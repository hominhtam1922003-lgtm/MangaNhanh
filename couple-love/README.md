# Hai Trái Tim 💕

Ứng dụng Android/iOS bằng **React Native · Expo SDK 54 · NativeWind · Three.js/R3F native · Supabase**. Tất cả nội dung giao diện của ứng dụng bằng tiếng Việt.

## Hai chế độ chạy

Khi mở app lần đầu, bạn chọn một trong hai chế độ và có thể đổi lại trong Cài đặt:

1. **Trên máy này · không cần máy chủ (mặc định, đầy đủ tính năng)** — đếm ngày yêu, trái tim 3D, chu kỳ, nhật ký, cảm xúc, lời nhắc hẹn giờ trên máy, sinh trắc học và sao lưu tệp. Hai máy trao đổi dữ liệu bằng **mã QR / tệp dữ liệu**, không cần tài khoản, không cần Internet. Vì không có máy chủ nên **không có cập nhật tức thời giữa hai máy và không nhắc hộ được người thương**.
2. **Đồng bộ hai máy** — cần một dự án Supabase do bạn tạo (xem mục 2 bên dưới). Đổi lại bạn có cập nhật tức thời Android ↔ iPhone, nhật ký chung, lời nhắc kép gửi tới cả hai máy.

Không có máy chủ nào được nhúng sẵn trong APK và tôi không tạo tài khoản thay bạn. Chế độ 1 chạy hoàn toàn độc lập, không cần đăng ký gì.

## Có trong mã nguồn

- Trái tim 3D nổi, chất liệu bóng, ánh sáng và 80 hạt lấp lánh; vuốt để xoay. Tôn trọng tùy chọn giảm chuyển động. Không cần tải mô hình hoặc ảnh từ bên ngoài.
- Đếm lịch **năm / tháng / ngày / giờ / phút / giây**, tổng ngày bên nhau; xử lý ngày nhuận và cuối tháng, dùng mốc UTC chung.
- Ghép Android ↔ iPhone bằng QR hoặc mã **6 chữ số**, hết hạn sau 10 phút, dùng một lần, tối đa hai thành viên; giới hạn 8 lần thử / 15 phút / tài khoản.
- Tên, ảnh đại diện, ngày bắt đầu, cảm xúc, nhật ký và dữ liệu được chia sẻ đồng bộ qua Supabase Realtime; làm mới dự phòng 30 giây. Không phải giao diện giả dữ liệu.
- Nhật ký ảnh + ghi chú; ảnh JPEG thu nhỏ tối đa 2 MB, kho Storage riêng, URL ký tạm thời. Hiển thị 100 kỷ niệm mới nhất.
- Chu kỳ mặc định riêng tư; chỉ chủ dữ liệu sửa, chia sẻ cần xác nhận; người nhận phải đồng ý riêng để nhận lời nhắc chu kỳ.
- Lịch kỳ kinh, kỳ tiếp theo và khoảng dễ thụ thai **ước tính**. Nhắc trước kỳ 3 ngày, đầu kỳ, mốc rụng trứng và kỷ niệm hằng năm. Có lời khuyên quan tâm nhẹ nhàng.
- Lời nhắc cảm xúc cho người thương; chống lặp trong cùng phút.
- Face ID / vân tay khóa khi rời ứng dụng; phiên và cấu hình lưu trong SecureStore, không lưu mật khẩu ở mã nguồn.
- SQL RLS, RPC ghép đôi nguyên tử, hàng chờ push có lease / retry, Edge Function và script triển khai lịch chạy 5 phút.
- **Ghép nối hai chiều không cần máy chủ (1.2.0):** bước 1 bạn quét mã của người thương để nhận dữ liệu của họ; bước 2 đưa **mã phản hồi** (đã gồm cả hai bên) cho người thương quét để họ nhận đủ dữ liệu của bạn. App gộp theo mốc thời gian (`updatedAt`) nên quét lại nhiều lần **không nhân đôi** kỷ niệm/lời nhắc, bản mới hơn thắng, tên và ngày kỷ niệm của bạn không bị máy kia ghi đè.
- **Giao diện 1.2.0:** trái tim 3D có quầng sáng, vòng sáng quay, 3 trái tim nhỏ bay quanh, hạt sáng nhấp nháy, chạm giữ để thấy nhịp đập, vuốt để xoay có quán tính; thẻ gradient, thanh tab có vệt sáng, màn hình chờ và icon lấy từ `assets/`.
- **Chế độ trên máy:** dữ liệu JSON trong thư mục riêng của ứng dụng + bản sao trong AsyncStorage, ảnh JPEG thu nhỏ trong `images/`, lời nhắc đặt bằng lịch cục bộ, mã QR chia đoạn (có kiểm tra hỏng/mất đoạn), tệp sao lưu JSON chứa cả nhật ký và ảnh nhỏ, khóa Face ID/vân tay, nút xóa toàn bộ dữ liệu hai bước.
- GitHub Actions build **APK release chứa sẵn JavaScript**, không cần mở Metro / mua EAS Build.

