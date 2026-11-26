"""Print the UDID of an available tvOS simulator, preferring a 1080p Apple TV."""

import json
import subprocess
import sys


def main() -> None:
    raw = subprocess.check_output(["xcrun", "simctl", "list", "devices", "available", "-j"], text=True)
    devices = json.loads(raw)["devices"]
    tvs: list[dict[str, object]] = []
    for runtime, entries in devices.items():
        if "tvOS" not in runtime:
            continue
        for entry in entries:
            if entry.get("isAvailable"):
                tvs.append(entry)
    if not tvs:
        sys.exit("No available tvOS simulator")

    def rank(entry: dict[str, object]) -> int:
        name = str(entry["name"])
        score = 0
        if "1080p" in name:
            score += 3
        if "4K" in name:
            score += 1
        return score

    tvs.sort(key=rank, reverse=True)
    chosen = tvs[0]
    print(f"Simulator {chosen['name']} {chosen['udid']}", file=sys.stderr)
    print(chosen["udid"])


if __name__ == "__main__":
    main()
