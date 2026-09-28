#!/bin/bash
set -uo pipefail

cd "$(dirname "$0")/.."

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

echo "===== 设备列表 ====="
"$ADB" devices -l

echo ""
echo "===== VoxFlow 安装信息 ====="
"$ADB" -s "$SERIAL" shell dumpsys package com.voxflow.todo | grep -E "versionName|versionCode|firstInstallTime|lastUpdateTime" || true

echo ""
echo "===== 无障碍服务状态 ====="
"$ADB" -s "$SERIAL" shell dumpsys accessibility | grep -iE "voxflow|WeChatAccessibility|enabled" | head -40 || true

echo ""
echo "===== 最近 VoxFlow 日志 ====="
"$ADB" -s "$SERIAL" logcat -d -t 300 | grep -iE "VoxFlow|MlKitOcr|takeScreenshot|OnDeviceLlm|WeChatAccessibility|AppUsage" | tail -80 || true

SCREENSHOT="$HOME/Desktop/voxflow-screen.png"
"$ADB" -s "$SERIAL" exec-out screencap -p -d 0 > "$SCREENSHOT" 2>/dev/null || true
echo ""
echo "截图已保存：$SCREENSHOT"
echo "验证完成。请把上面这些文字和截图发给 Codex。"
