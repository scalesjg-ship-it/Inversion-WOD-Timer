#!/usr/bin/env bash
# Always-run cleanup. Deletes the temporary keychain, cert, both profiles, API key, and IPA.
# Exits 0 so a cleanup problem does not hide an earlier archive or upload error.
set -u

SIGNING_DIR="${SIGNING_DIR:-${RUNNER_TEMP:-/tmp}/ios-signing}"
KEYCHAIN_PATH="${KEYCHAIN_PATH:-$SIGNING_DIR/app-signing.keychain-db}"

if command -v security >/dev/null 2>&1; then
  if [ -n "$KEYCHAIN_PATH" ]; then
    security delete-keychain "$KEYCHAIN_PATH" >/dev/null 2>&1 || true
  fi
  login="$HOME/Library/Keychains/login.keychain-db"
  if [ -e "$login" ]; then
    security default-keychain -s "$login" >/dev/null 2>&1 || true
    security list-keychains -d user -s "$login" >/dev/null 2>&1 || true
  fi
fi

remove_profile() {
  local uuid="${1:-}"
  if [[ "$uuid" =~ ^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$ ]]; then
    rm -f "$HOME/Library/MobileDevice/Provisioning Profiles/${uuid}.mobileprovision"
    rm -f "$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles/${uuid}.mobileprovision"
  fi
}

remove_profile "${IOS_PROFILE_UUID:-}"
remove_profile "${WATCH_PROFILE_UUID:-}"

if [[ "${APP_STORE_CONNECT_KEY_ID:-}" =~ ^[A-Za-z0-9]+$ ]]; then
  rm -f "$HOME/private_keys/AuthKey_${APP_STORE_CONNECT_KEY_ID}.p8"
  rm -f "$HOME/.private_keys/AuthKey_${APP_STORE_CONNECT_KEY_ID}.p8"
  rm -f "$HOME/.appstoreconnect/private_keys/AuthKey_${APP_STORE_CONNECT_KEY_ID}.p8"
fi

runner_temp="${RUNNER_TEMP:-}"
remove_under_temp() {
  local path="${1:-}"
  if [ -z "$path" ] || [ -z "$runner_temp" ]; then
    return 0
  fi
  case "$path" in
    "$runner_temp"/*) rm -rf "$path" ;;
  esac
}

remove_under_temp "$SIGNING_DIR"
remove_under_temp "${API_PRIVATE_KEYS_DIR:-}"
remove_under_temp "${ARCHIVE_PATH:-}"
remove_under_temp "${EXPORT_PATH:-}"
remove_under_temp "${IPA_UNPACK_DIR:-}"

echo "Removed the temporary keychain, iPhone and watch profiles, API key, and signed IPA."
exit 0
