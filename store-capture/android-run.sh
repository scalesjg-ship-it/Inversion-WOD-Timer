#!/usr/bin/env bash
# One emulator pass: install, seed "North Gym", then capture the three screens.
# Usage: android-run.sh <tv|phone|tablet> <out dir>
set -uo pipefail
kind=$1; out=$2
here=$(cd "$(dirname "$0")" && pwd)
serial=emulator-5554
pkg=com.garrettscales.americana
mkdir -p "$out/logs"
adb -s $serial wait-for-device
adb -s $serial shell getprop ro.build.version.sdk
adb -s $serial shell wm size | tee "$out/logs/$kind-wm.txt"
if [ "$kind" = tablet ]; then
  adb -s $serial shell wm density 240
  adb -s $serial shell settings put system accelerometer_rotation 0
  adb -s $serial shell settings put system user_rotation 0
  adb -s $serial shell settings put global policy_control immersive.full=*
fi
adb -s $serial shell wm density | tee -a "$out/logs/$kind-wm.txt"
adb -s $serial install -r -g "$APK" || adb -s $serial install -r "$APK"
adb -s $serial shell pm grant $pkg android.permission.POST_NOTIFICATIONS || true
if [ "$kind" != tv ]; then
  adb -s $serial shell settings put global sysui_demo_allowed 1
  adb -s $serial shell am broadcast -a com.android.systemui.demo -e command enter
  adb -s $serial shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 0941
  adb -s $serial shell am broadcast -a com.android.systemui.demo -e command battery -e level 100 -e plugged false
  adb -s $serial shell am broadcast -a com.android.systemui.demo -e command network -e wifi show -e level 4
  adb -s $serial shell am broadcast -a com.android.systemui.demo -e command network -e mobile show -e datatype none -e level 4
  adb -s $serial shell am broadcast -a com.android.systemui.demo -e command notifications -e visible false
fi
# First launch creates RKStorage, then seed the demo gym name.
adb -s $serial shell monkey -p $pkg -c android.intent.category.LAUNCHER 1
sleep 25
python3 "$here/seed-android.py" $serial 2>&1 | tee "$out/logs/$kind-seed.log"
if ! maestro --device $serial test "$here/flows/home.yaml" > "$out/logs/$kind-home-check.log" 2>&1; then
  echo "::warning::$kind seed did not show North Gym; setting it in the app UI"
  if [ "$kind" = tv ]; then flow=setname-tv.yaml; else flow=setname-phone.yaml; fi
  maestro --device $serial test --debug-output "$out/logs/$kind-setname" "$here/flows/$flow" > "$out/logs/$kind-setname.log" 2>&1 || tail -n 40 "$out/logs/$kind-setname.log"
fi
"$here/capture.sh" android $serial "$out" "android-$kind"