**Giới hạn của chế độ trên máy:** mã QR chỉ chứa hồ sơ, ngày bắt đầu và dữ liệu chu kỳ (không chứa nhật ký); tệp dữ liệu chứa cả nhật ký và ảnh nhỏ. Ghép nối là bản chụp tại thời điểm tạo mã, muốn cập nhật phải ghép lại. Gỡ ứng dụng hoặc xóa dữ liệu ứng dụng sẽ mất dữ liệu, hãy xuất tệp dự phòng. Nhắc hẹn không phải báo thức reo chuông và hệ điều hành có thể trì hoãn.

**Không phải ứng dụng y tế:** dự báo chu kỳ là phép tính lịch, không phải AI, không đo hay xác nhận rụng trứng. Không có “ngày an toàn” để tránh thai. Không bảo đảm 60 FPS trên mọi điện thoại. Hiện chưa kiểm thử bằng hai điện thoại thật / FCM / APNs.

## 0. Icon và màn hình chờ

Bộ icon trong `assets/` được tạo bằng Pillow (không cần Internet):

```bash
python3 scripts/make-icons.py              # icon trái tim 3D mặc định
python3 scripts/make-icons.py ảnh-của-bạn.jpg   # dùng ảnh bạn có quyền sử dụng
```

Script ghi `icon.png`, `adaptive-icon.png`, `splash-icon.png`, `notification-icon.png`, `favicon.png` và `app.config.js` đã trỏ tới các tệp này. Bản APK đang phát hành dùng icon trái tim mặc định.

## 1. Chạy mã nguồn

Yêu cầu Node 22+, npm, Android Studio + Java 17 cho Android; macOS/Xcode cho iOS.

```bash
npm ci
npm test
npm run check
cp .env.example .env
npm run android
```

Điền URL và khóa **công khai** của dự án Supabase vào `.env`, hoặc để trống và nhập ở màn hình đầu ứng dụng. Hai điện thoại phải dùng cùng dự án. Không đưa `service_role`, secret key, mật khẩu database, keystore hay FCM service-account vào ứng dụng / Git.

Chạy `npm run ios` trên macOS sau khi cấu hình signing. Expo Go không phải môi trường xác minh Face ID / thông báo đẩy Android SDK 54; dùng bản native.

## 2. Tạo backend thực

1. Tạo dự án Supabase do bạn quản lý. Trong **Authentication → Providers**, bật Email và nếu muốn sử dụng nút không email, bật **Anonymous Sign-ins**. Cấu hình SMTP/URL xác nhận và URL trang đổi mật khẩu của bạn nếu dùng email. Luồng quên mật khẩu mở trang recovery do bạn cấu hình, không có trang recovery web trong app này.
2. Với dự án mới, chạy nguyên file `supabase/migrations/001_love.sql` trong SQL Editor. Tạo bảng, trigger tài khoản, RLS, RPC, Realtime và bucket riêng `love-assets`. Migration chỉ dành cho dự án mới; script kiểm tra `public.couples` để tránh chạy lại lần đầu, không thay thế quản lý migration khi nâng cấp.
3. Cài/deploy Edge Function và lịch cron bằng script dưới đây. URL connection database dùng Supabase pooler / direct connection phù hợp mạng của máy, đúng mật khẩu, TLS; không tắt kiểm tra chứng chỉ trong triển khai thật.

Các biến môi trường cho **máy quản trị**:

| Biến                    | Lấy ở đâu / ý nghĩa                                                 |
| ----------------------- | ------------------------------------------------------------------- |
| `DATABASE_URL`          | Connection string PostgreSQL của dự án                              |
| `SUPABASE_URL`          | URL HTTPS của dự án                                                 |
| `SUPABASE_PROJECT_REF`  | Mã dự án trong Project Settings                                     |
| `SUPABASE_ACCESS_TOKEN` | Token CLI của tài khoản Supabase, chỉ dùng triển khai               |
| `CRON_SECRET`           | Tùy chọn; script tự sinh nếu thiếu, lưu trong Vault và Edge secrets |

Sau khi đặt các biến đó trong terminal của máy quản trị:

```bash
npm run provision
```

Script dùng Supabase CLI qua `npx`, chạy migration nếu chưa có, bật `pg_cron` / `pg_net`, lưu bí mật trong Vault, deploy function `dispatch-notifications` và đặt cron mỗi 5 phút. Service-role key được Supabase cung cấp trong môi trường Edge, không dùng public key để gửi push. Nếu mạng của Supabase CLI không truy cập được, deploy cùng thư mục function bằng CLI trên máy của bạn.

