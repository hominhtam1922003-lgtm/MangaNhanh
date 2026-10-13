# 📖 MangaNhanh

Trình đọc truyện tranh (manga/manhwa/manhua) nhanh, đẹp, không quảng cáo — tổng hợp từ **NetTruyen** (`nettruyen.gg`) và **TruyenQQ** (`truyenqqko.com`). Ảnh nét, tự quét toàn bộ chương (bao gồm trang phân trang / nút "Xem thêm"), có giao diện tối/sáng, thư viện yêu thích, lịch sử đọc, chế độ đọc dọc/webtoon/lật trang. Có thể đóng gói thành **APK Android** bằng Capacitor.

## ✨ Tính năng

- 🔍 **Tổng hợp 2 nguồn lớn**: NetTruyen & TruyenQQ.
- 📚 **Tự quét toàn bộ chương**: request `?page=1..N` cho đến khi không còn chap mới, hợp nhất & sắp xếp.
- 🖼️ **Ảnh sắc nét**: tải từ CDN gốc, tự fallback qua `wsrv.nl` khi ảnh bị chặn hotlink/CORS.
- 🎛️ **3 chế độ đọc**: Dọc, Webtoon, Trang (mũi tên ← →).
- 🌓 Dark / Light / System, thiết kế gradient hiện đại, responsive.
- ⭐ **Yêu thích, lịch sử đọc** (lưu local).
- ⚡ **Mở nhanh bằng link** (dán URL là đọc ngay).
- 📱 **Cài làm ứng dụng Android (APK)** bằng Capacitor, hoặc PWA "Thêm vào màn hình chính".

## 🚀 Chạy web

```bash
npm install
npm run dev          # http://localhost:3000
# hoặc build tĩnh
npm run export       # output vào out/
```

## 📱 Build APK Android (một cú nhấp)

### Điều kiện
- **Node.js ≥ 18**
- **JDK 17**
- **Android Studio** (hoặc Android SDK command-line) với `platforms;android-34` và `build-tools;34.0.0`
- Biến môi trường `ANDROID_HOME` trỏ đến thư mục SDK

### Một dòng lệnh
```bash
bash scripts/build-apk.sh
```

Script này sẽ:
1. `npm install` và `npm run export` để build web tĩnh vào `out/` (với SPA fallback cho hash routing).
2. `npx cap add android` (nếu chưa có) và `cap sync` để copy web vào project Android.
3. Chạy Gradle `assembleDebug`.

**APK thành phẩm**: `android/app/build/outputs/apk/debug/app-debug.apk` – copy vào điện thoại, bấm cài, cho phép "Nguồn không xác định" là xong.

### Build thủ công
```bash
npm run export        # build web tĩnh
npx cap add android   # tạo project Android (chạy lần đầu)
npx cap sync android  # đồng bộ web vào android/
cd android && ./gradlew assembleDebug
```

### Dùng PWA thay cho APK
Không muốn cài app? Mở web bằng Chrome Android → menu ⋮ → **Thêm vào màn hình chính** → trải nghiệm full-screen y hệt native.

## 🏗️ Công nghệ
- **Next.js 14** (static export) + **React 18** + **TypeScript**
- **Tailwind CSS** — theme `brand`/`ink` với gradient
- **cheerio** — parse HTML
- **Capacitor 6** — đóng gói thành APK Android
- LocalStorage lưu favorites/history/settings
- CORS proxy dự phòng (allorigins, corsproxy.io, codetabs) cho fetch client-side

## 📂 Cấu trúc
```
src/
├── app/                # Next.js entry
├── components/         # UI (AppShell, Router, MangaCard, ThemeProvider, Loading...)
├── views/              # Các màn hình (Home, Detail, Reader, Library, History, Search...)
└── lib/
    ├── sources/        # Parser NetTruyen & TruyenQQ
    └── client/         # Fetch, storage, hash-router
scripts/
├── spa-fallback.mjs    # Copy index.html cho các route động sau export
└── build-apk.sh        # Script 1-cú-nhấp để build APK
capacitor.config.json   # Cấu hình Capacitor (appId, splash, status bar)
```

## ⚠️ Lưu ý
- Nội dung truyện được lấy từ nguồn công khai do người dùng chỉ định, app chỉ đóng vai trò reader với giao diện thân thiện. Bản quyền thuộc tác giả và đơn vị phát hành gốc.
- CORS proxy công cộng đôi khi không ổn định; nếu không tải được trang/ảnh hãy ấn tải lại.

