# 📖 MangaNhanh

Trình đọc truyện tranh nhanh, ảnh nét, không quảng cáo – tổng hợp **NetTruyen** + **TruyenQQ**, tự quét toàn bộ chương (kể cả nút "Xem thêm" / phân trang). Đóng gói thành APK Android tự động qua GitHub Actions.

## 📱 Tải APK không cần cài Android Studio

**Cách dễ nhất**: để GitHub Actions build APK giùm bạn – không cần cài gì cả, chỉ cần GitHub account (miễn phí).

### Bước 1: Upload project lên GitHub
1. Tạo repo mới trên https://github.com/new (đặt tên `MangaNhanh`, để Public).
2. Trên Arena này, bấm **Push to GitHub** / **Đẩy lên GitHub** (nút ở góc trên), chọn repo vừa tạo. Hoặc nếu bạn tải source về thì chạy:
   ```bash
   git init
   git add .
   git commit -m "MangaNhanh first commit"
   git remote add origin https://github.com/<TÊN-BẠN>/MangaNhanh.git
   git branch -M main
   git push -u origin main
   ```

### Bước 2: Đợi GitHub build APK
File `.github/workflows/build-apk.yml` mình đã cài đặt sẵn. Sau khi push code lên:
1. Vào repo GitHub → tab **Actions** → bạn sẽ thấy workflow **Build APK** đang chạy.
2. Chờ khoảng 3-5 phút, khi nào có dấu ✅ xanh là xong.
3. Bấm vào dòng chạy thành công → phần **Artifacts** sẽ có file `MangaNhanh-APK.zip` → tải về, giải ra được file `app-debug.apk`.

### Bước 3: Cài APK lên điện thoại
1. Copy file `.apk` vào điện thoại (gửi qua Zalo/Telegram/Google Drive cho chính bạn, hoặc chép qua cáp).
2. Trên điện thoại bấm vào file `.apk` → khi báo "Không phép cài ứng dụng từ nguồn này" → vào **Cài đặt** bật cho phép → quay lại cài đặt.
3. Mở app **MangaNhanh** lên và đọc truyện thôi 🎉

> 💡 Mỗi lần bạn push code mới lên GitHub, Action sẽ tự động build ra APK mới luôn.

---

## 🚀 Chạy thử web trên máy

```bash
npm install
npm run dev      # http://localhost:3000
npm run export   # build web tĩnh vào out/
```

## 📱 Build APK thủ công (khi có Android Studio)

```bash
bash scripts/build-apk.sh
```

APK thành phẩm tại `android/app/build/outputs/apk/debug/app-debug.apk`.

## ✨ Tính năng

- Tổng hợp 2 nguồn: NetTruyen + TruyenQQ
- Tự quét toàn bộ chương (xử lý phân trang/"Xem thêm")
- Ảnh nét, dự phòng qua proxy ảnh khi bị chặn
- 3 chế độ đọc: Dọc / Webtoon / Trang (← →)
- Giao diện Tối/Sáng/Hệ thống
- Yêu thích, lịch sử đọc (lưu local)
- Mở nhanh bằng link, tìm kiếm trên cả 2 nguồn
- Đóng gói APK Android bằng Capacitor, hoặc PWA "Thêm vào màn hình chính"

Chi tiết xem ở README gốc trong repo.
