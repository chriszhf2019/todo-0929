#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"

# LiteRT-LM is compiled for Java 21, so prefer JDK 21 (or newer) over 17.
if [[ -z "${JAVA_HOME:-}" || ! -x "$JAVA_HOME/bin/java" ]]; then
  JAVA_HOME="$(/usr/libexec/java_home -v 21 2>/dev/null || true)"
fi
if [[ -z "${JAVA_HOME:-}" || ! -x "$JAVA_HOME/bin/java" ]]; then
  BREW_JDK21="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
  if [[ -x "$BREW_JDK21/bin/java" ]]; then
    JAVA_HOME="$BREW_JDK21"
  fi
fi
if [[ -z "${JAVA_HOME:-}" || ! -x "$JAVA_HOME/bin/java" ]]; then
  JAVA_HOME="$(/usr/libexec/java_home -v 17)"
fi

export ANDROID_HOME="$ANDROID_SDK"
export ANDROID_SDK_ROOT="$ANDROID_SDK"
export JAVA_HOME

cd "$ROOT_DIR"
npm run android:sync

cd "$ROOT_DIR/android"
./gradlew assembleDebug assembleRelease

mkdir -p "$ROOT_DIR/dist"
cp \
  "$ROOT_DIR/android/app/build/outputs/apk/debug/app-debug.apk" \
  "$ROOT_DIR/dist/VoxFlow-Todo-1.3-debug.apk"
cp \
  "$ROOT_DIR/android/app/build/outputs/apk/release/app-release.apk" \
  "$ROOT_DIR/dist/VoxFlow-Todo-1.3-release.apk"

printf '\nAPK: %s\n' "$ROOT_DIR/dist/VoxFlow-Todo-1.3-debug.apk"
printf 'APK: %s\n' "$ROOT_DIR/dist/VoxFlow-Todo-1.3-release.apk"
