# Lịch Nhắc 1.2

**[Tải thẳng LichNhac-1.2.0.apk — không cần giải nén](https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/lich-nhac-v1.2.0-test-d783451/LichNhac-1.2.0.apk)**

[Release 1.2.0 thử nghiệm](https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/tag/lich-nhac-v1.2.0-test-d783451) · [Build đã kiểm chứng #38386193021](https://github.com/hominhtam1922003-lgtm/MangaNhanh/actions/runs/38386193021).

APK được lấy nguyên vẹn từ build thành công của commit `d783451`, không build lại khi đăng Release. Dùng debug signing để cài thử, không phải bản ký Google Play. **Có thể không cài đè APK 1.1 vì khác chữ ký. Không gỡ app nếu chưa chấp nhận mất công việc/key/cài đặt.**

Ứng dụng Android Flutter bằng tiếng Việt: công việc, lịch tháng/âm lịch, ngày lễ Việt Nam, thời tiết theo tọa độ và trợ lý lập kế hoạch Gemini.

- Tên: **Lịch Nhắc** · ID: **`vn.lichnhac.app`** · phiên bản **1.2.0+3**.
- **Android 7.0 / API 24 trở lên**, theo lựa chọn nâng cấp của người dùng. Bản này không còn hỗ trợ API 23, để dùng Flutter stable và thư viện hiện đại.
- Công việc, cài đặt và lịch lễ lưu trên máy. **Thời tiết và Gemini cần internet**.
- Không có backend riêng hoặc đăng nhập ứng dụng. Thời tiết không cần API key. Gemini tùy chọn, dùng key của riêng người dùng và quota của Google.

## Thay đổi 1.2

- UI Material 3 đồng bộ sáng/tối, nền dịu, thẻ gradient, form giới hạn chiều rộng; điều hướng rail khi ngang/rộng, thanh dưới trên điện thoại.
- Lịch 42 ô **chiều cao cố định**, âm lịch trong từng ô (UTC+7, 1900–2100), dấu công việc/ngày lễ; lịch và agenda đặt cạnh nhau trên màn rộng.
- Ô nhập tiếng Việt giữ controller/caret/composing ổn định; không lọc giữa lúc ghép dấu, giới hạn ký tự sau khi kết thúc composing. Tìm không dấu chỉ chuẩn hóa bản sao so sánh, không sửa text gốc. Lỗi bàn phím/UniKey ở host emulator cần kiểm tra riêng trên Gboard tiếng Việt ở máy thật.
- Lưu Gemini key **đọc lại để xác nhận**, thông báo ngay và trạng thái thường trực. Ô key trống sau khi lưu là bảo mật, không phải mất key. Lưu offline khác với xác thực Google: bấm **Kiểm tra key và tải mô hình** để kiểm tra quota/quyền/mạng.
- Thời tiết thêm mưa mm, gió giật/hướng gió, mây/áp suất, UV, mọc/lặn mặt trời, đồ thị nhiệt độ 24 giờ, thẻ giờ và ngày mở rộng. Cache cũ vẫn đọc được; trường chưa có hiển thị —, không tự điền dữ liệu giả. Không thể cam kết tăng độ chính xác vật lý của nguồn dự báo.
- SQLite **schema 3** thêm `alarm`, giữ dữ liệu cũ và chế độ thông báo cũ.

### Báo thức đổ chuông

Thêm/sửa công việc → chọn giờ → **Bật nhắc việc** → **Báo thức**. Mở **Tiện ích → Báo thức & quyền Android**:

1. Android 12+: cấp **Báo thức chính xác** (`SCHEDULE_EXACT_ALARM`); quay lại ứng dụng để đồng bộ. Không cấp sẽ dùng thông báo thường và báo rõ.
2. Android 13+: cấp thông báo để có điều khiển Dừng/Hoãn; Android 14+: quyền toàn màn hình là tùy chọn riêng.
3. Kiểm tra **âm lượng báo thức** (app không tự tăng âm lượng). Chuông mặc định Android hoặc âm beep gốc kèm app phát lặp, có rung, **Dừng / Hoãn 5 hoặc 10 phút**, tự dừng sau 5 phút.
4. Dừng chuông không tự hoàn thành việc. Sửa thời điểm/xóa/hoàn thành/tắt nhắc hủy lịch và chuông; app giữ trạng thái hoãn khi mở lại. Khôi phục lịch tương lai sau boot/cập nhật/đổi múi giờ; giờ địa phương giữ nguyên, hoãn tính theo phút thực.

Android yêu cầu thông báo foreground cho dịch vụ phát chuông; đây **không chỉ là âm thông báo một lần**. Khi thiếu quyền toàn màn hình, có thể phải chạm thông báo để mở nút điều khiển. Nếu đã tắt thông báo/quyền toàn màn hình, mở **Tiện ích → Báo thức & quyền Android → Mở báo thức đang đổ chuông** để Dừng/Hoãn. Nếu Android chặn dịch vụ, cố gắng gửi thông báo thường. Máy tắt, force-stop, thu hồi quyền, âm lượng 0, chế độ Không làm phiền hoặc OEM chặn nền có thể làm chuông không hoạt động. Không dùng thay báo thức khẩn cấp.

**Chữ ký bản thử:** keystore debug của runner cũ không được giữ. APK mới có thể không cài đè được APK 1.1 do khác chữ ký. Không gỡ app nếu chưa chấp nhận mất công việc/cài đặt/key; chưa có tính năng sao lưu tự động. Migration giữ dữ liệu khi cập nhật được với cùng chữ ký, không giữ dữ liệu sau uninstall.

### Kiểm tra trên máy thật trước khi tin cậy

- Dán key → Lưu → thấy xác nhận; thoát/mở lại → key vẫn đã lưu; thử kiểm tra mô hình (cần key Google hợp lệ). Không chia sẻ key trong chat/log.
- Gõ “Đặt lịch ôn tiếng Việt” bằng Gboard tiếng Việt, sửa giữa câu, xoay ngang, kiểm tra dấu/caret.
- Đặt việc 2 phút tới, bật Báo thức/quyền, khóa màn hình và đợi; thử Dừng, Hoãn, hai việc cùng giờ, sửa/xóa/hoàn thành, reboot trước giờ và từ chối quyền.
- Dự báo so với nguồn khí tượng địa phương, kiểm tra GPS, cache cũ/mất mạng. HTTP 200 chỉ chứng minh API nhận tham số, không chứng minh thời tiết đúng ngoài thực tế.

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
- Dữ liệu thật từ **Open-Meteo**: nhiệt độ, cảm giác, độ ẩm, gió, biểu đồ/dự báo 24 giờ và 7 ngày.
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
  - Trời quang: tùy chọn riêng, mặc định tắt để giảm phiền; chỉ báo có nắng khi nguồn xác định là ban ngày.
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

SQLite `lich_nhac.db`, schema **v3**: v1 tạo bảng công việc; v2 thêm cài đặt/index; v3 thêm cột báo thức mặc định tắt. Migration tuần tự giữ dữ liệu, có test nâng v1 → v3. Mở/cập nhật app không tự xóa dữ liệu.

- Ngày hạn lưu `YYYY-MM-DD` địa phương; giờ lưu số phút từ 00:00. Không có giờ: quá hạn từ ngày tiếp theo. Có giờ: quá hạn khi thời điểm đã qua. Đã xong: không quá hạn.
- Lịch nhắc đọc múi giờ thiết bị, dùng IANA `timezone`, xử lý GMT cố định; thông báo thường không xin quyền exact; báo thức đổ chuông có màn cấp quyền riêng.
- Thông báo công việc, lễ và thời tiết có namespace/kênh riêng, không hủy nhầm khi sửa việc. Nhắc công việc chỉ đồng bộ phần thay đổi, không hủy/lên lịch lại toàn bộ danh sách mỗi lần sửa.
- Công việc không tự đồng bộ sang máy khác. Android backup bị tắt. Gỡ/xóa dữ liệu app làm mất dữ liệu.
- **Xóa toàn bộ dữ liệu** có xác nhận, bao gồm công việc, cài đặt, vị trí, cache, lịch nhắc, tác vụ nền và Gemini key.
- Để giữ dữ liệu khi cài cập nhật, giữ application ID và chữ ký APK.

## Chạy trên máy tính

Cài Flutter **stable**, Android Studio/SDK và Java **17**. Workflow cố định bản stable **3.47.7 / Dart 3.13.5** đã được kiểm chứng để tránh nâng SDK ngoài ý muốn; yêu cầu tối thiểu của pubspec là Flutter 3.38.1 / Dart 3.10. Thư viện thực tế được cố định trong `pubspec.lock`.

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

Có smoke test HTTP nguồn thời tiết thật tại tâm Mỹ Tho (không chặn build nếu nhà cung cấp tạm lỗi, không phải test GPS thiết bị). Workflow `.github/workflows/publish-apk.yml` kiểm tra một lần build đã thành công, tải artifact trên runner rồi đăng chính file APK lên Release thử nghiệm; không build lại hay thay chữ ký. Có artifact nhỏ `lich-nhac-source-checkpoint` chứa mã định dạng và lockfile, và GitHub Checks báo chẩn đoán (không dùng Gemini key). Không yêu cầu secret hay keystore riêng để build APK.

### Tải và cài

**Cách nhanh nhất:** bấm link **Tải thẳng LichNhac-1.1.0.apk** ở đầu README, chép file APK sang Android 7.0+ và mở để cài. Không cần tải ZIP, giải nén hoặc đăng nhập GitHub. Đây là bản thử nghiệm, không phải bản ký phát hành Google Play.

**Cách dự phòng qua Actions (cần đăng nhập, tải ZIP):**

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

## Kiểm chứng 1.2 — 13/10/2026

Commit **`d783451c0cc3867f9f610755df28827e4440f856`**, [run #38386193021](https://github.com/hominhtam1922003-lgtm/MangaNhanh/actions/runs/38386193021): **success, 9 phút 7 giây**.

| Bước | Kết quả thật |
|---|---|
| Flutter 3.47.7 / Dart 3.13.5 | Stable, Java 17 |
| Định dạng | Không có diff `lib` / `test` |
| Analyze | **No issues found** |
| Flutter test | **73 tests passed**, gồm IME ghép dấu/caret, storage key, migration alarm, permission fallback, ngang 1440×800 và màn nhỏ/chữ lớn |
| Build release APK | Thành công, **62,6 MB** theo Flutter |
| Native unit policy | `:app:testReleaseUnitTest` thành công, kiểm tra giữ hoãn/marker đã phát/đổi hạn/múi giờ |
| Android 15 emulator | **OK (2 tests), 19,541 giây**; lịch thật AlarmManager chạy đến receiver/service, MediaPlayer báo đang phát, hoãn 5 phút, đồng bộ/restore giữ hoãn, hai chuông xếp hàng và hủy |
| API thời tiết thật | **HTTP 200**, chấp nhận các tham số mới (gió giật, áp suất, mưa tổng, UV, mọc/lặn) |

Emulator kiểm tra trạng thái MediaPlayer, **không chứng minh loa điện thoại/OEM, DND, reboot vật lý hay độ đúng của dự báo**. Chưa dùng key Google thật của người dùng; key test là chuỗi giả, storage/network được mock. Không đo FPS trên máy thật. Khôi phục lịch đã được kiểm tra bằng gọi `restore`, chưa mô phỏng reboot hệ điều hành.

## Kiểm chứng bản cũ 1.1 — 13/10/2026

Môi trường Arena thiếu Flutter/Dart và không tải được SDK từ Google, nên đã chuyển kiểm chứng thật sang **GitHub Actions**, không thay Flutter bằng app giả lập.

Bản mã **`56783aa`**, [workflow #38373854418](https://github.com/hominhtam1922003-lgtm/MangaNhanh/actions/runs/38373854418), đã hoàn tất thành công:

| Hạng mục | Kết quả thực tế |
|---|---|
| Flutter / Dart | Stable 3.47.7 / Dart 3.13.5, Java 17 |
| `flutter pub get` | Thành công, lockfile đã cố định |
| `dart format lib test` | Thành công, không có thay đổi định dạng |
| `flutter analyze` | No issues found |
| `flutter test` | **58 test đạt**, gồm màn hình 320×640 và chữ phóng 1,5 lần |
| `flutter build apk --release` | Thành công, `app-release.apk` **62,2 MB** |
| Nguồn thời tiết thật | **HTTP 200**, tham số app được Open-Meteo chấp nhận tại điểm Mỹ Tho; có dữ liệu 7 ngày và cờ ban ngày |
| Upload artifact | Thành công, **`lich-nhac-apk`** |

Log đầy đủ được công bố qua GitHub Checks **Flutter diagnostics**. Build thử nghiệm trên nhánh làm việc, **chưa merge vào main**. Phần cập nhật tài liệu sau lần chạy này không thay đổi mã ứng dụng đã được kiểm chứng.

Các lỗi test/Gradle ở những lần CI đầu đã được sửa. Dữ liệu thời tiết trong smoke test là điểm lưới tại tâm Mỹ Tho, không phải GPS của điện thoại người dùng và không chứng minh dự báo chính xác 100%.

**Chưa kiểm chứng Gemini bằng key của bạn, GPS trên thiết bị thật, thông báo nền/reboot hoặc FPS thực tế.** Test mock/CI không thay thế thử trên điện thoại. Cần thử quyền cho phép/từ chối, mất mạng, thay vị trí, reboot, tiết kiệm pin và buộc dừng. Không cam kết thời tiết chính xác 100% hoặc cảnh báo đúng phút.
