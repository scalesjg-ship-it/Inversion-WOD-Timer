#!/usr/bin/env bash
# Creates an iPhone simulator of the first available type, seeds "North Gym",
# and captures the three store screens.
# Usage: ios-run.sh <prefix> <out dir> <device type id>...
set -uo pipefail
prefix=$1; out=$2; shift 2
here=$(cd "$(dirname "$0")" && pwd)
bundle=com.garrettscales.americana
mkdir -p "$out/logs"
runtime=$(xcrun simctl list runtimes -j | python3 -c "import json,sys; r=[x for x in json.load(sys.stdin)['runtimes'] if x['platform']=='iOS' and x['isAvailable']]; r.sort(key=lambda x: [int(p) for p in x['version'].split('.')]); print(r[-1]['identifier'])")
echo "runtime $runtime"
udid=""
for type in "$@"; do
  if udid=$(xcrun simctl create "Store-$prefix" "$type" "$runtime" 2>/dev/null); then
    echo "created $type $udid"; echo "$type" > "$out/logs/$prefix-devicetype.txt"; break
  fi
  echo "cannot create $type on $runtime"; udid=""
done
[ -n "$udid" ] || { echo "::error::no simulator for $prefix"; exit 1; }
xcrun simctl boot "$udid"
xcrun simctl bootstatus "$udid" -b
xcrun simctl status_bar "$udid" override --time "9:41" --dataNetwork wifi --wifiMode active --wifiBars 3 \
  --cellularMode active --cellularBars 4 --batteryState charged --batteryLevel 100 || true
xcrun simctl install "$udid" "$APP"
data=$(xcrun simctl get_app_container "$udid" $bundle data)
store="$data/Library/Application Support/$bundle/RCTAsyncLocalStorage_V1"
mkdir -p "$store"
python3 - "$store/manifest.json" <<'PY'
import json, sys
json.dump({"americana.branding.v1": json.dumps({"gymName": "North Gym"})}, open(sys.argv[1], "w"))
PY
cat "$store/manifest.json"; echo
if ! maestro --device "$udid" test "$here/flows/home.yaml" > "$out/logs/$prefix-home-check.log" 2>&1; then
  echo "::warning::$prefix seed did not show North Gym; setting it in the app UI"
  tail -n 30 "$out/logs/$prefix-home-check.log"
  maestro --device "$udid" test --debug-output "$out/logs/$prefix-setname" "$here/flows/setname-phone.yaml" > "$out/logs/$prefix-setname.log" 2>&1 || tail -n 40 "$out/logs/$prefix-setname.log"
fi
"$here/capture.sh" ios "$udid" "$out" "$prefix"
status=$?
xcrun simctl shutdown "$udid" || true
exit $status
