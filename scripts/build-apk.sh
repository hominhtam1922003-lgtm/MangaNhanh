#!/usr/bin/env bash
# Build MangaNhanh APK in one command
# Requirements: Node.js 18+, JDK 17+, Android SDK (ANDROID_HOME set), Android platform 34, build-tools 34.0.0.
set -e

echo "==> [1/4] Building static web (out/)..."
npm install
npm run export

echo "==> [2/4] Syncing Capacitor Android..."
npx cap sync android 2>/dev/null || {
  echo "Android platform not found, adding..."
  npx cap add android
  npx cap sync android
}

echo "==> [3/4] Building APK (debug)..."
cd android
./gradlew assembleDebug

echo ""
echo "✅  Build thành công!"
echo "File APK: android/app/build/outputs/apk/debug/app-debug.apk"
echo "Hãy copy file này vào điện thoại và cài đặt."
