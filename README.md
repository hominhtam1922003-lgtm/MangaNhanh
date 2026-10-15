# PipeTube

A lightweight, ad-free Expo + TypeScript mobile client for the open-source Piped API. Replaces the previous MangaNhanh Next.js/Capacitor application (historical documentation is in README-legacy.md).

## Features

- Dark Home screen with US trending videos, pull-to-refresh, loading/error/retry states.
- Dedicated video search screen (submit using the keyboard Search button).
- Native `expo-av` playback with controls, HLS or muxed MP4 streams, and an audio-only switch.
- No advertising SDKs, accounts, or YouTube API key.
- Background/locked-screen audio configuration: `staysActiveInBackground`, silent-mode playback on iOS, and native iOS `UIBackgroundModes: [audio]`.

## Run

Requires Node 20 and npm.

```sh
npm ci
cp .env.example .env  # optional: choose a working Piped instance
npm start
```

Use an Android emulator or a compatible Expo Go client for basic development. This project uses Expo SDK 51 to retain the explicitly requested `expo-av` integration. Current Expo Go releases may not support this older SDK; use a native build instead. `expo-av` has been deprecated in newer Expo SDKs; migrating to `expo-video`/`expo-audio` is a future upgrade.

Piped public instances can be offline, rate-limited, or blocked by YouTube. Change `EXPO_PUBLIC_PIPED_API_URL` to an accessible HTTPS Piped API instance, then restart Metro (or rebuild the APK). Requests time out after 20 seconds. The API URL is public configuration, not a secret. The app does not silently send queries to other instances.

## APK Android — không cần tài khoản Expo

Workflow `.github/workflows/build.yml` tự chạy khi push lên `main`, hoặc chạy thủ công bằng **Actions → Build Android APK → Run workflow**.

1. Đưa các thay đổi lên GitHub và merge vào `main`.
2. Mở tab **Actions**, chọn lần chạy **Build Android APK**.
3. Khi build thành công, tải artifact **PipeTube-APK** (lưu 14 ngày).
4. Giải nén, mở `app-release.apk` trên Android và cho phép cài ứng dụng từ nguồn này khi được hỏi.

Workflow dùng `expo prebuild` rồi Gradle `assembleRelease` — cách build native tương đương, không cần `EXPO_TOKEN`, Expo project ID hay EAS. JavaScript được đóng gói trong APK: không cần Metro hoặc Expo Go khi sử dụng. API Piped vẫn cần Internet.

**Chữ ký:** bản này dùng debug keystore mặc định của template Expo/React Native để cài thử cá nhân, dù là release bundle. Không dùng bản này để phát hành Google Play. Muốn phát hành chính thức cần cấu hình release keystore riêng và lưu bí mật trong GitHub Secrets. Nếu đổi chữ ký, có thể phải gỡ APK cũ trước khi cài bản mới.

Có thể đặt repository variable **EXPO_PUBLIC_PIPED_API_URL** để chọn instance Piped hoạt động, rồi chạy build lại.

Build trên máy có Node 20, Java 17 và Android SDK:

```sh
npm ci
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
# android/app/build/outputs/apk/release/app-release.apk (từ thư mục gốc)
```

`eas.json` vẫn có profile preview APK nếu sau này muốn dùng EAS; quy trình Actions không phụ thuộc EAS.

## Background audio and validation

Test background playback using a **native standalone APK / iOS build**, not Expo Go (iOS background audio is not supported in Expo Go). Start a video, lock the screen or switch to another app, and confirm audio continues. Try audio-only mode for less bandwidth. Android battery restrictions can affect playback; this app does not implement a media notification, lock-screen transport controls, or an Android foreground media service. Long-running playback under OS memory/battery pressure is not guaranteed by expo-av alone. Navigating back from the player intentionally unloads playback; switching stream modes restarts playback.

Only combined video/audio streams or HLS are used for video; separate DASH tracks cannot be muxed by expo-av. If no compatible video exists, try audio-only mode. Live stream availability depends on the instance.

Checks:

```sh
npm run tsc
npx expo export --platform android --output-dir dist
```

Device checklist: trending → search → open video → pause/resume/seek → switch to audio-only → background → lock/unlock → return → navigate back (audio stops). Also test an unavailable API instance, no search results, and stream failure/retry.
