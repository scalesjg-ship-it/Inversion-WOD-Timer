#!/usr/bin/env python3
"""Checks for the iPhone and Watch TestFlight signing helper."""

from __future__ import annotations

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
spec = importlib.util.spec_from_file_location("ci_ios_signing", ROOT / "scripts" / "ci-ios-signing.py")
signing = importlib.util.module_from_spec(spec)
sys.modules["ci_ios_signing"] = signing
spec.loader.exec_module(signing)


def profile(bundle: str, platform: list[str], **overrides):
    base = {
        "Name": f"Americana {bundle.rsplit('.', 1)[-1]}",
        "UUID": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        "TeamIdentifier": ["BNP9QFC679"],
        "TeamName": "CrossFit Inversion LLC",
        "AppIDName": "Americana",
        "Platform": platform,
        "Entitlements": {
            "application-identifier": f"BNP9QFC679.{bundle}",
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


PHONE = signing.PHONE_BUNDLE
WATCH = signing.WATCH_BUNDLE


def project_text() -> str:
    return textwrap.dedent(
        """
        \t\tPHONE /* Release */ = {
        \t\t\tisa = XCBuildConfiguration;
        \t\t\tbuildSettings = {
        \t\t\t\tCURRENT_PROJECT_VERSION = 1;
        \t\t\t\tMARKETING_VERSION = 1.0.0;
        \t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = "com.garrettscales.americana";
        \t\t\t\tSDKROOT = iphoneos;
        \t\t\t};
        \t\t\tname = Release;
        \t\t};
        \t\tWATCH /* Release */ = {
        \t\t\tisa = XCBuildConfiguration;
        \t\t\tbuildSettings = {
        \t\t\t\tCURRENT_PROJECT_VERSION = 18;
        \t\t\t\tMARKETING_VERSION = 1.0.0;
        \t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = "com.garrettscales.americana.watchkitapp";
        \t\t\t\tSDKROOT = watchos;
        \t\t\t};
        \t\t\tname = Release;
        \t\t};
        \t\tPOD /* Release */ = {
        \t\t\tisa = XCBuildConfiguration;
        \t\t\tbuildSettings = {
        \t\t\t\tSDKROOT = iphoneos;
        \t\t\t};
        \t\t\tname = Release;
        \t\t};
        """
    )


class BuildNumberTests(unittest.TestCase):
    def test_build_number_must_be_newer_than_the_in_review_build(self):
        self.assertEqual(signing.normalize_ios_build_number("19"), "19")
        self.assertEqual(signing.normalize_ios_build_number("20"), "20")
        expect_fail(self, "greater than 18", lambda: signing.normalize_ios_build_number("18"))
        expect_fail(self, "greater than 18", lambda: signing.normalize_ios_build_number("1"))
        expect_fail(self, "positive integer", lambda: signing.normalize_ios_build_number("019"))
        expect_fail(self, "positive integer", lambda: signing.normalize_ios_build_number("0"))

    def test_app_json_marketing_version_stays_1_0_0(self):
        app = (ROOT / "app.json").read_text()
        self.assertIn('"version": "1.0.0"', app)
        self.assertIn('"buildNumber": "18"', app)


class ProfileTests(unittest.TestCase):
    def test_accepts_matching_app_store_profiles(self):
        phone = signing.validate_profile(profile(PHONE, ["iOS"]), PHONE)
        watch = signing.validate_profile(profile(WATCH, ["watchOS"], UUID="bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee"), WATCH)
        self.assertEqual(phone.bundle_id, PHONE)
        self.assertEqual(watch.bundle_id, WATCH)
        self.assertEqual(phone.team_id, "BNP9QFC679")

    def test_rejects_a_swapped_or_tvos_profile(self):
        expect_fail(self, "application-identifier", lambda: signing.validate_profile(profile(WATCH, ["iOS"]), PHONE))
        expect_fail(self, "tvOS", lambda: signing.validate_profile(profile(PHONE, ["tvOS"]), PHONE))
        expect_fail(self, "BNP9QFC679", lambda: signing.validate_profile(profile(PHONE, ["iOS"], TeamIdentifier=["PUSHPRESS1"]), PHONE))
        expect_fail(
            self,
            "PushPress",
            lambda: signing.validate_profile(profile(PHONE, ["iOS"], TeamName="PushPress"), PHONE),
        )
        expect_fail(
            self,
            "devices",
            lambda: signing.validate_profile(profile(PHONE, ["iOS"], ProvisionedDevices=["DEVICE"]), PHONE),
        )


class SigningProjectTests(unittest.TestCase):
    def test_both_targets_get_the_same_build_and_their_own_profile(self):
        updated, counts = signing.apply_versions(project_text(), "19")
        self.assertEqual(counts[PHONE], 1)
        self.assertEqual(counts[WATCH], 1)
        self.assertEqual(updated.count("CURRENT_PROJECT_VERSION = 19;"), 2)
        self.assertEqual(updated.count("MARKETING_VERSION = 1.0.0;"), 2)
        self.assertNotIn("CURRENT_PROJECT_VERSION = 18;", updated)
        signed, signed_counts = signing.apply_manual_signing(
            project_text(),
            "Americana iOS App Store",
            "Americana Watch App Store",
            "Apple Distribution: CrossFit Inversion LLC (BNP9QFC679)",
            "19",
        )
        self.assertEqual(signed_counts[PHONE], 1)
        self.assertEqual(signed_counts[WATCH], 1)
        self.assertIn('PROVISIONING_PROFILE_SPECIFIER = "Americana iOS App Store";', signed)
        self.assertIn('PROVISIONING_PROFILE_SPECIFIER = "Americana Watch App Store";', signed)
        self.assertIn('"CODE_SIGN_IDENTITY[sdk=iphoneos*]"', signed)
        self.assertIn('"CODE_SIGN_IDENTITY[sdk=watchos*]"', signed)
        self.assertNotIn("appletvos*", signed)
        self.assertEqual(signed.count("CODE_SIGN_STYLE = Manual;"), 2)
        self.assertIn("DEVELOPMENT_TEAM = BNP9QFC679;", signed)
        pod = signed.split("POD /* Release */", 1)[1]
        self.assertNotIn("CODE_SIGN_STYLE = Manual;", pod)

    def test_export_plist_maps_both_bundle_ids_and_does_not_upload(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "ExportOptions.plist"
            signing.write_export_plist(path, "Americana iOS App Store", "Americana Watch App Store", "Apple Distribution")
            plist = plistlib.loads(path.read_bytes())
        self.assertEqual(plist["method"], "app-store-connect")
        self.assertEqual(plist["destination"], "export")
        self.assertEqual(plist["signingStyle"], "manual")
        self.assertEqual(plist["teamID"], "BNP9QFC679")
        self.assertEqual(
            plist["provisioningProfiles"],
            {
                PHONE: "Americana iOS App Store",
                WATCH: "Americana Watch App Store",
            },
        )
        self.assertFalse(plist["manageAppVersionAndBuildNumber"])
        self.assertNotIn("submit", str(plist).lower())

    def test_built_plists_must_match(self):
        good = {
            "CFBundleVersion": "19",
            "CFBundleIdentifier": PHONE,
            "CFBundleShortVersionString": "1.0.0",
            "DTPlatformName": "iphoneos",
        }
        signing.verify_built_plist(good, PHONE, "19", "iphoneos")
        watch = dict(good)
        watch["CFBundleIdentifier"] = WATCH
        watch["DTPlatformName"] = "watchos"
        signing.verify_built_plist(watch, WATCH, "19", "watchos")
        drifted = dict(watch)
        drifted["CFBundleVersion"] = "18"
        expect_fail(self, "CFBundleVersion", lambda: signing.verify_built_plist(drifted, WATCH, "19", "watchos"))
        other_marketing = dict(good)
        other_marketing["CFBundleShortVersionString"] = "1.0.1"
        expect_fail(self, "1.0.0", lambda: signing.verify_built_plist(other_marketing, PHONE, "19", "iphoneos"))
        tv = dict(good)
        tv["DTPlatformName"] = "appletvos"
        expect_fail(self, "Apple TV", lambda: signing.verify_built_plist(tv, PHONE, "19", "iphoneos"))


class WorkflowContractTests(unittest.TestCase):
    def test_workflow_is_manual_testflight_only(self):
        text = (ROOT / ".github" / "workflows" / "iphone-signed-testflight.yml").read_text()
        self.assertIn("name: iPhone signed TestFlight", text)
        self.assertIn("workflow_dispatch:", text)
        self.assertNotIn("\n  push:", text)
        self.assertNotIn("pull_request:", text)
        for name in signing.REQUIRED_SECRETS:
            self.assertIn(f"secrets.{name}", text)
        self.assertIn("secrets.APPLE_TEAM_ID", text)
        self.assertIn("BNP9QFC679", text)
        self.assertIn("com.garrettscales.americana", text)
        self.assertIn("com.garrettscales.americana.watchkitapp", text)
        self.assertIn("6833266123", text)
        self.assertIn("macos-26", text)
        self.assertIn("node-version: 22", text)
        self.assertIn("npm ci", text)
        self.assertNotIn('EXPO_TV: "1"', text)
        self.assertIn("npx expo prebuild --platform ios", text)
        self.assertIn("generic/platform=iOS", text)
        self.assertIn("CODE_SIGN_STYLE=Manual", text)
        self.assertIn('CODE_SIGN_IDENTITY=$CODE_SIGN_IDENTITY', text)
        self.assertNotIn("PRODUCT_BUNDLE_IDENTIFIER=", text)
        self.assertNotIn("PROVISIONING_PROFILE_SPECIFIER=", text)
        self.assertIn("-t ios", text)
        self.assertNotIn("-t appletvos", text)
        self.assertNotIn("xcrun notarytool", text)
        self.assertNotIn("eas submit", text)
        self.assertNotIn("altool --submit", text)
        self.assertNotIn("reviewSubmissions", text)
        self.assertNotIn("betaAppReview", text)
        self.assertIn("confirm", text)
        self.assertIn("UPLOAD", text)
        self.assertIn("VERIFY_ONLY", text)
        self.assertIn("inputs.confirm == 'UPLOAD'", text)
        verify = text.split("Verify the signed iPhone and watch build", 1)[1].split("- name:", 1)[0]
        self.assertIn("ditto -x -k", verify)
        self.assertNotIn("unzip", verify)
        helper = (ROOT / "scripts" / "ci-ios-signing.py").read_text()
        self.assertIn('"--verify", "--deep", "--strict", "--verbose=4"', helper)
        self.assertIn("build_number:", text)
        self.assertIn('default: "19"', text)
        self.assertIn("IOS_BUILD_NUMBER: ${{ inputs.build_number }}", text)
        self.assertIn("MARKETING_VERSION=1.0.0", text)
        self.assertIn('"$MARKETING_VERSION" != "1.0.0"', text)
        upload = text.split("uses: actions/upload-artifact@v4", 1)[1]
        self.assertIn("artifacts/public-logs/*.log", upload)
        self.assertNotIn(".ipa", upload)
        self.assertNotIn(".p12", upload)
        self.assertNotIn(".p8", upload)
        self.assertNotIn(".mobileprovision", upload)
        tvos = (ROOT / ".github" / "workflows" / "appletv-signed-testflight.yml").read_text()
        self.assertIn('EXPO_TV: "1"', tvos)
        self.assertIn("-t appletvos", tvos)
        self.assertNotIn("IOS_APP_PROFILE_BASE64", tvos)
        self.assertNotIn("WATCH_APP_PROFILE_BASE64", tvos)

    def test_shell_scripts_parse(self):
        for name in ("ci-ios-install-signing.sh", "ci-ios-cleanup-signing.sh"):
            subprocess.run(["bash", "-n", str(ROOT / "scripts" / name)], check=True)


if __name__ == "__main__":
    unittest.main()
