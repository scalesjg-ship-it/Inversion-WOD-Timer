#!/usr/bin/env python3
"""Checks for the signed Apple TV TestFlight workflow.

The workflow calls this for values that must match the repo (team, bundle id,
tvOS build number) and for files that must never be printed (certificates,
profiles, the App Store Connect private key). It applies the tvOS marketing
version and build number from workflow_dispatch to the prebuild only. It does
not write app.json, and it does not submit an app for review.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import plistlib
import re
import shlex
import subprocess
import sys
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

TEAM_ID = "BNP9QFC679"
BUNDLE_ID = "com.garrettscales.americana"
ASC_APP_ID = "6833266123"
# tvOS 1.0 build 22 is approved and live. App Store Connect error 90062
# rejects another upload whose CFBundleShortVersionString is 1.0.0.
APPROVED_TVOS_MARKETING = (1, 0, 0)
MARKETING_VERSION_RE = re.compile(r"(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*)){1,2}")
# Committed fallback in plugins/withTvBuildNumber.js. workflow_dispatch input
# build_number arrives as TVOS_BUILD_NUMBER and replaces this for an upload.
PLUGIN_TVOS_BUILD_NUMBER = "24"
BUILD_NUMBER_RE = re.compile(r"^[1-9]\d{0,8}$")
# Marketing versions that already have a VALID build on App Store Connect.
TVOS_BUILD_ALREADY_UPLOADED = {"1.0.1": 23}
FORBIDDEN_MARK = "pushpress"
TVOS_PLATFORMS = {"tvos", "appletvos", "com.apple.platform.appletvos"}
UUID_RE = re.compile(
    r"^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$"
)
KEY_ID_RE = re.compile(r"^[A-Za-z0-9]{8,32}$")
ISSUER_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
REQUIRED_SECRETS = (
    "APPLE_CERTIFICATE_BASE64",
    "APPLE_CERTIFICATE_PASSWORD",
    "APPLE_PROVISION_PROFILE_BASE64",
    "APP_STORE_CONNECT_KEY_ID",
    "APP_STORE_CONNECT_ISSUER_ID",
    "APP_STORE_CONNECT_API_KEY_P8",
)
PEM_RE = re.compile(
    r"-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----.*?-----END [A-Z0-9 ]*PRIVATE KEY-----",
    re.DOTALL,
)


def repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def fail(message: str) -> None:
    raise SystemExit(f"::error::{message}")


WATCH_SERVICE = "Americana-Timer"


def assert_watch_browse(plist: dict) -> None:
    """The generated tvOS Info.plist must browse the watch application service.

    Apple's DeviceDiscoveryUI article requires NSApplicationServices.Browses with
    the service identifier, a usage description, and NSApplicationServicePlatformSupport
    containing watchOS. No entitlement is required.
    """
    services = plist.get("NSApplicationServices")
    if not isinstance(services, dict):
        fail("tvOS Info.plist is missing NSApplicationServices")
    browses = services.get("Browses")
    if not isinstance(browses, list) or not browses:
        fail("tvOS Info.plist NSApplicationServices.Browses is empty")
    match = None
    for entry in browses:
        if isinstance(entry, dict) and entry.get("NSApplicationServiceIdentifier") == WATCH_SERVICE:
            match = entry
            break
    if match is None:
        fail(f"tvOS Info.plist does not browse {WATCH_SERVICE}")
    description = match.get("NSApplicationServiceUsageDescription")
    if not isinstance(description, str) or not description.strip():
        fail("tvOS Info.plist browse entry is missing NSApplicationServiceUsageDescription")
    platforms = match.get("NSApplicationServicePlatformSupport")
    if not isinstance(platforms, list) or "watchOS" not in platforms:
        fail(f"tvOS Info.plist platform support is {platforms!r}, expected watchOS")


def check_watch_browse(ios_dir: Path) -> None:
    info_files = [path for path in sorted(ios_dir.glob("*/Info.plist")) if path.parent.name != "Pods"]
    if not info_files:
        fail("Prebuild did not write an app Info.plist")
    checked = 0
    for path in info_files:
        plist = load_plist(path)
        bundle = plist.get("CFBundleIdentifier")
        if bundle not in (None, BUNDLE_ID, "$(PRODUCT_BUNDLE_IDENTIFIER)"):
            continue
        if "CFBundleExecutable" not in plist and "CFBundleIdentifier" not in plist and "NSApplicationServices" not in plist:
            continue
        assert_watch_browse(plist)
        checked += 1
        print(f"NSApplicationServices Browses {WATCH_SERVICE} for watchOS in {path}")
    if checked != 1:
        fail(f"Expected one tvOS Info.plist browsing {WATCH_SERVICE}, found {checked}")


def read_plugin_tvos_build_number(root: Path) -> str:
    """The committed default. The upload build can override it."""
    text = (root / "plugins" / "withTvBuildNumber.js").read_text()
    match = re.search(r"const TVOS_BUILD_NUMBER = '([^']+)';", text)
    if not match or not match.group(1).strip():
        fail("Could not read TVOS_BUILD_NUMBER from plugins/withTvBuildNumber.js")
    value = match.group(1).strip()
    if value != PLUGIN_TVOS_BUILD_NUMBER:
        fail(
            "plugins/withTvBuildNumber.js TVOS_BUILD_NUMBER is "
            f"{value!r}, expected {PLUGIN_TVOS_BUILD_NUMBER}"
        )
    return value


def normalize_build_number(value: str) -> str:
    """Accept a tvOS CFBundleVersion that can be passed to xcodebuild."""
    text = value.strip()
    if not BUILD_NUMBER_RE.fullmatch(text):
        fail(
            "build_number must be a positive integer CFBundleVersion with no leading zero "
            f"(got {text!r})"
        )
    return text


def reject_known_tvos_build(marketing: str, build: str) -> None:
    """Refuse a CFBundleVersion App Store Connect already accepted."""
    taken = TVOS_BUILD_ALREADY_UPLOADED.get(marketing)
    if taken is None or int(build) > taken:
        return
    fail(
        f"tvOS {marketing} ({taken}) is already VALID on App Store Connect. "
        f"CFBundleVersion {build} would collide. Use {taken + 1} or higher."
    )


def read_tvos_build_number(root: Path) -> str:
    """CFBundleVersion the tvOS plugin writes.

    workflow_dispatch input build_number is passed as TVOS_BUILD_NUMBER.
    When that variable is unset or blank, the plugin default is used.
    """
    read_plugin_tvos_build_number(root)
    raw = os.environ.get("TVOS_BUILD_NUMBER")
    if raw is None or not raw.strip():
        return PLUGIN_TVOS_BUILD_NUMBER
    return normalize_build_number(raw)


def assert_repo_identity(root: Path) -> str:
    """Return the marketing version. Refuse a tree whose ids drifted."""
    app = json.loads((root / "app.json").read_text())
    expo = app["expo"]
    if expo.get("name") != "Americana":
        fail(f"app.json name is {expo.get('name')!r}, expected Americana")
    bundle = expo.get("ios", {}).get("bundleIdentifier")
    if bundle != BUNDLE_ID:
        fail(f"app.json bundle id is {bundle!r}, expected {BUNDLE_ID}")
    version = str(expo.get("version") or "")
    if not version:
        fail("app.json expo.version is empty")
    eas = json.loads((root / "eas.json").read_text())
    submit = eas["submit"]["production-tvos"]["ios"]
    if submit.get("ascAppId") != ASC_APP_ID:
        fail(f"eas.json ascAppId is {submit.get('ascAppId')!r}, expected {ASC_APP_ID}")
    if submit.get("appleTeamId") != TEAM_ID:
        fail(f"eas.json appleTeamId is {submit.get('appleTeamId')!r}, expected {TEAM_ID}")
    # Pins the plugin default at 24 and validates TVOS_BUILD_NUMBER when set.
    read_tvos_build_number(root)
    return version


def version_key(value: str) -> tuple[int, ...]:
    return tuple(int(part) for part in value.split("."))


def normalize_marketing_version(value: str) -> str:
    """Accept a tvOS marketing version higher than the approved 1.0.0."""
    text = value.strip()
    if not MARKETING_VERSION_RE.fullmatch(text):
        fail(f"marketing_version must be a numeric version such as 1.0.1 (got {text!r})")
    parsed = version_key(text)
    width = max(len(parsed), len(APPROVED_TVOS_MARKETING))
    padded = parsed + (0,) * (width - len(parsed))
    approved = APPROVED_TVOS_MARKETING + (0,) * (width - len(APPROVED_TVOS_MARKETING))
    if padded <= approved:
        fail(
            "tvOS CFBundleShortVersionString must be higher than the approved version "
            f"1.0.0 (App Store Connect error 90062). Got {text}."
        )
    return text


def settings_block_has_bundle(block: str, bundle_id: str = BUNDLE_ID) -> bool:
    """True when this buildSettings block sets bundle_id and not a longer id."""
    return (
        re.search(
            rf'PRODUCT_BUNDLE_IDENTIFIER = "?{re.escape(bundle_id)}"?[ \t]*;',
            block,
        )
        is not None
    )


def apply_tvos_marketing_version(text: str, marketing_version: str) -> str:
    """Set MARKETING_VERSION on the tvOS Xcode project.

    ios/ in this workflow is the EXPO_TV=1 prebuild. Existing MARKETING_VERSION
    and INFOPLIST_KEY values in that project are updated. The Americana target
    gains MARKETING_VERSION when that build setting is missing.
    """
    version = normalize_marketing_version(marketing_version)
    pattern = re.compile(
        r"^([ \t]*)(?P<key>\"?(?:MARKETING_VERSION|INFOPLIST_KEY_CFBundleShortVersionString)\"?)"
        r"[ \t]*=[ \t]*.*;[ \t]*$",
        re.MULTILINE,
    )

    def replace(match: re.Match[str]) -> str:
        return f"{match.group(1)}{match.group('key')} = {version};"

    updated = pattern.sub(replace, text)
    pieces: list[str] = []
    cursor = 0
    targets = 0
    for start, end in iter_build_settings(updated):
        pieces.append(updated[cursor:start])
        block = updated[start : end + 1]
        cursor = end + 1
        if not settings_block_has_bundle(block):
            pieces.append(block)
            continue
        block = upsert_setting(block, "MARKETING_VERSION", version)
        if "INFOPLIST_KEY_CFBundleShortVersionString" in block:
            block = upsert_setting(block, "INFOPLIST_KEY_CFBundleShortVersionString", version)
        targets += 1
        pieces.append(block)
    pieces.append(updated[cursor:])
    if targets == 0:
        fail(f"No Xcode build configuration contains {BUNDLE_ID}")
    return "".join(pieces)


def load_plist(path: Path) -> dict:
    try:
        with path.open("rb") as handle:
            value = plistlib.load(handle)
    except (OSError, plistlib.InvalidFileException) as error:
        fail(f"Could not read plist {path.name}: {error.__class__.__name__}")
    if not isinstance(value, dict):
        fail(f"{path.name} is not a plist dictionary")
    return value


def _platforms(plist: dict) -> list[str]:
    raw = plist.get("Platform", [])
    if isinstance(raw, str):
        return [raw]
    if isinstance(raw, list):
        return [str(item) for item in raw]
    fail("Provisioning profile Platform is not a string or array")
    return []


def _expired(value: object) -> bool:
    if not isinstance(value, datetime):
        return False
    expiry = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return expiry <= datetime.now(timezone.utc)


@dataclass(frozen=True)
class Profile:
    name: str
    uuid: str
    team_id: str
    bundle_id: str


def validate_profile(plist: dict) -> Profile:
    """Accept only an App Store tvOS profile for CrossFit Inversion LLC."""
    teams = plist.get("TeamIdentifier")
    if teams != [TEAM_ID]:
        fail(f"Provisioning profile team must be {TEAM_ID} only")
    entitlements = plist.get("Entitlements")
    if not isinstance(entitlements, dict):
        fail("Provisioning profile is missing Entitlements")
    app_id = entitlements.get("application-identifier")
    expected_app_id = f"{TEAM_ID}.{BUNDLE_ID}"
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
    if not isinstance(uuid, str) or not UUID_RE.fullmatch(uuid):
        fail("Provisioning profile UUID is missing or not a UUID")
    blob = " ".join(
        str(plist.get(key, "")) for key in ("Name", "TeamName", "AppIDName")
    )
    if FORBIDDEN_MARK in blob.lower():
        fail("Refusing a provisioning profile whose name or team mentions PushPress")
    team_name = plist.get("TeamName")
    if isinstance(team_name, str) and team_name and "inversion" not in team_name.lower():
        fail("Provisioning profile TeamName must be CrossFit Inversion LLC")
    platforms = _platforms(plist)
    normalized = {item.lower() for item in platforms}
    if not normalized & TVOS_PLATFORMS:
        fail("Provisioning profile is not a tvOS profile")
    if _expired(plist.get("ExpirationDate")):
        fail("Provisioning profile is expired")
    return Profile(name=name, uuid=uuid, team_id=TEAM_ID, bundle_id=BUNDLE_ID)


def quote_pbx(value: str) -> str:
    if re.fullmatch(r"[A-Za-z0-9._/]+", value):
        return value
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def iter_build_settings(text: str):
    needle = "buildSettings = {"
    start = 0
    while True:
        index = text.find(needle, start)
        if index < 0:
            return
        brace = index + len(needle) - 1
        depth = 0
        for end in range(brace, len(text)):
            char = text[end]
            if char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    yield index, end
                    start = end + 1
                    break
        else:
            fail("Unclosed buildSettings block in project.pbxproj")


def upsert_setting(block: str, key: str, value: str) -> str:
    assignment = f"{key} = {value};"
    pattern = re.compile(rf"^([ \t]*){re.escape(key)} = .*;[ \t]*$", re.MULTILINE)

    def replace(match: re.Match[str]) -> str:
        return match.group(1) + assignment

    if pattern.search(block):
        return pattern.sub(replace, block, count=1)
    sibling = re.search(r"^([ \t]+)\S.*= .*;[ \t]*$", block, re.MULTILINE)
    indent = sibling.group(1) if sibling else "\t\t\t\t"
    head, separator, tail = block.rpartition("\n")
    if not separator or not tail.endswith("}"):
        fail("buildSettings block does not end with a closing brace")
    return f"{head}\n{indent}{assignment}\n{tail}"


def signing_identity_value(identity: str) -> str:
    """A certificate name that can be one xcodebuild KEY=VALUE argument."""
    if not identity or any(char in identity for char in "\n\r="):
        fail("Signing identity must be one line and must not contain '='")
    return identity


def apply_manual_signing(
    text: str,
    profile_name: str,
    build_number: str,
    identity: str = "Apple Distribution",
) -> tuple[str, int]:
    """Set manual distribution signing on configs that use the Americana bundle id.

    The appletvos identity is stored in the project file, where the key is quoted.
    Do not pass CODE_SIGN_IDENTITY[sdk=appletvos*]=... to xcodebuild: it splits the
    argument on the first '=', so the identity becomes 'appletvos*]=...'.
    """
    if "\n" in profile_name or "\r" in profile_name:
        fail("Profile name is not a single line")
    quoted_identity = quote_pbx(signing_identity_value(identity))
    settings = {
        "CODE_SIGN_STYLE": "Manual",
        "DEVELOPMENT_TEAM": TEAM_ID,
        "CODE_SIGN_IDENTITY": quoted_identity,
        '"CODE_SIGN_IDENTITY[sdk=appletvos*]"': quoted_identity,
        "PROVISIONING_PROFILE_SPECIFIER": quote_pbx(profile_name),
        "CURRENT_PROJECT_VERSION": build_number,
        "PRODUCT_BUNDLE_IDENTIFIER": f'"{BUNDLE_ID}"',
    }
    updated = 0
    pieces: list[str] = []
    cursor = 0
    for start, end in iter_build_settings(text):
        pieces.append(text[cursor:start])
        block = text[start : end + 1]
        cursor = end + 1
        if BUNDLE_ID not in block:
            pieces.append(block)
            continue
        for key, value in settings.items():
            block = upsert_setting(block, key, value)
        updated += 1
        pieces.append(block)
    pieces.append(text[cursor:])
    if updated == 0:
        fail(f"No Xcode build configuration contains {BUNDLE_ID}")
    return "".join(pieces), updated


def export_options(profile_name: str, identity: str = "Apple Distribution") -> dict:
    """Local App Store export. destination=export does not upload or submit."""
    return {
        "method": "app-store-connect",
        "destination": "export",
        "signingStyle": "manual",
        "signingCertificate": signing_identity_value(identity),
        "teamID": TEAM_ID,
        "provisioningProfiles": {BUNDLE_ID: profile_name},
        "manageAppVersionAndBuildNumber": False,
        "stripSwiftSymbols": True,
        "uploadSymbols": False,
    }


def write_export_plist(path: Path, profile_name: str, identity: str = "Apple Distribution") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as handle:
        plistlib.dump(export_options(profile_name, identity), handle, fmt=plistlib.FMT_XML)


def distribution_identity_name(text: str) -> str:
    """Pick the distribution certificate for team BNP9QFC679.

    Modern certificates are named 'Apple Distribution'. Older ones are named
    'iPhone Distribution' and still sign tvOS App Store builds. Development
    certificates are ignored.
    """
    matches: list[tuple[int, str]] = []
    for line in text.splitlines():
        if "Distribution" not in line or '"' not in line:
            continue
        if FORBIDDEN_MARK in line.lower():
            fail("Refusing a distribution certificate that mentions PushPress")
        quoted = re.findall(r'"([^"]+)"', line)
        if not quoted:
            continue
        name = quoted[0]
        if "Apple Distribution" in name:
            rank = 0
        elif "iPhone Distribution" in name:
            rank = 1
        else:
            continue
        teams = re.findall(r"\(([A-Z0-9]{10})\)", name)
        if teams != [TEAM_ID]:
            fail(f"Distribution certificate must be team {TEAM_ID} only")
        matches.append((rank, signing_identity_value(name)))
    if not matches:
        fail(
            "Temporary keychain has no Apple Distribution or iPhone Distribution "
            f"identity for {TEAM_ID}"
        )
    matches.sort()
    return matches[0][1]


def assert_codesign(text: str) -> None:
    identifier = re.findall(r"^Identifier=(.+)$", text, re.MULTILINE)
    teams = re.findall(r"^TeamIdentifier=(.+)$", text, re.MULTILINE)
    if identifier != [BUNDLE_ID]:
        fail(f"Signed bundle id must be {BUNDLE_ID}")
    if teams != [TEAM_ID]:
        fail(f"Signed TeamIdentifier must be {TEAM_ID} only")
    if FORBIDDEN_MARK in text.lower():
        fail("Refusing a signature that mentions PushPress")
    authorities = [
        line.split("=", 1)[1]
        for line in text.splitlines()
        if line.startswith("Authority=")
    ]
    if not any(
        ("Apple Distribution" in line or "iPhone Distribution" in line) and TEAM_ID in line
        for line in authorities
    ):
        fail(f"Signature authority must be a distribution certificate for {TEAM_ID}")


def verify_built_plist(plist: dict, marketing_version: str, build_number: str) -> None:
    if str(plist.get("CFBundleVersion")) != build_number:
        fail(
            f"Built CFBundleVersion is {plist.get('CFBundleVersion')!r}, expected {build_number}"
        )
    if plist.get("CFBundleIdentifier") != BUNDLE_ID:
        fail(f"Built CFBundleIdentifier is {plist.get('CFBundleIdentifier')!r}, expected {BUNDLE_ID}")
    if str(plist.get("CFBundleShortVersionString")) != marketing_version:
        fail(
            "Built CFBundleShortVersionString is "
            f"{plist.get('CFBundleShortVersionString')!r}, expected {marketing_version}"
        )
    platform = plist.get("DTPlatformName")
    supported = plist.get("CFBundleSupportedPlatforms") or []
    if platform != "appletvos" and "AppleTVOS" not in supported:
        fail("Built app is not an appletvos binary")
    if platform == "appletvsimulator":
        fail("Built app is an Apple TV simulator binary")


def discover_prebuild(ios_dir: Path) -> tuple[Path, Path]:
    """Find the workspace and scheme the way the simulator workflow lists them."""
    workspaces = sorted(
        path
        for path in ios_dir.glob("*.xcworkspace")
        if path.is_dir() and "Pods" not in path.parts
    )
    projects = sorted(
        path for path in ios_dir.glob("*.xcodeproj") if path.is_dir() and path.name != "Pods.xcodeproj"
    )
    if len(projects) != 1:
        fail(f"Expected one app xcodeproj under {ios_dir}, found {[path.name for path in projects]}")
    project = projects[0]
    preferred = project.stem
    if workspaces != [ios_dir / f"{preferred}.xcworkspace"]:
        found = ", ".join(path.name for path in workspaces) or "(none)"
        fail(
            "expo prebuild did not produce "
            f"{preferred}.xcworkspace (ios/*.xcworkspace excluding Pods). Found: {found}"
        )
    schemes = sorted(project.glob("xcshareddata/xcschemes/*.xcscheme"))
    app_schemes = [
        path for path in schemes if "UITest" not in path.stem and not path.stem.startswith("Pods")
    ]
    chosen = next((path for path in app_schemes if path.stem == preferred), None)
    if chosen is None:
        found = ", ".join(path.name for path in schemes) or "(none)"
        fail(f"Could not find the {preferred} shared scheme. Found: {found}")
    scheme_text = chosen.read_text()
    archive = re.search(r"<ArchiveAction\b[^>]*>", scheme_text)
    if archive is None or 'buildConfiguration = "Release"' not in archive.group(0):
        fail(f"{chosen.name} does not archive the Release configuration")
    return workspaces[0], chosen


def verify_prebuild(
    root: Path,
    ios_dir: Path,
    marketing_version: str | None = None,
) -> dict[str, str]:
    source_version = assert_repo_identity(root)
    build = read_tvos_build_number(root)
    if marketing_version is not None:
        reject_known_tvos_build(normalize_marketing_version(marketing_version), build)
    pbx_files = sorted(ios_dir.glob("*.xcodeproj/project.pbxproj"))
    if len(pbx_files) != 1:
        fail("Expected one project.pbxproj")
    project_text = pbx_files[0].read_text()
    if not re.search(r"appletvos|appletvsimulator|TVOS_DEPLOYMENT_TARGET", project_text):
        fail("expo prebuild did not produce a tvOS project")
    if "SDKROOT = appletvos;" not in project_text:
        fail("Xcode project SDKROOT is not appletvos")
    if "TARGETED_DEVICE_FAMILY = 3;" not in project_text:
        fail("Xcode project TARGETED_DEVICE_FAMILY is not 3 (Apple TV)")
    bundle_ids = set(re.findall(r'PRODUCT_BUNDLE_IDENTIFIER = "?([^";\s]+)"?;', project_text))
    if bundle_ids != {BUNDLE_ID}:
        fail(f"Unexpected PRODUCT_BUNDLE_IDENTIFIER values: {sorted(bundle_ids)}")
    info_files = sorted(ios_dir.glob("*/Info.plist"))
    info_files = [path for path in info_files if path.parent.name != "Pods"]
    if not info_files:
        fail("Prebuild did not write an app Info.plist")
    matched_plists: list[tuple[Path, dict]] = []
    for path in info_files:
        plist = load_plist(path)
        if str(plist.get("CFBundleVersion")) == build:
            matched_plists.append((path, plist))
    if len(matched_plists) != 1:
        fail(f"Expected one Info.plist with CFBundleVersion {build}, found {len(matched_plists)}")
    info_path, matched = matched_plists[0]
    assert_watch_browse(matched)
    short = str(matched.get("CFBundleShortVersionString"))
    exported = source_version
    if marketing_version is None:
        if short != source_version:
            fail(f"Info.plist CFBundleShortVersionString is {short!r}, expected {source_version}")
    else:
        # Expo writes a literal CFBundleShortVersionString from app.json. A
        # MARKETING_VERSION build setting does not replace that literal, so
        # the tvOS plist has to be updated in the prebuild before archive.
        if short not in {source_version, "$(MARKETING_VERSION)"}:
            fail(
                f"Info.plist CFBundleShortVersionString is {short!r}, expected {source_version} "
                "from app.json before the tvOS override"
            )
        exported = normalize_marketing_version(marketing_version)
        project_text = apply_tvos_marketing_version(project_text, exported)
        pbx_files[0].write_text(project_text)
        matched["CFBundleShortVersionString"] = exported
        with info_path.open("wb") as handle:
            plistlib.dump(matched, handle, fmt=plistlib.FMT_XML)
        print(
            f"tvOS CFBundleShortVersionString set to {exported} "
            f"(app.json version remains {source_version}, CFBundleVersion {build})"
        )
    workspace, scheme = discover_prebuild(ios_dir)
    print(f"workspace={workspace} (from ios/*.xcworkspace, excluding Pods)")
    print(f"scheme={scheme.stem} (from {scheme.relative_to(ios_dir)})")
    print(f"CFBundleVersion={build} CFBundleShortVersionString={exported}")
    return {
        "WORKSPACE": str(workspace),
        "SCHEME": scheme.stem,
        "TVOS_BUILD_NUMBER": build,
        "MARKETING_VERSION": exported,
        "SOURCE_MARKETING_VERSION": source_version,
        "BUNDLE_ID": BUNDLE_ID,
        "APPLE_TEAM_ID_EXPECTED": TEAM_ID,
        "ASC_APP_ID": ASC_APP_ID,
    }


def append_github_env(pairs: dict[str, str]) -> None:
    path = os.environ.get("GITHUB_ENV")
    if not path:
        return
    with open(path, "a", encoding="utf-8") as handle:
        for key, value in pairs.items():
            if not re.fullmatch(r"[A-Z0-9_]+", key) or "\n" in value or "\r" in value:
                fail(f"Refusing to export {key}")
            handle.write(f"{key}={value}\n")


def write_shell_env(path: Path, pairs: dict[str, str]) -> None:
    lines = [f"{key}={shlex.quote(value)}" for key, value in pairs.items()]
    path.write_text("\n".join(lines) + "\n")
    os.chmod(path, 0o600)


def decode_secret(env_name: str) -> bytes:
    raw = os.environ.get(env_name, "")
    if not raw.strip():
        fail(f"Missing GitHub secret {env_name}")
    try:
        data = base64.b64decode(raw, validate=False)
    except (ValueError, TypeError):
        fail(f"GitHub secret {env_name} is not valid base64")
    if len(data) < 64:
        fail(f"GitHub secret {env_name} decoded to an unexpectedly small file")
    return data


def normalize_p8(value: str) -> str:
    text = value.strip()
    if not text:
        fail("Missing GitHub secret APP_STORE_CONNECT_API_KEY_P8")
    if "\\n" in text and "\n" not in text:
        text = text.replace("\\n", "\n")
    if "BEGIN PRIVATE KEY" not in text or "END PRIVATE KEY" not in text:
        fail("APP_STORE_CONNECT_API_KEY_P8 is not a PEM private key")
    if not text.endswith("\n"):
        text += "\n"
    return text


def check_env() -> None:
    raw_marketing = os.environ.get("TVOS_MARKETING_VERSION")
    marketing = None
    if raw_marketing is not None:
        marketing = normalize_marketing_version(raw_marketing)
        print(f"tvOS marketing version {marketing} is higher than the approved 1.0.0.")
    build = read_tvos_build_number(repo_root())
    if marketing is not None:
        reject_known_tvos_build(marketing, build)
    print(f"tvOS CFBundleVersion {build}.")
    team = os.environ.get("APPLE_TEAM_ID", "").strip()
    if team and team != TEAM_ID:
        fail(f"APPLE_TEAM_ID must be {TEAM_ID} (CrossFit Inversion LLC). Refusing any other team.")
    missing = [name for name in REQUIRED_SECRETS if not os.environ.get(name, "").strip()]
    if missing:
        fail("Missing GitHub secret " + ", ".join(missing))
    decode_secret("APPLE_CERTIFICATE_BASE64")
    decode_secret("APPLE_PROVISION_PROFILE_BASE64")
    key_id = os.environ["APP_STORE_CONNECT_KEY_ID"].strip()
    issuer = os.environ["APP_STORE_CONNECT_ISSUER_ID"].strip()
    if not KEY_ID_RE.fullmatch(key_id):
        fail("APP_STORE_CONNECT_KEY_ID has an unexpected shape")
    if not ISSUER_RE.fullmatch(issuer):
        fail("APP_STORE_CONNECT_ISSUER_ID has an unexpected shape")
    normalize_p8(os.environ["APP_STORE_CONNECT_API_KEY_P8"])
    print(f"Secrets are present. Signing team is fixed to {TEAM_ID}.")


def write_api_key(directory: Path) -> Path:
    key_id = os.environ.get("APP_STORE_CONNECT_KEY_ID", "").strip()
    if not KEY_ID_RE.fullmatch(key_id):
        fail("APP_STORE_CONNECT_KEY_ID has an unexpected shape")
    pem = normalize_p8(os.environ.get("APP_STORE_CONNECT_API_KEY_P8", ""))
    directory.mkdir(parents=True, exist_ok=True)
    os.chmod(directory, 0o700)
    path = directory / f"AuthKey_{key_id}.p8"
    path.write_text(pem)
    os.chmod(path, 0o600)
    print(f"Wrote App Store Connect API key to {path.name}")
    return path


def redact(text: str, secrets: list[str]) -> str:
    redacted = PEM_RE.sub("***", text)
    for secret in secrets:
        if secret and len(secret) >= 6:
            redacted = redacted.replace(secret, "***")
    return redacted


def prepare_log_artifact(source_dir: Path, dest_dir: Path, tail_lines: int = 200) -> None:
    if dest_dir.exists():
        for child in dest_dir.iterdir():
            if child.is_file():
                child.unlink()
    dest_dir.mkdir(parents=True, exist_ok=True)
    secrets = [os.environ.get(name, "") for name in REQUIRED_SECRETS]
    secrets.append(os.environ.get("APPLE_TEAM_ID", ""))
    password_file = os.environ.get("SIGNING_DIR", "")
    if password_file:
        password_path = Path(password_file) / "keychain.password"
        if password_path.is_file():
            secrets.append(password_path.read_text())
    wrote = 0
    if source_dir.is_dir():
        for path in sorted(source_dir.glob("*.log")):
            kept: deque[str] = deque(maxlen=tail_lines)
            with path.open(errors="replace") as handle:
                for line in handle:
                    kept.append(line)
            (dest_dir / f"{path.stem}-tail.log").write_text(redact("".join(kept), secrets))
            wrote += 1
    for path in dest_dir.rglob("*"):
        if not path.is_file():
            continue
        leaked = path.suffix.lower() in {".ipa", ".p12", ".p8", ".mobileprovision", ".cer"} or path.name.endswith(
            ".xcarchive"
        )
        if leaked or PEM_RE.search(path.read_text(errors="replace")):
            for child in dest_dir.iterdir():
                if child.is_file():
                    child.unlink()
            fail(f"Refusing to publish signing material from {path.name}")
    print(f"Prepared {wrote} redacted log tail(s)")


def verify_built_app(app: Path, root: Path, marketing_version: str | None = None) -> None:
    source_version = assert_repo_identity(root)
    build = read_tvos_build_number(root)
    marketing = (
        normalize_marketing_version(marketing_version)
        if marketing_version is not None
        else source_version
    )
    reject_known_tvos_build(marketing, build)
    info = load_plist(app / "Info.plist")
    verify_built_plist(info, marketing, build)
    assert_watch_browse(info)
    profile = app / "embedded.mobileprovision"
    if not profile.is_file():
        fail("Built app is missing embedded.mobileprovision")
    decoded = app.parent / "embedded.plist"
    decode = subprocess.run(
        ["security", "cms", "-D", "-i", str(profile), "-o", str(decoded)],
        check=False,
        capture_output=True,
        text=True,
    )
    if decode.returncode != 0 or not decoded.is_file():
        fail("Could not decode embedded.mobileprovision")
    validate_profile(load_plist(decoded))
    details = subprocess.run(
        ["codesign", "-dv", "--verbose=4", str(app)],
        check=False,
        capture_output=True,
        text=True,
    )
    # codesign writes identity details to stderr.
    assert_codesign((details.stderr or "") + (details.stdout or ""))
    verified = subprocess.run(
        ["codesign", "--verify", "--deep", "--strict", "--verbose=2", str(app)],
        check=False,
        capture_output=True,
        text=True,
    )
    if details.returncode != 0 or verified.returncode != 0:
        sys.stderr.write(details.stderr or "")
        sys.stderr.write(verified.stderr or "")
        fail("codesign verification failed")
    print(f"Signed {BUNDLE_ID} build {build} ({marketing}) for team {TEAM_ID} (appletvos)")


def cmd_check_watch_browse(args: argparse.Namespace) -> None:
    check_watch_browse(Path(args.ios_dir).resolve())


def cmd_verify_prebuild(args: argparse.Namespace) -> None:
    root = Path(args.repo).resolve()
    ios_dir = Path(args.ios_dir).resolve()
    pairs = verify_prebuild(root, ios_dir, args.marketing_version)
    for key in ("ASC_APP_ID", "BUNDLE_ID"):
        current = os.environ.get(key, "").strip()
        if current and current != pairs[key]:
            fail(f"Workflow {key} is {current}, expected {pairs[key]}")
    append_github_env(pairs)
    if args.env_file:
        write_shell_env(Path(args.env_file), pairs)


def cmd_inspect_profile(args: argparse.Namespace) -> None:
    profile = validate_profile(load_plist(Path(args.plist)))
    pairs = {"PROFILE_NAME": profile.name, "PROFILE_UUID": profile.uuid}
    if args.github_env:
        os.environ["GITHUB_ENV"] = args.github_env
        append_github_env(pairs)
    if args.env_file:
        write_shell_env(Path(args.env_file), pairs)
    print(f"profile name={profile.name}")
    print(f"profile uuid={profile.uuid}")
    print(f"profile team={profile.team_id} bundle={profile.bundle_id} platform=tvOS")


def cmd_apply_signing(args: argparse.Namespace) -> None:
    path = Path(args.pbx)
    if "Pods" in path.parts:
        fail("Refusing to edit a Pods project")
    root = repo_root()
    build = read_tvos_build_number(root)
    identity = signing_identity_value(args.identity)
    updated_text, count = apply_manual_signing(path.read_text(), args.profile_name, build, identity)
    path.write_text(updated_text)
    print(f"Set manual signing on {count} Americana build configuration(s)")


def cmd_write_export_plist(args: argparse.Namespace) -> None:
    write_export_plist(Path(args.out), args.profile_name, args.identity)
    print(f"Wrote {Path(args.out).name} (method=app-store-connect destination=export)")


def cmd_decode_secret(args: argparse.Namespace) -> None:
    data = decode_secret(args.env)
    destination = Path(args.out)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)
    os.chmod(destination, 0o600)
    print(f"Wrote {destination.name} ({len(data)} bytes)")


def cmd_assert_identity(args: argparse.Namespace) -> None:
    text = Path(args.file).read_text() if args.file else sys.stdin.read()
    identity = distribution_identity_name(text)
    pairs = {"CODE_SIGN_IDENTITY": identity}
    if args.github_env:
        os.environ["GITHUB_ENV"] = args.github_env
        append_github_env(pairs)
    if args.env_file:
        write_shell_env(Path(args.env_file), pairs)
    print(f"Using signing identity: {identity}")


def cmd_assert_codesign(args: argparse.Namespace) -> None:
    text = Path(args.file).read_text() if args.file else sys.stdin.read()
    assert_codesign(text)
    print(f"codesign TeamIdentifier={TEAM_ID} Identifier={BUNDLE_ID}")


def cmd_check_env(_args: argparse.Namespace) -> None:
    check_env()


def cmd_write_api_key(args: argparse.Namespace) -> None:
    path = write_api_key(Path(args.dir))
    append_github_env({"API_PRIVATE_KEYS_DIR": str(path.parent)})


def cmd_prepare_logs(args: argparse.Namespace) -> None:
    prepare_log_artifact(Path(args.source), Path(args.dest), tail_lines=args.tail)


def cmd_verify_built_app(args: argparse.Namespace) -> None:
    verify_built_app(Path(args.app), Path(args.repo).resolve(), args.marketing_version)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)

    browse = sub.add_parser("check-watch-browse")
    browse.add_argument("--ios-dir", default="ios")
    browse.set_defaults(func=cmd_check_watch_browse)

    verify = sub.add_parser("verify-prebuild")
    verify.add_argument("--repo", default=str(repo_root()))
    verify.add_argument("--ios-dir", default="ios")
    verify.add_argument("--env-file")
    verify.add_argument("--marketing-version")
    verify.set_defaults(func=cmd_verify_prebuild)

    inspect = sub.add_parser("inspect-profile")
    inspect.add_argument("--plist", required=True)
    inspect.add_argument("--github-env")
    inspect.add_argument("--env-file")
    inspect.set_defaults(func=cmd_inspect_profile)

    apply = sub.add_parser("apply-signing")
    apply.add_argument("--pbx", required=True)
    apply.add_argument("--profile-name", required=True)
    apply.add_argument("--identity", required=True)
    apply.set_defaults(func=cmd_apply_signing)

    export = sub.add_parser("write-export-plist")
    export.add_argument("--profile-name", required=True)
    export.add_argument("--identity", required=True)
    export.add_argument("--out", required=True)
    export.set_defaults(func=cmd_write_export_plist)

    decode = sub.add_parser("decode-secret")
    decode.add_argument("--env", required=True)
    decode.add_argument("--out", required=True)
    decode.set_defaults(func=cmd_decode_secret)

    identity = sub.add_parser("assert-identity")
    identity.add_argument("--file")
    identity.add_argument("--github-env")
    identity.add_argument("--env-file")
    identity.set_defaults(func=cmd_assert_identity)

    codesign = sub.add_parser("assert-codesign")
    codesign.add_argument("--file")
    codesign.set_defaults(func=cmd_assert_codesign)

    check = sub.add_parser("check-env")
    check.set_defaults(func=cmd_check_env)

    key = sub.add_parser("write-api-key")
    key.add_argument("--dir", required=True)
    key.set_defaults(func=cmd_write_api_key)

    logs = sub.add_parser("prepare-logs")
    logs.add_argument("--source", required=True)
    logs.add_argument("--dest", required=True)
    logs.add_argument("--tail", type=int, default=200)
    logs.set_defaults(func=cmd_prepare_logs)

    built = sub.add_parser("verify-built-app")
    built.add_argument("--app", required=True)
    built.add_argument("--repo", default=str(repo_root()))
    built.add_argument("--marketing-version")
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
