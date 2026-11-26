#!/usr/bin/env python3
"""Checks for the signed iPhone + Apple Watch TestFlight workflow.

The upload is internal TestFlight processing only. It does not submit the app
for App Review and it does not select a build on the App Store version that is
already in review. app.json marketing version is 1.0.1. The workflow_dispatch
build_number becomes CFBundleVersion on the iPhone app and the embedded watch app.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import os
import plistlib
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("ci_tvos_signing", ROOT / "ci-tvos-signing.py")
tvos = importlib.util.module_from_spec(_spec)
sys.modules["ci_tvos_signing"] = tvos
_spec.loader.exec_module(tvos)

TEAM_ID = tvos.TEAM_ID
PHONE_BUNDLE = "com.garrettscales.americana"
WATCH_BUNDLE = "com.garrettscales.americana.watchkitapp"
ASC_APP_ID = tvos.ASC_APP_ID
IOS_MARKETING = "1.0.1"
# The last iPhone + watch TestFlight upload is build 23. The next CFBundleVersion
# must be higher, including on the 1.0.1 train.
LAST_TESTFLIGHT_BUILD = 23
BUILD_NUMBER_RE = tvos.BUILD_NUMBER_RE
FORBIDDEN_MARK = tvos.FORBIDDEN_MARK
PHONE_PLATFORMS = {"ios", "iphoneos"}
WATCH_PLATFORMS = {"watchos", "ios", "iphoneos"}
TVOS_PLATFORMS = {"tvos", "appletvos", "com.apple.platform.appletvos"}
REQUIRED_SECRETS = (
    "APPLE_CERTIFICATE_BASE64",
    "APPLE_CERTIFICATE_PASSWORD",
    "IOS_APP_PROFILE_BASE64",
    "WATCH_APP_PROFILE_BASE64",
    "APP_STORE_CONNECT_KEY_ID",
    "APP_STORE_CONNECT_ISSUER_ID",
    "APP_STORE_CONNECT_API_KEY_P8",
)
fail = tvos.fail
quote_pbx = tvos.quote_pbx
iter_build_settings = tvos.iter_build_settings
upsert_setting = tvos.upsert_setting
signing_identity_value = tvos.signing_identity_value
load_plist = tvos.load_plist
append_github_env = tvos.append_github_env
write_shell_env = tvos.write_shell_env
decode_secret = tvos.decode_secret
normalize_p8 = tvos.normalize_p8
write_api_key = tvos.write_api_key
distribution_identity_name = tvos.distribution_identity_name
discover_prebuild = tvos.discover_prebuild
repo_root = tvos.repo_root


def normalize_ios_build_number(value: str) -> str:
    """A CFBundleVersion newer than the last iPhone TestFlight upload."""
    text = value.strip()
    if not BUILD_NUMBER_RE.fullmatch(text):
        fail(
            "build_number must be a positive integer CFBundleVersion with no leading zero "
            f"(got {text!r})"
        )
    if int(text) <= LAST_TESTFLIGHT_BUILD:
        fail(
            f"build_number must be greater than {LAST_TESTFLIGHT_BUILD}. "
            f"iOS 1.0 ({LAST_TESTFLIGHT_BUILD}) is already on TestFlight."
        )
    return text


def read_ios_build_number() -> str:
    raw = os.environ.get("IOS_BUILD_NUMBER")
    if raw is None or not raw.strip():
        fail("IOS_BUILD_NUMBER is required")
    return normalize_ios_build_number(raw)


def assert_repo_identity(root: Path) -> None:
    """Refuse a tree whose App Store ids drifted. Do not rewrite app.json."""
    if os.environ.get("EXPO_TV") in {"1", "true"}:
        fail("iPhone signing refuses EXPO_TV. Prebuild the iPhone app with EXPO_TV unset.")
    app = tvos.json.loads((root / "app.json").read_text())
    expo = app["expo"]
    if expo.get("name") != "Anthem Gym Timer":
        fail(f"app.json name is {expo.get('name')!r}, expected Anthem Gym Timer")
    if expo.get("version") != IOS_MARKETING:
        fail(f"app.json version is {expo.get('version')!r}, expected {IOS_MARKETING}")
    bundle = expo.get("ios", {}).get("bundleIdentifier")
    if bundle != PHONE_BUNDLE:
        fail(f"app.json bundle id is {bundle!r}, expected {PHONE_BUNDLE}")
    eas = tvos.json.loads((root / "eas.json").read_text())
    submit = eas["submit"]["production-ios"]["ios"]
    if submit.get("ascAppId") != ASC_APP_ID:
        fail(f"eas.json ascAppId is {submit.get('ascAppId')!r}, expected {ASC_APP_ID}")
    if submit.get("appleTeamId") != TEAM_ID:
        fail(f"eas.json appleTeamId is {submit.get('appleTeamId')!r}, expected {TEAM_ID}")


def _platforms(plist: dict) -> set[str]:
    raw = plist.get("Platform", [])
    if isinstance(raw, str):
        values = [raw]
    elif isinstance(raw, list):
        values = [str(item) for item in raw]
    else:
        fail("Provisioning profile Platform is not a string or array")
        return set()
    return {item.lower() for item in values}


def validate_profile(plist: dict, expected_bundle: str):
    """App Store distribution profile for one bundle id on team BNP9QFC679."""
    teams = plist.get("TeamIdentifier")
    if teams != [TEAM_ID]:
        fail(f"Provisioning profile team must be {TEAM_ID} only")
    entitlements = plist.get("Entitlements")
    if not isinstance(entitlements, dict):
        fail("Provisioning profile is missing Entitlements")
    app_id = entitlements.get("application-identifier")
    expected_app_id = f"{TEAM_ID}.{expected_bundle}"
    if app_id != expected_app_id:
        fail(f"Provisioning profile application-identifier must be {expected_app_id}")
    if entitlements.get("com.apple.developer.team-identifier") != TEAM_ID:
        fail(f"Provisioning profile entitlement team must be {TEAM_ID}")
    if entitlements.get("get-task-allow") is not False:
        fail("Provisioning profile is not an App Store distribution profile (get-task-allow)")
    if "ProvisionedDevices" in plist:
        fail("Provisioning profile lists devices. App Store distribution profiles do not.")
    if plist.get("ProvisionsAllDevices") is True:
        fail("Refusing an enterprise provisioning profile")
    name = plist.get("Name")
    uuid = plist.get("UUID")
    if not isinstance(name, str) or not name.strip() or "\n" in name or "\r" in name:
        fail("Provisioning profile name is missing or not a single line")
    if not isinstance(uuid, str) or not tvos.UUID_RE.fullmatch(uuid):
        fail("Provisioning profile UUID is missing or not a UUID")
    blob = " ".join(str(plist.get(key, "")) for key in ("Name", "TeamName", "AppIDName"))
    if FORBIDDEN_MARK in blob.lower():
        fail("Refusing a provisioning profile whose name or team mentions PushPress")
    team_name = plist.get("TeamName")
    if isinstance(team_name, str) and team_name and "inversion" not in team_name.lower():
        fail("Provisioning profile TeamName must be CrossFit Inversion LLC")
    platforms = _platforms(plist)
    if platforms & TVOS_PLATFORMS and not (platforms & (PHONE_PLATFORMS | {"watchos"})):
        fail("Refusing a tvOS provisioning profile for the iPhone archive")
    if expected_bundle == WATCH_BUNDLE:
        if not (platforms & WATCH_PLATFORMS):
            fail("Watch provisioning profile is not an iOS or watchOS profile")
    elif not (platforms & PHONE_PLATFORMS) or platforms == {"watchos"}:
        fail("iPhone provisioning profile is not an iOS profile")
    if tvos._expired(plist.get("ExpirationDate")):
        fail("Provisioning profile is expired")
    return tvos.Profile(name=name, uuid=uuid, team_id=TEAM_ID, bundle_id=expected_bundle)


def settings_block_has_bundle(block: str, bundle_id: str) -> bool:
    return (
        re.search(
            rf'PRODUCT_BUNDLE_IDENTIFIER = "?{re.escape(bundle_id)}"?[ \t]*;',
            block,
        )
        is not None
    )


def _apply_to_bundles(text: str, mutate) -> tuple[str, dict[str, int]]:
    counts = {PHONE_BUNDLE: 0, WATCH_BUNDLE: 0}
    pieces: list[str] = []
    cursor = 0
    for start, end in iter_build_settings(text):
        pieces.append(text[cursor:start])
        block = text[start : end + 1]
        cursor = end + 1
        matched = None
        for bundle_id in (WATCH_BUNDLE, PHONE_BUNDLE):
            if settings_block_has_bundle(block, bundle_id):
                matched = bundle_id
                break
        if matched is None:
            pieces.append(block)
            continue
        block = mutate(block, matched)
        counts[matched] += 1
        pieces.append(block)
    pieces.append(text[cursor:])
    for bundle_id, count in counts.items():
        if count == 0:
            fail(f"No Xcode build configuration contains {bundle_id}")
    return "".join(pieces), counts


def apply_versions(text: str, build_number: str) -> tuple[str, dict[str, int]]:
    """Give the iPhone app and the watch app the same marketing version and build."""
    build = normalize_ios_build_number(build_number)

    def mutate(block: str, _bundle: str) -> str:
        block = upsert_setting(block, "CURRENT_PROJECT_VERSION", build)
        block = upsert_setting(block, "MARKETING_VERSION", IOS_MARKETING)
        if "INFOPLIST_KEY_CFBundleShortVersionString" in block:
            block = upsert_setting(block, "INFOPLIST_KEY_CFBundleShortVersionString", IOS_MARKETING)
        if "INFOPLIST_KEY_CFBundleVersion" in block:
            block = upsert_setting(block, "INFOPLIST_KEY_CFBundleVersion", build)
        return block

    return _apply_to_bundles(text, mutate)


def apply_manual_signing(
    text: str,
    ios_profile: str,
    watch_profile: str,
    identity: str,
    build_number: str,
) -> tuple[str, dict[str, int]]:
    """Manual distribution signing. Each bundle keeps its own profile."""
    build = normalize_ios_build_number(build_number)
    identity_value = signing_identity_value(identity)
    quoted_identity = quote_pbx(identity_value)
    profiles = {PHONE_BUNDLE: ios_profile, WATCH_BUNDLE: watch_profile}
    sdk_keys = {
        PHONE_BUNDLE: '"CODE_SIGN_IDENTITY[sdk=iphoneos*]"',
        WATCH_BUNDLE: '"CODE_SIGN_IDENTITY[sdk=watchos*]"',
    }
    for name in profiles.values():
        if "\n" in name or "\r" in name:
            fail("Profile name is not a single line")

    def mutate(block: str, bundle_id: str) -> str:
        settings = {
            "CODE_SIGN_STYLE": "Manual",
            "DEVELOPMENT_TEAM": TEAM_ID,
            "CODE_SIGN_IDENTITY": quoted_identity,
            sdk_keys[bundle_id]: quoted_identity,
            "PROVISIONING_PROFILE_SPECIFIER": quote_pbx(profiles[bundle_id]),
            "CURRENT_PROJECT_VERSION": build,
            "MARKETING_VERSION": IOS_MARKETING,
            "PRODUCT_BUNDLE_IDENTIFIER": f'"{bundle_id}"',
        }
        for key, value in settings.items():
            block = upsert_setting(block, key, value)
        return block

    return _apply_to_bundles(text, mutate)


def export_options(ios_profile: str, watch_profile: str, identity: str = "Apple Distribution") -> dict:
    """Local App Store export. destination=export does not upload or submit."""
    return {
        "method": "app-store-connect",
        "destination": "export",
        "signingStyle": "manual",
        "signingCertificate": signing_identity_value(identity),
        "teamID": TEAM_ID,
        "provisioningProfiles": {
            PHONE_BUNDLE: ios_profile,
            WATCH_BUNDLE: watch_profile,
        },
        "manageAppVersionAndBuildNumber": False,
        "stripSwiftSymbols": True,
        "uploadSymbols": False,
    }


def write_export_plist(path: Path, ios_profile: str, watch_profile: str, identity: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as handle:
        plistlib.dump(export_options(ios_profile, watch_profile, identity), handle, fmt=plistlib.FMT_XML)


def _phone_plist(ios_dir: Path) -> Path:
    info_files = [
        path
        for path in sorted(ios_dir.glob("*/Info.plist"))
        if path.parent.name != "Pods" and (path.parent / "AppDelegate.swift").is_file()
    ]
    if len(info_files) != 1:
        fail(f"Expected one iPhone Info.plist next to AppDelegate.swift, found {len(info_files)}")
    return info_files[0]


def _watch_plist(root: Path) -> Path:
    path = root / "targets" / "watch" / "Info.plist"
    if not path.is_file():
        fail("targets/watch/Info.plist is missing")
    return path


def apply_phone_plist(path: Path, build_number: str) -> None:
    plist = load_plist(path)
    short = str(plist.get("CFBundleShortVersionString"))
    if short != IOS_MARKETING:
        fail(
            f"iPhone Info.plist CFBundleShortVersionString is {short!r}, expected {IOS_MARKETING}. "
            "This workflow does not change the marketing version."
        )
    plist["CFBundleVersion"] = build_number
    with path.open("wb") as handle:
        plistlib.dump(plist, handle, fmt=plistlib.FMT_XML)


def assert_watch_plist(path: Path) -> None:
    plist = load_plist(path)
    short = str(plist.get("CFBundleShortVersionString"))
    build = str(plist.get("CFBundleVersion"))
    if short not in {IOS_MARKETING, "$(MARKETING_VERSION)"}:
        fail(f"Watch Info.plist marketing version is {short!r}, expected {IOS_MARKETING}")
    if build not in {"$(CURRENT_PROJECT_VERSION)"} and build != os.environ.get("IOS_BUILD_NUMBER", "").strip():
        fail("Watch Info.plist CFBundleVersion must track CURRENT_PROJECT_VERSION")
    if plist.get("WKCompanionAppBundleIdentifier") != PHONE_BUNDLE:
        fail("Watch companion bundle id must be the iPhone app")
    if plist.get("CFBundleIdentifier") not in {None, "$(PRODUCT_BUNDLE_IDENTIFIER)", WATCH_BUNDLE}:
        fail(f"Watch CFBundleIdentifier is {plist.get('CFBundleIdentifier')!r}")
    if plist.get("CFBundleIconName") != "AppIcon":
        fail("Watch Info.plist CFBundleIconName must be AppIcon")


def assert_watch_app_icon(project_text: str) -> None:
    """The watch target compiles AppIcon.appiconset, not a phone icon slot."""
    blocks = [
        block
        for block in re.findall(r"buildSettings = \{([^}]*)\}", project_text)
        if re.search(rf'PRODUCT_BUNDLE_IDENTIFIER = "?{re.escape(WATCH_BUNDLE)}"?\s*;', block)
    ]
    if len(blocks) < 2:
        fail(f"Expected Debug and Release watch build settings, found {len(blocks)}")
    for block in blocks:
        if not re.search(r'ASSETCATALOG_COMPILER_APPICON_NAME = "?AppIcon"?\s*;', block):
            fail("Watch target ASSETCATALOG_COMPILER_APPICON_NAME must be AppIcon so the 1024 icon ships")


def verify_prebuild(root: Path, ios_dir: Path) -> dict[str, str]:
    assert_repo_identity(root)
    build = read_ios_build_number()
    pbx_files = sorted(ios_dir.glob("*.xcodeproj/project.pbxproj"))
    if len(pbx_files) != 1:
        fail("Expected one project.pbxproj")
    project_text = pbx_files[0].read_text()
    if "SDKROOT = appletvos;" in project_text and "SDKROOT = iphoneos;" not in project_text:
        fail("expo prebuild produced a tvOS project. iPhone signing requires EXPO_TV unset.")
    if "WATCHOS_DEPLOYMENT_TARGET" not in project_text:
        fail("iPhone prebuild is missing the embedded watch target")
    bundle_ids = set(re.findall(r'PRODUCT_BUNDLE_IDENTIFIER = "?([^";\s]+)"?;', project_text))
    expected = {PHONE_BUNDLE, WATCH_BUNDLE}
    if bundle_ids != expected:
        fail(f"Unexpected PRODUCT_BUNDLE_IDENTIFIER values: {sorted(bundle_ids)}")
    project_text, counts = apply_versions(project_text, build)
    assert_watch_app_icon(project_text)
    pbx_files[0].write_text(project_text)
    phone_plist = _phone_plist(ios_dir)
    apply_phone_plist(phone_plist, build)
    assert_watch_plist(_watch_plist(root))
    if counts[PHONE_BUNDLE] < 1 or counts[WATCH_BUNDLE] < 1:
        fail("iPhone and watch build numbers were not both updated")
    workspace, scheme = discover_prebuild(ios_dir)
    print(
        f"iPhone and watch CFBundleVersion={build} CFBundleShortVersionString={IOS_MARKETING} "
        f"(app.json version remains {IOS_MARKETING})"
    )
    print(f"workspace={workspace}")
    print(f"scheme={scheme.stem}")
    return {
        "WORKSPACE": str(workspace),
        "SCHEME": scheme.stem,
        "IOS_BUILD_NUMBER": build,
        "MARKETING_VERSION": IOS_MARKETING,
        "SOURCE_MARKETING_VERSION": IOS_MARKETING,
        "BUNDLE_ID": PHONE_BUNDLE,
        "WATCH_BUNDLE_ID": WATCH_BUNDLE,
        "APPLE_TEAM_ID_EXPECTED": TEAM_ID,
        "ASC_APP_ID": ASC_APP_ID,
    }


def check_env() -> None:
    build = read_ios_build_number()
    print(f"iOS marketing version {IOS_MARKETING}. CFBundleVersion {build} for the iPhone app and the watch app.")
    team = os.environ.get("APPLE_TEAM_ID", "").strip()
    if team and team != TEAM_ID:
        fail(f"APPLE_TEAM_ID must be {TEAM_ID} (CrossFit Inversion LLC). Refusing any other team.")
    missing = [name for name in REQUIRED_SECRETS if not os.environ.get(name, "").strip()]
    if missing:
        fail("Missing GitHub secret " + ", ".join(missing))
    decode_secret("APPLE_CERTIFICATE_BASE64")
    decode_secret("IOS_APP_PROFILE_BASE64")
    decode_secret("WATCH_APP_PROFILE_BASE64")
    key_id = os.environ["APP_STORE_CONNECT_KEY_ID"].strip()
    issuer = os.environ["APP_STORE_CONNECT_ISSUER_ID"].strip()
    if not tvos.KEY_ID_RE.fullmatch(key_id):
        fail("APP_STORE_CONNECT_KEY_ID has an unexpected shape")
    if not tvos.ISSUER_RE.fullmatch(issuer):
        fail("APP_STORE_CONNECT_ISSUER_ID has an unexpected shape")
    normalize_p8(os.environ["APP_STORE_CONNECT_API_KEY_P8"])
    print(f"Secrets are present. Signing team is fixed to {TEAM_ID}. Upload does not submit for review.")


def assert_codesign(text: str, bundle_id: str) -> None:
    identifier = re.findall(r"^Identifier=(.+)$", text, re.MULTILINE)
    teams = re.findall(r"^TeamIdentifier=(.+)$", text, re.MULTILINE)
    if identifier != [bundle_id]:
        fail(f"Signed bundle id must be {bundle_id}")
    if teams != [TEAM_ID]:
        fail(f"Signed TeamIdentifier must be {TEAM_ID} only")
    if FORBIDDEN_MARK in text.lower():
        fail("Refusing a signature that mentions PushPress")
    authorities = [line.split("=", 1)[1] for line in text.splitlines() if line.startswith("Authority=")]
    if not any(
        ("Apple Distribution" in line or "iPhone Distribution" in line) and TEAM_ID in line
        for line in authorities
    ):
        fail(f"Signature authority must be a distribution certificate for {TEAM_ID}")


def verify_built_plist(plist: dict, bundle_id: str, build_number: str, platform: str) -> None:
    if str(plist.get("CFBundleVersion")) != build_number:
        fail(f"{bundle_id} CFBundleVersion is {plist.get('CFBundleVersion')!r}, expected {build_number}")
    if plist.get("CFBundleIdentifier") != bundle_id:
        fail(f"Built CFBundleIdentifier is {plist.get('CFBundleIdentifier')!r}, expected {bundle_id}")
    if str(plist.get("CFBundleShortVersionString")) != IOS_MARKETING:
        fail(
            f"{bundle_id} CFBundleShortVersionString is "
            f"{plist.get('CFBundleShortVersionString')!r}, expected {IOS_MARKETING}"
        )
    name = plist.get("DTPlatformName")
    if name in {"appletvos", "appletvsimulator"}:
        fail(f"{bundle_id} was built for Apple TV")
    if name not in {platform, None} and platform == "iphoneos" and name != "iphoneos":
        fail(f"{bundle_id} DTPlatformName is {name!r}, expected {platform}")


def decoded_profile_destination(app: Path) -> Path:
    """A new plist path outside every bundle.

    The watch app lives at Americana.app/Watch/AmericanaWatch.app. Decoding its
    profile next to that bundle writes Americana.app/Watch/*.plist into the
    already-signed iPhone app and breaks the outer seal.
    """
    fd, name = tempfile.mkstemp(prefix=f"{app.stem}-embedded-", suffix=".plist")
    os.close(fd)
    return Path(name)


def path_is_inside(path: Path, bundle: Path) -> bool:
    try:
        path.resolve().relative_to(bundle.resolve())
    except ValueError:
        return False
    return True


def containing_bundle(path: Path) -> Path | None:
    """The outermost .app, .appex, or .framework that contains path."""
    current = path.resolve().parent
    found = None
    while current != current.parent:
        if current.suffix in {".app", ".appex", ".framework"}:
            found = current
        current = current.parent
    return found


def _resource_entries(resources: dict) -> dict:
    files2 = resources.get("files2")
    if isinstance(files2, dict) and files2:
        return files2
    files = resources.get("files")
    return files if isinstance(files, dict) else {}


def _nested_prefixes(entries: dict) -> list[str]:
    prefixes = []
    for rel, info in entries.items():
        if isinstance(info, dict) and ("cdhash" in info or info.get("requirement")):
            prefixes.append(rel.strip("/") + "/")
    return prefixes


def seal_problems(app: Path) -> list[str]:
    """Read-only comparison of _CodeSignature/CodeResources to the bundle on disk."""
    signature = app / "_CodeSignature" / "CodeResources"
    if not signature.is_file():
        return [f"{app.name} is missing _CodeSignature/CodeResources"]
    entries = _resource_entries(load_plist(signature))
    nested = _nested_prefixes(entries)
    problems: list[str] = []
    sealed: set[str] = set()
    for rel, info in entries.items():
        rel = str(rel)
        sealed.add(rel)
        target = app / rel
        if isinstance(info, dict) and ("cdhash" in info or info.get("requirement")):
            if not target.exists():
                problems.append(f"nested code missing: {rel}")
            continue
        optional = isinstance(info, dict) and bool(info.get("optional"))
        if isinstance(info, dict) and "symlink" in info:
            if target.is_symlink():
                if os.readlink(target) != info["symlink"]:
                    problems.append(f"symlink mismatch: {rel}")
            elif not optional:
                problems.append(f"symlink missing: {rel}")
            continue
        digest = info
        algo = "sha1"
        if isinstance(info, dict):
            if "hash2" in info:
                digest = info["hash2"]
                algo = "sha256"
            elif "hash" in info:
                digest = info["hash"]
            else:
                continue
        if not isinstance(digest, (bytes, bytearray)):
            problems.append(f"unreadable seal entry: {rel}")
            continue
        if not target.exists():
            if not optional:
                problems.append(f"file missing: {rel}")
            continue
        if target.is_symlink():
            problems.append(f"symlink where a file was sealed: {rel}")
            continue
        if not target.is_file():
            problems.append(f"sealed path is not a file: {rel}")
            continue
        actual = hashlib.new(algo, target.read_bytes()).digest()
        if actual != bytes(digest):
            problems.append(f"file modified: {rel}")
    executable = ""
    info_plist = app / "Info.plist"
    if info_plist.is_file():
        executable = str(load_plist(info_plist).get("CFBundleExecutable") or "")
    for dirpath, dirnames, filenames in os.walk(app, followlinks=False):
        current = Path(dirpath)
        rel_dir = "" if current == app else _posix_rel(app, current)
        if rel_dir == "_CodeSignature" or rel_dir.startswith("_CodeSignature/"):
            dirnames[:] = []
            continue
        kept = []
        for name in dirnames:
            child = f"{rel_dir}/{name}" if rel_dir else name
            if any(child == prefix[:-1] or child.startswith(prefix) for prefix in nested):
                continue
            kept.append(name)
        dirnames[:] = kept
        for name in filenames:
            rel = f"{rel_dir}/{name}" if rel_dir else name
            if rel.startswith("_CodeSignature/") or rel in sealed or rel == executable:
                continue
            if any(rel.startswith(prefix) for prefix in nested):
                continue
            problems.append(f"file added: {rel}")
    return problems


def _posix_rel(root: Path, path: Path) -> str:
    return path.relative_to(root).as_posix()


def _run_codesign(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, check=False, capture_output=True, text=True)


def _command_text(result: subprocess.CompletedProcess[str]) -> str:
    return (result.stdout or "") + (result.stderr or "")


def _signed_children(directory: Path) -> list[Path]:
    if not directory.is_dir():
        return []
    found = []
    for child in sorted(directory.iterdir()):
        if child.suffix in {".framework", ".app", ".appex"} and (child / "_CodeSignature").is_dir():
            found.append(child)
    return found


def _check_bundle(bundle: Path, bundle_id: str | None, errors: list[str]) -> None:
    label = str(bundle)
    problems = seal_problems(bundle)
    if problems:
        sys.stderr.write(f"CodeResources mismatch in {label}:\n")
        for problem in problems:
            sys.stderr.write(f"  {problem}\n")
        # "file added" is printed so the log names it. codesign --strict is the
        # gate for that case, because stock seal rules omit a few filenames.
        hard = [problem for problem in problems if not problem.startswith("file added:")]
        if hard:
            errors.append(f"CodeResources mismatch in {bundle.name}")
    else:
        sys.stderr.write(f"CodeResources matches {label}\n")
    details = _run_codesign(["codesign", "-dv", "--verbose=4", str(bundle)])
    detail_text = _command_text(details)
    if bundle_id is not None:
        identity = None
        try:
            assert_codesign(detail_text, bundle_id)
        except SystemExit as exc:
            identity = str(exc).removeprefix("::error::")
        if identity:
            sys.stderr.write(detail_text)
            errors.append(identity)
    verified = _run_codesign(["codesign", "--verify", "--strict", "--verbose=4", str(bundle)])
    if details.returncode != 0 or verified.returncode != 0:
        sys.stderr.write(f"codesign --verify --strict --verbose=4 {label}\n")
        sys.stderr.write(detail_text)
        sys.stderr.write(_command_text(verified))
        errors.append(f"codesign --verify --strict failed for {bundle.name}")
    else:
        sys.stderr.write(f"codesign --verify --strict passed for {label}\n")


def _embedded_profile(app: Path, expected_bundle: str) -> None:
    profile = app / "embedded.mobileprovision"
    if not profile.is_file():
        fail(f"{expected_bundle} is missing embedded.mobileprovision")
    decoded = decoded_profile_destination(app)
    host = containing_bundle(decoded)
    if host is not None:
        decoded.unlink(missing_ok=True)
        fail(f"Refusing to decode a profile inside {host.name}")
    try:
        decode = subprocess.run(
            ["security", "cms", "-D", "-i", str(profile), "-o", str(decoded)],
            check=False,
            capture_output=True,
            text=True,
        )
        if decode.returncode != 0 or not decoded.is_file():
            fail(f"Could not decode the provisioning profile embedded in {expected_bundle}")
        validate_profile(load_plist(decoded), expected_bundle)
    finally:
        decoded.unlink(missing_ok=True)


def verify_built_app(app: Path, root: Path) -> None:
    """Check the exported app without writing into it or re-signing it.

    codesign -dv and codesign --verify do not sign. Profile decoding goes to a
    temporary file outside the bundle. --deep --strict on the iPhone app remains
    the gate; inner bundles are checked first so a failure names its bundle.
    """
    assert_repo_identity(root)
    build = read_ios_build_number()
    phone = load_plist(app / "Info.plist")
    verify_built_plist(phone, PHONE_BUNDLE, build, "iphoneos")
    watches = sorted(path for path in (app / "Watch").glob("*.app") if path.is_dir()) if (app / "Watch").is_dir() else []
    if len(watches) != 1:
        fail(f"Expected one embedded watch app, found {len(watches)}")
    watch = watches[0]
    verify_built_plist(load_plist(watch / "Info.plist"), WATCH_BUNDLE, build, "watchos")
    _embedded_profile(app, PHONE_BUNDLE)
    _embedded_profile(watch, WATCH_BUNDLE)
    errors: list[str] = []
    for embedded in watches:
        _check_bundle(embedded, WATCH_BUNDLE, errors)
    for folder in ("Frameworks", "PlugIns"):
        for embedded in _signed_children(app / folder):
            _check_bundle(embedded, None, errors)
    _check_bundle(app, PHONE_BUNDLE, errors)
    deep = _run_codesign(["codesign", "--verify", "--deep", "--strict", "--verbose=4", str(app)])
    if deep.returncode != 0:
        sys.stderr.write(f"codesign --verify --deep --strict --verbose=4 {app}\n")
        sys.stderr.write(_command_text(deep))
        traced = _run_codesign(["codesign", "--verify", "--deep", "--strict", "-vvvv", str(app)])
        sys.stderr.write(f"codesign --verify --deep --strict -vvvv {app}\n")
        sys.stderr.write(_command_text(traced))
        errors.append(f"codesign --verify --deep --strict failed for {PHONE_BUNDLE}")
    if errors:
        fail("; ".join(errors))
    print(
        f"Signed {PHONE_BUNDLE} and {WATCH_BUNDLE} build {build} ({IOS_MARKETING}) "
        f"for team {TEAM_ID}. Not submitted for App Review."
    )


def prepare_logs(source_dir: Path, dest_dir: Path, tail_lines: int = 200) -> None:
    extra = [os.environ.get(name, "") for name in REQUIRED_SECRETS]
    extra.append(os.environ.get("APPLE_TEAM_ID", ""))
    previous = {name: os.environ.get(name) for name in tvos.REQUIRED_SECRETS}
    # Reuse the tvOS redaction, and also mask the iPhone and watch profiles.
    os.environ["APPLE_PROVISION_PROFILE_BASE64"] = (
        os.environ.get("IOS_APP_PROFILE_BASE64", "") + os.environ.get("WATCH_APP_PROFILE_BASE64", "")
    )
    try:
        tvos.prepare_log_artifact(source_dir, dest_dir, tail_lines)
    finally:
        for name, value in previous.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value
    if dest_dir.is_dir():
        for path in dest_dir.glob("*.log"):
            text = path.read_text(errors="replace")
            path.write_text(tvos.redact(text, extra))


def cmd_verify_prebuild(args: argparse.Namespace) -> None:
    pairs = verify_prebuild(Path(args.repo).resolve(), Path(args.ios_dir).resolve())
    for key in ("ASC_APP_ID", "BUNDLE_ID"):
        current = os.environ.get(key, "").strip()
        if current and current != pairs[key]:
            fail(f"Workflow {key} is {current}, expected {pairs[key]}")
    append_github_env(pairs)
    if args.env_file:
        write_shell_env(Path(args.env_file), pairs)


def cmd_inspect_profile(args: argparse.Namespace) -> None:
    expected = PHONE_BUNDLE if args.kind == "ios" else WATCH_BUNDLE
    profile = validate_profile(load_plist(Path(args.plist)), expected)
    prefix = "IOS" if args.kind == "ios" else "WATCH"
    pairs = {f"{prefix}_PROFILE_NAME": profile.name, f"{prefix}_PROFILE_UUID": profile.uuid}
    if args.github_env:
        os.environ["GITHUB_ENV"] = args.github_env
        append_github_env(pairs)
    if args.env_file:
        write_shell_env(Path(args.env_file), pairs)
    print(f"{prefix} profile name={profile.name}")
    print(f"{prefix} profile uuid={profile.uuid}")
    print(f"{prefix} profile team={profile.team_id} bundle={profile.bundle_id}")


def cmd_apply_signing(args: argparse.Namespace) -> None:
    path = Path(args.pbx)
    if "Pods" in path.parts:
        fail("Refusing to edit a Pods project")
    build = read_ios_build_number()
    updated, counts = apply_manual_signing(
        path.read_text(),
        args.ios_profile,
        args.watch_profile,
        signing_identity_value(args.identity),
        build,
    )
    path.write_text(updated)
    print(
        "Set manual signing on "
        f"{counts[PHONE_BUNDLE]} iPhone and {counts[WATCH_BUNDLE]} watch configuration(s)"
    )


def cmd_write_export_plist(args: argparse.Namespace) -> None:
    write_export_plist(Path(args.out), args.ios_profile, args.watch_profile, args.identity)
    print(f"Wrote {Path(args.out).name} (method=app-store-connect destination=export, two profiles)")


def cmd_check_env(_args: argparse.Namespace) -> None:
    check_env()


def cmd_verify_built_app(args: argparse.Namespace) -> None:
    verify_built_app(Path(args.app), Path(args.repo).resolve())


def cmd_prepare_logs(args: argparse.Namespace) -> None:
    prepare_logs(Path(args.source), Path(args.dest), args.tail)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)

    verify = sub.add_parser("verify-prebuild")
    verify.add_argument("--repo", default=str(repo_root()))
    verify.add_argument("--ios-dir", default="ios")
    verify.add_argument("--env-file")
    verify.set_defaults(func=cmd_verify_prebuild)

    inspect = sub.add_parser("inspect-profile")
    inspect.add_argument("--plist", required=True)
    inspect.add_argument("--kind", choices=("ios", "watch"), required=True)
    inspect.add_argument("--github-env")
    inspect.add_argument("--env-file")
    inspect.set_defaults(func=cmd_inspect_profile)

    apply = sub.add_parser("apply-signing")
    apply.add_argument("--pbx", required=True)
    apply.add_argument("--ios-profile", required=True)
    apply.add_argument("--watch-profile", required=True)
    apply.add_argument("--identity", required=True)
    apply.set_defaults(func=cmd_apply_signing)

    export = sub.add_parser("write-export-plist")
    export.add_argument("--ios-profile", required=True)
    export.add_argument("--watch-profile", required=True)
    export.add_argument("--identity", required=True)
    export.add_argument("--out", required=True)
    export.set_defaults(func=cmd_write_export_plist)

    decode = sub.add_parser("decode-secret")
    decode.add_argument("--env", required=True)
    decode.add_argument("--out", required=True)
    decode.set_defaults(func=tvos.cmd_decode_secret)

    identity = sub.add_parser("assert-identity")
    identity.add_argument("--file")
    identity.add_argument("--github-env")
    identity.add_argument("--env-file")
    identity.set_defaults(func=tvos.cmd_assert_identity)

    check = sub.add_parser("check-env")
    check.set_defaults(func=cmd_check_env)

    key = sub.add_parser("write-api-key")
    key.add_argument("--dir", required=True)
    key.set_defaults(func=tvos.cmd_write_api_key)

    logs = sub.add_parser("prepare-logs")
    logs.add_argument("--source", required=True)
    logs.add_argument("--dest", required=True)
    logs.add_argument("--tail", type=int, default=200)
    logs.set_defaults(func=cmd_prepare_logs)

    built = sub.add_parser("verify-built-app")
    built.add_argument("--app", required=True)
    built.add_argument("--repo", default=str(repo_root()))
    built.set_defaults(func=cmd_verify_built_app)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    args.func(args)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except BrokenPipeError:
        raise SystemExit(1)
