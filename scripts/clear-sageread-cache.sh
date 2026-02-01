#!/usr/bin/env bash
set -euo pipefail

main() {
  local APP_ID="com.lywhlao2025.sagereadx"
  local LEGACY_ID="com.xincmm.sageread"
  local USER_DIR="${HOME}"

  echo "🧹 Clearing SageRead local data for user: ${USER_DIR}"

  # App data (Tauri)
  rm -rf "${USER_DIR}/Library/Application Support/${APP_ID}" || true
  rm -rf "${USER_DIR}/Library/Application Support/${LEGACY_ID}" || true

  # WebKit storage used by Tauri WebView
  rm -rf "${USER_DIR}/Library/WebKit/${APP_ID}" || true
  rm -rf "${USER_DIR}/Library/WebKit/${LEGACY_ID}" || true
  rm -rf "${USER_DIR}/Library/WebKit/SageRead" "${USER_DIR}/Library/WebKit/SageReadX" || true

  # Caches
  rm -rf "${USER_DIR}/Library/Caches/${APP_ID}" "${USER_DIR}/Library/Caches/${LEGACY_ID}" || true
  rm -rf "${USER_DIR}/Library/Caches/SageRead" "${USER_DIR}/Library/Caches/SageReadX" || true

  # Preferences / plist
  rm -f "${USER_DIR}/Library/Preferences/${APP_ID}.plist" "${USER_DIR}/Library/Preferences/${LEGACY_ID}.plist" || true
  rm -f "${USER_DIR}/Library/Preferences/SageRead.plist" "${USER_DIR}/Library/Preferences/SageReadX.plist" || true

  # Logs (optional, to avoid stale sessions hints)
  rm -rf "${USER_DIR}/Library/Logs/${APP_ID}" "${USER_DIR}/Library/Logs/${LEGACY_ID}" || true

  echo "✅ Done. Please relaunch SageRead X to start with a fresh state."
}

main "$@"
