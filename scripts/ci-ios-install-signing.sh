#!/usr/bin/env bash
# Import the Apple Distribution certificate and the iPhone and watch App Store
# profiles. Never prints secret values. Does not submit an app for review.
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v security >/dev/null 2>&1; then
  echo "::error::The signing install step must run on macOS (security is missing)."
  exit 1
fi

missing=0
for name in APPLE_CERTIFICATE_BASE64 APPLE_CERTIFICATE_PASSWORD IOS_APP_PROFILE_BASE64 WATCH_APP_PROFILE_BASE64; do
  if [ -z "${!name:-}" ]; then
    echo "::error::Missing GitHub secret ${name}"
    missing=1
  fi
done
if [ "$missing" -ne 0 ]; then
  exit 1
fi

if [ -n "${APPLE_TEAM_ID:-}" ] && [ "$APPLE_TEAM_ID" != "BNP9QFC679" ]; then
  echo "::error::APPLE_TEAM_ID must be BNP9QFC679 (CrossFit Inversion LLC). Refusing any other team."
  exit 1
fi

echo "::add-mask::${APPLE_CERTIFICATE_PASSWORD}"

ROOT="${RUNNER_TEMP:-/tmp}/ios-signing"
mkdir -p "$ROOT"
chmod 700 "$ROOT"

python3 scripts/ci-ios-signing.py decode-secret --env APPLE_CERTIFICATE_BASE64 --out "$ROOT/distribution.p12"
python3 scripts/ci-ios-signing.py decode-secret --env IOS_APP_PROFILE_BASE64 --out "$ROOT/ios.mobileprovision"
python3 scripts/ci-ios-signing.py decode-secret --env WATCH_APP_PROFILE_BASE64 --out "$ROOT/watch.mobileprovision"

security cms -D -i "$ROOT/ios.mobileprovision" > "$ROOT/ios-profile.plist"
security cms -D -i "$ROOT/watch.mobileprovision" > "$ROOT/watch-profile.plist"
python3 scripts/ci-ios-signing.py inspect-profile \
  --kind ios \
  --plist "$ROOT/ios-profile.plist" \
  --env-file "$ROOT/ios-profile.env" \
  --github-env "${GITHUB_ENV:-}"
python3 scripts/ci-ios-signing.py inspect-profile \
  --kind watch \
  --plist "$ROOT/watch-profile.plist" \
  --env-file "$ROOT/watch-profile.env" \
  --github-env "${GITHUB_ENV:-}"
# shellcheck disable=SC1091
source "$ROOT/ios-profile.env"
# shellcheck disable=SC1091
source "$ROOT/watch-profile.env"

KEYCHAIN_PATH="$ROOT/app-signing.keychain-db"
KEYCHAIN_PASSWORD="$(openssl rand -base64 32)"
echo "::add-mask::${KEYCHAIN_PASSWORD}"
printf '%s' "$KEYCHAIN_PASSWORD" > "$ROOT/keychain.password"
chmod 600 "$ROOT/keychain.password"

security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
security import "$ROOT/distribution.p12" \
  -k "$KEYCHAIN_PATH" \
  -P "$APPLE_CERTIFICATE_PASSWORD" \
  -A -t cert -f pkcs12 \
  -T /usr/bin/codesign \
  -T /usr/bin/security \
  -T /usr/bin/xcodebuild
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH" >/dev/null

LOGIN_KEYCHAIN="$(security default-keychain | tr -d '"')"
security list-keychains -d user -s "$KEYCHAIN_PATH" "$LOGIN_KEYCHAIN"
security default-keychain -s "$KEYCHAIN_PATH"

security find-identity -v -p codesigning "$KEYCHAIN_PATH" | tee "$ROOT/identities.txt"
python3 scripts/ci-ios-signing.py assert-identity \
  --file "$ROOT/identities.txt" \
  --env-file "$ROOT/identity.env" \
  --github-env "${GITHUB_ENV:-}"
# shellcheck disable=SC1091
source "$ROOT/identity.env"

install_profile() {
  local uuid="$1"
  local source="$2"
  local dir="$3"
  mkdir -p "$dir"
  cp "$source" "$dir/${uuid}.mobileprovision"
  chmod 644 "$dir/${uuid}.mobileprovision"
}

for dir in "$HOME/Library/MobileDevice/Provisioning Profiles" "$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"; do
  install_profile "$IOS_PROFILE_UUID" "$ROOT/ios.mobileprovision" "$dir"
  install_profile "$WATCH_PROFILE_UUID" "$ROOT/watch.mobileprovision" "$dir"
done

python3 scripts/ci-ios-signing.py write-export-plist \
  --ios-profile "$IOS_PROFILE_NAME" \
  --watch-profile "$WATCH_PROFILE_NAME" \
  --identity "$CODE_SIGN_IDENTITY" \
  --out "$ROOT/ExportOptions.plist"

if [ -n "${GITHUB_ENV:-}" ]; then
  {
    printf 'KEYCHAIN_PATH=%s\n' "$KEYCHAIN_PATH"
    printf 'SIGNING_DIR=%s\n' "$ROOT"
    printf 'EXPORT_OPTIONS_PLIST=%s\n' "$ROOT/ExportOptions.plist"
  } >> "$GITHUB_ENV"
fi

echo "Installed iPhone profile ${IOS_PROFILE_UUID} and watch profile ${WATCH_PROFILE_UUID} for team BNP9QFC679."