Cron tạo lời nhắc từ **08:00 theo múi giờ cặp đôi**; mốc nằm trong ngày, không hứa gửi chính xác tới từng giây. Dữ liệu quá cũ (quá min(90 ngày, 3 vòng kinh)) dừng dự báo tự động. Chạy lại cron không tạo trùng lời nhắc. Push dùng nội dung chung để không lộ sức khỏe trên màn hình khóa.

## 3. Thông báo kép Android / iOS

Lời nhắc trong ứng dụng hoạt động bằng bảng `alerts`. Push khi ứng dụng đóng cần **toàn bộ** cấu hình sau:

1. Tạo tài khoản Expo và dự án EAS (`npx eas-cli init`), lấy Project ID. Đây là đăng ký cổng push, **không yêu cầu dùng EAS Build trả phí**.
2. Android: tạo Firebase project, thêm app `vn.haitraitim.app`, tải `google-services.json` đặt cạnh `app.config.js`. Cấu hình **FCM HTTP v1 service-account** trong EAS Credentials (`npx eas-cli credentials --platform android`). `google-services.json` không thay thế khóa service-account phía cổng gửi.
3. iOS: cấu hình bundle `vn.haitraitim.app`, APNs key, provisioning profile và quyền push bằng tài khoản Apple Developer. Build/sign trên macOS hoặc EAS, cài lên iPhone thật. Phân phối iOS/APNs thường cần Apple Developer trả phí; không thể cam kết 100% miễn phí.
4. Nhập Project ID vào cấu hình ứng dụng hoặc biến `EXPO_PUBLIC_EAS_PROJECT_ID` khi build. Mỗi người đăng nhập bằng tài khoản riêng; trong **Cài đặt → Đăng ký thông báo trên máy này**, cấp quyền trên điện thoại thật.
5. Người ghi bật lời nhắc; nếu muốn thông báo cho người thương, bật chia sẻ chu kỳ. Người thương bật đồng ý lời nhắc chu kỳ trong Cài đặt. Nếu thiếu một đồng ý, chỉ chủ dữ liệu được nhắc.
6. Nếu bật Enhanced Push Security trong Expo, đặt `EXPO_ACCESS_TOKEN` cho Edge Function bằng Supabase secrets, không đưa vào APK.

Function gửi qua Expo Push, Expo chuyển tới **FCM / APNs**. Ticket được cổng chấp nhận không chứng minh điện thoại đã nhận. Hàng chờ gửi tối đa 6 lần, backoff và lease 10 phút; việc gửi ít nhất một lần có thể gây push lặp khi một lô chỉ thành công một phần. Chưa lưu/đối soát push receipt; theo dõi log Expo/Supabase khi kiểm thử. Khi thu hồi chia sẻ / đồng ý, lời nhắc và hàng chờ tương ứng bị xóa, function kiểm tra quyền lại trước gửi; thông báo đã được hệ điều hành nhận không thể thu hồi.

## 4. GitHub Actions → tải APK

### Khi dùng riêng thư mục này làm repository

Đẩy **toàn bộ nội dung thư mục**, gồm `.github/workflows/build-apk.yml`, `package-lock.json`, source và `scripts`. Workflow tự chạy khi push vào main hoặc chọn **Actions → APK Hai Trái Tim → Run workflow**.

### Trong repository MangaNhanh hiện tại

Workflow kích hoạt nằm ở **`../.github/workflows/build-couple-apk.yml`**; workflow lồng bên trong chỉ dành cho bản source độc lập vì GitHub không chạy workflow ở thư mục con. Workflow Flutter gốc vẫn được giữ nguyên.

Secrets tùy chọn trong GitHub Settings → Secrets and variables → Actions:

| Secret                             | Ý nghĩa                                                         |
| ---------------------------------- | --------------------------------------------------------------- |
| `LOVE_SUPABASE_URL`                | URL dự án                                                       |
| `LOVE_SUPABASE_ANON_KEY`           | Khóa công khai anon/publishable; sẽ nằm trong APK theo thiết kế |
| `LOVE_EAS_PROJECT_ID`              | Project ID Expo/EAS                                             |
| `LOVE_GOOGLE_SERVICES_JSON_BASE64` | Nội dung `google-services.json` mã hóa base64                   |
| `LOVE_ANDROID_KEYSTORE_BASE64`     | Keystore release riêng, base64                                  |
| `LOVE_ANDROID_KEYSTORE_PASSWORD`   | Mật khẩu keystore                                               |
| `LOVE_ANDROID_KEY_ALIAS`           | Alias                                                           |
| `LOVE_ANDROID_KEY_PASSWORD`        | Mật khẩu khóa                                                   |

