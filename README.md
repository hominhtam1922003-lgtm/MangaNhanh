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

## Ứng dụng Hai Trái Tim (thư mục `couple-love/`)

Mã nguồn đầy đủ của app đếm ngày yêu **Android ↔ iOS** nằm trong thư mục `couple-love`: React Native/Expo SDK 54, NativeWind, trái tim 3D bằng Three.js/R3F. App dùng được ngay **không cần tài khoản, không cần máy chủ**: hai máy ghép nối bằng **mã 6 số** qua các trạm MQTT công cộng với dữ liệu **mã hóa đầu-cuối** (1.3.0), hoặc chuyển dữ liệu thủ công bằng mã/tệp JSON; chế độ Supabase (realtime, RLS, Storage, Edge Function + cron thông báo kép) vẫn còn cho ai muốn dựng máy chủ riêng. Hướng dẫn backend, push FCM/APNs, secrets ký APK và kiểm thử ở `couple-love/README.md`.

### Tải APK thử nghiệm (Android 7.0+, API 24)

**https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.6.0-test-7bbe0b0/HaiTraiTim-1.6.0.apk**

- `HaiTraiTim-1.6.0.apk` · **55.605.776 byte** · SHA256 `3222510223206266bc33f05ba03f895454e61af62421a473faeb67789de16ab7` · kèm file `.sha256` trong Assets. Trong app, mở **Cài đặt** xem dòng cuối: phải là **1.6.0, bản dựng 7** — cách chắc chắn nhất để biết máy đã cài đúng bản mới.
- **Bản 1.6.0 sửa đúng 5 việc người dùng nêu:**
  1. **Chọn ngày bắt đầu yêu không còn nhảy về tháng 10/2026** — bộ chọn ngày được tách thành phần riêng, chỉ nhận đúng ngày đã lưu, chặn ngày tương lai, nên nhịp đếm từng giây của trang chủ không còn kéo nó về hôm nay. Ngày lưu ở **12 giờ trưa** nên đổi múi giờ vẫn đúng ngày đã chọn (có bài kiểm thử).
  2. **Đổi ảnh đại diện chạy được** — thay lời gọi `manipulateAsync` đã bị `expo-image-manipulator` bỏ (đây là nguyên nhân lỗi cũ) bằng API mới `manipulate → resize → renderAsync → saveAsync`, kèm bắt lỗi rõ ràng; mỗi lần đổi đặt **tên tệp mới** nên máy không hiện lại ảnh cũ trong bộ đệm.
  3. **“Gửi và nhận tệp” được thay bằng Khoảnh khắc kiểu Locket** — ở trang chủ bấm **Chụp ngay** (hoặc chọn từ thư viện), ảnh được nén nhỏ rồi gửi qua chính kết nối đang có sang **cả hai máy**; hai bạn cùng xem trong lưới khoảnh khắc, mở ra xem lớn kèm **ngày giờ chụp**, ai gửi và chú thích. Ảnh chưa gửi xong tự gửi tiếp ở lần mở app sau; máy nào thiếu ảnh thì tự xin máy kia gửi lại. Gửi tệp JSON giờ chỉ còn là **sao lưu/phục hồi** trong Cài đặt.
  4. **Lời yêu thương mỗi ngày** — hai máy cùng nhận một câu nhắc yêu thương/thơ ngắn lúc **09:00** và **21:00**; câu chọn theo ngày (45 câu) nên hai máy luôn giống nhau và không cần mạng; tắt được trong **Cài đặt**.
  5. **Đổi hình nền / chủ đề trang chủ** — **8 chủ đề** (Hồng, Tím, Biển, Bạc hà, Hoàng hôn, Nắng, Tuyết, Đêm) đổi nền chuyển sắc, màu nhấn và biểu tượng trang trí, giống đổi chủ đề trong tin nhắn.
