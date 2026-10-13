# Lịch Nhắc 1.1

Ứng dụng Android Flutter bằng tiếng Việt: công việc, lịch tháng/âm lịch, ngày lễ Việt Nam, thời tiết theo tọa độ và trợ lý lập kế hoạch Gemini.

- Tên: **Lịch Nhắc** · ID: **`vn.lichnhac.app`** · phiên bản **1.1.0+2**.
- **Android 7.0 / API 24 trở lên**, theo lựa chọn nâng cấp của người dùng. Bản này không còn hỗ trợ API 23, để dùng Flutter stable và thư viện hiện đại.
- Công việc, cài đặt và lịch lễ lưu trên máy. **Thời tiết và Gemini cần internet**.
- Không có backend riêng hoặc đăng nhập ứng dụng. Thời tiết không cần API key. Gemini tùy chọn, dùng key của riêng người dùng và quota của Google.

## Chức năng

### Công việc và lịch

- Hôm nay: ngày dương/âm, ngày lễ, số việc chưa xong/đã xong/quá hạn và việc đến hạn hôm nay.
- Lịch tháng: chuyển tháng, về hôm nay, chọn ngày, thêm việc; đánh dấu ngày có công việc và ngày lễ.
- Công việc: tìm tiêu đề, kết hợp bộ lọc trạng thái/danh mục, sắp hạn hoặc ưu tiên. Danh sách dựng từng mục khi cuộn (`SliverList`), tìm kiếm debounce 180 ms.
- Thêm/sửa/xóa/hoàn thành; tiêu đề tối đa 100 ký tự, ghi chú, ngày, giờ tùy chọn, danh mục và ưu tiên. Xóa có xác nhận.
- Thông báo nhắc công việc: xin quyền Android 13+, không crash nếu từ chối; sửa/xóa/hoàn thành cập nhật hoặc hủy lịch.
- Material 3 sáng/tối/hệ thống; thẻ gradient có chiều sâu và biểu tượng thời tiết dạng khối 3D nhẹ. Không chạy vòng lặp animation 3D nặng khi app rảnh.

### Thời tiết có nguồn rõ ràng

Mở tab **Thời tiết** → **Dùng GPS**, hoặc **Chọn địa điểm** / nhập vĩ độ, kinh độ.

- GPS chỉ được xin quyền khi bấm nút; hiển thị tọa độ và độ chính xác ước tính. Nếu GPS tắt hoặc từ chối quyền, vẫn chọn thủ công được.
- Mỹ Tho là địa điểm chọn sẵn có nhãn rõ, **không được giả là vị trí GPS hiện tại**.
- Dữ liệu thật từ **Open-Meteo**: nhiệt độ, cảm giác, độ ẩm, gió, dự báo 12 giờ và 7 ngày.
- Hiển thị nguồn, múi giờ, thời điểm số liệu và thời điểm tải; cache cũ được đánh dấu, không sinh dự báo mẫu khi không kết nối được.
- Lưu cache trong SQLite. Khi mở lại app, tải lại cache; tự cập nhật khi đã có cấu hình và cache quá một giờ. Có cập nhật thủ công/kéo làm mới.

**Không thể bảo đảm thời tiết hoặc GPS chính xác 100%.** GPS có sai số; dự báo là đầu ra mô hình trên vùng lưới, không phải cảm biến tại nhà bạn. Gemini không được dùng để tự tạo dự báo. Luôn xem xác suất mưa và thời điểm dữ liệu.

### Cảnh báo thời tiết nền

Bật **Kiểm tra thời tiết định kỳ** trong tab Thời tiết, cấp quyền thông báo nếu muốn nhận nhắc:

- WorkManager đặt mục tiêu kiểm tra **15 phút/lần** khi có mạng, dùng **tọa độ đã chọn gần nhất**, không theo dõi GPS liên tục hoặc xin quyền vị trí nền.
- Xét dự báo **3 giờ tới**:
  - Mưa: mặc định xác suất ≥ 60% và lượng mưa dự báo ≥ 0,2 mm.
  - Nắng nóng: mặc định ≥ 35°C hoặc UV ≥ 8.
  - Gió mạnh: mặc định gió giật ≥ 40 km/h.
  - Trời quang: tùy chọn riêng, mặc định tắt để giảm phiền.
- Có lựa chọn ngưỡng trong giao diện; mỗi loại tối đa một thông báo trong **4 giờ** để tránh spam.
- Không gửi cảnh báo từ cache tải quá một giờ hoặc số liệu hiện tại cũ hơn 90 phút.
- Tắt cảnh báo/xóa dữ liệu sẽ hủy tác vụ nền và thông báo liên quan.

**Android có thể trì hoãn WorkManager và lịch thông báo** do Doze, tiết kiệm pin, giới hạn hãng máy hoặc buộc dừng ứng dụng. Đây **không phải** hệ thống cảnh báo khẩn cấp; không cam kết thông báo đúng phút. Sau khi buộc dừng, mở lại ứng dụng. Khi di chuyển, lấy GPS mới nếu muốn dự báo theo nơi mới.