**Không có secrets vẫn build được**: nhập Supabase khi mở app; push chưa sẵn sàng. Không có bốn secrets keystore thì APK dùng chữ ký debug của mẫu Expo: chỉ dành thử nghiệm, không phát hành cửa hàng. Dùng cùng keystore riêng cho mọi lần nâng cấp để giữ dữ liệu. Không gửi secrets trong chat.

CI: Ubuntu → Node 22 → Java 17 → Android SDK → `npm ci` → tests / TypeScript / format → Expo prebuild → Gradle `assembleRelease` cho ARM64 và ARMv7 → artifact **`HaiTraiTim-1.0.0-APK`**, chứa `.apk` và SHA256, giữ 14 ngày. Tải từ trang run → Artifacts, giải nén và cài APK. Android tối thiểu API 24 (Android 7). Chi phí / hạn mức Actions phụ thuộc repository và tài khoản GitHub, không vô hạn.

## 5. Bảo mật, vận hành và giới hạn

- RLS chặn người ngoài đọc cặp đôi, chu kỳ, nhật ký, ảnh và lời nhắc. Khách không được ghi trực tiếp thành viên / mã / hàng chờ hoặc sửa nội dung lời nhắc.
- Khóa công khai không phải bí mật; bảo mật đến từ **RLS và xác thực**. Đây không phải mã hóa đầu-cuối: người quản trị backend truy cập được dữ liệu.
- URL ảnh có hạn, ảnh đã tải về/ảnh chụp màn hình của người nhận không thể thu hồi. Khi hủy ghép đôi, dữ liệu bảng bị cascade xóa; ảnh trong Storage không tự xóa bằng SQL. Quản trị viên cần xóa prefix UUID của cặp đôi trong bucket `love-assets`; ảnh tạm bỏ dở cũng cần dọn. Xóa tài khoản và dữ liệu dự phòng trong Supabase là thao tác quản trị.
- Backup dữ liệu/keystore theo nhu cầu. Khóa sinh trắc học chỉ bảo vệ giao diện trên máy, không thay cho bảo vệ tài khoản và thiết bị. Không có cơ chế vượt khóa; mất cảm biến có thể cần cài lại rồi đăng nhập bằng email đã liên kết.
- Chưa có đồng bộ ngoại tuyến có hàng chờ; khi mạng lỗi, thao tác báo thất bại để thử lại, không giả vờ đã lưu. Không lưu cache sức khỏe lâu dài trên điện thoại.
- Anonymous Sign-ins dễ bị lạm dụng tạo nhiều tài khoản; giới hạn thử mã chỉ áp dụng trên mỗi tài khoản. Trước mở cho công chúng, cân nhắc tắt anonymous, bật rate limit và xác minh email. Nếu bật CAPTCHA bắt buộc, cần bổ sung giao diện CAPTCHA tương ứng; bản hiện tại không có luồng CAPTCHA và không nên bật anonymous CAPTCHA rồi kỳ vọng nút không email hoạt động.
- Supabase free tier có quota Database / Storage / Realtime / Edge và có thể tạm dừng dự án ít hoạt động. Khi backend dừng, push theo lịch cũng dừng. Theo dõi quota, log, retry thất bại; dọn `alerts`, `push_jobs` cũ theo chính sách riêng.
- `npm audit` còn cảnh báo ở dependency/transitive toolchain Expo SDK 54 / RN / Tailwind. Không tự động nâng major hoặc khẳng định production an toàn tuyệt đối. Chỉ nên dùng thử với dữ liệu không nhạy cảm trước audit triển khai thực.

## 6. Kiểm thử

```bash
npm test
npm run check
npm run format:check
EXPO_OFFLINE=1 npx expo export --platform android
EXPO_OFFLINE=1 npx expo export --platform ios
EXPO_OFFLINE=1 npx expo prebuild --platform android --no-install --clean
```

Tests Node gồm logic lịch và **PostgreSQL thực chạy WASM bằng PGlite + pgcrypto**, áp dụng migration thật trong fixture auth/storage để kiểm tra ghép đôi, hết hạn, giới hạn thử, RLS, privacy revocation, nhật ký/ảnh, hàng chờ và lời nhắc kép. Fixture không thay cho Supabase cloud / Realtime / mạng push thật.

Trước phát hành: kiểm thử Android ↔ iPhone, mã hết hạn/sai, người thứ ba, thu hồi chia sẻ khi partner đang mở màn hình, ảnh, mất mạng, khóa khi đưa app nền, đổi máy bằng email, FCM/APNs khi đóng app và chữ ký nâng cấp. Chỉ đo FPS trên thiết bị cụ thể, không suy từ mã nguồn.
