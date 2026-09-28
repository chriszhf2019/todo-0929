#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> 编译安卓 APK（这一步需要几分钟）"
npm run android:apk

APK="dist/VoxFlow-Todo-1.3-release.apk"
if [[ ! -f "$APK" ]]; then
  echo "未找到 $APK，请检查上方编译日志。"
  exit 1
fi

ADB="${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools/adb"
if [[ ! -x "$ADB" ]]; then
  ADB="$(command -v adb || true)"
fi
if [[ -z "$ADB" ]]; then
  echo "未找到 adb，请确认 Android SDK 已安装。"
  exit 1
fi

SERIAL="$("$ADB" devices | awk 'NR>1 && $2=="device" {print $1; exit}')"
if [[ -z "$SERIAL" ]]; then
  echo "没有检测到已授权的安卓设备。"
  exit 1
fi

echo "使用设备：$SERIAL"

echo "==> 安装到已连接的安卓设备"
"$ADB" -s "$SERIAL" install -r "$APK"

echo "==> 完成"
