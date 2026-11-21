#!/usr/bin/env python3
"""Pick an App Store-sized Apple Watch simulator and record screenshot pixels.

Apple's screenshot specifications (read 21 November 2026):
https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/

One Apple Watch size is used for every localization. Accepted pixels are:

  422 x 514  Ultra 4, Ultra 3
  410 x 502  Ultra 2, Ultra
  416 x 496  Series 12, Series 11, Series 10 (the 46mm screen)
  396 x 484  Series 9, Series 8, Series 7
  368 x 448  Series 6, Series 5, Series 4, SE 3, SE 2, SE
  312 x 390  Series 3, Series 2, Series 1

auto prefers 410x502, then a 46mm Series at 416x496, then any other accepted size
the installed watchOS runtime can boot. This script does not sign or upload.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shlex
import struct
import subprocess
import sys
import zlib
from dataclasses import dataclass
from pathlib import Path
from typing import NoReturn

ACCEPTED: dict[tuple[int, int], str] = {
    (422, 514): "Ultra 4, Ultra 3",
    (410, 502): "Ultra 2, Ultra",
    (416, 496): "Series 12, Series 11, Series 10",
    (396, 484): "Series 9, Series 8, Series 7",
    (368, 448): "Series 6, Series 5, Series 4, SE 3, SE 2, SE",
    (312, 390): "Series 3, Series 2, Series 1",
}

PREFERENCES = ("auto", "ultra-410x502", "series-46mm-416x496")
PREVIEW_STATES = ("waiting", "getReady", "work", "rest", "finished")
# TimerFace's background, used only where a screenshot pixel is translucent.
FACE_BACKGROUND = (7, 8, 10)
PNG_SIG = b"\x89PNG\r\n\x1a\n"
SPEC_URL = (
    "https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/"
)


class ScreenshotError(Exception):
    pass


def fail(message: str) -> NoReturn:
    raise ScreenshotError(message)


@dataclass(frozen=True)
class WatchDevice:
    name: str
    identifier: str
    width: int
    height: int
    label: str
    rank: int
    generation: int


@dataclass(frozen=True)
class WatchRuntime:
    name: str
    identifier: str
    version: tuple[int, ...]
    device_ids: frozenset[str] | None


def parse_states(text: str) -> list[str]:
    """3 or 4 preview names. waiting is the not-connected screen."""
    parts = [part.strip() for part in text.split(",") if part.strip()]
    if len(parts) < 3 or len(parts) > 4:
        fail(f"Capture 3 or 4 states, got {len(parts)}: {parts or '(none)'}")
    unknown = [part for part in parts if part not in PREVIEW_STATES]
    if unknown:
        fail(f"Unknown preview state {unknown}. Allowed: {', '.join(PREVIEW_STATES)}")
    if len(set(parts)) != len(parts):
        fail(f"Duplicate preview state in {parts}")
    if "waiting" not in parts:
        fail("Include waiting, the not-connected Apple TV screen")
    return parts


def _generation(name: str) -> int:
    series = re.search(r"series\s+(\d+)", name, re.IGNORECASE)
    if series:
        return int(series.group(1))
    ultra = re.search(r"ultra\s+([234])", name, re.IGNORECASE)
    if ultra:
        return int(ultra.group(1))
    if re.search(r"\bultra\b", name, re.IGNORECASE):
        return 1
    return 0


def rank_device(name: str, preference: str) -> tuple[int, tuple[int, int]] | None:
    """Lower rank is a better screenshot device. None means this name cannot be used."""
    if preference not in PREFERENCES:
        fail(f"Unknown device preference {preference!r}. Use {', '.join(PREFERENCES)}")
    lowered = name.lower()
    if "apple watch" not in lowered:
        return None
    ultra2 = "ultra 2" in lowered
    ultra3 = "ultra 3" in lowered
    ultra4 = "ultra 4" in lowered
    plain_ultra = "ultra" in lowered and not (ultra2 or ultra3 or ultra4)
    series_46 = "46mm" in lowered and "series" in lowered
    if preference == "ultra-410x502":
        if ultra2:
            return 0, (410, 502)
        if plain_ultra:
            return 1, (410, 502)
        return None
    if preference == "series-46mm-416x496":
        if series_46:
            return 0, (416, 496)
        return None
    if ultra2:
        return 0, (410, 502)
    if plain_ultra:
        return 1, (410, 502)
    if series_46:
        return 2, (416, 496)
    if ultra3 or ultra4:
        return 3, (422, 514)
    if "45mm" in lowered:
        return 4, (396, 484)
    if "44mm" in lowered:
        return 5, (368, 448)
    if "42mm" in lowered and re.search(r"series\s+[123]\b", lowered):
        return 6, (312, 390)
    return None


def devices_from(entries: list[dict[str, object]], preference: str) -> list[WatchDevice]:
    chosen: list[WatchDevice] = []
    for entry in entries:
        name = str(entry.get("name", ""))
        identifier = str(entry.get("identifier", ""))
        family = str(entry.get("productFamily", ""))
        if family and "watch" not in family.lower():
            continue
        ranked = rank_device(name, preference)
        if ranked is None or not identifier:
            continue
        rank, size = ranked
        label = ACCEPTED[size]
        chosen.append(
            WatchDevice(
                name=name,
                identifier=identifier,
                width=size[0],
                height=size[1],
                label=label,
                rank=rank,
                generation=_generation(name),
            )
        )
    chosen.sort(key=lambda device: (device.rank, -device.generation, device.name))
    return chosen


def _version(runtime: dict[str, object]) -> tuple[int, ...]:
    raw = str(runtime.get("version") or "")
    parts: list[int] = []
    for piece in raw.split("."):
        digits = "".join(char for char in piece if char.isdigit())
        if digits:
            parts.append(int(digits))
    return tuple(parts)


def _available(runtime: dict[str, object]) -> bool:
    if "isAvailable" in runtime:
        return bool(runtime["isAvailable"])
    text = str(runtime.get("availability", "")).lower()
    return "unavailable" not in text


def runtimes_from(entries: list[dict[str, object]]) -> list[WatchRuntime]:
    found: list[WatchRuntime] = []
    for entry in entries:
        name = str(entry.get("name", ""))
        identifier = str(entry.get("identifier", ""))
        if "watchos" not in name.lower() and "watchos" not in identifier.lower():
            continue
        if not _available(entry) or not identifier:
            continue
        supported = entry.get("supportedDeviceTypes")
        device_ids: frozenset[str] | None
        if supported is None:
            device_ids = None
        elif isinstance(supported, list):
            device_ids = frozenset(
                str(item.get("identifier", "")) for item in supported if isinstance(item, dict)
            )
        else:
            device_ids = frozenset()
        found.append(
            WatchRuntime(
                name=name,
                identifier=identifier,
                version=_version(entry),
                device_ids=device_ids,
            )
        )
    found.sort(key=lambda runtime: runtime.version, reverse=True)
    return found


def choose_from(
    device_entries: list[dict[str, object]],
    runtime_entries: list[dict[str, object]],
    preference: str,
) -> tuple[WatchDevice, WatchRuntime]:
    devices = devices_from(device_entries, preference)
    runtimes = runtimes_from(runtime_entries)
    if not runtimes:
        fail("No available watchOS simulator runtime")
    if not devices:
        names = sorted(
            str(entry.get("name", ""))
            for entry in device_entries
            if "watch" in str(entry.get("name", "")).lower()
        )
        fail(
            f"No Apple Watch simulator matches {preference}. "
            f"Installed watch device types: {', '.join(names) or '(none)'}"
        )
    for device in devices:
        for runtime in runtimes:
            if runtime.device_ids is not None and device.identifier not in runtime.device_ids:
                continue
            return device, runtime
    fail(
        "No watchOS runtime supports "
        + ", ".join(device.name for device in devices)
        + ". Runtimes: "
        + ", ".join(runtime.name for runtime in runtimes)
    )


def shell_env(device: WatchDevice, runtime: WatchRuntime) -> str:
    pairs = {
        "WATCH_DEVICE_NAME": device.name,
        "WATCH_DEVICE_TYPE": device.identifier,
        "WATCH_RUNTIME_ID": runtime.identifier,
        "WATCH_RUNTIME_NAME": runtime.name,
        "WATCH_EXPECTED_WIDTH": str(device.width),
        "WATCH_EXPECTED_HEIGHT": str(device.height),
        "WATCH_SIZE_LABEL": device.label,
    }
    return "".join(f"{key}={shlex.quote(value)}\n" for key, value in pairs.items())


def simctl_json(*args: str) -> dict[str, object]:
    raw = subprocess.check_output(["xcrun", "simctl", "list", *args, "-j"], text=True)
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        fail(f"simctl list {' '.join(args)} did not return an object")
    return parsed


def choose(preference: str) -> str:
    devices = simctl_json("devicetypes")
    runtimes = simctl_json("runtimes")
    device_entries = devices.get("devicetypes") or devices.get("deviceTypes") or []
    runtime_entries = runtimes.get("runtimes") or []
    if not isinstance(device_entries, list) or not isinstance(runtime_entries, list):
        fail("simctl JSON is missing devicetypes or runtimes")
    device, runtime = choose_from(device_entries, runtime_entries, preference or "auto")
    print(
        f"Using {device.name} on {runtime.name} for {device.width}x{device.height} ({device.label})",
        file=sys.stderr,
    )
    return shell_env(device, runtime)


def _chunk(chunk_type: bytes, payload: bytes) -> bytes:
    crc = zlib.crc32(chunk_type + payload) & 0xFFFFFFFF
    return struct.pack(">I", len(payload)) + chunk_type + payload + struct.pack(">I", crc)


def encode_png(width: int, height: int, color_type: int, rows: list[bytes]) -> bytes:
    """8-bit non-interlaced PNG. rows are raw samples with no filter byte."""
    if color_type not in {2, 6}:
        fail(f"encode_png supports RGB and RGBA, not color type {color_type}")
    raw = bytearray()
    for row in rows:
        raw.append(0)
        raw.extend(row)
    ihdr = struct.pack(">IIBBBBB", width, height, 8, color_type, 0, 0, 0)
    return PNG_SIG + _chunk(b"IHDR", ihdr) + _chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + _chunk(b"IEND", b"")


def _paeth(left: int, up: int, up_left: int) -> int:
    estimate = left + up - up_left
    if abs(estimate - left) <= abs(estimate - up) and abs(estimate - left) <= abs(estimate - up_left):
        return left
    if abs(estimate - up) <= abs(estimate - up_left):
        return up
    return up_left


def _unfilter(raw: bytes, width: int, height: int, bpp: int) -> list[bytearray]:
    stride = width * bpp
    expected = height * (stride + 1)
    if len(raw) != expected:
        fail(f"PNG image data is {len(raw)} bytes, expected {expected}")
    rows: list[bytearray] = []
    previous = bytearray(stride)
    offset = 0
    for _ in range(height):
        filter_type = raw[offset]
        offset += 1
        scan = raw[offset : offset + stride]
        offset += stride
        recon = bytearray(stride)
        for index, value in enumerate(scan):
            left = recon[index - bpp] if index >= bpp else 0
            up = previous[index]
            up_left = previous[index - bpp] if index >= bpp else 0
            if filter_type == 0:
                recon[index] = value
            elif filter_type == 1:
                recon[index] = (value + left) & 255
            elif filter_type == 2:
                recon[index] = (value + up) & 255
            elif filter_type == 3:
                recon[index] = (value + ((left + up) // 2)) & 255
            elif filter_type == 4:
                recon[index] = (value + _paeth(left, up, up_left)) & 255
            else:
                fail(f"Unsupported PNG filter {filter_type}")
        rows.append(recon)
        previous = recon
    return rows


def decode_png(data: bytes) -> tuple[int, int, int, list[bytearray]]:
    if not data.startswith(PNG_SIG):
        fail("File is not a PNG")
    offset = 8
    ihdr = None
    idat: list[bytes] = []
    while offset + 8 <= len(data):
        length = struct.unpack(">I", data[offset : offset + 4])[0]
        chunk_type = data[offset + 4 : offset + 8]
        start = offset + 8
        end = start + length
        if end + 4 > len(data):
            fail("PNG chunk is truncated")
        payload = data[start:end]
        offset = end + 4
        if chunk_type == b"IHDR":
            ihdr = payload
        elif chunk_type == b"IDAT":
            idat.append(payload)
        elif chunk_type == b"IEND":
            break
    if ihdr is None or not idat:
        fail("PNG is missing IHDR or IDAT")
    if len(ihdr) < 13:
        fail("PNG IHDR is short")
    width, height, bit_depth, color_type, compression, png_filter, interlace = struct.unpack(
        ">IIBBBBB", ihdr[:13]
    )
    if bit_depth != 8 or compression != 0 or png_filter != 0 or interlace != 0:
        fail(
            "PNG must be 8-bit, non-interlaced, with standard compression "
            f"(bit depth {bit_depth}, interlace {interlace})"
        )
    if color_type not in {2, 6}:
        fail(f"PNG color type {color_type} is not RGB or RGBA")
    bpp = 4 if color_type == 6 else 3
    rows = _unfilter(zlib.decompress(b"".join(idat)), width, height, bpp)
    return width, height, color_type, rows


def _composite(row: bytearray, width: int) -> bytes:
    out = bytearray()
    for index in range(width):
        red, green, blue, alpha = row[index * 4 : index * 4 + 4]
        if alpha == 255:
            out.extend((red, green, blue))
            continue
        cover = alpha / 255
        remain = 1 - cover
        out.extend(
            (
                round(red * cover + FACE_BACKGROUND[0] * remain),
                round(green * cover + FACE_BACKGROUND[1] * remain),
                round(blue * cover + FACE_BACKGROUND[2] * remain),
            )
        )
    return bytes(out)


def prepare_png(path: Path) -> tuple[int, int, str]:
    """Return width, height, and whether alpha was removed. Opaque RGB is left untouched."""
    original = path.read_bytes()
    width, height, color_type, rows = decode_png(original)
    if (width, height) not in ACCEPTED:
        fail(
            f"{path.name} is {width}x{height}, which App Store Connect does not accept for Apple Watch. "
            f"Accepted: {', '.join(f'{w}x{h}' for w, h in ACCEPTED)}"
        )
    if color_type == 2:
        return width, height, "opaque"
    flat = [_composite(row, width) for row in rows]
    path.write_bytes(encode_png(width, height, 2, flat))
    return width, height, "alpha-removed"


def write_dimensions(
    directory: Path,
    expected_width: int,
    expected_height: int,
    device: str,
    runtime: str,
    status_bar: str,
    out: Path,
) -> str:
    if (expected_width, expected_height) not in ACCEPTED:
        fail(f"Expected size {expected_width}x{expected_height} is not an App Store Watch size")
    pngs = sorted(path for path in directory.glob("*.png") if path.is_file())
    if not pngs:
        fail(f"No PNGs in {directory}")
    lines = [
        f"source: {SPEC_URL}",
        "accepted: "
        + "; ".join(f"{width}x{height} ({label})" for (width, height), label in ACCEPTED.items()),
        f"simulator: {device}",
        f"runtime: {runtime}",
        f"expected: {expected_width}x{expected_height} ({ACCEPTED[(expected_width, expected_height)]})",
        f"status_bar: {status_bar}",
        "alpha: App Store Connect rejects transparency. Opaque screenshots are unchanged. "
        "Translucent pixels are composited on #07080A, the watch face background.",
        "",
    ]
    summary = [
        "## Apple Watch screenshots",
        "",
        f"- Simulator: {device} ({runtime})",
        f"- App Store size: {expected_width}x{expected_height} ({ACCEPTED[(expected_width, expected_height)]})",
        f"- Status bar: {status_bar}",
        "",
        "| File | Pixels | Alpha |",
        "| --- | --- | --- |",
    ]
    problems: list[str] = []
    for path in pngs:
        width, height, alpha = prepare_png(path)
        if (width, height) != (expected_width, expected_height):
            problems.append(
                f"{path.name} is {width}x{height}, expected {expected_width}x{expected_height} from {device}."
            )
        lines.append(f"{path.name} {width}x{height} {alpha}")
        summary.append(f"| `{path.name}` | {width}x{height} | {alpha} |")
    text = "\n".join(lines) + "\n"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text)
    step = os.environ.get("GITHUB_STEP_SUMMARY")
    if step:
        with open(step, "a", encoding="utf-8") as handle:
            handle.write("\n".join(summary) + "\n")
    if problems:
        fail(" ".join(problems))
    return text


def watch_target_id(project_text: str, name: str = "AmericanaWatch") -> str:
    """Return the PBXNativeTarget id for the watch app. The iPhone target is ignored."""
    pattern = re.compile(
        r"(?P<id>[A-Fa-f0-9]{24})[^\n{]* = \{\s*isa = PBXNativeTarget;(?P<body>.*?)\n[ \t]*\};",
        re.DOTALL,
    )
    found: list[str] = []
    for match in pattern.finditer(project_text):
        named = re.search(r"^[ \t]*name = \"?([^;\"]+)\"?;", match.group("body"), re.MULTILINE)
        if named and named.group(1) == name:
            found.append(match.group("id"))
    if len(found) != 1:
        fail(f"Expected one {name} native target in the Xcode project, found {len(found)}")
    return found[0]


def watch_scheme_xml(target_id: str, project_name: str, name: str = "AmericanaWatch") -> str:
    """Shared scheme that builds only the watch app, with implicit dependencies off.

    Opening the CocoaPods workspace and building this scheme otherwise compiles the
    iPhone Pods for the watch simulator.
    """
    if name == "Americana" or "Pods" in name:
        fail(f"Refusing to write a watch scheme for {name}")
    reference = f"""<BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "{target_id}"
               BuildableName = "{name}.app"
               BlueprintName = "{name}"
               ReferencedContainer = "container:{project_name}">
            </BuildableReference>"""
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Scheme
   LastUpgradeVersion = "2600"
   version = "1.7">
   <BuildAction
      parallelizeBuildables = "NO"
      buildImplicitDependencies = "NO">
      <BuildActionEntries>
         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "YES"
            buildForAnalyzing = "YES">
            {reference}
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      shouldUseLaunchSchemeArgsEnv = "YES">
   </TestAction>
   <LaunchAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      launchStyle = "0"
      useCustomWorkingDirectory = "NO"
      ignoresPersistentStateOnLaunch = "NO"
      debugDocumentVersioning = "YES"
      debugServiceExtension = "internal"
      allowLocationSimulation = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         {reference}
      </BuildableProductRunnable>
   </LaunchAction>
   <ProfileAction
      buildConfiguration = "Release"
      shouldUseLaunchSchemeArgsEnv = "YES"
      savedToolIdentifier = ""
      useCustomWorkingDirectory = "NO"
      debugDocumentVersioning = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         {reference}
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction
      buildConfiguration = "Debug">
   </AnalyzeAction>
   <ArchiveAction
      buildConfiguration = "Release"
      revealArchiveInOrganizer = "YES">
   </ArchiveAction>
</Scheme>
"""
    names = re.findall(r'BlueprintName = "([^"]+)"', xml)
    if names != [name, name, name]:
        fail(f"Watch scheme must reference only {name}, found {names or '(none)'}")
    if xml.count(f'BlueprintIdentifier = "{target_id}"') != 3:
        fail("Watch scheme did not reference only the watch target")
    if 'buildImplicitDependencies = "NO"' not in xml or 'parallelizeBuildables = "NO"' not in xml:
        fail("Watch scheme still builds implicit dependencies")
    if 'buildImplicitDependencies = "YES"' in xml or 'parallelizeBuildables = "YES"' in xml:
        fail("Watch scheme still builds implicit dependencies")
    return xml


