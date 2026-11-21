#!/usr/bin/env python3
"""Checks for the Apple Watch screenshot workflow."""

from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("ci_watch_screenshots", ROOT / "scripts" / "ci-watch-screenshots.py")
shots = importlib.util.module_from_spec(spec)
sys.modules["ci_watch_screenshots"] = shots
spec.loader.exec_module(shots)


def device(name: str, identifier: str) -> dict[str, str]:
    return {"name": name, "identifier": identifier, "productFamily": "watchOS"}


ULTRA2 = device("Apple Watch Ultra 2 (49mm)", "com.apple.CoreSimulator.SimDeviceType.Apple-Watch-Ultra-2-49mm")
ULTRA = device("Apple Watch Ultra (49mm)", "com.apple.CoreSimulator.SimDeviceType.Apple-Watch-Ultra-49mm")
ULTRA3 = device("Apple Watch Ultra 3 (49mm)", "com.apple.CoreSimulator.SimDeviceType.Apple-Watch-Ultra-3-49mm")
SERIES11 = device("Apple Watch Series 11 (46mm)", "com.apple.CoreSimulator.SimDeviceType.Apple-Watch-Series-11-46mm")
SERIES10_46 = device(
    "Apple Watch Series 10 (46mm)", "com.apple.CoreSimulator.SimDeviceType.Apple-Watch-Series-10-46mm"
)
SERIES10_42 = device(
    "Apple Watch Series 10 (42mm)", "com.apple.CoreSimulator.SimDeviceType.Apple-Watch-Series-10-42mm"
)
SERIES9 = device("Apple Watch Series 9 (45mm)", "com.apple.CoreSimulator.SimDeviceType.Apple-Watch-Series-9-45mm")
SERIES3_42 = device(
    "Apple Watch Series 3 (42mm)", "com.apple.CoreSimulator.SimDeviceType.Apple-Watch-Series-3-42mm"
)
SERIES3_38 = device(
    "Apple Watch Series 3 (38mm)", "com.apple.CoreSimulator.SimDeviceType.Apple-Watch-Series-3-38mm"
)
IPHONE = {"name": "iPhone 16", "identifier": "com.apple.CoreSimulator.SimDeviceType.iPhone-16", "productFamily": "iOS"}


def runtime(name: str, identifier: str, version: str, devices: list[dict[str, str]] | None) -> dict:
    entry = {"name": name, "identifier": identifier, "version": version, "isAvailable": True}
    if devices is not None:
        entry["supportedDeviceTypes"] = devices
    return entry


class RankTests(unittest.TestCase):
    def test_auto_prefers_ultra_2_then_46mm_then_other_accepted_sizes(self):
        entries = [SERIES10_42, SERIES3_38, IPHONE, SERIES9, ULTRA3, SERIES10_46, ULTRA, ULTRA2, SERIES11, SERIES3_42]
        runtimes = [
            runtime(
                "watchOS 26.0",
                "com.apple.CoreSimulator.SimRuntime.watchOS-26-0",
                "26.0",
                entries,
            )
        ]
        device, chosen_runtime = shots.choose_from(entries, runtimes, "auto")
        self.assertEqual(device.name, "Apple Watch Ultra 2 (49mm)")
        self.assertEqual((device.width, device.height), (410, 502))
        self.assertEqual(device.label, "Ultra 2, Ultra")
        self.assertEqual(chosen_runtime.name, "watchOS 26.0")

    def test_46mm_mode_skips_ultra_and_the_smaller_series_10(self):
        entries = [ULTRA2, SERIES10_42, SERIES10_46, SERIES11]
        runtimes = [runtime("watchOS 11.0", "watchOS-11", "11.0", entries)]
        device, _runtime = shots.choose_from(entries, runtimes, "series-46mm-416x496")
        self.assertEqual(device.name, "Apple Watch Series 11 (46mm)")
        self.assertEqual((device.width, device.height), (416, 496))

    def test_ultra_mode_uses_the_original_ultra_when_ultra_2_is_missing(self):
        entries = [SERIES11, ULTRA, ULTRA3]
        runtimes = [runtime("watchOS 26.1", "watchOS-26.1", "26.1", entries)]
        device, _runtime = shots.choose_from(entries, runtimes, "ultra-410x502")
        self.assertEqual(device.name, "Apple Watch Ultra (49mm)")
        self.assertEqual((device.width, device.height), (410, 502))

    def test_forced_mode_does_not_fall_back(self):
        entries = [SERIES11, ULTRA3]
        runtimes = [runtime("watchOS 26.0", "watchOS-26", "26.0", entries)]
        with self.assertRaises(shots.ScreenshotError):
            shots.choose_from(entries, runtimes, "ultra-410x502")

    def test_auto_falls_back_to_the_next_accepted_size(self):
        entries = [SERIES3_38, SERIES9, SERIES3_42]
        runtimes = [runtime("watchOS 10.0", "watchOS-10", "10.0", None)]
        device, _runtime = shots.choose_from(entries, runtimes, "auto")
        self.assertEqual((device.width, device.height), (396, 484))

    def test_newest_runtime_that_supports_the_device_wins(self):
        old = runtime("watchOS 10.0", "watchOS-10", "10.0", [ULTRA2])
        new = runtime("watchOS 26.0", "watchOS-26", "26.0", [SERIES11])
        unavailable = runtime("watchOS 27.0", "watchOS-27", "27.0", [ULTRA2])
        unavailable["isAvailable"] = False
        device, chosen = shots.choose_from([ULTRA2, SERIES11], [old, unavailable, new], "auto")
        self.assertEqual(device.name, ULTRA2["name"])
        self.assertEqual(chosen.identifier, "watchOS-10")

    def test_shell_env_quotes_the_device_name(self):
        device, chosen = shots.choose_from([ULTRA2], [runtime("watchOS 26.0", "watchOS-26", "26.0", None)], "auto")
        text = shots.shell_env(device, chosen)
        self.assertIn("WATCH_DEVICE_NAME='Apple Watch Ultra 2 (49mm)'", text)
        self.assertIn("WATCH_EXPECTED_WIDTH=410\n", text)
        self.assertIn("WATCH_EXPECTED_HEIGHT=502\n", text)