Nguồn: https://open-meteo.com/ · dữ liệu CC BY 4.0; API miễn phí dành cho sử dụng phi thương mại theo điều khoản nhà cung cấp. Nếu phân phối thương mại, phải kiểm tra điều khoản/quota và chọn giấy phép phù hợp.

### Ngày lễ Việt Nam

Vào **Tiện ích → Ngày lễ Việt Nam**:

- Tết Dương lịch, Tết Nguyên đán, Giao thừa, Giỗ Tổ Hùng Vương, 30/4, 1/5, Quốc khánh, Trung thu và các ngày kỷ niệm.
- Quy đổi âm lịch Việt Nam **UTC+7**, phạm vi **1900–2100**. Công thức thiên văn Jean Meeus; thuật toán tháng nhuận theo lịch Việt Nam của **Hồ Ngọc Đức**.
- Có nhắc trước 1/3/7 ngày lúc 09:00, lựa chọn chỉ ngày lễ chính hoặc thêm ngày kỷ niệm.
- **Không coi danh sách này là lịch nghỉ bù chính thức.** Ngày nghỉ liền kề Quốc khánh, bố trí kỳ nghỉ Tết và nghỉ bù cần theo công bố hằng năm / cơ quan của bạn. Không tự suy đoán các quyết định này.
- Lịch lễ dựng cục bộ, không cần mạng; tính lại lịch nhắc khi mở app. Receiver Android khôi phục lịch đã đặt sau reboot/cập nhật.

### Gemini: lập kế hoạch có xác nhận

Vào **Tiện ích → Trợ lý Gemini**:

1. Nhập API key **trong app**, bấm **Lưu key an toàn**. Không gửi key trong chat, không commit lên GitHub, không nhúng key vào APK.
2. Bấm **Kiểm tra key và tải mô hình**; chọn mô hình có quyền `generateContent` trong danh sách Google trả về.
3. Nhập yêu cầu. Nếu muốn, bật gửi tối đa 30 việc chưa xong (chỉ tiêu đề/ngày/giờ, không gửi ghi chú hoặc GPS).
4. Bấm **Tạo bản nháp**. App gửi nội dung yêu cầu và dữ liệu bạn chủ động cho phép tới Google Gemini.
5. Kiểm tra ngày/giờ, chạm từng bản nháp để sửa, chọn các việc muốn lưu, rồi **xác nhận lưu**.

App kiểm tra cấu trúc JSON, tiêu đề, ngày thực sự tồn tại, giờ, danh mục, ưu tiên và tối đa 10 bản nháp. AI không tự sửa lịch, tự bật thông báo hay lưu trước xác nhận. Lưu nhiều việc dùng transaction SQLite. AI vẫn có thể gợi ý sai dù JSON hợp lệ.

Key được lưu bằng `flutter_secure_storage`, cơ chế bảo mật Android; không lưu trong SQLite hoặc log CI. Thiết bị root/xâm nhập không được bảo đảm an toàn tuyệt đối. Có nút xóa key. Gemini có giới hạn quota, điều khoản và chính sách dữ liệu riêng của Google; không cần bật thanh toán để dùng các phần app khác. Không gửi dữ liệu nhạy cảm nếu không muốn chia sẻ với nhà cung cấp.

## Lưu dữ liệu và riêng tư

SQLite `lich_nhac.db`, schema **v2**: v1 tạo bảng công việc; v2 thêm cài đặt/index. Migration tuần tự giữ dữ liệu, có test nâng v1 → v2. Mở/cập nhật app không tự xóa dữ liệu.

- Ngày hạn lưu `YYYY-MM-DD` địa phương; giờ lưu số phút từ 00:00. Không có giờ: quá hạn từ ngày tiếp theo. Có giờ: quá hạn khi thời điểm đã qua. Đã xong: không quá hạn.
- Lịch nhắc đọc múi giờ thiết bị, dùng IANA `timezone`, xử lý GMT cố định; không xin quyền báo thức chính xác.
- Thông báo công việc, lễ và thời tiết có namespace/kênh riêng, không hủy nhầm khi sửa việc. Nhắc công việc chỉ đồng bộ phần thay đổi, không hủy/lên lịch lại toàn bộ danh sách mỗi lần sửa.
- Công việc không tự đồng bộ sang máy khác. Android backup bị tắt. Gỡ/xóa dữ liệu app làm mất dữ liệu.
- **Xóa toàn bộ dữ liệu** có xác nhận, bao gồm công việc, cài đặt, vị trí, cache, lịch nhắc, tác vụ nền và Gemini key.
- Để giữ dữ liệu khi cài cập nhật, giữ application ID và chữ ký APK.

## Chạy trên máy tính

Cài Flutter **stable**, Android Studio/SDK và Java **17**. Mã đã được CI resolve với Flutter **3.47.7 / Dart 3.13.5**; yêu cầu tối thiểu của pubspec là Flutter 3.38.1 / Dart 3.10. Thư viện thực tế được cố định trong `pubspec.lock`.

