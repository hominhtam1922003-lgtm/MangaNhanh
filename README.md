# Lịch Nhắc

Ứng dụng Flutter Android quản lý công việc, lịch và deadline, **hoạt động ngoại tuyến**. Giao diện tiếng Việt, Material 3, hỗ trợ Android **6.0 / API 23 trở lên**.

- Tên hiển thị: **Lịch Nhắc**
- Application ID: **`vn.lichnhac.app`**
- Phiên bản đầu tiên: **1.0.0+1**
- Không backend, không tài khoản, không API key hoặc dịch vụ trả phí.

## Chức năng

- **Hôm nay:** ngày hiện tại, thống kê chưa xong/đã xong/quá hạn của toàn bộ công việc; danh sách đến hạn hôm nay theo giờ; đánh dấu hoàn thành ngay trên danh sách.
- **Lịch:** lịch tháng, chuyển tháng, về hôm nay; chấm đánh dấu ngày có công việc; chọn ngày xem và thêm công việc cho ngày đó.
- **Công việc:** tìm tiêu đề, lọc trạng thái/danh mục, sắp xếp hạn gần nhất hoặc ưu tiên cao trước. Các bộ lọc có thể kết hợp.
- **Thêm/sửa:** tiêu đề bắt buộc tối đa 100 ký tự, ghi chú, ngày, giờ tùy chọn, bốn danh mục, ba mức ưu tiên, hoàn thành và nhắc việc. Chạm một công việc để sửa hoặc xóa; xóa cần xác nhận.
- **Nhắc việc:** thông báo cục bộ, xin quyền Android 13+ khi bật nhắc. Từ chối quyền không ngăn lưu công việc. Sửa/xóa/hoàn thành sẽ cập nhật hoặc hủy lịch nhắc.
- **Cài đặt:** sáng/tối/theo hệ thống, lưu lựa chọn qua lần mở app; xóa toàn bộ dữ liệu có xác nhận.
- Không thêm dữ liệu mẫu khi cài lần đầu.

## Lưu trữ và thời gian

SQLite (`sqflite`) lưu công việc và cài đặt trong `lich_nhac.db` trên thiết bị. Schema hiện tại là **v2**: v1 tạo bảng công việc, v2 thêm bảng cài đặt và index ngày đến hạn. `onCreate`/`onUpgrade` dùng cùng chuỗi migration, đã có test nâng v1 → v2 giữ nguyên dữ liệu; không drop/recreate dữ liệu khi khởi động hoặc cập nhật app. Giữ nguyên application ID và chữ ký khi cập nhật để Android giữ dữ liệu.

Ngày được lưu dạng **`YYYY-MM-DD` địa phương**, giờ là số phút từ 00:00, không chuyển ngày sang UTC:

- Không có giờ: chỉ quá hạn khi ngày đến hạn đã qua.
- Có giờ: quá hạn khi ngày và giờ đến hạn đã qua.
- Đã hoàn thành: không tính quá hạn.
- Công việc không có giờ được xếp sau các việc có giờ trong cùng ngày.

Dữ liệu và cài đặt được đọc lại khi mở app/quay lại từ nền; trạng thái quá hạn tự cập nhật mỗi 30 giây khi app mở. Dữ liệu **không tự đồng bộ hoặc sao lưu sang máy khác** (Android backup bị tắt). Gỡ app hoặc xóa dữ liệu ứng dụng sẽ làm mất dữ liệu.

### Giới hạn thông báo Android

- Chỉ đặt lịch cho công việc chưa xong, bật nhắc, có giờ và còn ở tương lai. Hạn đã qua vẫn được lưu nhưng không phát thông báo hồi tố.
- Dùng `inexactAllowWhileIdle`, **không xin quyền báo thức chính xác**. Android có thể gửi trễ do Doze, tiết kiệm pin hoặc chính sách hãng máy; không nên dùng như báo thức khẩn cấp.
- Đọc múi giờ Android qua `MethodChannel`, khởi tạo cơ sở dữ liệu IANA của `timezone`. Mở lại ứng dụng sau khi đổi múi giờ để tính lại lịch nhắc theo giờ địa phương mới.
- Receiver khôi phục lịch sau khởi động lại thiết bị/cập nhật ứng dụng. Sau khi **buộc dừng** app, cần mở lại để khôi phục lịch; đây là giới hạn Android.
- Có thể bật lại quyền thông báo trong **Cài đặt Android → Ứng dụng → Lịch Nhắc → Thông báo**.
- Pin `flutter_local_notifications 19.5.0` là bản ổn định tương thích API 23. Dòng 22.x có minSdk 24, không dùng vì yêu cầu hỗ trợ Android 6.0.

