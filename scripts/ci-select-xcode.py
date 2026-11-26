"""Print the DEVELOPER_DIR of the newest Xcode that is 26.4 or newer."""

import os
import pathlib
import subprocess
import sys


def version_of(developer: str) -> tuple[int, ...]:
    env = os.environ.copy()
    env["DEVELOPER_DIR"] = developer
    out = subprocess.check_output(["xcodebuild", "-version"], env=env, text=True)
    return tuple(int(part) for part in out.splitlines()[0].split()[-1].split("."))


def main() -> None:
    found: list[tuple[tuple[int, ...], str, str]] = []
    for app in pathlib.Path("/Applications").glob("Xcode*.app"):
        developer = str(app / "Contents" / "Developer")
        try:
            found.append((version_of(developer), developer, app.name))
        except (OSError, subprocess.CalledProcessError, ValueError) as error:
            print(f"skip {app}: {error}", file=sys.stderr)
    found.sort()
    print("Installed Xcode:", file=sys.stderr)
    for version, developer, name in found:
        print(f"  {name} {'.'.join(map(str, version))} {developer}", file=sys.stderr)
    usable = [item for item in found if item[0] >= (26, 4)]
    if not usable:
        sys.exit("No Xcode 26.4 or newer is installed")
    print(usable[-1][1])
    print(f"Using {usable[-1][2]}", file=sys.stderr)


if __name__ == "__main__":
    main()