```bash
flutter doctor
flutter doctor --android-licenses
flutter pub get
dart format lib test
flutter analyze
flutter test
flutter devices
flutter run
```

Build APK thử:

```bash
flutter build apk --release
# Hoặc Linux/macOS:
bash scripts/build-apk.sh
```

APK: **`build/app/outputs/flutter-apk/app-release.apk`**. `android/local.properties` do Flutter tạo; không commit. Không chạy lại `flutter create` hay các script Capacitor cũ.

## GitHub Actions và APK

Workflow **`.github/workflows/build-apk.yml`** chạy trên Ubuntu latest, Java 17, Flutter stable:

1. `flutter pub get`
2. `dart format lib test`
3. `flutter analyze`
4. `flutter test`
5. `flutter build apk --release`
6. Upload APK bằng **`actions/upload-artifact@v4`**, artifact **`lich-nhac-apk`**, lưu 30 ngày.

Chạy khi push `main`, pull request vào `main`, chạy thủ công; có thêm trigger push nhánh làm việc Arena để kiểm chứng trước merge. Các lệnh ghi log qua `tee` dùng `shell: bash` có `pipefail`: test/analyze thất bại sẽ **không** tiếp tục build.

Có artifact nhỏ `lich-nhac-source-checkpoint` chứa mã định dạng và lockfile, và GitHub Checks báo chẩn đoán (không dùng Gemini key). Không yêu cầu secret hay keystore riêng để build APK.

### Tải và cài

1. Vào repository → **Actions → Build APK Lịch Nhắc**.
2. Chọn **lần chạy xanh đúng nhánh/commit** → **Artifacts → lich-nhac-apk**.
3. Đăng nhập GitHub, tải ZIP, giải nén lấy `app-release.apk`.
4. Chép APK sang Android **7.0+**, mở file, cho phép cài ứng dụng từ nguồn đó nếu được hỏi.
5. Trong app, chọn GPS/thủ công và bật cảnh báo nếu muốn. Nhập Gemini key trong app, không trong cuộc trò chuyện.

**APK dùng debug signing cho release, chỉ để thử nội bộ, không phải bản ký phát hành Google Play.** Không commit keystore/mật khẩu. Keystore debug trên runner có thể đổi giữa các lần build: nếu chữ ký không khớp cần gỡ bản thử cũ (mất dữ liệu) hoặc dùng chữ ký ổn định do bạn tự quản lý ngoài Git. Bản phát hành cần cấu hình signing riêng/App Bundle và khai báo riêng tư phù hợp.

## Đưa mã lên GitHub

Repository hiện tại đã có Git. Trong Arena giữ nhánh làm việc của phiên và mở PR vào `main`; không khởi tạo lại lịch sử.

Nếu tạo repository mới **từ bản sao chưa có Git** trên máy riêng: tạo repo trống trên https://github.com/new rồi:

```bash
git init -b main
git add .
git commit -m "Ứng dụng Lịch Nhắc"
git remote add origin https://github.com/<ten-cua-ban>/lich-nhac.git
git push -u origin main
```

Không commit API key, `.dart_tool`, APK/build, local.properties hoặc keystore. Với repository đã có lịch sử, push nhánh làm việc và tạo PR thay vì khởi tạo lại.

## Cấu trúc

```text
lib/
  app/        # Controller, theme, lifecycle
  models/     # Task, weather, âm lịch, ngày lễ
  data/       # SQLite, HTTP, notification hub, WorkManager, Gemini
  features/   # Hôm nay, Lịch, Công việc, Thời tiết, Lễ, Gemini, Cài đặt
  widgets/    # TaskCard, trạng thái trống, thẻ chiều sâu
android/      # Flutter/Gradle, permissions, receiver, timezone channel
scripts/build-apk.sh
test/         # Quá hạn/lọc, SQLite, notification, thời tiết HTTP/rule, lịch âm, AI JSON, widget
legacy-web/   # MangaNhanh web cũ, không tham gia build Flutter
```

## Kiểm chứng

Môi trường Arena không có Flutter/Dart và không tải được SDK từ Google. Do đó đã chuyển **kiểm chứng thật sang GitHub Actions**, không thay Flutter bằng app giả lập. CI đầu tiên đã chạy analyze thành công và tìm thấy các lỗi test/Gradle; các lỗi đó đang được sửa và kiểm chứng lại cho bản mở rộng.

Xem kết quả của commit mới nhất trong Actions và GitHub Checks `Flutter diagnostics`; chỉ coi APK đã kiểm chứng build khi **job build-apk xanh và có artifact APK**. Kết quả cuối cùng sẽ được cập nhật khi CI hoàn tất.

Test mock/CI **không chứng minh** GPS, thời tiết trực tiếp, Gemini bằng key của người dùng, hiệu suất FPS hoặc thông báo nền đã được thử trên điện thoại. Cần kiểm tra thực tế các quyền cho phép/từ chối, mất mạng, thay vị trí, reboot, tiết kiệm pin và buộc dừng. Không có cam kết chính xác 100% hoặc cảnh báo đúng phút.
