#!/usr/bin/env python3
"""Checks for the tvOS TestFlight signing helper and workflow contract."""

from __future__ import annotations

import base64
import importlib.util
import os
import plistlib
import subprocess
import sys
import tempfile
import textwrap
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("ci_tvos_signing", ROOT / "scripts" / "ci-tvos-signing.py")
signing = importlib.util.module_from_spec(spec)
sys.modules["ci_tvos_signing"] = signing
spec.loader.exec_module(signing)


def profile(**overrides):
    base = {
        "Name": "Americana tvOS App Store b17",
        "UUID": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        "TeamIdentifier": ["BNP9QFC679"],
        "TeamName": "CrossFit Inversion LLC",
        "AppIDName": "Americana",
        "Platform": ["tvOS"],
        "Entitlements": {
            "application-identifier": "BNP9QFC679.com.garrettscales.americana",
            "com.apple.developer.team-identifier": "BNP9QFC679",
            "get-task-allow": False,
        },
        "ExpirationDate": datetime.now(timezone.utc) + timedelta(days=30),
    }
    base.update(overrides)
    return base


def expect_fail(testcase, message_part, function):
    with testcase.assertRaises(SystemExit) as caught:
        function()
    testcase.assertIn(message_part, str(caught.exception))


class ProfileTests(unittest.TestCase):
    def test_accepts_the_inversion_tvos_app_store_profile(self):
        parsed = signing.validate_profile(profile())
        self.assertEqual(parsed.name, "Americana tvOS App Store b17")
        self.assertEqual(parsed.uuid, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
        self.assertEqual(parsed.team_id, "BNP9QFC679")
        self.assertEqual(parsed.bundle_id, "com.garrettscales.americana")

    def test_rejects_any_other_team(self):
        expect_fail(self, "BNP9QFC679", lambda: signing.validate_profile(profile(TeamIdentifier=["PUSHPRESS1"])))

    def test_rejects_pushpress_in_the_name(self):
        expect_fail(
            self,
            "PushPress",
            lambda: signing.validate_profile(profile(TeamName="PushPress", Name="Americana tvOS")),
        )

    def test_rejects_an_ios_profile(self):
        expect_fail(self, "tvOS", lambda: signing.validate_profile(profile(Platform=["iOS"])))

    def test_rejects_development_and_enterprise_profiles(self):
        expect_fail(
            self,
            "devices",
            lambda: signing.validate_profile(profile(ProvisionedDevices=["DEVICE"])),
        )
        expect_fail(
            self,
            "enterprise",
            lambda: signing.validate_profile(profile(ProvisionsAllDevices=True)),
        )
        entitlements = dict(profile()["Entitlements"])
        entitlements["get-task-allow"] = True
        expect_fail(
            self,
            "get-task-allow",
            lambda: signing.validate_profile(profile(Entitlements=entitlements)),
        )

    def test_rejects_a_different_bundle_id(self):
        entitlements = dict(profile()["Entitlements"])
        entitlements["application-identifier"] = "BNP9QFC679.com.example.other"
        expect_fail(
            self,
            "application-identifier",
            lambda: signing.validate_profile(profile(Entitlements=entitlements)),
        )

    def test_rejects_an_expired_profile(self):
        expect_fail(
            self,
            "expired",
            lambda: signing.validate_profile(
                profile(ExpirationDate=datetime.now(timezone.utc) - timedelta(days=1))
            ),
        )


class ExportAndSigningTests(unittest.TestCase):
    def test_export_plist_is_a_local_app_store_export(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "ExportOptions.plist"
            signing.write_export_plist(path, "Americana tvOS App Store b17")
            plist = plistlib.loads(path.read_bytes())
        self.assertEqual(plist["method"], "app-store-connect")
        self.assertEqual(plist["destination"], "export")
        self.assertEqual(plist["signingStyle"], "manual")
        self.assertEqual(plist["teamID"], "BNP9QFC679")
        self.assertEqual(plist["signingCertificate"], "Apple Distribution")
        self.assertEqual(
            plist["provisioningProfiles"],
            {"com.garrettscales.americana": "Americana tvOS App Store b17"},
        )
        self.assertFalse(plist["manageAppVersionAndBuildNumber"])
        self.assertNotIn("upload", plist["destination"])
        self.assertNotIn("submit", str(plist).lower())

    def test_manual_signing_is_applied_only_to_the_app_target(self):
        project = textwrap.dedent(
            """
            \\t\\tAPP /* Release */ = {
            \\t\\t\\tisa = XCBuildConfiguration;
            \\t\\t\\tbuildSettings = {
            \\t\\t\\t\\tCURRENT_PROJECT_VERSION = 1;
            \\t\\t\\t\\tPRODUCT_BUNDLE_IDENTIFIER = "com.garrettscales.americana";
            \\t\\t\\t\\tPRODUCT_NAME = "Americana";
            \\t\\t\\t\\tSDKROOT = appletvos;
            \\t\\t\\t};
            \\t\\t\\tname = Release;
            \\t\\t};
            \\t\\tPROJ /* Release */ = {
            \\t\\t\\tisa = XCBuildConfiguration;
            \\t\\t\\tbuildSettings = {
            \\t\\t\\t\\t"CODE_SIGN_IDENTITY[sdk=iphoneos*]" = "iPhone Developer";
            \\t\\t\\t\\tSDKROOT = appletvos;
            \\t\\t\\t};
            \\t\\t\\tname = Release;
            \\t\\t};
            """
        ).replace("\\t", "\t")
        updated, count = signing.apply_manual_signing(project, "Americana tvOS App Store b17", "23")
        self.assertEqual(count, 1)
        self.assertIn("CODE_SIGN_STYLE = Manual;", updated)
        self.assertIn("DEVELOPMENT_TEAM = BNP9QFC679;", updated)
        self.assertIn('CODE_SIGN_IDENTITY = "Apple Distribution";', updated)
        self.assertIn('"CODE_SIGN_IDENTITY[sdk=appletvos*]" = "Apple Distribution";', updated)
        self.assertIn('PROVISIONING_PROFILE_SPECIFIER = "Americana tvOS App Store b17";', updated)
        self.assertIn("CURRENT_PROJECT_VERSION = 23;", updated)
        self.assertIn('"CODE_SIGN_IDENTITY[sdk=iphoneos*]" = "iPhone Developer";', updated)
        self.assertEqual(updated.count("CODE_SIGN_STYLE = Manual;"), 1)
        indents = {
            line[: len(line) - len(line.lstrip("\t"))]
            for line in updated.splitlines()
            if "CODE_SIGN_STYLE = Manual;" in line or "CURRENT_PROJECT_VERSION = 23;" in line
        }
        self.assertEqual(indents, {"\t\t\t\t"})

    def test_distribution_identity_must_be_inversion(self):
        good = '  1) ABCDEF "Apple Distribution: CrossFit Inversion LLC (BNP9QFC679)"\n     1 valid identities found\n'
        signing.assert_distribution_identity(good)
        expect_fail(
            self,
            "PushPress",
            lambda: signing.assert_distribution_identity(
                '  1) ABC "Apple Distribution: PushPress (BNP9QFC679)"\n'
            ),
        )
        expect_fail(
            self,
            "BNP9QFC679",
            lambda: signing.assert_distribution_identity(
                '  1) ABC "Apple Distribution: Other LLC (AAAAAAAAAA)"\n'
            ),
        )
        expect_fail(
            self,
            "no Apple Distribution",
            lambda: signing.assert_distribution_identity(
                '  1) ABC "Apple Development: CrossFit Inversion LLC (BNP9QFC679)"\n'
            ),
        )

    def test_codesign_output_must_match_the_app(self):
        good = "\n".join(
            [
                "Identifier=com.garrettscales.americana",
                "Authority=Apple Distribution: CrossFit Inversion LLC (BNP9QFC679)",
                "Authority=Apple Worldwide Developer Relations Certification Authority",
                "TeamIdentifier=BNP9QFC679",
            ]
        )
        signing.assert_codesign(good)
        expect_fail(
            self,
            "TeamIdentifier",
            lambda: signing.assert_codesign(good.replace("TeamIdentifier=BNP9QFC679", "TeamIdentifier=AAAAAAAAAA")),
        )


class PrebuildTests(unittest.TestCase):
    def test_repo_identity_is_build_23(self):
        self.assertEqual(signing.read_tvos_build_number(ROOT), "23")
        self.assertEqual(signing.assert_repo_identity(ROOT), "1.0.0")

    def test_verify_prebuild_discovers_the_americana_scheme(self):
        with tempfile.TemporaryDirectory() as tmp:
            ios = Path(tmp)
            project = ios / "Americana.xcodeproj"
            schemes = project / "xcshareddata" / "xcschemes"
            schemes.mkdir(parents=True)
            (project / "project.pbxproj").write_text(
                "\n".join(
                    [
                        "SDKROOT = appletvos;",
                        "TARGETED_DEVICE_FAMILY = 3;",
                        "TVOS_DEPLOYMENT_TARGET = 16.4;",
                        'PRODUCT_BUNDLE_IDENTIFIER = "com.garrettscales.americana";',
                    ]
                )
            )
            (schemes / "Americana.xcscheme").write_text(
                '<ArchiveAction\n   buildConfiguration = "Release"\n   revealArchiveInOrganizer = "YES">\n</ArchiveAction>\n'
            )
            (ios / "Americana.xcworkspace").mkdir()
            app = ios / "Americana"
            app.mkdir()
            with (app / "Info.plist").open("wb") as handle:
                plistlib.dump(
                    {"CFBundleVersion": "23", "CFBundleShortVersionString": "1.0.0"},
                    handle,
                )
            env_file = ios / "prebuild.env"
            previous = os.environ.get("GITHUB_ENV")
            github_env = ios / "github.env"
            os.environ["GITHUB_ENV"] = str(github_env)
            try:
                signing.main(
                    [
                        "verify-prebuild",
                        "--repo",
                        str(ROOT),
                        "--ios-dir",
                        str(ios),
                        "--env-file",
                        str(env_file),
                    ]
                )
            finally:
                if previous is None:
                    os.environ.pop("GITHUB_ENV", None)
                else:
                    os.environ["GITHUB_ENV"] = previous
            exported = github_env.read_text()
            self.assertIn("SCHEME=Americana", exported)
            self.assertIn("TVOS_BUILD_NUMBER=23", exported)
            self.assertIn("Americana.xcworkspace", exported)
            self.assertIn("SCHEME=Americana", env_file.read_text())

    def test_real_prebuild_tree_is_tvos_build_23(self):
        ios = ROOT / "ios"
        info = ios / "Americana" / "Info.plist"
        if not info.is_file():
            self.skipTest("generated ios project is not in this checkout")
        workspace = ios / "Americana.xcworkspace"
        created = False
        if not workspace.is_dir():
            workspace.mkdir()
            created = True
        try:
            result = signing.verify_prebuild(ROOT, ios.resolve())
        finally:
            if created:
                workspace.rmdir()
        self.assertEqual(result["SCHEME"], "Americana")
        self.assertEqual(result["TVOS_BUILD_NUMBER"], "23")
        self.assertTrue(result["WORKSPACE"].endswith("Americana.xcworkspace"))


class SecretHandlingTests(unittest.TestCase):
    def test_redaction_removes_pem_blocks_and_secret_values(self):
        pem = "-----BEGIN PRIVATE KEY-----\nSECRETDATA\n-----END PRIVATE KEY-----\n"
        text = f"password=hunter2-secret\n{pem}done"
        redacted = signing.redact(text, ["hunter2-secret"])
        self.assertNotIn("SECRETDATA", redacted)
        self.assertNotIn("hunter2-secret", redacted)
        self.assertIn("done", redacted)

    def test_prepare_logs_publishes_only_redacted_tails(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "artifacts"
            dest = source / "public-logs"
            source.mkdir()
            (source / "xcodebuild.log").write_text("line\n" * 10 + "password=hunter2-secret\n")
            (source / "Americana.ipa").write_bytes(b"not-a-real-ipa")
            (source / "distribution.p12").write_bytes(b"cert")
            previous = os.environ.get("APPLE_CERTIFICATE_PASSWORD")
            os.environ["APPLE_CERTIFICATE_PASSWORD"] = "hunter2-secret"
            try:
                signing.prepare_log_artifact(source, dest, tail_lines=5)
            finally:
                if previous is None:
                    os.environ.pop("APPLE_CERTIFICATE_PASSWORD", None)
                else:
                    os.environ["APPLE_CERTIFICATE_PASSWORD"] = previous
            published = list(dest.iterdir())
            self.assertEqual([path.name for path in published], ["xcodebuild-tail.log"])
            body = published[0].read_text()
            self.assertNotIn("hunter2-secret", body)
            self.assertNotIn("not-a-real-ipa", body)

    def test_check_env_rejects_a_wrong_team_without_printing_the_key(self):
        pem = "-----BEGIN PRIVATE KEY-----\nnot-a-real-key\n-----END PRIVATE KEY-----\n"
        env = {
            "APPLE_CERTIFICATE_BASE64": base64.b64encode(b"c" * 80).decode(),
            "APPLE_CERTIFICATE_PASSWORD": "test-password",
            "APPLE_PROVISION_PROFILE_BASE64": base64.b64encode(b"p" * 80).decode(),
            "APP_STORE_CONNECT_KEY_ID": "AB12CD34EF",
            "APP_STORE_CONNECT_ISSUER_ID": "00000000-0000-0000-0000-000000000000",
            "APP_STORE_CONNECT_API_KEY_P8": pem,
            "APPLE_TEAM_ID": "PUSHPRESS1",
        }
        previous = {key: os.environ.get(key) for key in env}
        os.environ.update(env)
        try:
            with self.assertRaises(SystemExit) as caught:
                signing.check_env()
            message = str(caught.exception)
            self.assertIn("BNP9QFC679", message)
            self.assertNotIn("not-a-real-key", message)
            self.assertNotIn("test-password", message)
        finally:
            for key, value in previous.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value

    def test_write_api_key_uses_the_authkey_filename(self):
        pem = "-----BEGIN PRIVATE KEY-----\\nline\\n-----END PRIVATE KEY-----"
        with tempfile.TemporaryDirectory() as tmp:
            previous = {
                "APP_STORE_CONNECT_KEY_ID": os.environ.get("APP_STORE_CONNECT_KEY_ID"),
                "APP_STORE_CONNECT_API_KEY_P8": os.environ.get("APP_STORE_CONNECT_API_KEY_P8"),
            }
            os.environ["APP_STORE_CONNECT_KEY_ID"] = "AB12CD34EF"
            os.environ["APP_STORE_CONNECT_API_KEY_P8"] = pem
            try:
                path = signing.write_api_key(Path(tmp))
            finally:
                for key, value in previous.items():
                    if value is None:
                        os.environ.pop(key, None)
                    else:
                        os.environ[key] = value
            self.assertEqual(path.name, "AuthKey_AB12CD34EF.p8")
            self.assertIn("BEGIN PRIVATE KEY", path.read_text())
            self.assertNotIn("\\n", path.read_text())


class WorkflowContractTests(unittest.TestCase):
    def test_workflow_is_manual_testflight_only(self):
        text = (ROOT / ".github" / "workflows" / "appletv-signed-testflight.yml").read_text()
        self.assertIn("workflow_dispatch:", text)
        self.assertNotIn("\n  push:", text)
        self.assertNotIn("pull_request:", text)
        for name in signing.REQUIRED_SECRETS:
            self.assertIn(f"secrets.{name}", text)
        self.assertIn("secrets.APPLE_TEAM_ID", text)
        self.assertIn("BNP9QFC679", text)
        self.assertIn("com.garrettscales.americana", text)
        self.assertIn("6833266123", text)
        self.assertIn("macos-26", text)
        self.assertIn("node-version: 22", text)
        self.assertIn("npm ci", text)
        self.assertIn("EXPO_TV: \"1\"", text)
        self.assertIn("npx expo prebuild --platform ios", text)
        self.assertIn("scripts/ci-select-xcode.py", text)
        self.assertIn("generic/platform=tvOS", text)
        self.assertIn("CODE_SIGN_STYLE=Manual", text)
        self.assertIn('CODE_SIGN_IDENTITY=Apple Distribution', text)
        self.assertIn("-t appletvos", text)
        self.assertNotIn("xcrun notarytool", text)
        self.assertNotIn("eas submit", text)
        self.assertIn("confirm", text)
        self.assertIn("UPLOAD", text)
        upload = text.split("uses: actions/upload-artifact@v4", 1)[1]
        self.assertIn("artifacts/public-logs/*.log", upload)
        self.assertNotIn(".ipa", upload)
        self.assertNotIn(".p12", upload)
        self.assertNotIn(".p8", upload)
        self.assertNotIn(".mobileprovision", upload)

    def test_shell_scripts_parse(self):
        for name in ("ci-tvos-install-signing.sh", "ci-tvos-cleanup-signing.sh"):
            subprocess.run(["bash", "-n", str(ROOT / "scripts" / name)], check=True)

    def test_cleanup_deletes_signing_files_and_leaves_other_paths(self):
        with tempfile.TemporaryDirectory() as tmp, tempfile.TemporaryDirectory() as home, tempfile.TemporaryDirectory() as outside:
            runner = Path(tmp)
            home_path = Path(home)
            signing_dir = runner / "tvos-signing"
            signing_dir.mkdir()
            (signing_dir / "distribution.p12").write_text("secret")
            (runner / "Americana.xcarchive").mkdir()
            export_dir = runner / "tvos-export"
            export_dir.mkdir()
            (export_dir / "Americana.ipa").write_text("ipa")
            (home_path / "private_keys").mkdir()
            (home_path / "private_keys" / "AuthKey_AB12CD34EF.p8").write_text("key")
            profile_dir = home_path / "Library" / "MobileDevice" / "Provisioning Profiles"
            profile_dir.mkdir(parents=True)
            uuid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
            (profile_dir / f"{uuid}.mobileprovision").write_text("profile")
            kept = Path(outside) / "keep"
            kept.mkdir()
            (kept / "file").write_text("keep")
            env = os.environ.copy()
            env.update(
                {
                    "HOME": str(home_path),
                    "RUNNER_TEMP": str(runner),
                    "SIGNING_DIR": str(signing_dir),
                    "KEYCHAIN_PATH": str(signing_dir / "app-signing.keychain-db"),
                    "ARCHIVE_PATH": str(runner / "Americana.xcarchive"),
                    "EXPORT_PATH": str(export_dir),
                    "API_PRIVATE_KEYS_DIR": str(runner / "asc-private-keys"),
                    "PROFILE_UUID": uuid,
                    "APP_STORE_CONNECT_KEY_ID": "AB12CD34EF",
                }
            )
            subprocess.run(["bash", str(ROOT / "scripts" / "ci-tvos-cleanup-signing.sh")], check=True, env=env)
            self.assertFalse(signing_dir.exists())
            self.assertFalse((export_dir / "Americana.ipa").exists())
            self.assertFalse((home_path / "private_keys" / "AuthKey_AB12CD34EF.p8").exists())
            self.assertFalse((profile_dir / f"{uuid}.mobileprovision").exists())
            env["ARCHIVE_PATH"] = str(kept)
            subprocess.run(["bash", str(ROOT / "scripts" / "ci-tvos-cleanup-signing.sh")], check=True, env=env)
            self.assertTrue((kept / "file").is_file())


if __name__ == "__main__":
    unittest.main()