- **Bản 1.5.0 sửa lỗi app bị văng (quan trọng):** mã kết nối dùng `TextEncoder`/`TextDecoder` mà **React Native không có** (module ném lỗi ngay khi nạp ⇒ app văng lúc mở) và `nacl.randomBytes` cần `crypto.getRandomValues` mà React Native **cũng không có** (⇒ văng khi tạo phòng/bắt tay). Nay phần chuyển chữ ↔ byte được tự viết trong app (đã đối chiếu **từng byte** với chuẩn UTF-8 của Node, kể cả tiếng Việt có dấu và emoji) và nguồn ngẫu nhiên an toàn lấy từ **expo-crypto**. Có bài kiểm thử chạy mã kết nối trong môi trường **đã xóa `TextEncoder`/`TextDecoder`** nên lỗi này không thể tái diễn mà không bị CI phát hiện.
- Bản 1.5.0 còn thêm: **Cài đặt** hiện số phiên bản + bản dựng và mục **“Lỗi gần nhất”**; mọi lỗi JavaScript được ghi lại thay vì làm văng app (màn hình lỗi hiện tiếng Việt kèm nút *Mở lại màn hình*); màn hình **Ghép nối → Chi tiết kết nối** có nút **Tự kiểm tra lại** hiện ✓/✗ cho nguồn ngẫu nhiên, mã hóa đầu-cuối và WebSocket của máy.
- Bản 1.4.0 — **nối song song mọi trạm**, gửi dữ liệu **sau khi đăng ký phòng xong (SUBACK)** thay vì ngay sau bắt tay (CONNACK) nên tin không còn bị mất, chống trùng theo mã bản tin, **“Chi tiết kết nối”** ngay trong app (từng trạm báo gì + nhật ký + nút *Thử kết nối lại*), thêm trạm **broker-cn.emqx.io** gần Việt Nam, và máy nhập mã **không còn hiện lại mã y như máy tạo mã**. Đo thật trên trạm công cộng từ runner CI: máy A sẵn sàng 807 ms, máy B 1.410 ms, **B nhận dữ liệu của A sau 1.533 ms**, cả hai cùng thấy nhau trực tuyến (EMQX 1,7 s · EMQX châu Á 1,1 s · Mosquitto 1,5 s; HiveMQ chậm 21 s; Eclipse cổng 443 chết hẳn).
- Bản 1.3.0 — **ghép nối tức thời bằng mã 6 số, cả hai máy cùng nhận**: một bạn bấm *Tạo mã 6 số*, bạn kia nhập đúng 6 số đó là xong. Vào phòng thì **mỗi máy vừa gửi dữ liệu của mình vừa nhận dữ liệu của người thương**, và **cả hai máy** đều hiện “Đã ghép nối với …” nên không còn cảnh một máy có dữ liệu còn máy kia trống. Không phải quét hai lần, không phải làm lại ở bên nào, không cần máy chủ, không cần đăng ký.
- Dữ liệu đi qua các trạm MQTT công cộng miễn phí (EMQX → HiveMQ → Mosquitto, tự đổi trạm khi trạm trước không tới được) nhưng luôn **mã hóa đầu-cuối** bằng NaCl secretbox: trạm chỉ thấy chuỗi đã mã hóa — bốn trạm theo thứ tự: EMQX (8084), mqtt.eclipseprojects.io (cổng 443, dễ qua mạng di động), HiveMQ (8884), Mosquitto (8081). Khóa phòng suy ra từ chính mã 6 số và chỉ nằm trong máy hai bạn, nên người khác không đọc được nếu không biết mã.
- Mỗi máy chỉ gửi **dữ liệu của mình** (tên, cảm xúc, chu kỳ, kỷ niệm do mình viết, lời nhắc) và gói tin tự cắt bớt khi quá lớn, bỏ ảnh riêng — nhờ vậy hai máy không gửi trả lại dữ liệu của nhau và không lặp vô tận. Mỗi gói tin còn mang mã máy gửi, nên bản tin mà trạm **dội lại cho chính máy vừa gửi** bị bỏ qua — không còn chuyện máy tự nhận mình là người thương. Kỷ niệm kèm ảnh vẫn gửi qua “Xuất và chia sẻ tệp dữ liệu”.
- Vẫn giữ chế độ chạy hoàn toàn trên máy và cách chuyển dữ liệu thủ công (mã dán tay / tệp JSON) cho lúc một bên không có mạng, cùng dự báo chu kỳ, nhắc nhở trên máy, khóa Face ID/vân tay và giao diện 3D.
- Lấy nguyên vẹn từ [lần build thành công 38519724865](https://github.com/hominhtam1922003-lgtm/MangaNhanh/actions/runs/38519724865) (commit `7bbe0b0`), tải lên Release bằng [workflow đăng APK 38521145761](https://github.com/hominhtam1922003-lgtm/MangaNhanh/actions/runs/38521145761) — cả 7 bước đều xanh, không build lại và không đổi chữ ký.
- Phép đo thật các trạm công cộng chạy bằng [workflow dò trạm 38512750797](https://github.com/hominhtam1922003-lgtm/MangaNhanh/actions/runs/38512750797) (dùng đúng mã nguồn của app, chạy từ runner có Internet thật).
- CI đã chạy: **43 kiểm thử Node** (logic lịch; reducer chế độ trên máy; mã hóa/giải mã gói tức thời, mã 6 số vào đúng một phòng, bộ mã hóa MQTT ghép được dữ liệu về từng byte, mỗi máy chỉ gửi dữ liệu của mình và không lặp, gói tin tự cắt bớt, **hai máy nói chuyện với nhau qua broker giả có dội bản tin và cả hai cùng nhận ghép nối**; `tests/relaybroker.test.mjs` dựng hẳn một **broker MQTT thật bằng thư viện `aedes`** ngay trong máy rồi cho hai máy nhập cùng mã 6 số nói chuyện qua đó — gói CONNECT/SUBSCRIBE/PUBLISH tự viết được broker thật chấp nhận, cả hai cùng nhận dữ liệu, gửi lại không nhân đôi, máy nhập sai mã không thấy gì, **và ảnh khoảnh khắc 12.000 ký tự được cắt thành nhiều gói rồi ghép lại đúng từng ký tự ở máy kia, xin gửi lại cũng chạy**; `tests/moments.test.mjs` kiểm tra khoảnh khắc gộp giữa hai máy, không nhân đôi khi gửi lại, 8 chủ đề, 45 câu yêu thương theo ngày và ngày bắt đầu không bị lệch khi đổi múi giờ), `tsc` sạch, Prettier sạch, `expo export` Android, Gradle `assembleRelease` cho `arm64-v8a` và `armeabi-v7a`.
- **Cần có:** cả hai máy đều có Internet (WiFi hoặc 4G); dữ liệu mới tự sang nhau khi cả hai cùng mở app, một bên đóng app thì lần mở sau sẽ gửi bù.
- **Chưa kiểm chứng:** hai điện thoại thật, quét QR bằng camera thật, quyền thông báo trên máy thật, Face ID thật, FPS thực tế, FCM/APNs, và việc trạm công cộng có luôn tới được từ mạng di động của bạn. Dự báo chu kỳ chỉ là phép tính lịch, **không dùng để tránh thai**.
- Bản 1.2.0 trước đó (ghép nối hai chiều bằng quét mã): `https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.2.0-test-ec8950e/HaiTraiTim-1.2.0.apk`. Bản 1.5.0 (`b30f5c2`) vẫn chạy tốt và đã được người dùng xác nhận ghép nối thành công; các bản 1.3.0 (`947971e`, `8b6a2a8`, `f0ee8e4`) và 1.4.0 (`61027f2`) **đã bị thu hồi vì app bị văng**. Nay dùng bản **1.6.0** dựng từ `7bbe0b0` ở trên.
- **Icon:** bộ icon trong `couple-love/assets/` tạo bằng `python3 couple-love/scripts/make-icons.py` (chạy kèm đường dẫn ảnh của bạn để đổi icon sang ảnh đó rồi build lại).
- APK dùng **chữ ký debug của mẫu Expo** — chỉ để thử, không phát hành cửa hàng; cấu hình 4 secret keystore trong Actions để ký bằng khóa riêng. **Gỡ ứng dụng hoặc xóa dữ liệu ứng dụng sẽ mất dữ liệu trên máy**, hãy xuất tệp dự phòng trước.

## Ứng dụng Hai Trái Tim (thư mục `couple-love/`)

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
