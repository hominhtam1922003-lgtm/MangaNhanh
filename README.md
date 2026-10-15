# Lịch Nhắc 1.3

**[Tải trực tiếp LichNhac-1.3.0.apk — GroqCloud chat](https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/lich-nhac-v1.3.0-test-e241f0f/LichNhac-1.3.0.apk)**

[Release 1.3](https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/tag/lich-nhac-v1.3.0-test-e241f0f) · [Build nguồn thành công #38392914401](https://github.com/hominhtam1922003-lgtm/MangaNhanh/actions/runs/38392914401).

APK lấy nguyên vẹn từ commit `e241f0f`, không build lại khi đăng Release. Debug signing để thử, không ký Google Play. **Có thể không cài đè được APK cũ do khác chữ ký. Gỡ app sẽ mất công việc/key/lịch sử/cài đặt; không gỡ nếu chưa chấp nhận mất dữ liệu.**

Ứng dụng Android Flutter bằng tiếng Việt: công việc, lịch tháng/âm lịch, ngày lễ Việt Nam, thời tiết theo tọa độ và trợ lý chat GroqCloud.

- Tên: **Lịch Nhắc** · ID: **`vn.lichnhac.app`** · phiên bản **1.3.0+4**.
- **Android 7.0 / API 24 trở lên**, theo lựa chọn nâng cấp của người dùng. Bản này không còn hỗ trợ API 23, để dùng Flutter stable và thư viện hiện đại.
- Công việc, cài đặt và lịch lễ lưu trên máy. **Thời tiết và trợ lý AI cần internet**.
- Không có backend riêng hoặc đăng nhập ứng dụng. Thời tiết không cần API key. GroqCloud tùy chọn, dùng key của riêng người dùng và hạn mức nhà cung cấp.

## Trợ lý AI GroqCloud — 1.3

- Tab trợ lý chuyển từ form Gemini sang chat hỏi–đáp nhiều lượt qua **GroqCloud** (không phải Grok/xAI).
- Tạo key tại `https://console.groq.com/keys` → Cài đặt AI → nhập key `gsk_…` → Lưu → Kiểm tra kết nối. Key Gemini không dùng với GroqCloud, không bị gửi/xóa khi đổi provider.
- API trực tiếp: `https://api.groq.com/openai/v1/models` và `/openai/v1/chat/completions`; dùng Bearer header. Không nhúng key, không backend riêng.
- Tự khám phá mô hình mỗi lần gửi; model bị ngừng/404 sẽ tải lại danh sách và thử mô hình khác, tối đa 3 lần. Không tự retry 429/quota hoặc bật thanh toán.
- Khi bấm Gửi: tối đa 20 tin gần nhất (giới hạn ngữ cảnh 16.000 ký tự) và câu hỏi ≤4.000 ký tự gửi cho GroqCloud. Có thể chọn cho AI tham khảo 30 việc chưa xong, chỉ tiêu đề/ngày/giờ, không ghi chú/GPS/thời tiết.
- Lịch sử tối đa 100 tin lưu SQLite trên máy; không mã hóa riêng, không sync tự động. Xóa cuộc trò chuyện có xác nhận, không xóa dữ liệu nhà cung cấp đã nhận.
- Sao chép tin nhắn hoặc chuyển sang form tạo việc; phải nhập tiêu đề và bấm Lưu. AI không tự ghi công việc, đặt chuông hay truy cập web/GPS.
- API có hạn mức/điều khoản riêng. AI có thể sai. APK 1.3 đã build/test; các bản 1.2 trở về trước chưa có chat GroqCloud.

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

## Kiểm chứng 1.3 — 13/10/2026

Nguồn `e241f0f3460b5d2df3af5ea6b3620f8e4293a09e`, [run #38392914401](https://github.com/hominhtam1922003-lgtm/MangaNhanh/actions/runs/38392914401): **success, 9 phút 28 giây**.

- Analyze thành công, không diff định dạng Dart.
- **85 tests passed**: thêm Groq key tách biệt, đọc lại, chat UTF-8/endpoint/header/ngữ cảnh, lọc model, tự đổi model ngừng (400/404), giới hạn retry, 429 không retry, giới hạn lịch sử; UI 320×640/chữ 1,5 lần/bàn phím, gửi/nhận và lưu SQLite không tự tạo việc.
- APK release build thành công (**62,8 MB** theo Flutter), native unit và **2 Android 15 emulator alarm tests** đạt.
- **Test chat dùng API mock/FakeGroq, không phải key tài khoản thật.** Cần nhập key hợp lệ trên máy và kiểm tra quyền/hạn mức. Không khẳng định đã xác thực với GroqCloud bằng key của người dùng.

## Kiểm chứng 1.2 — 13/10/2026

Commit **`d783451c0cc3867f9f610755df28827e4440f856`**, [run #38386193021](https://github.com/hominhtam1922003-lgtm/MangaNhanh/actions/runs/38386193021): **success, 9 phút 7 giây**.

| Bước                         | Kết quả thật                                                                                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Flutter 3.47.7 / Dart 3.13.5 | Stable, Java 17                                                                                                                                                               |
| Định dạng                    | Không có diff `lib` / `test`                                                                                                                                                  |
| Analyze                      | **No issues found**                                                                                                                                                           |
| Flutter test                 | **73 tests passed**, gồm IME ghép dấu/caret, storage key, migration alarm, permission fallback, ngang 1440×800 và màn nhỏ/chữ lớn                                             |
| Build release APK            | Thành công, **62,6 MB** theo Flutter                                                                                                                                          |
| Native unit policy           | `:app:testReleaseUnitTest` thành công, kiểm tra giữ hoãn/marker đã phát/đổi hạn/múi giờ                                                                                       |
| Android 15 emulator          | **OK (2 tests), 19,541 giây**; lịch thật AlarmManager chạy đến receiver/service, MediaPlayer báo đang phát, hoãn 5 phút, đồng bộ/restore giữ hoãn, hai chuông xếp hàng và hủy |
| API thời tiết thật           | **HTTP 200**, chấp nhận các tham số mới (gió giật, áp suất, mưa tổng, UV, mọc/lặn)                                                                                            |

Emulator kiểm tra trạng thái MediaPlayer, **không chứng minh loa điện thoại/OEM, DND, reboot vật lý hay độ đúng của dự báo**. Chưa dùng key Google thật của người dùng; key test là chuỗi giả, storage/network được mock. Không đo FPS trên máy thật. Khôi phục lịch đã được kiểm tra bằng gọi `restore`, chưa mô phỏng reboot hệ điều hành.

## Kiểm chứng bản cũ 1.1 — 13/10/2026

Môi trường Arena thiếu Flutter/Dart và không tải được SDK từ Google, nên đã chuyển kiểm chứng thật sang **GitHub Actions**, không thay Flutter bằng app giả lập.

Bản mã **`56783aa`**, [workflow #38373854418](https://github.com/hominhtam1922003-lgtm/MangaNhanh/actions/runs/38373854418), đã hoàn tất thành công:

| Hạng mục                      | Kết quả thực tế                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| Flutter / Dart                | Stable 3.47.7 / Dart 3.13.5, Java 17                                                                  |
| `flutter pub get`             | Thành công, lockfile đã cố định                                                                       |
| `dart format lib test`        | Thành công, không có thay đổi định dạng                                                               |
| `flutter analyze`             | No issues found                                                                                       |
| `flutter test`                | **58 test đạt**, gồm màn hình 320×640 và chữ phóng 1,5 lần                                            |
| `flutter build apk --release` | Thành công, `app-release.apk` **62,2 MB**                                                             |
| Nguồn thời tiết thật          | **HTTP 200**, tham số app được Open-Meteo chấp nhận tại điểm Mỹ Tho; có dữ liệu 7 ngày và cờ ban ngày |
| Upload artifact               | Thành công, **`lich-nhac-apk`**                                                                       |

Log đầy đủ được công bố qua GitHub Checks **Flutter diagnostics**. Build thử nghiệm trên nhánh làm việc, **chưa merge vào main**. Phần cập nhật tài liệu sau lần chạy này không thay đổi mã ứng dụng đã được kiểm chứng.

Các lỗi test/Gradle ở những lần CI đầu đã được sửa. Dữ liệu thời tiết trong smoke test là điểm lưới tại tâm Mỹ Tho, không phải GPS của điện thoại người dùng và không chứng minh dự báo chính xác 100%.

**Chưa kiểm chứng Gemini bằng key của bạn, GPS trên thiết bị thật, thông báo nền/reboot hoặc FPS thực tế.** Test mock/CI không thay thế thử trên điện thoại. Cần thử quyền cho phép/từ chối, mất mạng, thay vị trí, reboot, tiết kiệm pin và buộc dừng. Không cam kết thời tiết chính xác 100% hoặc cảnh báo đúng phút.

## Ứng dụng Mật Mã Yêu (tên cũ: Hai Trái Tim — thư mục `couple-love/`)

Mã nguồn đầy đủ của app đếm ngày yêu **Android ↔ iOS** nằm trong thư mục `couple-love`: React Native/Expo SDK 54, NativeWind, trái tim 3D bằng Three.js/R3F. App dùng được ngay **không cần tài khoản, không cần máy chủ**: hai máy ghép nối bằng **mã 6 số** qua các trạm MQTT công cộng với dữ liệu **mã hóa đầu-cuối** (1.3.0), hoặc chuyển dữ liệu thủ công bằng mã/tệp JSON; chế độ Supabase (realtime, RLS, Storage, Edge Function + cron thông báo kép) vẫn còn cho ai muốn dựng máy chủ riêng. Hướng dẫn backend, push FCM/APNs, secrets ký APK và kiểm thử ở `couple-love/README.md`.

### Tải APK thử nghiệm (Android 7.0+, API 24)

## Mật Mã Yêu 1.18.3 (bản mới nhất) — sửa cuộc gọi trực tiếp WebRTC + TURN riêng (`couple-love.metered.live`) trên LDPlayer

**APK Android (bản đầy đủ):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-v1.18.3-test-b19b6bf/MatMaYeu-1.18.3.apk · **78.688.409 byte** (kèm file kiểm tra `MatMaYeu-1.18.3.apk.sha256` trong Assets)
**APK Android (bản NHẸ, chỉ arm64-v8a):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-v1.18.3-test-b19b6bf/MatMaYeu-1.18.3-arm64.apk · **56.292.158 byte** (kèm file `MatMaYeu-1.18.3-arm64.sha256`)
**iPhone (`.ipa` chưa ký, ký lại bằng Apple ID miễn phí):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-ios-v1.18.3-test-b19b6bf/MatMaYeu-1.18.3-unsigned.ipa · **17.184.234 byte** (kèm file `MatMaYeu-1.18.3-unsigned.ipa.sha256`)

Trong app mở **Cài đặt**, dòng cuối phải là **Mật Mã Yêu 1.18.3, bản dựng 23**. Dựng từ `b19b6bf3a07735c77168cc8bb1ea82c05504b4b4` (APK build `38673090771`; iOS build `38673090772`). **Cài đè lên 1.18.2 / 1.18.1 được, không mất dữ liệu.**

**Nguyên nhân vì sao 1.18.2 vẫn báo *"Chưa nối trực tiếp được, tiếng đang đi qua kênh ghép nối"* dù đã có TURN riêng & cách sửa ở 1.18.3:**

1. **Lỗi khoá chết (`await this.ready` deadlock) tại `src/services/rtcCall.ts:331`:**
   - Trong `constructor`, `this.ready = this.setup()`, mà `this.setup()` lại chờ hết `await this.peerStage()` (2,5 giây) rồi mới chạy `await this.nativeStage()`.
   - Nhưng hàm nhận tín hiệu `handle(message)` lại viết `await this.ready` ngay dòng đầu tiên! Hệ quả: trong suốt 2,5 giây đầu, mọi gói tín hiệu (`pid`, `offer`, `answer`, `ice`) gửi từ máy kia sang đều bị **treo cứng ở dòng `await this.ready`** — đến khi mở khoá thì `peerStage()` đã hết giờ và tự huỷ (`stopPeer()`), còn mảng `this.early` cũng trống rỗng.
   - **Đã sửa:** Tách riêng `this.micReady = this.openMic()`, bỏ hẳn `await this.ready`, mở thẳng `nativeStage` (WebRTC + TURN riêng `couple-love.metered.live`) ngay giây thứ 0 khi nhấc máy, và xếp hàng xử lý `offer`/`answer`/`ice` tuần tự qua `this.signalChain`.
2. **Xung đột IP ảo nội bộ `10.0.2.15` (`typ host`) giữa hai máy ảo LDPlayer:**
   - Mỗi cửa sổ LDPlayer đều được cấp cùng địa chỉ IP nội bộ `10.0.2.15` sau lớp NAT ảo của giả lập. Khi LDPlayer A gửi địa chỉ `10.0.2.15 typ host` cho LDPlayer B, WebRTC của LDPlayer B tưởng LDPlayer A nằm cùng mạng LAN `10.0.2.x` (ưu tiên cao nhất) nên tự bắn gói kiểm tra STUN vào chính `10.0.2.15` của mình thay vì dùng địa chỉ `typ relay` của máy chủ TURN `couple-love.metered.live`.
   - **Đã sửa:** Lọc bỏ địa chỉ ảo `10.0.2.x typ host` (`isEmulatorLoopbackHost`), và nếu sau 4 giây chế độ ưu tiên P2P (`all`) vẫn bị tường lửa/NAT giả lập giữ lại thì tự động chuyển sang vòng 2 ép **100% đi qua máy chủ TURN (`iceTransportPolicy: "relay"`)** trước khi hạ xuống kênh ghép nối.
3. **Bù gói `offer` / `answer` / `accept` bị trễ trên MQTT & dự phòng micro giả lập:**
   - Gửi lặp gói `accept` (0ms, 250ms, 500ms); bên gọi tự gửi nhắc `offer` mỗi 1,2 giây khi chưa nhận được `answer`; bên nghe tự gửi lại `lastAnswerSdp` kèm danh sách ICE khi nhận lại `offer`. Nếu 1 cửa sổ LDPlayer trên PC không gắn mic (hoặc mic bị cửa sổ kia giữ), vẫn tạo luồng `MediaStream` / `recvonly` để kết nối WebRTC trực tiếp không bị huỷ.

## Mật Mã Yêu 1.18.2 (bản trước) — khôi phục đủ 5 tab + Theme, đăng nhập tài khoản trong app, mã cố định hai chiều không kẹt SQL

**APK Android (bản đầy đủ):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-v1.18.2-test-56303e4/MatMaYeu-1.18.2.apk · **78.685.217 byte** (kèm file kiểm tra `MatMaYeu-1.18.2.apk.sha256` trong Assets)
**APK Android (bản NHẸ, chỉ arm64-v8a):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-v1.18.2-test-56303e4/MatMaYeu-1.18.2-arm64.apk · **56.288.966 byte** (kèm file `MatMaYeu-1.18.2-arm64.sha256`)
**iPhone (`.ipa` chưa ký, ký lại bằng Apple ID miễn phí):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-ios-v1.18.2-test-56303e4/MatMaYeu-1.18.2-unsigned.ipa · **17.182.615 byte** (kèm file `MatMaYeu-1.18.2-unsigned.ipa.sha256`)

Trong app mở **Cài đặt**, dòng cuối phải là **Mật Mã Yêu 1.18.2, bản dựng 22**. Dựng từ `56303e4cdca4cc3f51c026cf4f0d9636c95824af` (APK build `38669023110`; iOS build `38669022958`). **Cài đè lên 1.18.1 / 1.18.0 được, không mất dữ liệu** (gói `vn.haitraitim.app`, slug và khoá ký giữ nguyên). **Không gỡ app** nếu chưa chấp nhận mất dữ liệu.

**Sửa 3 lỗi trên LDPlayer của bản 1.18.1:**

1. **Khôi phục đầy đủ thanh 5 tab (`Yêu nhau`, `Tin nhắn`, `Chăm sóc`, `Nhật ký`, `Cài đặt`), Chủ đề (Theme), Ảnh nền và toàn bộ tính năng cũ:**
   - Bản 1.18.0/1.18.1 có 2 lỗi chặn giao diện: ① `Root()` đọc `readConfig()` thấy sẵn cấu hình Supabase nên đẩy nhầm sang `CloudApp` 1.0 cũ (chỉ có 4 tab cũ, không có `Tin nhắn`, không có `Theme`, bấm tạo mã báo *“Chưa tạo được mã — Chưa hoàn tất thao tác”*); ② Ở chế độ trên máy, màn chắn `PairGate` chặn trước `LocalShell` làm mất hẳn thanh 5 tab dưới đáy và nền chủ đề.
   - Bản 1.18.2 mở thẳng vào `LocalApp` (`love-mode-v2`), luôn hiển thị đủ 5 tab dưới đáy + chủ đề + ảnh nền; phần ghép nối nằm ở nút **“🔗 Ghép nối”** trên đầu màn hình hoặc trong Cài đặt. Khi chưa ghép nối thì app chỉ khoá mở phòng mạng (vẫn chống “kết nối ảo”), không che mất ứng dụng.
2. **Đăng nhập / Đăng ký tài khoản ngay trong app (không còn lệ thuộc trình duyệt Google trên giả lập):**
   - Thêm khung **Đăng nhập** và **Đăng ký** bằng **Tên tài khoản hoặc Email + Mật khẩu (≥ 6 ký tự)** ngay trong màn Ghép nối, kèm nút **Dùng ngay trên máy này (tạo mã tức thì)** và vẫn giữ nút Google/Facebook.
   - Nếu Supabase chưa bật xác nhận hoặc chưa chạy SQL, tài khoản vẫn tạo phiên ổn định từ đúng email + mật khẩu để cùng một tài khoản luôn ra **đúng một mã cố định 6 ký tự** trên mọi máy.
3. **Kết nối hai chiều bằng mã cố định 6 ký tự chạy được ngay cả khi chưa chạy `002_pairing.sql`:**
   - Khi hàm RPC `ensure_profile` / `pair_with_code` trên Supabase chưa được tạo hoặc lỗi mạng, app tự suy **mã cố định 6 ký tự** từ tài khoản (`shortCodeFromUid`) và tạo **khoá phòng đối xứng** (`pairSecretFromCodes(mã_A, mã_B)`), đồng thời lắng nghe trên kênh hộp thư lời mời của mã mình (`inviteSecretForCode`).
   - Máy A chỉ cần nhập mã 6 ký tự của máy B (hoặc ngược lại) → máy A gửi gói lời mời `pair.invite` → máy B tự nhận người thương và tự nhảy sang cùng phòng kết nối hai chiều. Nút **Ngắt kết nối (cả hai máy)** gửi `pair.unpair` để cả hai máy cùng rời phòng.
   - Sửa thêm bộ lọc `RelayClient.handle` trong `relayProtocol.mjs` để không làm rơi gói `typing`, `reaction`, `unsend`, `profile`, `read`, `chatAck`, `pair.invite`, `pair.unpair`.

**141/141 bài kiểm thử xanh**, `tsc` sạch, Prettier sạch. **Chưa thử trực tiếp trên LDPlayer của bạn nên chưa khẳng định 100% đã hết lỗi** — hãy cài đè bản 1.18.2 (không gỡ app) và kiểm tra đủ 5 tab + Theme + ghép nối hai máy.

## Mật Mã Yêu 1.18.1 (bản trước) — bản sạch mã nguồn sau tổng vệ sinh

**APK Android (bản đầy đủ):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-v1.18.1-test-e6d5cb6/MatMaYeu-1.18.1.apk · **78.669.445 byte** (kèm file kiểm tra `MatMaYeu-1.18.1.apk.sha256` trong Assets)
**APK Android (bản NHẸ, chỉ arm64-v8a):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-v1.18.1-test-e6d5cb6/MatMaYeu-1.18.1-arm64.apk · **56.273.194 byte** (kèm file `MatMaYeu-1.18.1-arm64.sha256`)
**iPhone (`.ipa` chưa ký, ký lại bằng Apple ID miễn phí):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-ios-v1.18.1-test-e6d5cb6/MatMaYeu-1.18.1-unsigned.ipa · **17.170.132 byte** (kèm file `MatMaYeu-1.18.1-unsigned.ipa.sha256`)

Trong app mở **Cài đặt**, dòng cuối phải là **Mật Mã Yêu 1.18.1, bản dựng 21**. Dựng từ `e6d5cb60c023f47e772949c080be916bf9788102` (APK build `38660107385`; iOS build `38660107403`). **Cài đè lên 1.18.0 được, không mất dữ liệu** (gói `vn.haitraitim.app`, slug và khoá ký giữ nguyên). **Không gỡ app** nếu chưa chấp nhận mất dữ liệu.

**Tính năng y hệt 1.18.0 — bản này chỉ dọn mã nguồn:**

- **Xoá code chết:** giao thức mã 6 số/QR cũ (`createRoom`, `roomFromCode`, `makeCode`, `roomToQr`, `roomFromQr`, `codePattern`), hàm dựng phòng từ bộ nhớ máy `roomFromState` (nguồn của lỗi “kết nối ảo”), `lastMessageTimes`, `callStatusText`, `isCallPhase`, `PHASES`, `sameDay`, `randomBytesProblem`, `relayServiceNotificationId`, `getCurrentUser`, kiểu `RelayStatus`, và cả tệp `src/screens/local/MoodLocal.tsx` (125 dòng, không còn đường tới).
- **Bỏ gói thừa:** gỡ `aedes-server-factory` (npm gỡ theo 5 gói phụ thuộc). Vẫn **giữ** `nativewind` / `tailwindcss` / `babel-preset-expo` / `react-native-worklets` / `expo-system-ui` / `expo-asset` / `expo-splash-screen` / `react-native-svg` vì chúng là cấu hình babel/metro, plugin hay gói ngang hàng — gỡ là vỡ build.
- **Tách tệp dài:** `App.tsx` 3589 → 3184 dòng (`screens/CloudApp.tsx`, `screens/ModeChooser.tsx`, `components/LockScreen.tsx`); `src/screens/local/ChatLocal.tsx` 1728 → 1217 dòng (`components/MessageRow.tsx`, `components/SwipeRow.tsx`); `relayProtocol.mjs` 876 → 799 dòng.
- **Rà vòng đời:** mọi `setInterval` / `addEventListener` / kênh Supabase MQTT-Realtime đều có hàm dọn; thêm `clearTimeout` cho hẹn “đã đọc” trong ChatLocal. CI có bước kiểm tra mỗi `setInterval` phải có `clearInterval`.
- **Bộ nhớ/APK gần như không đổi:** bundle JS −1.526 byte, APK −752 byte. Code chết vốn đã bị tree-shake, nên **không nhận là “giải phóng bộ nhớ”** — lợi ích thật là mã dễ đọc/sửa, hết rò rỉ hẹn giờ và bộ kiểm thử bám đúng tệp mới.
- **Không đổi gì về ghép nối:** vẫn phải làm **3 bước Supabase** (chạy `002_pairing.sql`, bật Google/Facebook, thêm Redirect URL `haitraitim://auth-callback`) như mục 1.18.0 bên dưới. Máy ảo LDPlayer cũng phải bật mạng.

**140/140 bài kiểm thử xanh**, `tsc` sạch, Prettier sạch, `expo export` chạy được, workflow CI tự đọc phiên bản từ `app.config.js` để đặt tên APK (lần sau tăng bản chỉ sửa một chỗ). **Vẫn chưa thử trên LDPlayer của bạn nên chưa dám nói là đã hết mọi lỗi** — bạn cài đè lên 1.18.0 rồi kiểm tra: mở Cài đặt xem đúng “1.18.1, bản dựng 21”, tin nhắn/cuộc gọi như cũ, và tình trạng “kết nối ảo” đã hết chưa.

## Mật Mã Yêu 1.18.0 (bản trước) — ghép nối theo tài khoản, hết “kết nối ảo”

**APK Android (bản đầy đủ):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-v1.18.0-test-d313f4b/MatMaYeu-1.18.0.apk · **78.670.197 byte** (kèm file kiểm tra `MatMaYeu-1.18.0.apk.sha256` trong Assets)
**APK Android (bản NHẸ, chỉ arm64-v8a):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-v1.18.0-test-d313f4b/MatMaYeu-1.18.0-arm64.apk · **56.273.946 byte** (kèm file `MatMaYeu-1.18.0-arm64.sha256`)
**iPhone (`.ipa` chưa ký, ký lại bằng Apple ID miễn phí):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-ios-v1.18.0-test-d313f4b/MatMaYeu-1.18.0-unsigned.ipa · **17.170.425 byte** (kèm file `MatMaYeu-1.18.0-unsigned.ipa.sha256`)

Trong app mở **Cài đặt**, dòng cuối phải là **Mật Mã Yêu 1.18.0, bản dựng 20**. Dựng từ `d313f4b1488d63b8fd997c97056656506360f910` (build `38605801635` cho APK; iOS build `38605801446`). **Cài đè lên 1.17.0 được, không mất dữ liệu** (gói `vn.haitraitim.app`, slug và khóa ký giữ nguyên). **Không gỡ app** nếu chưa chấp nhận mất dữ liệu.

**Bước 1 — ghép nối theo tài khoản, bỏ hẳn mã 6 số ngẫu nhiên:**

- Đăng nhập **Google/Facebook** bằng Supabase Auth (mỗi người một `uid` cố định). Đổi tên/ảnh đại diện được lưu lên Supabase.
- **Mã kết nối = mã cố định 6 ký tự gắn với `uid`** (ví dụ `ABC-234`; bảng chữ bỏ I, O, 0, 1 cho khỏi nhầm), lưu ở bảng `profiles`. Ai nhập trước cũng được — máy chủ ghi ghép đôi cho **cả hai** máy.
- `partner_id` lưu trên Supabase và **đọc lại mỗi lần mở app**. Chưa có `partner_id` → app **dừng ở màn nhập mã**, không cho vào phần chat.
- App **không còn đọc phòng MQTT cũ trong bộ nhớ máy**: phòng kết nối suy ra từ khoá `pair_secret` mà máy chủ sinh khi ghép đôi, chỉ hai hàng hồ sơ của hai bạn đọc được. Nhờ vậy hết cảnh tự chui vào phòng cũ sau khi khôi phục dữ liệu/Auto Backup — đúng lỗi “kết nối ảo” bạn gặp.
- Nút **“Ngắt kết nối (cả hai máy)”** trong **Cài đặt** (và ở màn ghép nối): máy chủ xoá `partner_id` của **cả hai** bên, cả hai máy tự về màn nhập mã trong vài giây (realtime + hỏi lại mỗi 20 giây). Tin nhắn, nhật ký, kỷ niệm đã viết vẫn còn trên máy.
- Mục **Ghép nối** không còn nút tạo mã 6 số/QR; màn đó giờ có mã cố định của bạn, “Chi tiết kết nối” và lối **chuyển dữ liệu thủ công** (dán mã/tệp dự phòng) cho khi một máy không có mạng.

**Bước 2 — sửa giao diện chat:**

- Nút **“↓ mới nhất”** giờ theo **vị trí cuộn** (`onScroll` với `contentOffset` / `contentSize` / `layoutMeasurement`): ẩn khi đang ở cuối, chỉ hiện khi cuộn lên quá 140 px, danh sách ngắn hơn khung thì không hiện — bản 1.17.0 hiện mãi vì chỉ đếm số tin nhắn.
- **Bỏ hẳn nhãn “↩ trả lời” thừa** ngoài bong bóng (trước đây nằm chờ ở lề trái, chỉ mờ đi nhờ hiệu ứng luồng UI nên máy nào hiệu ứng không chạy là hiện ở mọi dòng). Trả lời bằng **nhấn giữ** hoặc **vuốt ngang**.

**Việc phải làm trong Supabase (một lần):** ① SQL Editor → chạy toàn bộ `couple-love/supabase/migrations/002_pairing.sql`; ② Authentication → Providers → bật **Google** và/hoặc **Facebook** (hoặc bật **Anonymous Sign-Ins** để thử nhanh bằng nút “Đăng nhập nhanh”); ③ Authentication → URL Configuration → thêm Redirect URL `haitraitim://auth-callback`. Chưa làm 3 bước này thì app dừng ở màn đăng nhập — đúng thiết kế, vì không có tài khoản thì không biết đang ghép với ai.

**140 bài kiểm thử đều xanh** (thêm 20 bài cho vòng này), TypeScript sạch, Prettier sạch, `expo export` ra bundle chứa đúng dự án ghép nối + các hàm `ensure_profile` / `pair_with_code` / `unpair` / `save_profile`, bản dựng Android ra `versionName 1.18.0` + `versionCode 20`. **Chưa thử trên LDPlayer của bạn nên chưa dám nói là đã hết mọi lỗi** — bạn thử: máy A đăng nhập lấy mã → máy B nhập mã đó; bấm Ngắt kết nối ở máy A xem máy B có tự văng về màn nhập mã; ghép lại xem tin cũ còn nguyên; kéo lên xem tin cũ rồi kéo xuống đáy xem nút “↓ mới nhất” có tự ẩn; kiểm tra không còn nhãn “trả lời” nào ngoài bong bóng.

## Mật Mã Yêu 1.17.0 (bản trước) — gói tin nhắn đúng chuẩn, tim 3D đập theo giọng, TURN riêng cho 4G

**APK Android (bản đầy đủ):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-v1.17.0-test-068e170/MatMaYeu-1.17.0.apk · **78.566.174 byte** (kèm file kiểm tra `MatMaYeu-1.17.0.apk.sha256` trong Assets)
**APK Android (bản NHẸ, chỉ arm64-v8a):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-v1.17.0-test-068e170/MatMaYeu-1.17.0-arm64.apk · **56.169.923 byte** (kèm file `MatMaYeu-1.17.0-arm64.sha256`)
**iPhone (`.ipa` chưa ký, ký lại bằng Apple ID miễn phí):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-ios-v1.17.0-test-82e33ac/MatMaYeu-1.17.0-unsigned.ipa · **17.134.185 byte** (kèm file `MatMaYeu-1.17.0-unsigned.ipa.sha256`)

Trong app mở **Cài đặt**, dòng cuối phải là **Mật Mã Yêu 1.17.0, bản dựng 19**. Dựng từ `068e170` (build `38596391427` cho APK; iOS dựng từ `82e33ac`, build `38598265419`). **Cài đè lên 1.16.0 được, không mất dữ liệu** (gói `vn.haitraitim.app`, slug và khóa ký giữ nguyên).

Bản 1.17.0 làm đúng các việc bạn nêu:

1. **Gói tin nhắn đúng chuẩn bạn đặt ra và tương thích hai chiều:** cảm xúc gửi `{type:"reaction", messageId, emotion}`, thu hồi gửi `{type:"unsend", messageId}` (xoá ở **cả hai** máy, để lại dòng “đã thu hồi”), đã xem gửi `{type:"read", lastMessageId}`, đang gõ gửi `{type:"typing", state:true}` (máy nhận tự tắt sau **3 giây**; bên gửi chỉ bắn một gói mỗi **1,2 giây**), đổi ảnh đại diện/tên gửi `{type:"profile"}`. App gửi kèm cả tên trường cũ (`chatReact`, `chatRecall`, `chatRead`) và máy 1.17 đọc được **cả hai** cách đặt tên, nên hai máy khác phiên bản vẫn nhắn tin được với nhau.
2. **Đồng bộ ảnh đại diện tức thì:** vừa đổi ảnh ở máy A, app bắn ngay gói hồ sơ rồi gửi kèm **tệp ảnh (≤ 120 KB)**; máy B ghi tệp và `setState` giao diện ngay, không phải đợi gói dữ liệu định kỳ. Máy nào thiếu tệp thì tự `photoRequest` xin gửi lại.
3. **Vuốt để trả lời bằng `react-native-gesture-handler` + `react-native-reanimated`** (đúng như bạn yêu cầu): cử chỉ chạy trên luồng UI, chỉ giành khi vuốt **ngang** quá 14 px nên cuộn dọc danh sách vẫn trơn; nhấn giữ vẫn mở bảng cảm xúc ❤️😂😮😢😡👍 với *Trả lời · Thu hồi · Lưu ảnh về máy · Xoá ở máy này*.
4. **Trái tim 3D (WebGL) trong cuộc gọi đập theo giọng nói:** mức tiếng lấy từ track WebRTC mỗi **0,5 giây** (`audioLevel` thật, máy ảo không báo thì ước lượng theo byte tiếng vào/ra), làm mượt rồi đưa thẳng vào `scale` của trái tim 3D — nói to tim đập mạnh hơn (tối đa **+30%**). Máy yếu hoặc bật “giảm chuyển động” thì app tự dùng tim vẽ sẵn cho nhẹ máy. Nút **Cúp máy đỏ 80 px**, **tắt mic trắng/xám 68 px**, thu nhỏ 56 px ở nửa dưới màn hình.
5. **Sửa rớt mạng 4G:** thêm **máy chủ trung chuyển riêng của bạn** (`couple-love.metered.live` cổng 80, 443 và TCP 443) đặt trước các bộ công cộng, giữ sẵn **6 địa chỉ mạng**, và **tự nối lại ICE (ICE restart)** ngay trong cuộc gọi khi 4G đổi trạm hoặc Wi-Fi ↔ 4G; chỉ khi vẫn không lên mới lùi về đường tiếng qua kênh ghép nối như cũ. Thang dự phòng giữ nguyên: PeerJS (2,5 giây) → WebRTC thuần → tiếng qua kênh ghép nối.
6. **Chat nhẹ hơn:** thanh nhập liệu viên thuốc `[+]·[ô chữ]·[mic⇄Gửi]` nằm gọn trên bàn phím, mỗi dòng tin được **ghi nhớ (memo)** nên gõ chữ không vẽ lại cả danh sách, `FlatList` chỉ vẽ 10–12 dòng mỗi lượt (`windowSize` 9, `removeClippedSubviews`). Lần này **không thêm FlashList**: đó là thư viện native mới mà chưa thử được trên máy bạn, còn `FlatList` đã tối ưu thì an toàn hơn; khi nào bạn muốn thử FlashList tôi đổi.

**120 bài kiểm thử đều xanh** (thêm 9 bài cho vòng này), TypeScript sạch, Prettier sạch, `expo export` ra bundle chứa đủ TURN riêng / `restartIce` / gesture-handler, `expo prebuild` ra `versionName 1.17.0` + `versionCode 19`, manifest có `configChanges` cho `MainActivity` (chống lỗi hộp chọn ảnh), dịch vụ chạy nổi `microphone|dataSync`, tên hiển thị iOS **Mật Mã Yêu**. **Chưa thử trên LDPlayer của bạn nên chưa dám nói là đã hết lỗi** — bạn thử: đổi ảnh đại diện ở máy B xem máy A có đổi ngay, vuốt một tin để trả lời, giữ vào tin để thả tim, thu hồi một tin xem máy kia có mất, rồi gọi thử khi máy đang dùng 4G xem tim có đập theo giọng và có rớt không.

## Mật Mã Yêu 1.16.0 (bản trước) — nhắn tin kiểu Messenger/Zalo, sửa lỗi gửi ảnh, tim đập theo giọng nói

**APK Android (bản đầy đủ):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.16.0-test-270c362/HaiTraiTim-1.16.0.apk · **77.974.318 byte** (kèm file kiểm tra `HaiTraiTim-1.16.0.apk.sha256` trong Assets)
**APK Android (bản NHẸ, chỉ arm64-v8a):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.16.0-test-270c362/HaiTraiTim-1.16.0-arm64.apk · **55.660.069 byte** (kèm file `HaiTraiTim-1.16.0-arm64.sha256`)
**iPhone (`.ipa` chưa ký, ký lại bằng Apple ID miễn phí):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-ios-v1.16.0-test-270c362/HaiTraiTim-1.16.0-unsigned.ipa · **16.978.710 byte** (kèm file `HaiTraiTim-1.16.0-unsigned.ipa.sha256`)

Trong app mở **Cài đặt**, dòng cuối phải là **Mật Mã Yêu 1.16.0, bản dựng 18**. Dựng từ `270c362` (build `38592751848` cho APK, `38592751758` cho iOS). Mạng yếu thì tải bản arm64. **Cài đè lên 1.15.0 được, không mất dữ liệu** (gói `vn.haitraitim.app` và khóa ký giữ nguyên, chỉ đổi tên hiển thị).

Bản 1.16.0 làm đúng các việc bạn nêu:

1. **Hết lỗi “Attempting to launch an unregistered ActivityResultLauncher” khi gửi/chụp ảnh.** Nguyên nhân là lỗi của chính thư viện chọn ảnh hệ thống: khi Activity bị hệ thống dựng lại (đổi cỡ chữ, đổi ngôn ngữ, đổi mật độ màn hình, máy ảo bị thu hồi bộ nhớ) thì bộ đăng ký “launcher” bị xoá mà không đăng ký lại, nên mọi lần gọi sau đều chết. Bản này làm hai việc: (a) plugin `plugins/with-android-activity-config.js` khai `configChanges` cho `MainActivity` (fontScale, locale, layoutDirection, density, uiMode, orientation…) để Activity **không bị dựng lại** nữa — đã kiểm tra trong manifest sau `expo prebuild`; (b) màn hình chat và Cài đặt **không dùng hộp chọn ảnh hệ thống nữa** mà mở **thư viện ảnh + máy ảnh ngay trong app** (`src/components/PhotoPicker.tsx`, `expo-media-library` + `expo-camera`). Lời nhắc cũ vẫn còn: nếu máy ảo đã dính lỗi từ bản trước thì **mở lại app một lần** là sạch.
2. **Nhắn tin đủ bộ như Messenger/Zalo:** **thu hồi tin nhắn xoá cả hai bên** (giữ dấu “đã thu hồi”, khác hẳn *Xoá trên máy này*), **thả cảm xúc** ❤️😂😮😢😡👍, **vuốt để trả lời**, **giữ nút mic để gửi tin thoại**, chấm **“đang nhập…”**, báo **đã xem** kèm ảnh đại diện nhỏ cạnh tin cuối, **lưu ảnh người thương gửi về máy**.
3. **Đổi ảnh đại diện là máy kia thấy ngay:** tên tệp ảnh đi kèm mọi gói dữ liệu, máy nào thiếu ảnh thì tự xin gửi lại (`photoRequest`).
4. **Thanh nhập liệu dạng viên thuốc** nổi ba phần `[+] · [ô chữ] · [mic]`, gõ chữ thì mic biến thành nút **Gửi**, icon nằm gọn phía trên bàn phím; bỏ hàng icon và khối chữ gây rối; tin nhắn cuộn còn thanh chat thì cố định.
5. **Cuộc gọi:** trái tim **đập theo giọng nói thật** (mức tiếng lấy từ track WebRTC mỗi 0,5 giây, máy ảo thiếu số liệu thì ước lượng theo byte tiếng) và nút **Cúp máy đỏ to** + nút **tắt mic** trắng/xám ở nửa dưới màn hình.
6. **Thông báo:** bấm là **vào thẳng đoạn chat**, có nút **Trả lời** ngay trên thông báo, và công tắc **Giữ kết nối khi tắt màn hình** (dịch vụ chạy nổi `dataSync`, Android buộc phải hiện thông báo “Đang giữ kết nối”). Nói thẳng giới hạn: nếu vào Cài đặt điện thoại bấm **Buộc dừng** app thì mọi kết nối đều tắt — muốn có tin nhắn khi app đã bị buộc dừng thì phải có máy chủ đẩy riêng (FCM), mà app này cố ý không dùng máy chủ.

**111 bài kiểm thử đều xanh**, TypeScript sạch, Prettier sạch, `expo export` cho Android thành công, `expo prebuild` ra manifest có `configChanges` cho `MainActivity`, dịch vụ chạy nổi `microphone|dataSync` và đủ quyền `FOREGROUND_SERVICE_DATA_SYNC`, `POST_NOTIFICATIONS`, `READ_MEDIA_IMAGES`, `RECORD_AUDIO`. **Chưa thử trên LDPlayer của bạn nên chưa dám nói là đã hết lỗi** — bạn cài rồi thử: gửi ảnh, chụp ảnh, thu hồi, thả tim, vuốt trả lời, giữ mic gửi thoại, đổi ảnh đại diện ở máy B xem máy A có thấy không, rồi gọi thử xem tim có đập theo giọng.

## Mật Mã Yêu 1.15.0 (bản trước) — cuộc gọi qua được NAT khó nhờ TURN dự phòng, giữ cuộc gọi khi tắt màn hình

**APK Android (bản đầy đủ):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.15.0-test-91bf7bd/HaiTraiTim-1.15.0.apk · **77.814.316 byte** (kèm file kiểm tra `HaiTraiTim-1.15.0.apk.sha256` trong Assets)
**APK Android (bản NHẸ, chỉ arm64-v8a):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.15.0-test-91bf7bd/HaiTraiTim-1.15.0-arm64.apk · **55.500.067 byte** (kèm file `HaiTraiTim-1.15.0-arm64.sha256`)
**iPhone (`.ipa` chưa ký, ký lại bằng Apple ID miễn phí):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-ios-v1.15.0-test-91bf7bd/HaiTraiTim-1.15.0-unsigned.ipa · **16.815.744 byte** (kèm file `HaiTraiTim-1.15.0-unsigned.ipa.sha256`)

Trong app mở **Cài đặt**, dòng cuối phải là **1.15.0, bản dựng 17**. Dựng từ `91bf7bd` (build 38582680038 cho APK, 38582680084 cho iOS). Mạng yếu thì tải bản arm64.

Bản 1.15.0 làm đúng hai việc bạn nêu:

1. **Cuộc gọi thông qua được cả mạng khó (NAT đối xứng, Wi-Fi công ty).** Đường tiếng vẫn ba lớp và **ưu tiên nối trực tiếp máy-tới-máy**: (1) **PeerJS** — thư viện gọi điện mã nguồn mở, app tự nối vào trạm trung chuyển công khai `0.peerjs.com` kèm TURN miễn phí của PeerJS, không cần tài khoản; (2) không xong trong 2,5 giây thì chuyển sang **WebRTC thuần** (offer/answer/ICE) đi qua kênh ghép nối sẵn có; (3) vẫn không xong thì **quay về tiếng qua kênh ghép nối** — không ai bị mất cuộc gọi. Bản 1.15.0 thêm **máy chủ TURN dự phòng miễn phí** (Open Relay của Metered: cổng 80, 443 và TCP 443) để hai máy vẫn nối được khi mạng chặn P2P; địa chỉ TURN nào cũng nối được thì app dùng, nên tiếng vẫn đi thẳng máy-tới-máy khi có thể. Muốn dùng TURN riêng thì đặt biến `EXPO_PUBLIC_TURN_URLS`, `EXPO_PUBLIC_TURN_USER`, `EXPO_PUBLIC_TURN_CREDENTIAL` rồi dựng lại APK.
2. **Cuộc gọi không tắt khi tắt màn hình.** Android chạy **dịch vụ chạy nổi** kèm thông báo thường trực “Cuộc gọi đang diễn ra…” có nút **Cúp máy** (chạm nút là cúp ngay cả khi đang ở app khác), xin quyền `FOREGROUND_SERVICE_MICROPHONE` + `WAKE_LOCK`; iOS khai báo `UIBackgroundModes` gồm `audio` và `voip`, phiên âm thanh đặt `shouldPlayInBackground` nên tiếng vẫn chạy khi khoá máy hoặc chuyển app.

91 bài kiểm thử đều xanh, TypeScript sạch, `expo export` cho Android thành công, `expo prebuild` ra manifest có dịch vụ chạy nổi đúng kiểu `microphone`. **Chưa thử trên máy ảo LDPlayer của bạn nên chưa dám nói là đã hết đứt** — bạn gọi thử hai máy rồi báo lại.

Bản 1.14.0 trước đó (đã có sẵn, vẫn tải được):
`https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.14.0-test-a352b9f/HaiTraiTim-1.14.0.apk`

Bản 1.14.0 làm đúng hai việc bạn nêu:

1. **Bỏ hẳn hình cầu tình yêu.** Màn hình Yêu nhau giờ chỉ còn **một trái tim 3D ở chính giữa**, xung quanh là **vũ trụ trái tim**: ba quỹ đạo nghiêng nhau, mỗi quỹ đạo mang 4–7 trái tim nhỏ quay với tốc độ khác nhau, nền tinh vân hai quầng sáng và 130 ngôi sao. Vẫn **chỉ một vùng WebGL** nên máy ảo không đơ. Tệp `src/components/LoveBridgeArt.tsx` đã xoá.
2. **Cuộc gọi tiếng trực tiếp (WebRTC) — nói chuyện liền mạch như gọi thường.** Hai máy vẫn trao đổi tín hiệu qua **kênh ghép nối** (offer/answer/ICE, không cần máy chủ), nhưng khi đã nối thì tiếng nói đi **thẳng máy-tới-máy** theo chuẩn RTP/Opus 20 ms một gói, có **khử vọng** và bộ đệm chống rung mạng. Không còn cắt thành tệp 0,9 giây rồi ghép lại, nên không còn đứt quãng vì micro phải nghỉ giữa hai mảnh. Nếu mạng chặn không nối trực tiếp được trong 4 giây (hoặc máy không có WebRTC), app **tự quay về đường tiếng qua kênh ghép nối** — không ai bị mất cuộc gọi. Màn hình gọi hiện rõ đang dùng đường tiếng nào (“Đang nối tiếng trực tiếp…”, “● Tiếng nét trực tiếp (WebRTC)”, hoặc “○ Tiếng đi qua kênh ghép nối”), và Cài đặt có dòng kiểm tra WebRTC của máy.

## Hai Trái Tim 1.13.0 — nói chuyện liền mạch hơn, một máy tắt là máy kia tự tắt, cầu tình yêu vẽ theo tranh

**APK Android (bản đầy đủ):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.13.0-test-d16a04c/HaiTraiTim-1.13.0.apk · **58.937.849 byte** · SHA256 `1733207396ba849cb4d363ff392f8a21c2cd694eb8ad8875328ca0ad5fe7eda6`
**APK Android (bản NHẸ, tải nhanh hơn ~27%):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.13.0-test-d16a04c/HaiTraiTim-1.13.0-arm64.apk · **43.308.364 byte** · SHA256 `743f9cc0a6cda9e4081ab67087f278c649e5e8bb2e16758c324ad7b756a3fa5c`
**iPhone (`.ipa` chưa ký, ký lại bằng Apple ID miễn phí):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-ios-v1.13.0-test-cc33e5c/HaiTraiTim-1.13.0-unsigned.ipa · **11.647.809 byte** · SHA256 `588c3cbca2cd39e1b0a165e1bc38a4c32c44e9645d7faad6a386aeb6cee82c15`

Trong app mở **Cài đặt**, dòng cuối phải là **1.13.0, bản dựng 15**. APK dựng từ `d16a04c` (lần build 38568939724), IPA dựng từ `cc33e5c` (lần build 38567292645).

Bản 1.13.0 làm đúng bốn việc bạn nêu:

1. **Nói chuyện trong cuộc gọi liền mạch hơn:** mảnh tiếng dài **0,9 giây**, hàng đợi giữ 8 mảnh, phát cách nhau 40 ms, **chờ sẵn 2 mảnh** rồi mới phát mảnh đầu, nhịp phát 90 ms; gói gửi đi **không chờ xác nhận** nên không khựng; **tạm dừng ghi âm khi loa đang phát** nên hết tiếng vọng (vọng) — đây là nguyên nhân chính làm câu nói bị đứt quãng trước đây. Mảnh ghi vào 6 tệp xoay vòng `callout-…-<số>.m4a`, gói tối đa 160 KB.
2. **Một máy tắt/kết thúc là máy kia tự kết thúc:** hai bên gửi nhịp sống `alive` mỗi 1,5 giây; quá **5 giây** không thấy nhịp thì máy còn lại tự đóng cuộc gọi và hiện **“Người thương đã kết thúc cuộc gọi”**. Gói cúp máy/từ chối được gửi lại ở mốc 0,25 giây và 0,5 giây vì kênh ghép nối có thể làm mất gói.
3. **Cầu tình yêu và cô dâu chú rể vẽ lại thành tranh vector** theo đúng ảnh bạn gửi (Ngưu Lang – Chức Nữ): vòm cầu ghép từ **19 con chim Ô Thước**, mặt trăng có quầng sáng, hoa văn sóng bốn góc, mây và cánh hoa; cô dâu áo hồng có tà áo bay + khăn quàng đỏ, chú rể áo lam. Tranh vẽ bằng `react-native-svg` (`src/components/LoveBridgeArt.tsx`) nên **không còn mô hình đồ chơi** và **không thêm vùng WebGL** nào — cả màn hình vẫn chỉ một canvas của trái tim 3D.
4. **Bỏ hẳn tab Cảm xúc** trong chế độ trên máy.

Bản 1.12.0 trước đó làm lại mô hình cầu 3D trong cùng canvas của trái tim; 1.13.0 thay nó bằng tranh vector bạn yêu cầu.

73 bài kiểm thử đều xanh, TypeScript sạch, `expo export` cho Android thành công.

## Hai Trái Tim 1.12.0 — hết đơ màn hình, mở được Tin nhắn, cầu tình yêu 3D ăn khớp chủ đề

**APK Android (bản đầy đủ):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.12.0-test-65aafef/HaiTraiTim-1.12.0.apk · **58.941.701 byte** · SHA256 `48c9a576b713726c3df35af2db54a72e103f39e92e96107379a04d6f680d22dd`
**APK Android (bản NHẸ, tải nhanh hơn ~26%):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.12.0-test-65aafef/HaiTraiTim-1.12.0-arm64.apk · **43.312.216 byte** · SHA256 `572b81d62312cd4c0ae94bbb108031eb2babf8670fe4091a97c5007236ff92a8`
**iPhone (`.ipa` chưa ký, ký lại bằng Apple ID miễn phí):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-ios-v1.12.0-test-65aafef/HaiTraiTim-1.12.0-unsigned.ipa · **11.652.260 byte** · SHA256 `57d0870bdad67fc259b5aa572b2a889a169fea06ed749ad5d40dc88bf5d00360`

Trong app mở **Cài đặt**, dòng cuối phải là **1.12.0, bản dựng 14**. Dựng từ `65aafef` (build 38562494291 / 38562494369).

Bản 1.12.0 sửa hai lỗi nặng bạn gặp và làm lại cầu tình yêu:

1. **Hết đơ/dính màn hình.** Nguyên nhân: màn Yêu nhau mở **hai vùng WebGL cùng lúc** (trái tim 3D và cầu 3D riêng) — máy ảo LDPlayer không hợp lược nhiều vùng GL nên app treo khung hình cũ và không bấm được. Nay **chỉ còn MỘT canvas**, cầu được vẽ bên trong chính canvas của trái tim.
2. **Vào được mục Tin nhắn.** Khung Tin nhắn và khung cuộn chung trước đây cùng co giãn nên màn hình cũ dính lại; nay hai khối **loại trừ nhau** (`tab === "chat" ? null : <ScrollView>`), khung Tin nhắn chiếm trọn chiều cao, ô nhắn tin luôn ở đáy.
3. **Bớt giật khi không gọi:** bỏ nhịp tự vẽ lại giao diện **mỗi giây** (chỉ chạy khi đang có cuộc gọi).
4. **Cầu tình yêu 3D làm lại, ăn khớp chủ đề:** mặt cầu là **một ống cong** uốn theo vòm, lan can hai bên, ván và cột dựng theo lô (`instancedMesh`) nên rất nhẹ; **trăng tròn**, **đàn Ô Thước 6 con** bay vòng; **cô dâu áo xanh ngọc + khăn đỏ + dải lụa bay** và **chú rể áo lam** chạy từ hai đầu vào giữa cầu rồi gặp nhau; **bảng màu lấy trực tiếp từ chủ đề** đang chọn (không còn khối nền xanh đen lạc lõng). Hạ tải đồ hoạ: tắt khử răng cưa, giới hạn độ phân giải, ít hạt sáng hơn.

71 bài kiểm thử đều xanh, TypeScript sạch, `expo export` cho Android thành công.

## Hai Trái Tim 1.11.0 — gọi nói liên tục, nhạc chuông trong máy, cầu tình yêu 3D

**APK Android (cài trực tiếp, không cần ZIP):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.11.0-test-8d9ef2e/HaiTraiTim-1.11.0.apk · **58.942.065 byte** · SHA256 `ba6fa99c0e8e2770a126865be92e181a091d001514a9e88a7929022589aa3f14` · dựng từ `8d9ef2e` (lần build 38559252404, đăng bằng workflow 38560853145). Trong app, mở **Cài đặt** xem dòng cuối: phải là **1.11.0, bản dựng 13**.

**iPhone (file .ipa chưa ký, phải tự ký lại bằng Apple ID miễn phí):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-ios-v1.11.0-test-8d9ef2e/HaiTraiTim-1.11.0-unsigned.ipa · **11.651.636 byte** · SHA256 `2521e74bf022065c7a5ba110f7a022c53654e6a8d462ea709020de7a817b677f` · dựng từ `8d9ef2e` (lần build 38559252507, đăng bằng workflow 38560853117)

Bản 1.11.0 sửa đúng những việc bạn nêu:

1. **Gọi nói liên tục như Zalo/Messenger — bỏ hẳn kiểu “giữ để nói”.** Tiếng nói cắt thành mảnh **0,7 giây** gửi liên tục qua kênh ghép nối, máy kia tự phát lên loa; mic bật/tắt bằng một nút. _Nói thẳng:_ trễ khoảng một giây và có thể ngắt quãng vài chỗ; muốn như cuộc gọi điện thoại thật thì phải thêm WebRTC và build lại native.
2. **Cả hai máy cùng nghe chuông:** bên nhận nghe nhạc chuông (rung kèm), bên gọi nghe hồi chuông tổng đài.
3. **Cài nhạc chuông từ thư viện nhạc trong máy** (Cài đặt → Nhạc chuông cuộc gọi); nhạc chỉ đổi trên máy bạn, có nút quay về nhạc mặc định.
4. **Kết thúc cuộc gọi tự đóng** sau 2,2 giây và **hiện nhật ký trong đoạn chat**: “📞 Cuộc gọi đi/đến · 01:23”, cuộc gọi nhỡ ghi rõ “Cuộc gọi nhỡ”.
5. **Popup cuộc gọi thiết kế lại:** vòng sáng thở, vòng sóng khi đang nói, nút tròn Mic · Thu nhỏ · Kết thúc, thanh thu nhỏ gọn gàng.
6. **Cầu tình yêu 3D** đúng kiểu ảnh bạn gửi: trăng tròn, đàn Ô Thước bay thành dòng, vòm cầu ghép từng ván, **cô dâu và chú rể chibi** chạy vào giữa cầu, gặp nhau thì tim sáng rồi cùng quay về.
7. **Nhắn tin nhanh hơn:** mỗi tin nhắn/gửi vị trí không còn đẩy cả gói dữ liệu 60 KB lên 5 trạm (chỉ đẩy khi dữ liệu khác tin nhắn thay đổi, kèm nhịp an toàn 20 giây), dữ liệu ghi xuống máy gộp trong 400 ms → đoạn chat hết lag khi gửi vị trí.
8. **App mượt hơn:** mỗi dòng tin nhắn vẽ riêng và nhớ sẵn nên **gõ chữ không vẽ lại bảng tin**, danh sách chỉ vẽ các dòng đang thấy.
9. **Ô nhắn tin cố định:** mục Tin nhắn tách khỏi khung cuộn chung → tin nhiều tới đâu cũng **chỉ phần tin cuộn, thanh chat luôn ở đáy**.

71 bài kiểm thử đều xanh, TypeScript sạch, `expo export` cho Android thành công. Chi tiết kỹ thuật ở `couple-love/README.md`.

## Hai Trái Tim 1.10.0 — hết chữ ngược, gọi điện, sticker, cầu tình yêu

**APK Android (cài trực tiếp, không cần ZIP):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.10.0-test-0a44d5f/HaiTraiTim-1.10.0.apk · **58.549.853 byte** · SHA256 `6e9426fcd457b010ef58bc01f2ba8045f848201e9aea839ba59224e6abe581f0` · dựng từ `0a44d5f` (lần build 38552769225, đăng bằng workflow 38554460474). Trong app, mở **Cài đặt** xem dòng cuối: phải là **1.10.0, bản dựng 12**.

**iPhone (file .ipa chưa ký, phải tự ký lại bằng Apple ID miễn phí):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-ios-v1.10.0-test-0a44d5f/HaiTraiTim-1.10.0-unsigned.ipa · **11.458.596 byte** · SHA256 `38aad59124ebe92378810bb2fad5e382e209802c8be33f31bd017d34c34669bc` · dựng từ `0a44d5f` (lần build 38552769096, đăng bằng workflow 38554460357).

Bản 1.10.0 sửa đúng 13 việc bạn nêu:

1. **Hết chữ bị ngược trong khung chat.** Bảng tin trước dùng `FlatList inverted`; trên Android kiểu này chạy bằng `transform: [{ scale: -1 }]` nên **chữ trong ô trống cũng bị soi gương**. Nay danh sách **không lật** (`const ordered = [...messages].reverse()`, `scrollToEnd`): cũ ở trên, mới ở dưới, tin mới tự hiện.
2. **Ô nhắn tin được kéo lên** khỏi thanh chuyển mục, hết dính liền.
3. **Nhiều sticker hơn:** 4 bộ × 12 sticker (Yêu thương · Vui vẻ · Nhớ nhung · Dễ thương) + **48 emoji** chèn thẳng vào câu chữ.
4. **Trái tim 3D đẹp hơn** và **2 avatar + tên** nằm trong viên gradient nổi, mỗi người một nhãn tên.
5. **Cầu tình yêu:** cô dâu & chú rể chibi ở hai đầu **cầu 3D**, tự chạy lại gần nhau rồi gặp nhau giữa cầu (`src/components/LoveBridge.tsx`).
6. **Gọi điện như Messenger/Zalo:** bấm gọi → máy kia **đổ chuông** (45 giây tự ngắt) → **Nghe / Từ chối** → **giữ nút để nói** (mỗi lần ≤ 25 giây) → **bật/tắt mic**, **thu nhỏ cửa sổ** khi đang gọi, kết thúc thì tự ẩn sau 4,5 giây. _Nói thẳng:_ cuộc gọi đi qua **kênh ghép nối sẵn có**, chạy như **bộ đàm** (chuông + giữ để nói), **chưa phải thoại hai chiều liên tục** — muốn vậy phải thêm WebRTC và build lại phần native.
7. **Cách 2 tiếng tự gửi lời yêu / thơ** (07:00–22:00, xen kẽ lời yêu và thơ, hai máy cùng mốc thì cùng câu), tắt được trong Cài đặt.
8. **Nhắc khi chưa trả lời:** quá **3 phút** → “Người ấy vẫn đang đợi tin nhắn từ bạn 💌”; quá **1 tiếng** thì kèm một lời yêu; **không nhắc từ 22:00–07:00**.
9. **Bật/tắt “đã xem”** trong Cài đặt.
10. **Gửi ảnh chụp / ảnh trong máy / vị trí đang ở** ngay trong đoạn chat (nén 720 px, ≤ 160 KB; vị trí kèm nút mở bản đồ).

Giữ nguyên toàn bộ của 1.9.x (ảnh nền trong suốt kiểu Zalo 3 mức, chữ theo chủ đề, thông báo nổi, bảng tin cố định, 14 chủ đề có hoạ tiết). Lần dựng này chạy **64 bài kiểm thử đều xanh**, TypeScript sạch, `expo export` cho Android thành công.

**_Ghi chú:_** đổ chuông, giữ-để-nói, sticker, gửi ảnh/vị trí, lời yêu 2 tiếng một lần và nhắc trả lời mới kiểm thử bằng máy ảo + bài kiểm thử tự động (có bài dựng broker MQTT thật chạy trong máy), chưa kiểm chứng trên hai điện thoại thật. **Bản vá chữ bị ngược cần bạn xem lại trên LDPlayer.**

## Hai Trái Tim 1.9.1 — ảnh nền kiểu Zalo

**APK Android (cài trực tiếp, không cần ZIP):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.9.1-test-ef2dc57/HaiTraiTim-1.9.1.apk · **57.934.306 byte** · SHA256 `15d43a165d853b67a0889b8dd45cb9aff832c6686f14023932c0b605fa38ad94` · dựng từ `ef2dc57` (lần build 38543908536, đăng bằng workflow 38546491860). Trong app, mở **Cài đặt** xem dòng cuối: phải là **1.9.1, bản dựng 11**.

**iPhone (file .ipa chưa ký, phải tự ký lại bằng Apple ID miễn phí):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-ios-v1.9.1-test-ef2dc57/HaiTraiTim-1.9.1-unsigned.ipa · **11.309.849 byte** · SHA256 `a313cbb484c9ac5a640d832d861f5b4c24c1f76d40b959038aacf8a8f7d14e08` · dựng từ `ef2dc57` (lần build 38543908210).

- **Đặt ảnh trong thư viện làm nền là thấy ảnh xuyên qua giao diện, giống Zalo.** Khi có ảnh nền, thẻ, ô nhập tin, thanh trên, thanh dưới và bong bóng tin nhắn của người thương **tự chuyển sang màu trong suốt** (`rgba`); lớp phủ trên ảnh mỏng hơn nhiều (0,3–0,8 thay vì 0,85) nên ảnh nền hiện rõ phía sau.
- **Ba mức để bạn tự chọn:** Cài đặt → Đổi giao diện → Ảnh nền → **Ảnh rõ / Vừa / Chữ rõ** (lưu riêng trên từng máy, hai máy không kéo nhau).
- Giữ nguyên các sửa của 1.9.0 bên dưới (chữ theo chủ đề, thông báo nổi, tin nhắn tự gửi lại, bảng tin cố định, chủ đề có hoạ tiết, lịch chọn ngày không nhảy về hôm nay).

**_Ghi chú:_** ảnh nền trong suốt mới kiểm thử bằng máy ảo và bài kiểm thử tự động (59 bài), chưa kiểm chứng trên hai điện thoại thật.

## Hai Trái Tim 1.9.0

**APK Android (cài trực tiếp, không cần ZIP):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.9.0-test-51bc943/HaiTraiTim-1.9.0.apk · **57.931.650 byte** · SHA256 `bcbcc29a69407c65b7acfb17a2580bdfb18b2d1e89e4ef42788a586253ad0a11` · dựng từ `51bc943` (lần build 38541252032, đăng bằng workflow 38542781168). Trong app, mở **Cài đặt** xem dòng cuối: phải là **1.9.0, bản dựng 10**.

**iPhone (file .ipa chưa ký, phải tự ký lại bằng Apple ID miễn phí):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-ios-v1.9.0-test-51bc943/HaiTraiTim-1.9.0-unsigned.ipa · **11.307.936 byte** · SHA256 `1a6ce4070292bbaee902a21dcaee324067407c599656dfbc10e32827a4433390` · dựng từ `51bc943` (lần build 38541251941, đăng bằng workflow 38542781178). iPhone **không cài file trực tiếp như APK**: dùng Sideloadly/AltStore trên Windows với Apple ID miễn phí, app hết hạn sau 7 ngày và ký lại; muốn 1 năm không cần cắm cáp thì phải có Apple Developer 99 USD/năm.

Bản 1.9.0 sửa đúng 5 việc bạn nêu:

1. **Chữ không còn mờ/mất khi đổi giao diện** — mọi màn hình trên máy lấy màu chữ từ chủ đề (mục “Riêng tư trên máy này”, “Lời yêu thương mỗi ngày (09:00 và 21:00)”, các ngày trên lịch); bỏ lớp mờ 0.5 đè lên chữ.
2. **Thông báo nổi như Messenger** — hỏi quyền thông báo ngay khi mở app, kênh **Tin nhắn của người thương** mức cao nhất có âm thanh + rung, cảnh báo kèm nút mở Cài đặt khi quyền bị tắt.
3. **Tin nhắn và tin thoại tới được máy kia** — tin chưa gửi được thì nằm chờ và tự gửi lại (không đánh dấu đã gửi sớm), nhật ký kết nối ghi rõ số tin đã gửi/đã nhận, tin thoại hạn mức 420 KB, máy kia thiếu tệp thì tự xin gửi lại sau 45 giây, có trạng thái **đã tới máy kia**.
4. **Bảng tin cố định như Messenger/Zalo** — danh sách tin cuộn riêng, tin mới hiện ở dưới và trôi lên, kéo lên xem lại, ô nhập chỉ giãn tới 4 dòng, có nút cuộn xuống tin mới nhất.
5. **Chủ đề có hoạ tiết thật** — hoạ tiết nền theo từng chủ đề (hoa, mèo, sóng, sao…), thêm chủ đề **Mèo con** và **Vườn hoa**, ô xem trước trong Cài đặt hiện hoạ tiết.

Kèm theo: tự chọn ảnh trong máy làm nền app và **hai máy gửi ảnh nền cho nhau**, lịch chọn ngày tự viết (lùi/tiến tháng, lùi/tiến năm, gõ thẳng ngày/tháng/năm, không còn nhảy về hôm nay). Lần dựng này chạy 57 bài kiểm thử (TypeScript, độ tương phản chủ đề, lịch, ghép nối qua broker MQTT thật) và đều xanh.

**https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.8.0-test-cf8c282/HaiTraiTim-1.8.0.apk**

- `HaiTraiTim-1.8.0.apk` · **57.921.934 byte** · SHA256 `070a194f9c784af24f2d39c31f68f2acbcfaa8800d441486d9c9b7d156f8a94f` · kèm file `.sha256` trong Assets. Trong app, mở **Cài đặt** xem dòng cuối: phải là **1.8.0, bản dựng 9** — cách chắc chắn nhất để biết máy đã cài đúng bản mới.
- **Bản 1.8.0 — đổi giao diện là chữ tự đổi theo, nhật ký và cảm xúc hiện trên cả hai máy, có nhắn tin kèm tin thoại:**
  1. **Không còn chữ mờ/chữ chìm khi đổi chủ đề hay đặt ảnh làm nền.** Bảng màu có thêm `onDeep` (màu chữ trên nền đậm) nên nút chính, thanh tab đang chọn, nút chọn mã 6 số không còn chữ trắng trên nền sáng; 12 bảng màu được hiệu chỉnh lại và **độ tương phản được kiểm tra tự động** (chữ chính ≥ 4,5 · chữ phụ ≥ 3,0 · chữ trên nền đậm ≥ 3,2/4,6) trong `tests/theme_ui.test.mjs`. Nút gạt, dòng báo lỗi khi gõ ngày, tên chủ đề đều lấy màu từ chủ đề; lớp phủ `veil` trên ảnh nền ở chủ đề tối dày hơn (0,82) nên ảnh nền sáng cũng không làm chữ biến mất.
  2. **Sửa đúng lỗi “máy B viết nhật ký mà máy A không thấy”.** Gói dữ liệu 60 KB khi quá lớn trước đây **cắt mất cả phần nhật ký**, nên nhật ký viết thêm không sang được máy kia trong khi cảm xúc/khoảnh khắc vẫn đi. Nay **nhật ký luôn nằm trong gói**; gói quá lớn thì cắt theo thứ tự khoảnh khắc → lời nhắc → tin nhắn → rút ngắn chữ trong nhật ký, và bài kiểm thử `Gói dữ liệu lớn vẫn giữ nhật ký của mình` canh đúng điều này.
  3. **Nhìn thấy dữ liệu đã đi hay chưa.** Nhật ký kết nối trong mục **Ghép nối** ghi rõ `Đã gửi sang máy kia: n kỷ niệm · n tin nhắn · cảm xúc “…”` và `Đã nhận từ …: n kỷ niệm · cảm xúc “…”`; thẻ nhật ký gắn nhãn **của bạn** / **từ tên người thương** kèm số bài của người thương; mục Cảm xúc luôn hiện cảm xúc của cả hai bên.
  4. **Nhớ nhau một cái 💌** — thẻ ở trang chủ gửi một chạm (💌 Nhớ người thương, 🥰 Thương lắm, 🌙 Ngủ ngon nhé); bấm là máy người thương **nổi thông báo như tin nhắn Messenger** và nội dung nằm trong mục **Lời nhắc**.
  5. **Tab Nhắn tin giữa hai máy** — gửi chữ, **emoji** (24 biểu tượng), **6 câu nhớ nhanh** và **tin thoại ghi âm tối đa 30 giây** (`voice-<mã>.m4a`, nghe lại được, có thanh chạy); trạng thái từng tin đang chờ gửi → đã gửi → mới nhận → đã xem; xoá được từng tin; máy nào thiếu tệp tin thoại thì **tự xin gửi lại**; tab có chấm đếm tin chưa đọc. Mô tả tin nằm trong gói dữ liệu (40 tin mới nhất của mình), tệp tin thoại đi theo gói 3.500 ký tự như Khoảnh khắc — không cần máy chủ, không cần tài khoản.
  6. **Kiểm thử:** `tests/chat.test.mjs` dựng **broker MQTT thật (aedes + WebSocket) chạy ngay trong máy** rồi cho hai máy nhắn tin, gửi tin thoại và xin gửi lại; tổng **53/53 bài chạy qua**, TypeScript sạch, `expo export` Android thành công, Gradle `assembleRelease` cho `arm64-v8a` và `armeabi-v7a`.
- **Bản 1.7.0 — thiết kế lại giao diện và sửa lịch chọn ngày:**
  1. **Thiết kế lại toàn bộ giao diện theo chủ đề.** 12 chủ đề (Hồng kẹo, Đào pastel, Tím mộng mơ, Oải hương, Biển xanh, Bạc hà, Trà xanh, Nắng mai, Hoàng hôn, Sen hồng, Tuyết trắng, Đêm sao). Mỗi chủ đề có bảng màu riêng cho **nền, thẻ, nút, ô nhập, chip trạng thái, thanh dưới và cả màn hình khoá** nên không còn cảnh thẻ hồng nằm trên nền tím. Màu chữ cũng theo chủ đề nên chủ đề **Đêm sao** đọc được trên nền tối.
  2. **Hai máy dùng chung một giao diện khi đã ghép nối** — ai đổi chủ đề sau thì cả hai cùng đổi (so mốc thời gian nên không giành nhau, và vẫn đổi được khi máy kia đang tắt).
  3. **Chọn ảnh trong thư viện làm hình nền.** Ảnh được nén nhỏ (rộng 1080, chất lượng 0.72), đặt làm nền toàn app với lớp phủ theo chủ đề để chữ vẫn đọc được, và **được gửi sang máy người thương** qua kết nối (cắt thành gói như ảnh khoảnh khắc, máy thiếu thì tự xin gửi lại). Có nút **Bỏ ảnh nền**.
  4. **Lịch chọn ngày viết lại hoàn toàn** — bỏ hộp thoại của hệ điều hành (nguyên nhân **cứ nhảy về tháng 10/2026**) và thay bằng lịch của app: lùi/tiến **tháng và năm**, nút **Hôm nay**, tháng đang xem nằm trong state riêng nên nhịp đếm mỗi giây của trang chủ không kéo nó về tháng hiện tại, và **gõ thẳng Ngày / Tháng / Năm** rồi bấm “Lưu ngày này” (chặn ngày không tồn tại như 29/2 năm thường, chặn ngày tương lai, chặn trước 1900). Áp dụng cả cho **Chu kỳ → Ngày đầu kỳ**.
  5. Giữ nguyên **Khoảnh khắc kiểu Locket**, **Lời yêu thương 09:00 và 21:00**, ghép nối **mã 6 số**, dữ liệu **mã hoá đầu-cuối**, chạy hoàn toàn trên máy.
- **Bản 1.6.0 sửa đúng 5 việc người dùng nêu:**
  1. **Chọn ngày bắt đầu yêu không còn nhảy về tháng 10/2026** — bộ chọn ngày được tách thành phần riêng, chỉ nhận đúng ngày đã lưu, chặn ngày tương lai, nên nhịp đếm từng giây của trang chủ không còn kéo nó về hôm nay. Ngày lưu ở **12 giờ trưa** nên đổi múi giờ vẫn đúng ngày đã chọn (có bài kiểm thử).
  2. **Đổi ảnh đại diện chạy được** — thay lời gọi `manipulateAsync` đã bị `expo-image-manipulator` bỏ (đây là nguyên nhân lỗi cũ) bằng API mới `manipulate → resize → renderAsync → saveAsync`, kèm bắt lỗi rõ ràng; mỗi lần đổi đặt **tên tệp mới** nên máy không hiện lại ảnh cũ trong bộ đệm.
  3. **“Gửi và nhận tệp” được thay bằng Khoảnh khắc kiểu Locket** — ở trang chủ bấm **Chụp ngay** (hoặc chọn từ thư viện), ảnh được nén nhỏ rồi gửi qua chính kết nối đang có sang **cả hai máy**; hai bạn cùng xem trong lưới khoảnh khắc, mở ra xem lớn kèm **ngày giờ chụp**, ai gửi và chú thích. Ảnh chưa gửi xong tự gửi tiếp ở lần mở app sau; máy nào thiếu ảnh thì tự xin máy kia gửi lại. Gửi tệp JSON giờ chỉ còn là **sao lưu/phục hồi** trong Cài đặt.
  4. **Lời yêu thương mỗi ngày** — hai máy cùng nhận một câu nhắc yêu thương/thơ ngắn lúc **09:00** và **21:00**; câu chọn theo ngày (45 câu) nên hai máy luôn giống nhau và không cần mạng; tắt được trong **Cài đặt**.
  5. **Đổi hình nền / chủ đề trang chủ** — **8 chủ đề** (Hồng, Tím, Biển, Bạc hà, Hoàng hôn, Nắng, Tuyết, Đêm) đổi nền chuyển sắc, màu nhấn và biểu tượng trang trí, giống đổi chủ đề trong tin nhắn.
- **Bản 1.5.0 sửa lỗi app bị văng (quan trọng):** mã kết nối dùng `TextEncoder`/`TextDecoder` mà **React Native không có** (module ném lỗi ngay khi nạp ⇒ app văng lúc mở) và `nacl.randomBytes` cần `crypto.getRandomValues` mà React Native **cũng không có** (⇒ văng khi tạo phòng/bắt tay). Nay phần chuyển chữ ↔ byte được tự viết trong app (đã đối chiếu **từng byte** với chuẩn UTF-8 của Node, kể cả tiếng Việt có dấu và emoji) và nguồn ngẫu nhiên an toàn lấy từ **expo-crypto**. Có bài kiểm thử chạy mã kết nối trong môi trường **đã xóa `TextEncoder`/`TextDecoder`** nên lỗi này không thể tái diễn mà không bị CI phát hiện.
- Bản 1.5.0 còn thêm: **Cài đặt** hiện số phiên bản + bản dựng và mục **“Lỗi gần nhất”**; mọi lỗi JavaScript được ghi lại thay vì làm văng app (màn hình lỗi hiện tiếng Việt kèm nút _Mở lại màn hình_); màn hình **Ghép nối → Chi tiết kết nối** có nút **Tự kiểm tra lại** hiện ✓/✗ cho nguồn ngẫu nhiên, mã hóa đầu-cuối và WebSocket của máy.
- Bản 1.4.0 — **nối song song mọi trạm**, gửi dữ liệu **sau khi đăng ký phòng xong (SUBACK)** thay vì ngay sau bắt tay (CONNACK) nên tin không còn bị mất, chống trùng theo mã bản tin, **“Chi tiết kết nối”** ngay trong app (từng trạm báo gì + nhật ký + nút _Thử kết nối lại_), thêm trạm **broker-cn.emqx.io** gần Việt Nam, và máy nhập mã **không còn hiện lại mã y như máy tạo mã**. Đo thật trên trạm công cộng từ runner CI: máy A sẵn sàng 807 ms, máy B 1.410 ms, **B nhận dữ liệu của A sau 1.533 ms**, cả hai cùng thấy nhau trực tuyến (EMQX 1,7 s · EMQX châu Á 1,1 s · Mosquitto 1,5 s; HiveMQ chậm 21 s; Eclipse cổng 443 chết hẳn).
- Bản 1.3.0 — **ghép nối tức thời bằng mã 6 số, cả hai máy cùng nhận**: một bạn bấm _Tạo mã 6 số_, bạn kia nhập đúng 6 số đó là xong. Vào phòng thì **mỗi máy vừa gửi dữ liệu của mình vừa nhận dữ liệu của người thương**, và **cả hai máy** đều hiện “Đã ghép nối với …” nên không còn cảnh một máy có dữ liệu còn máy kia trống. Không phải quét hai lần, không phải làm lại ở bên nào, không cần máy chủ, không cần đăng ký.
- Dữ liệu đi qua các trạm MQTT công cộng miễn phí (EMQX → HiveMQ → Mosquitto, tự đổi trạm khi trạm trước không tới được) nhưng luôn **mã hóa đầu-cuối** bằng NaCl secretbox: trạm chỉ thấy chuỗi đã mã hóa — bốn trạm theo thứ tự: EMQX (8084), mqtt.eclipseprojects.io (cổng 443, dễ qua mạng di động), HiveMQ (8884), Mosquitto (8081). Khóa phòng suy ra từ chính mã 6 số và chỉ nằm trong máy hai bạn, nên người khác không đọc được nếu không biết mã.
- Mỗi máy chỉ gửi **dữ liệu của mình** (tên, cảm xúc, chu kỳ, kỷ niệm do mình viết, lời nhắc) và gói tin tự cắt bớt khi quá lớn, bỏ ảnh riêng — nhờ vậy hai máy không gửi trả lại dữ liệu của nhau và không lặp vô tận. Mỗi gói tin còn mang mã máy gửi, nên bản tin mà trạm **dội lại cho chính máy vừa gửi** bị bỏ qua — không còn chuyện máy tự nhận mình là người thương. Kỷ niệm kèm ảnh vẫn gửi qua “Xuất và chia sẻ tệp dữ liệu”.
- Vẫn giữ chế độ chạy hoàn toàn trên máy và cách chuyển dữ liệu thủ công (mã dán tay / tệp JSON) cho lúc một bên không có mạng, cùng dự báo chu kỳ, nhắc nhở trên máy, khóa Face ID/vân tay và giao diện 3D.
- Lấy nguyên vẹn từ [lần build thành công 38532880571](https://github.com/hominhtam1922003-lgtm/MangaNhanh/actions/runs/38532880571) (commit `cf8c282`), tải lên Release bằng [workflow đăng APK 38534194891](https://github.com/hominhtam1922003-lgtm/MangaNhanh/actions/runs/38534194891) — cả 7 bước đều xanh, không build lại và không đổi chữ ký.
- Phép đo thật các trạm công cộng chạy bằng [workflow dò trạm 38512750797](https://github.com/hominhtam1922003-lgtm/MangaNhanh/actions/runs/38512750797) (dùng đúng mã nguồn của app, chạy từ runner có Internet thật).
- CI đã chạy: **53 kiểm thử Node** (logic lịch; reducer chế độ trên máy; mã hóa/giải mã gói tức thời, mã 6 số vào đúng một phòng, bộ mã hóa MQTT ghép được dữ liệu về từng byte, mỗi máy chỉ gửi dữ liệu của mình và không lặp, gói tin tự cắt bớt, **hai máy nói chuyện với nhau qua broker giả có dội bản tin và cả hai cùng nhận ghép nối**; `tests/relaybroker.test.mjs` dựng hẳn một **broker MQTT thật bằng thư viện `aedes`** ngay trong máy rồi cho hai máy nhập cùng mã 6 số nói chuyện qua đó — gói CONNECT/SUBSCRIBE/PUBLISH tự viết được broker thật chấp nhận, cả hai cùng nhận dữ liệu, gửi lại không nhân đôi, máy nhập sai mã không thấy gì, **và ảnh khoảnh khắc 12.000 ký tự được cắt thành nhiều gói rồi ghép lại đúng từng ký tự ở máy kia, xin gửi lại cũng chạy**; `tests/moments.test.mjs` kiểm tra khoảnh khắc gộp giữa hai máy, không nhân đôi khi gửi lại, chủ đề, 45 câu yêu thương theo ngày và ngày bắt đầu không bị lệch khi đổi múi giờ; `tests/chat.test.mjs` dựng broker MQTT thật (aedes + WebSocket) chạy trong máy để **hai máy nhắn tin, gửi tin thoại và xin gửi lại**, đồng thời canh việc **gói dữ liệu lớn vẫn giữ nhật ký**; `tests/theme_ui.test.mjs` kiểm tra **12 chủ đề** đủ màu cho mọi thành phần **và độ tương phản đủ đọc** (chữ chính ≥ 4,5 · chữ phụ ≥ 3,0 · chữ trên nền đậm ≥ 3,2/4,6), **lưới lịch đúng từng ngày** (kể cả tuần bắt đầu Thứ Hai và tháng nhuận), lùi/tiến tháng không tự về tháng hiện tại, **gõ thẳng ngày tháng năm** chặn 29/2 sai và ngày tương lai, cùng việc **giao diện dùng chung giữa hai máy** (bản mới hơn thắng, bản cũ không ghi đè, ảnh nền gắn đúng bản), `tsc` sạch, Prettier sạch, `expo export` Android, Gradle `assembleRelease` cho `arm64-v8a` và `armeabi-v7a`.
- **Cần có:** cả hai máy đều có Internet (WiFi hoặc 4G); dữ liệu mới tự sang nhau khi cả hai cùng mở app, một bên đóng app thì lần mở sau sẽ gửi bù.
- **Chưa kiểm chứng:** hai điện thoại thật, quét QR bằng camera thật, quyền thông báo trên máy thật, Face ID thật, FPS thực tế, FCM/APNs, và việc trạm công cộng có luôn tới được từ mạng di động của bạn. Dự báo chu kỳ chỉ là phép tính lịch, **không dùng để tránh thai**.
- Bản 1.2.0 trước đó (ghép nối hai chiều bằng quét mã): `https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.2.0-test-ec8950e/HaiTraiTim-1.2.0.apk`. Bản 1.6.0 (`7bbe0b0`) và 1.5.0 (`b30f5c2`) vẫn chạy tốt — 1.5.0 đã được người dùng xác nhận ghép nối thành công; các bản 1.3.0 (`947971e`, `8b6a2a8`, `f0ee8e4`) và 1.4.0 (`61027f2`) **đã bị thu hồi vì app bị văng**. Nay dùng bản **1.8.0** dựng từ `cf8c282` ở trên.
- **Icon:** bộ icon trong `couple-love/assets/` tạo bằng `python3 couple-love/scripts/make-icons.py` (chạy kèm đường dẫn ảnh của bạn để đổi icon sang ảnh đó rồi build lại).
- APK dùng **chữ ký debug của mẫu Expo** — chỉ để thử, không phát hành cửa hàng; cấu hình 4 secret keystore trong Actions để ký bằng khóa riêng. **Gỡ ứng dụng hoặc xóa dữ liệu ứng dụng sẽ mất dữ liệu trên máy**, hãy xuất tệp dự phòng trước.

## Ứng dụng Mật Mã Yêu (tên cũ: Hai Trái Tim — thư mục `couple-love/`)

Mã nguồn đầy đủ của app đếm ngày yêu **Android ↔ iOS** nằm trong thư mục `couple-love`: React Native/Expo SDK 54, NativeWind, trái tim 3D bằng Three.js/R3F, Supabase (đồng bộ realtime, RLS, Storage, Edge Function + cron thông báo kép). Hướng dẫn cấu hình backend, push FCM/APNs, secrets ký APK và kiểm thử ở `couple-love/README.md`.

### Tải APK thử nghiệm (Android 7.0+, API 24)

**https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.1.0-test-49375da/HaiTraiTim-1.1.0.apk**

- `HaiTraiTim-1.1.0.apk` · **55.186.153 byte** · SHA256 `0df84b96399475dcb43d22f3414a9066d30f73d4a55d6b8f338e6b95170494de` · kèm file `.sha256` trong Assets.
- Bản 1.1.0 thêm **chế độ chạy hoàn toàn trên máy**: mở app chọn “Dùng trên máy này” là dùng được ngay, không cần tài khoản, không cần máy chủ, không cần Internet. Hai máy nối nhau bằng mã QR chia đoạn hoặc tệp dữ liệu JSON (gồm cả nhật ký và ảnh nhỏ). Vẫn giữ chế độ đồng bộ Supabase và đổi qua lại trong Cài đặt.
- Lấy nguyên vẹn từ [lần build thành công 38404844843](https://github.com/hominhtam1922003-lgtm/MangaNhanh/actions/runs/38404844843) (commit `49375da`), tải lên Release bằng [workflow đăng APK 38406849237](https://github.com/hominhtam1922003-lgtm/MangaNhanh/actions/runs/38406849237), không build lại và không đổi chữ ký.
- CI đã chạy: **23 kiểm thử Node** (logic lịch; reducer chế độ trên máy; mã QR ghép/đoạn/hỏng; ghép nối lại không nhân đôi kỷ niệm; lời nhắc trước kỳ/đầu kỳ/rụng trứng/kỷ niệm; PostgreSQL thật bằng PGlite cho RLS, ghép đôi, hạn mã, thu hồi chia sẻ xóa lời nhắc), `tsc` sạch, Prettier sạch, `expo export` Android + iOS, Gradle `assembleRelease` cho `arm64-v8a` và `armeabi-v7a`.
- **Chưa kiểm chứng:** hai điện thoại thật, quét QR bằng camera thật, quyền thông báo trên máy thật, Face ID thật, FPS thực tế, FCM/APNs. Dự báo chu kỳ chỉ là phép tính lịch, **không dùng để tránh thai**.
- APK dùng **chữ ký debug của mẫu Expo** — chỉ để thử, không phát hành cửa hàng; cấu hình 4 secret keystore trong Actions để ký bằng khóa riêng. **Gỡ ứng dụng hoặc xóa dữ liệu ứng dụng sẽ mất dữ liệu trên máy**, hãy xuất tệp dự phòng trước.
- Chế độ đồng bộ (tùy chọn) cần bạn tự tạo dự án Supabase, chạy `supabase/migrations/001_love.sql`, triển khai Edge Function + cron (`npm run provision`), rồi nhập URL và khóa công khai khi mở app. Không nhập khóa bí mật/`service_role`/mật khẩu vào ứng dụng hoặc chat.
