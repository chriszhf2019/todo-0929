#!/usr/bin/env bash
# Device debug helper for VoxFlow Todo
# Usage: run from project root: ./scripts/device-debug.sh

set -euo pipefail

APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"
PACKAGE="com.voxflow.todo"
ACTIVITY="com.getcapacitor.BridgeActivity"
LOGFILE="voxflow-log.txt"

echo "== VoxFlow Device Debug Script =="

command -v adb >/dev/null 2>&1 || { echo "adb not found in PATH. Install Android Platform Tools."; exit 1; }

echo "1) Listing connected devices..."
adb devices

if [ ! -f "$APK_PATH" ]; then
  echo "APK not found at $APK_PATH. Build the project first: npm run build && npx cap sync android && (cd android && ./gradlew assembleDebug)";
  exit 1;
fi

echo "2) Installing APK (replace if exists)..."
adb install -r "$APK_PATH" || echo "adb install returned non-zero exit code"

echo "3) Clearing app data (pm clear)..."
adb shell pm clear "$PACKAGE" || echo "pm clear may have failed"

echo "4) Starting app..."
adb shell am start -n ${PACKAGE}/${ACTIVITY} || echo "start activity returned non-zero exit code"

echo "5) Opening chrome://inspect for WebView debugging (if needed)"
echo "   On your desktop Chrome, visit: chrome://inspect and enable 'Discover USB devices'"

echo "6) Tailing logcat to ${LOGFILE} (ctrl-C to stop)"
echo "   Filtering by package: ${PACKAGE}"

adb logcat | grep --line-buffered "$PACKAGE" | tee "$LOGFILE"
