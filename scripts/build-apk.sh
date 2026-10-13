#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
flutter pub get
dart format lib test
flutter analyze
flutter test
flutter build apk --release
printf '\nAPK thử nghiệm: build/app/outputs/flutter-apk/app-release.apk\n'
