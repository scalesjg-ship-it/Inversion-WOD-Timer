#!/usr/bin/env bash
# Runs the three store flows on one device and saves a native screenshot after each.
# Usage: capture.sh <ios|android> <device id> <out dir> <prefix>
set -uo pipefail
platform=$1; device=$2; out=$3; prefix=$4
here=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$out" "$out/logs"
shot() {
  local file="$out/$prefix-$1.png"
  if [ "$platform" = ios ]; then
    xcrun simctl io "$device" screenshot --type=png "$file"
  else
    adb -s "$device" exec-out screencap -p > "$file"
  fi
  echo "saved $file"
}
status=0
for screen in home countdown rounds; do
  for attempt in 1 2; do
    if maestro --device "$device" test --format junit --output "$out/logs/$prefix-$screen-$attempt.xml" \
        --debug-output "$out/logs/$prefix-$screen-$attempt" "$here/flows/$screen.yaml" > "$out/logs/$prefix-$screen-$attempt.log" 2>&1; then
      sleep 1
      shot "$screen"
      break
    fi
    echo "::warning::$prefix $screen attempt $attempt failed"
    tail -n 40 "$out/logs/$prefix-$screen-$attempt.log"
    shot "$screen-FAILED-$attempt"
    [ "$attempt" = 2 ] && status=1
  done
done
exit $status