class StateTests(unittest.TestCase):
    def test_default_capture_is_the_disconnected_screen_plus_three_timer_faces(self):
        self.assertEqual(
            shots.parse_states("waiting,work,rest,finished"),
            ["waiting", "work", "rest", "finished"],
        )

    def test_rejects_a_short_list_a_duplicate_and_a_missing_waiting_screen(self):
        with self.assertRaises(shots.ScreenshotError):
            shots.parse_states("waiting,work")
        with self.assertRaises(shots.ScreenshotError):
            shots.parse_states("waiting,work,work,rest")
        with self.assertRaises(shots.ScreenshotError):
            shots.parse_states("work,rest,finished")


class PngTests(unittest.TestCase):
    def test_opaque_rgb_keeps_its_bytes_and_alpha_is_flattened(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            opaque = folder / "opaque.png"
            opaque.write_bytes(shots.encode_png(410, 502, 2, [b"\x01\x02\x03" * 410 for _ in range(502)]))
            before = opaque.read_bytes()
            width, height, alpha = shots.prepare_png(opaque)
            self.assertEqual((width, height, alpha), (410, 502, "opaque"))
            self.assertEqual(opaque.read_bytes(), before)

            clear = folder / "clear.png"
            clear.write_bytes(shots.encode_png(416, 496, 6, [b"\x00\x00\x00\x00" * 416 for _ in range(496)]))
            width, height, alpha = shots.prepare_png(clear)
            self.assertEqual((width, height, alpha), (416, 496, "alpha-removed"))
            out_width, out_height, color_type, rows = shots.decode_png(clear.read_bytes())
            self.assertEqual((out_width, out_height, color_type), (416, 496, 2))
            self.assertEqual(rows[0][:3], bytes(shots.FACE_BACKGROUND))

    def test_sub_filter_round_trip_pixels(self):
        raw = bytes([1, 10, 20, 30, 1, 2, 3])
        rows = shots._unfilter(raw, 2, 1, 3)
        self.assertEqual(bytes(rows[0]), bytes([10, 20, 30, 11, 22, 33]))

    def test_rejects_a_size_app_store_connect_does_not_list(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "wrong.png"
            path.write_bytes(shots.encode_png(100, 100, 2, [b"\x00\x00\x00" * 100 for _ in range(100)]))
            with self.assertRaises(shots.ScreenshotError):
                shots.prepare_png(path)


class WorkflowTests(unittest.TestCase):
    def test_workflow_is_manual_unsigned_and_captures_booted_screenshots(self):
        text = (ROOT / ".github" / "workflows" / "apple-watch-screenshots.yml").read_text()
        self.assertIn("name: Apple Watch screenshots", text)
        self.assertIn("workflow_dispatch:", text)
        self.assertNotIn("\n  push:", text)
        self.assertNotIn("pull_request:", text)
        self.assertNotIn("secrets.", text)
        self.assertNotIn("altool", text)
        self.assertNotIn("eas submit", text)
        self.assertNotIn("APP_STORE_CONNECT", text)
        self.assertIn("macos-26", text)
        self.assertIn("node-version: 22", text)
        self.assertIn("npm ci", text)
        self.assertNotIn('EXPO_TV: "1"', text)
        self.assertIn("npx expo prebuild --platform ios", text)
        self.assertIn("SDKROOT = iphoneos;", text)
        self.assertIn("WATCHOS_DEPLOYMENT_TARGET", text)
        self.assertIn("verify-prebuild", text)
        self.assertIn("CODE_SIGNING_ALLOWED=NO", text)
        self.assertIn("-scheme AmericanaWatch", text)
        self.assertIn('-workspace "$WORKSPACE"', text)
        self.assertIn('-project "$PROJECT"', text)
        self.assertIn("[ -d ios/Pods ]", text)
        self.assertIn("-sdk watchsimulator", text)
        self.assertIn('-destination "id=$WATCH_UDID"', text)
        self.assertIn("-configuration Debug", text)
        self.assertIn('-derivedDataPath "$DERIVED"', text)
        self.assertIn("Debug-watchsimulator/AmericanaWatch.app", text)
        self.assertNotIn("-target AmericanaWatch", text)
        self.assertNotIn("generic/platform=watchOS Simulator", text)
        self.assertIn("-AmericanaWatchPreview", text)
        self.assertIn("xcrun simctl install booted", text)
        self.assertIn('simctl launch booted "$WATCH_BUNDLE_ID" -AmericanaWatchPreview', text)
        self.assertIn("xcrun simctl io booted screenshot", text)
        self.assertIn("xcrun simctl status_bar booted override --time 9:41", text)
        self.assertIn("name: apple-watch-screenshots", text)
        self.assertIn("if: always()", text)
        self.assertIn("dimensions.txt", text)
        self.assertIn("artifacts/xcodebuild.log", text)
        self.assertGreaterEqual(text.count("if: always()"), 2)
        self.assertIn('default: "waiting,work,rest,finished"', text)
        self.assertIn("ultra-410x502", text)
        self.assertIn("series-46mm-416x496", text)


if __name__ == "__main__":
    unittest.main()