def write_watch_scheme(project: Path, name: str = "AmericanaWatch") -> Path:
    """Write xcshareddata/xcschemes/AmericanaWatch.xcscheme for one watch target."""
    if project.suffix != ".xcodeproj" or not project.is_dir():
        fail(f"Expected an xcodeproj directory, got {project}")
    pbx = project / "project.pbxproj"
    if not pbx.is_file():
        fail(f"Missing {pbx}")
    target_id = watch_target_id(pbx.read_text(), name)
    scheme_dir = project / "xcshareddata" / "xcschemes"
    scheme_dir.mkdir(parents=True, exist_ok=True)
    scheme_path = scheme_dir / f"{name}.xcscheme"
    scheme_path.write_text(watch_scheme_xml(target_id, project.name, name))
    return scheme_path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)

    choose_cmd = sub.add_parser("choose")
    choose_cmd.add_argument("--preference", default="auto")

    states_cmd = sub.add_parser("states")
    states_cmd.add_argument("--text", required=True)

    dimensions_cmd = sub.add_parser("dimensions")
    dimensions_cmd.add_argument("--dir", required=True)
    dimensions_cmd.add_argument("--width", type=int, required=True)
    dimensions_cmd.add_argument("--height", type=int, required=True)
    dimensions_cmd.add_argument("--device", required=True)
    dimensions_cmd.add_argument("--runtime", required=True)
    dimensions_cmd.add_argument("--status-bar", required=True)
    dimensions_cmd.add_argument("--out", required=True)

    scheme_cmd = sub.add_parser("scheme")
    scheme_cmd.add_argument("--project", required=True)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.cmd == "choose":
            preference = args.preference.strip() or "auto"
            sys.stdout.write(choose(preference))
            return 0
        if args.cmd == "states":
            for name in parse_states(args.text):
                print(name)
            return 0
        if args.cmd == "dimensions":
            text = write_dimensions(
                Path(args.dir),
                args.width,
                args.height,
                args.device,
                args.runtime,
                args.status_bar,
                Path(args.out),
            )
            sys.stdout.write(text)
            return 0
        if args.cmd == "scheme":
            scheme_path = write_watch_scheme(Path(args.project))
            print(f"Wrote {scheme_path} for AmericanaWatch only")
            return 0
        fail(f"Unknown command {args.cmd}")
    except ScreenshotError as error:
        print(f"::error::{error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except BrokenPipeError:
        raise SystemExit(1)