## Cài Flutter và chạy trên máy tính

1. Cài Git và **Flutter stable** theo hướng dẫn Flutter: https://docs.flutter.dev/get-started/install. Cần Flutter **3.38.1 trở lên**, Dart **3.10 trở lên** (đi kèm Flutter).
2. Cài Android Studio, Android SDK/platform/build-tools phù hợp với `flutter.compileSdkVersion` của Flutter stable và Java **17**. Workflow để Flutter chọn compile/target SDK; minSdk cố định là 23.
3. Thêm `flutter/bin` vào PATH. Kiểm tra môi trường:

   ```bash
   flutter doctor
   flutter doctor --android-licenses
   ```

4. Trong thư mục gốc dự án:

   ```bash
   flutter pub get
   dart format lib test
   flutter analyze
   flutter test
   ```

5. Bật USB debugging trên điện thoại Android, kết nối USB (hoặc mở emulator), rồi:

   ```bash
   flutter devices
   flutter run
   ```

6. Build APK thử nghiệm:

   ```bash
   flutter build apk --release
   # Hoặc trên Linux/macOS:
   bash scripts/build-apk.sh
   ```

   Kết quả: **`build/app/outputs/flutter-apk/app-release.apk`**.

`android/local.properties` được Flutter tạo trên từng máy, không commit. Không cần `flutter create` lại dự án. Sau lần `flutter pub get` đầu tiên thành công, nên commit `pubspec.lock` để cố định các dependency đã resolve; workspace hiện chưa sinh được lockfile do không có Flutter và không truy cập được pub.dev.

## Đưa mã nguồn lên GitHub

Repository hiện tại đã có Git. Không cần `git init` hoặc đổi nhánh nếu bạn đang làm việc trong Arena; dùng nút push của Arena hoặc push nhánh làm việc hiện tại, rồi mở PR vào `main`.

Nếu tạo **repository mới từ bản sao mã nguồn** trên máy riêng:

1. Vào https://github.com/new, tạo repository trống (ví dụ `lich-nhac`), không tạo sẵn README.
2. Trong bản sao chưa có Git:

   ```bash
   git init -b main
   git add .
   git commit -m "Tạo ứng dụng Lịch Nhắc"
   git remote add origin https://github.com/<ten-cua-ban>/lich-nhac.git
   git push -u origin main
   ```

Không commit `.dart_tool`, `build`, APK, `local.properties`, keystore hoặc mật khẩu. Nếu dùng repository có lịch sử, giữ lịch sử và push nhánh của bạn, tạo PR vào `main` thay vì khởi tạo lại.

## GitHub Actions và tải APK

File **`.github/workflows/build-apk.yml`**:

- Tự chạy khi push vào `main`, kiểm tra pull request vào `main`.
- Có thể chạy thủ công bằng `workflow_dispatch`.
- Ubuntu latest, Java 17, Flutter stable.
- Chạy `flutter pub get` → định dạng Dart → `flutter analyze` → `flutter test` → `flutter build apk --release`.
- Upload bằng `actions/upload-artifact@v4`, tên artifact **`lich-nhac-apk`**, lưu 30 ngày; thất bại nếu không tìm thấy APK.
- Không cần secret, keystore riêng hoặc API key. Chưa cấu hình tự tạo GitHub Release theo tag; ưu tiên workflow artifact cơ bản.

### Tải và cài thử

