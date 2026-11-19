#!/usr/bin/env bash
# Import the Apple Distribution certificate into a temporary keychain and
# install the tvOS App Store profile. Never prints secret values.
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v security >/dev/null 2>&1; then
  echo "::error::The signing install step must run on macOS (security is missing)."
  exit 1
fi

missing=0
for name in APPLE_CERTIFICATE_BASE64 APPLE_CERTIFICATE_PASSWORD APPLE_PROVISION_PROFILE_BASE64; do
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

ROOT="${RUNNER_TEMP:-/tmp}/tvos-signing"
mkdir -p "$ROOT"
chmod 700 "$ROOT"

python3 scripts/ci-tvos-signing.py decode-secret --env APPLE_CERTIFICATE_BASE64 --out "$ROOT/distribution.p12"
python3 scripts/ci-tvos-signing.py decode-secret --env APPLE_PROVISION_PROFILE_BASE64 --out "$ROOT/profile.mobileprovision"

security cms -D -i "$ROOT/profile.mobileprovision" > "$ROOT/profile.plist"
python3 scripts/ci-tvos-signing.py inspect-profile \
  --plist "$ROOT/profile.plist" \
  --env-file "$ROOT/profile.env" \
  --github-env "${GITHUB_ENV:-}"
# shellcheck disable=SC1091
source "$ROOT/profile.env"

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
python3 scripts/ci-tvos-signing.py assert-identity --file "$ROOT/identities.txt"

install_profile() {
  local dir="$1"
  mkdir -p "$dir"
  cp "$ROOT/profile.mobileprovision" "$dir/${PROFILE_UUID}.mobileprovision"
  chmod 644 "$dir/${PROFILE_UUID}.mobileprovision"
}

# Xcode 16+ reads the Developer directory. The MobileDevice path is the one
# the workflow contract asks for; both use the profile UUID as the filename.
install_profile "$HOME/Library/MobileDevice/Provisioning Profiles"
install_profile "$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"

python3 scripts/ci-tvos-signing.py write-export-plist \
  --profile-name "$PROFILE_NAME" \
  --out "$ROOT/ExportOptions.plist"

if [ -n "${GITHUB_ENV:-}" ]; then
  {
    printf 'KEYCHAIN_PATH=%s\n' "$KEYCHAIN_PATH"
    printf 'SIGNING_DIR=%s\n' "$ROOT"
    printf 'EXPORT_OPTIONS_PLIST=%s\n' "$ROOT/ExportOptions.plist"
  } >> "$GITHUB_ENV"
fi

echo "Installed tvOS App Store profile ${PROFILE_UUID} for team BNP9QFC679."
