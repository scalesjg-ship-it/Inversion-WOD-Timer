#!/usr/bin/env python3
"""Checks for the tvOS TestFlight signing helper and workflow contract."""

from __future__ import annotations

import base64
import importlib.util
import json
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


def watch_browse():
    return {
        "NSApplicationServices": {
            "Browses": [
                {
                    "NSApplicationServiceIdentifier": "Americana-Timer",
                    "NSApplicationServiceUsageDescription": "Finds the Apple Watch on this Wi-Fi.",
                    "NSApplicationServicePlatformSupport": ["watchOS"],
                }
            ]
        }
    }


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
        legacy = "iPhone Distribution: CrossFit Inversion LLC (BNP9QFC679)"
        legacy_project, _count = signing.apply_manual_signing(
            project, "Americana tvOS App Store b17", "23", legacy
        )
        self.assertIn(f'CODE_SIGN_IDENTITY = "{legacy}";', legacy_project)
        self.assertNotIn("appletvos*]=", legacy_project)
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
        self.assertEqual(
            signing.distribution_identity_name(good),
            "Apple Distribution: CrossFit Inversion LLC (BNP9QFC679)",
        )
        legacy = '  1) ABCDEF "iPhone Distribution: CrossFit Inversion LLC (BNP9QFC679)"\n'
        self.assertEqual(
            signing.distribution_identity_name(legacy),
            "iPhone Distribution: CrossFit Inversion LLC (BNP9QFC679)",
        )
        both = good + legacy
        self.assertTrue(signing.distribution_identity_name(both).startswith("Apple Distribution"))
        expect_fail(
            self,
            "PushPress",
            lambda: signing.distribution_identity_name(
                '  1) ABC "Apple Distribution: PushPress (BNP9QFC679)"\n'
            ),
        )
        expect_fail(
            self,
            "BNP9QFC679",
            lambda: signing.distribution_identity_name(
                '  1) ABC "Apple Distribution: Other LLC (AAAAAAAAAA)"\n'
            ),
        )
        expect_fail(
            self,
            "no Apple Distribution",
            lambda: signing.distribution_identity_name(
                '  1) ABC "Apple Development: CrossFit Inversion LLC (BNP9QFC679)"\n'
            ),
        )
        expect_fail(
            self,
            "must not contain '='",
            lambda: signing.signing_identity_value("Apple Distribution=bad"),
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
    def test_repo_identity_defaults_to_build_24(self):
        previous = os.environ.get("TVOS_BUILD_NUMBER")
        os.environ.pop("TVOS_BUILD_NUMBER", None)
        try:
            self.assertEqual(signing.read_plugin_tvos_build_number(ROOT), "24")
            self.assertEqual(signing.read_tvos_build_number(ROOT), "24")
            self.assertEqual(signing.assert_repo_identity(ROOT), "1.0.0")
        finally:
            if previous is not None:
                os.environ["TVOS_BUILD_NUMBER"] = previous

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
                    {"CFBundleVersion": "24", "CFBundleShortVersionString": "1.0.0", **watch_browse()},
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
            self.assertIn("TVOS_BUILD_NUMBER=24", exported)
            self.assertIn("MARKETING_VERSION=1.0.0", exported)
            self.assertIn("SOURCE_MARKETING_VERSION=1.0.0", exported)
            self.assertIn("Americana.xcworkspace", exported)
            self.assertIn("SCHEME=Americana", env_file.read_text())
            self.assertEqual(
                plistlib.loads((app / "Info.plist").read_bytes())["CFBundleShortVersionString"],
                "1.0.0",
            )

    def test_real_prebuild_tree_is_tvos_build_24(self):
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
        self.assertEqual(result["TVOS_BUILD_NUMBER"], "24")
        self.assertEqual(result["MARKETING_VERSION"], "1.0.0")
        self.assertEqual(result["SOURCE_MARKETING_VERSION"], "1.0.0")
        self.assertTrue(result["WORKSPACE"].endswith("Americana.xcworkspace"))


def write_tvos_tree(
    ios: Path,
    short_version: str = "1.0.0",
    *,
    variable_short_version: bool = False,
    build_number: str = "24",
) -> Path:
    project = ios / "Americana.xcodeproj"
    schemes = project / "xcshareddata" / "xcschemes"
    schemes.mkdir(parents=True)
    project_text = "\n".join(
        [
            "SDKROOT = appletvos;",
            "TARGETED_DEVICE_FAMILY = 3;",
            "TVOS_DEPLOYMENT_TARGET = 16.4;",
            'PRODUCT_BUNDLE_IDENTIFIER = "com.garrettscales.americana";',
            "\t\tAPP /* Release */ = {",
            "\t\t\tisa = XCBuildConfiguration;",
            "\t\t\tbuildSettings = {",
            "\t\t\t\tCURRENT_PROJECT_VERSION = 23;",
            '\t\t\t\tINFOPLIST_KEY_CFBundleShortVersionString = 1.0.0;',
            '\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = "com.garrettscales.americana";',
            "\t\t\t\tSDKROOT = appletvos;",
            "\t\t\t};",
            "\t\t\tname = Release;",
            "\t\t};",
            "\t\tPROJ /* Release */ = {",
            "\t\t\tisa = XCBuildConfiguration;",
            "\t\t\tbuildSettings = {",
            "\t\t\t\tMARKETING_VERSION = 1.0;",
            "\t\t\t\tSDKROOT = appletvos;",
            "\t\t\t};",
            "\t\t\tname = Release;",
            "\t\t};",
        ]
    )
    (project / "project.pbxproj").write_text(project_text + "\n")
    (schemes / "Americana.xcscheme").write_text(
        '<ArchiveAction\n   buildConfiguration = "Release"\n   revealArchiveInOrganizer = "YES">\n</ArchiveAction>\n'
    )
    (ios / "Americana.xcworkspace").mkdir()
    app = ios / "Americana"
    app.mkdir()
    short = "$(MARKETING_VERSION)" if variable_short_version else short_version
    with (app / "Info.plist").open("wb") as handle:
        plistlib.dump(
            {
                "CFBundleVersion": build_number,
                "CFBundleShortVersionString": short,
                "CFBundleName": "Americana",
                "CFBundleIdentifier": "$(PRODUCT_BUNDLE_IDENTIFIER)",
                **watch_browse(),
            },
            handle,
        )
    other = ios / "Other"
    other.mkdir()
    with (other / "Info.plist").open("wb") as handle:
        plistlib.dump(
            {"CFBundleVersion": "18", "CFBundleShortVersionString": "1.0.0"},
            handle,
        )
    pods = ios / "Pods"
    pods.mkdir()
    with (pods / "Info.plist").open("wb") as handle:
        plistlib.dump(
            {"CFBundleVersion": "23", "CFBundleShortVersionString": "1.0.0"},
            handle,
        )
    return project / "project.pbxproj"


class WatchBrowseTests(unittest.TestCase):
    def test_requires_the_watchos_browse_entry(self):
        signing.assert_watch_browse(watch_browse())
        expect_fail(self, "NSApplicationServices", lambda: signing.assert_watch_browse({}))
        expect_fail(
            self,
            "Americana-Timer",
            lambda: signing.assert_watch_browse(
                {
                    "NSApplicationServices": {
                        "Browses": [
                            {
                                "NSApplicationServiceIdentifier": "Other",
                                "NSApplicationServiceUsageDescription": "Nope",
                                "NSApplicationServicePlatformSupport": ["watchOS"],
                            }
                        ]
                    }
                }
            ),
        )
        expect_fail(
            self,
            "watchOS",
            lambda: signing.assert_watch_browse(
                {
                    "NSApplicationServices": {
                        "Browses": [
                            {
                                "NSApplicationServiceIdentifier": "Americana-Timer",
                                "NSApplicationServiceUsageDescription": "Finds the watch.",
                                "NSApplicationServicePlatformSupport": ["iOS"],
                            }
                        ]
                    }
                }
            ),
        )

    def test_check_watch_browse_reads_the_generated_plist(self):
        with tempfile.TemporaryDirectory() as tmp:
            ios = Path(tmp)
            write_tvos_tree(ios)
            signing.check_watch_browse(ios)


class MarketingVersionTests(unittest.TestCase):
    def test_marketing_version_must_be_higher_than_the_approved_release(self):
        self.assertEqual(signing.normalize_marketing_version("1.0.1"), "1.0.1")
        self.assertEqual(signing.normalize_marketing_version(" 1.2 "), "1.2")
        self.assertEqual(signing.normalize_marketing_version("2.0.0"), "2.0.0")
        expect_fail(self, "90062", lambda: signing.normalize_marketing_version("1.0.0"))
        expect_fail(self, "90062", lambda: signing.normalize_marketing_version("1.0"))
        expect_fail(self, "90062", lambda: signing.normalize_marketing_version("0.9.0"))
        expect_fail(self, "1.0.1", lambda: signing.normalize_marketing_version("1.0.1;rm -rf"))
        expect_fail(self, "marketing_version", lambda: signing.normalize_marketing_version(""))
        expect_fail(self, "marketing_version", lambda: signing.normalize_marketing_version("1.0.1\n2.0.0"))

    def test_build_number_is_a_positive_integer_and_skips_uploaded_1_0_1_builds(self):
        self.assertEqual(signing.normalize_build_number("24"), "24")
        self.assertEqual(signing.normalize_build_number(" 25 "), "25")
        signing.reject_known_tvos_build("1.0.1", "24")
        signing.reject_known_tvos_build("1.0.2", "1")
        expect_fail(self, "CFBundleVersion", lambda: signing.normalize_build_number("0"))
        expect_fail(self, "CFBundleVersion", lambda: signing.normalize_build_number("024"))
        expect_fail(self, "CFBundleVersion", lambda: signing.normalize_build_number("24;rm"))
        expect_fail(self, "CFBundleVersion", lambda: signing.normalize_build_number(""))
        expect_fail(self, "already VALID", lambda: signing.reject_known_tvos_build("1.0.1", "23"))
        expect_fail(self, "already VALID", lambda: signing.reject_known_tvos_build("1.0.1", "1"))

    def test_check_env_rejects_build_23_for_1_0_1_before_secrets(self):
        previous = {
            "TVOS_MARKETING_VERSION": os.environ.get("TVOS_MARKETING_VERSION"),
            "TVOS_BUILD_NUMBER": os.environ.get("TVOS_BUILD_NUMBER"),
        }
        os.environ["TVOS_MARKETING_VERSION"] = "1.0.1"
        os.environ["TVOS_BUILD_NUMBER"] = "23"
        try:
            expect_fail(self, "already VALID", signing.check_env)
        finally:
            for key, value in previous.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value

    def test_build_number_input_overrides_the_plugin_default(self):
        previous = os.environ.get("TVOS_BUILD_NUMBER")
        os.environ["TVOS_BUILD_NUMBER"] = "25"
        app_json = (ROOT / "app.json").read_bytes()
        try:
            self.assertEqual(signing.read_tvos_build_number(ROOT), "25")
            with tempfile.TemporaryDirectory() as tmp:
                ios = Path(tmp)
                write_tvos_tree(ios, build_number="25")
                result = signing.verify_prebuild(ROOT, ios, "1.0.1")
                plist = plistlib.loads((ios / "Americana" / "Info.plist").read_bytes())
            self.assertEqual(result["TVOS_BUILD_NUMBER"], "25")
            self.assertEqual(result["MARKETING_VERSION"], "1.0.1")
            self.assertEqual(plist["CFBundleVersion"], "25")
            self.assertEqual(plist["CFBundleShortVersionString"], "1.0.1")
            self.assertEqual((ROOT / "app.json").read_bytes(), app_json)
            stored = json.loads(app_json)
            self.assertEqual(stored["expo"]["version"], "1.0.0")
            self.assertEqual(stored["expo"]["ios"]["buildNumber"], "18")
            self.assertEqual(stored["expo"]["android"]["versionCode"], 12)
        finally:
            if previous is None:
                os.environ.pop("TVOS_BUILD_NUMBER", None)
            else:
                os.environ["TVOS_BUILD_NUMBER"] = previous

    def test_verify_prebuild_rejects_an_uploaded_1_0_1_build(self):
        previous = os.environ.get("TVOS_BUILD_NUMBER")
        os.environ["TVOS_BUILD_NUMBER"] = "23"
        try:
            with tempfile.TemporaryDirectory() as tmp:
                ios = Path(tmp)
                write_tvos_tree(ios, build_number="23")
                expect_fail(self, "already VALID", lambda: signing.verify_prebuild(ROOT, ios, "1.0.1"))
                stored = json.loads((ROOT / "app.json").read_text())
                self.assertEqual(stored["expo"]["ios"]["buildNumber"], "18")
                self.assertEqual(stored["expo"]["version"], "1.0.0")
        finally:
            if previous is None:
                os.environ.pop("TVOS_BUILD_NUMBER", None)
            else:
                os.environ["TVOS_BUILD_NUMBER"] = previous

    def test_blank_build_number_uses_the_plugin_default(self):
        previous = os.environ.get("TVOS_BUILD_NUMBER")
        os.environ["TVOS_BUILD_NUMBER"] = "   "
        try:
            self.assertEqual(signing.read_tvos_build_number(ROOT), "24")
        finally:
            if previous is None:
                os.environ.pop("TVOS_BUILD_NUMBER", None)
            else:
                os.environ["TVOS_BUILD_NUMBER"] = previous

    def test_check_env_rejects_the_approved_version_before_secrets(self):
        previous = os.environ.get("TVOS_MARKETING_VERSION")
        os.environ["TVOS_MARKETING_VERSION"] = "1.0.0"
        try:
            expect_fail(self, "90062", signing.check_env)
        finally:
            if previous is None:
                os.environ.pop("TVOS_MARKETING_VERSION", None)
            else:
                os.environ["TVOS_MARKETING_VERSION"] = previous

    def test_project_marketing_version_is_applied_to_the_app_target(self):
        project = "\n".join(
            [
                "\t\tAPP /* Release */ = {",
                "\t\t\tisa = XCBuildConfiguration;",
                "\t\t\tbuildSettings = {",
                "\t\t\t\tCURRENT_PROJECT_VERSION = 23;",
                '\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = "com.garrettscales.americana";',
                "\t\t\t\tSDKROOT = appletvos;",
                "\t\t\t};",
                "\t\t\tname = Release;",
                "\t\t};",
                "\t\tPROJ /* Release */ = {",
                "\t\t\tisa = XCBuildConfiguration;",
                "\t\t\tbuildSettings = {",
                "\t\t\t\tMARKETING_VERSION = 1.0;",
                '\t\t\t\tINFOPLIST_KEY_CFBundleShortVersionString = "1.0.0";',
                "\t\t\t\tSDKROOT = appletvos;",
                "\t\t\t};",
                "\t\t\tname = Release;",
                "\t\t};",
                "\t\tTESTS /* Release */ = {",
                "\t\t\tisa = XCBuildConfiguration;",
                "\t\t\tbuildSettings = {",
                '\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = "com.garrettscales.americana.uitests";',
                "\t\t\t\tSDKROOT = appletvos;",
                "\t\t\t};",
                "\t\t\tname = Release;",
                "\t\t};",
            ]
        )
        updated = signing.apply_tvos_marketing_version(project, "1.0.1")
        self.assertEqual(updated.count("MARKETING_VERSION = 1.0.1;"), 2)
        self.assertNotIn("MARKETING_VERSION = 1.0;", updated)
        self.assertIn("INFOPLIST_KEY_CFBundleShortVersionString = 1.0.1;", updated)
        self.assertIn("CURRENT_PROJECT_VERSION = 23;", updated)
        self.assertIn('PRODUCT_BUNDLE_IDENTIFIER = "com.garrettscales.americana.uitests";', updated)
        app_block = updated.split("TESTS /* Release */", 1)[0]
        test_block = updated.split("TESTS /* Release */", 1)[1]
        self.assertEqual(app_block.count("MARKETING_VERSION = 1.0.1;"), 2)
        self.assertNotIn("MARKETING_VERSION", test_block)
        expect_fail(self, "90062", lambda: signing.apply_tvos_marketing_version(project, "1.0.0"))

    def test_verify_prebuild_overrides_only_the_tvos_plist(self):
        app_json = (ROOT / "app.json").read_bytes()
        with tempfile.TemporaryDirectory() as tmp:
            ios = Path(tmp)
            pbx = write_tvos_tree(ios)
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
                        "--marketing-version",
                        "1.0.1",
                    ]
                )
            finally:
                if previous is None:
                    os.environ.pop("GITHUB_ENV", None)
                else:
                    os.environ["GITHUB_ENV"] = previous
            exported = github_env.read_text()
            self.assertIn("MARKETING_VERSION=1.0.1", exported)
            self.assertIn("SOURCE_MARKETING_VERSION=1.0.0", exported)
            self.assertIn("TVOS_BUILD_NUMBER=24", exported)
            app_plist = plistlib.loads((ios / "Americana" / "Info.plist").read_bytes())
            self.assertEqual(app_plist["CFBundleShortVersionString"], "1.0.1")
            self.assertEqual(app_plist["CFBundleVersion"], "24")
            self.assertEqual(app_plist["CFBundleName"], "Americana")
            other = plistlib.loads((ios / "Other" / "Info.plist").read_bytes())
            self.assertEqual(other["CFBundleShortVersionString"], "1.0.0")
            self.assertEqual(other["CFBundleVersion"], "18")
            pods = plistlib.loads((ios / "Pods" / "Info.plist").read_bytes())
            self.assertEqual(pods["CFBundleShortVersionString"], "1.0.0")
            project_text = pbx.read_text()
            self.assertIn("MARKETING_VERSION = 1.0.1;", project_text)
            self.assertIn("INFOPLIST_KEY_CFBundleShortVersionString = 1.0.1;", project_text)
            self.assertIn("CURRENT_PROJECT_VERSION = 23;", project_text)
            signed, count = signing.apply_manual_signing(
                project_text, "Americana tvOS App Store b17", "23"
            )
            self.assertEqual(count, 1)
            self.assertIn("MARKETING_VERSION = 1.0.1;", signed)
            self.assertIn("CURRENT_PROJECT_VERSION = 23;", signed)
            self.assertEqual((ROOT / "app.json").read_bytes(), app_json)
            stored = json.loads(app_json)
            self.assertEqual(stored["expo"]["version"], "1.0.0")
            self.assertEqual(stored["expo"]["ios"]["buildNumber"], "18")
            self.assertEqual(stored["expo"]["android"]["versionCode"], 12)

    def test_variable_short_version_is_replaced_with_the_override(self):
        with tempfile.TemporaryDirectory() as tmp:
            ios = Path(tmp)
            write_tvos_tree(ios, variable_short_version=True)
            result = signing.verify_prebuild(ROOT, ios, "1.0.1")
            plist = plistlib.loads((ios / "Americana" / "Info.plist").read_bytes())
            self.assertEqual(plist["CFBundleShortVersionString"], "1.0.1")
            self.assertEqual(result["MARKETING_VERSION"], "1.0.1")
            self.assertEqual(result["SOURCE_MARKETING_VERSION"], "1.0.0")


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
        self.assertIn('CODE_SIGN_IDENTITY=$CODE_SIGN_IDENTITY', text)
        self.assertNotIn('"CODE_SIGN_IDENTITY[sdk=appletvos*]=Apple Distribution"', text)
        self.assertIn("security find-identity -v -p codesigning", text)
        self.assertIn("-t appletvos", text)
        self.assertNotIn("xcrun notarytool", text)
        self.assertNotIn("eas submit", text)
        self.assertIn("confirm", text)
        self.assertIn("UPLOAD", text)
        self.assertIn("marketing_version:", text)
        self.assertIn('default: "1.0.1"', text)
        self.assertIn("TVOS_MARKETING_VERSION: ${{ inputs.marketing_version }}", text)
        self.assertIn("build_number:", text)
        self.assertIn('default: "24"', text)
        self.assertIn("TVOS_BUILD_NUMBER: ${{ inputs.build_number }}", text)
        self.assertNotIn("CFBundleVersion stays 23", text)
        self.assertIn('--marketing-version "$TVOS_MARKETING_VERSION"', text)
        self.assertIn('--marketing-version "$MARKETING_VERSION"', text)
        self.assertIn('"$MARKETING_VERSION" = "1.0.0"', text)
        self.assertIn('"CURRENT_PROJECT_VERSION=$TVOS_BUILD_NUMBER"', text)
        self.assertIn('"MARKETING_VERSION=$MARKETING_VERSION"', text)
        self.assertIn("SOURCE_MARKETING_VERSION", text)
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