1. Push/merge mã nguồn vào `main`, mở tab **Actions** của repository.
2. Chọn workflow **Build APK Lịch Nhắc**. Có thể bấm **Run workflow**, chọn nhánh chứa workflow rồi chạy thủ công (workflow cần có trên nhánh mặc định để xuất hiện nút chạy).
3. Chờ lần chạy có dấu xanh. Nếu đỏ, mở bước lỗi để xem log; workflow sẽ không upload APK nếu analyze/test/build lỗi.
4. Mở lần chạy thành công, kéo tới **Artifacts**, tải **`lich-nhac-apk`** (cần đăng nhập GitHub), giải nén lấy `app-release.apk`.
5. Chép APK sang điện thoại, mở file. Cho phép cài ứng dụng từ nguồn đó khi Android hỏi, rồi cài **Lịch Nhắc**.
6. Khi bật nhắc với giờ đến hạn, cho phép thông báo trên Android 13+ nếu muốn nhận nhắc.

**APK này dùng debug signing cho build release, chỉ dành cho thử nghiệm nội bộ. Đây KHÔNG phải bản ký để phát hành trên Google Play.** Không có keystore hoặc mật khẩu được commit. Muốn phát hành cần cấu hình chữ ký phát hành riêng và build App Bundle. Keystore debug của runner có thể thay đổi giữa các lần chạy; nếu Android báo chữ ký không khớp, cần gỡ bản thử cũ trước khi cài bản mới (**gỡ sẽ mất dữ liệu**). Khi cần cập nhật nội bộ giữ dữ liệu lâu dài, hãy quản lý một chữ ký ổn định ngoài repository.

## Cấu trúc mã nguồn

```text
lib/
  main.dart
  app/          # MaterialApp, theme, lifecycle, controller
  models/       # Task, ngày/giờ, quá hạn, truy vấn/lọc/sắp xếp
  data/         # SQLite schema/repository, thông báo và múi giờ
  features/     # Hôm nay, Lịch, Công việc, form thêm/sửa, Cài đặt
  widgets/      # Danh sách công việc, trạng thái trống, xác nhận
android/        # Flutter embedding, Gradle, manifest, icon, timezone channel
scripts/build-apk.sh
test/           # Unit, SQLite thật qua FFI, mock thông báo, widget
.github/workflows/build-apk.yml
legacy-web/     # Mã MangaNhanh Next.js/Capacitor cũ, không tham gia Flutter build
```

Cấu hình Android Capacitor cũ đã được thay bằng Flutter. Mã web cũ được giữ trong `legacy-web` chỉ để tham khảo; các lệnh Capacitor cũ không còn là cách build ứng dụng này.

## Kiểm thử và trạng thái xác minh

Các test bao phủ quy tắc quá hạn (ngày, giờ, ranh giới, hoàn thành), kết hợp bộ lọc/tìm kiếm/sắp xếp, kiểm tra tiêu đề, SQLite CRUD, nâng schema v1 → v2, mở lại dữ liệu, xóa dữ liệu, quyền/thời điểm/múi giờ/hủy lịch thông báo bằng mock, và giao diện màn hình nhỏ.

**Trong workspace Arena tạo dự án này:** không có Flutter/Dart, Java hoặc Android SDK; tải Flutter từ `storage.googleapis.com` bị chặn bởi mạng. Vì vậy **chưa chạy thành công `flutter pub get`, `flutter analyze`, `flutter test` hoặc build APK**, chưa có APK đã xác minh. Mã Dart đã được định dạng bằng bản WASM của `dart_style`; **chưa chạy trực tiếp lệnh `dart format`**, lệnh này có sẵn trong workflow và script build để thực thi khi có SDK. Kiểm tra cú pháp Dart qua formatter, XML Android, cú pháp script shell, schema SQLite bằng Python và `git diff --check` đã đạt; các kiểm tra này không thay thế Flutter analyze/test/build. Không coi việc tạo file workflow là bằng chứng build thành công.

Trước khi sử dụng chính thức, cần chạy workflow xanh và thử trên thiết bị thật: quyền thông báo cho phép/từ chối, hoàn thành/sửa/xóa hủy nhắc, reboot, đổi múi giờ, dữ liệu sau mở lại app và chế độ sáng/tối. Không có tuyên bố đã kiểm thử trên thiết bị trong workspace này.
