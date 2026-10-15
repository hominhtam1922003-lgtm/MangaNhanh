# Mật Mã Yêu 💕

> Tên cũ là **Hai Trái Tim**; từ 1.16.0 app đổi tên hiển thị thành **Mật Mã Yêu**. Gói vẫn là `vn.haitraitim.app`, khoá ký không đổi nên bạn **cài đè** lên bản cũ được, không mất dữ liệu.

Ứng dụng Android/iOS bằng **React Native · Expo SDK 54 · NativeWind · Three.js/R3F native · Supabase**. Tất cả nội dung giao diện của ứng dụng bằng tiếng Việt.

## Hai chế độ chạy

Khi mở app lần đầu, bạn chọn một trong hai chế độ và có thể đổi lại trong Cài đặt:

1. **Trên máy này · không cần máy chủ (mặc định, đầy đủ tính năng)** — đếm ngày yêu, trái tim 3D, chu kỳ, nhật ký, cảm xúc, lời nhắc hẹn giờ trên máy, sinh trắc học và sao lưu tệp. Hai máy ghép nối bằng **mã cố định theo tài khoản** (Google/Facebook qua Supabase Auth) rồi tự gửi dữ liệu cho nhau khi cả hai cùng mở app (xem mục _Kết nối tức thời_ bên dưới). Từ 1.18.0 **không còn mã 6 số ngẫu nhiên**: mã kết nối là mã cố định gắn với `uid` của bạn và `partner_id` lưu trên máy chủ ghép nối; khi một bên không có mạng thì vẫn có cách **mã dán tay / tệp dữ liệu**.
2. **Đồng bộ hai máy** — cần một dự án Supabase do bạn tạo (xem mục 2 bên dưới). Đổi lại bạn có cập nhật tức thời Android ↔ iPhone, nhật ký chung, lời nhắc kép gửi tới cả hai máy.

Không có máy chủ nào được nhúng sẵn trong APK và tôi không tạo tài khoản thay bạn. Chế độ 1 chạy hoàn toàn độc lập, không cần đăng ký gì.

### Kết nối tức thời giữa hai máy (không cần máy chủ)

- **Từ 1.18.0:** mở app → đăng nhập **Google/Facebook** (Supabase Auth) → màn ghép nối hiện **mã cố định 6 ký tự** của bạn (ví dụ `ABC-234`, bảng chữ bỏ I/O/0/1). Người thương nhập mã của bạn **hoặc** bạn nhập mã của họ — hàm `pair_with_code` trên máy chủ ghi `partner_id` + khoá `pair_secret` cho **cả hai** hàng hồ sơ, nên chỉ một bên nhập là xong. Máy nào chưa có `partner_id` (đọc lại từ Supabase ở **mỗi lần mở app**) thì app **dừng ở màn nhập mã**, không vào phần chat: nhờ vậy máy không thể tự chui vào phòng MQTT cũ trong bộ nhớ/Auto Backup (lỗi “kết nối ảo”).
- Phòng kết nối (id + khoá 32 byte) **suy ra từ `pair_secret`** bằng SHA-512 của `haitraitim-pair-v4|<khoá>`; khoá này chỉ hai hàng hồ sơ của hai bạn đọc được (RLS), nên không ai khác vào phòng được. Ứng dụng **không** dùng `state.relay` cũ để mở phòng, chỉ ghi lại phòng đã xác nhận cho phần “giữ kết nối khi tắt màn hình”.
- Vào phòng là **mỗi máy vừa gửi dữ liệu của mình vừa nhận dữ liệu của người thương**, cả hai đều hiện “Đã ghép nối với …” và chip trạng thái trên đầu app. Không phải quét hai lần, không phải làm lại ở bên nào.
- Kênh truyền là MQTT 3.1.1 qua WebSocket tới **năm trạm công cộng miễn phí nối SONG SONG** (EMQX 8084, EMQX châu Á 8084, Eclipse 443, HiveMQ 8884, Mosquitto 8081): trạm nào vào được thì dùng ngay, trạm chết không làm chậm trạm khác. Bản tin đi trên mọi trạm đang sẵn sàng và **chống trùng theo mã bản tin**, nên hai máy chỉ cần **một** trạm chung. Dữ liệu chỉ được gửi **sau khi trạm xác nhận đăng ký phòng (SUBACK)** — gửi sớm hơn là mất tin. Nhịp giữ kết nối 10 giây và **chào nhau tức thì**: vừa thấy máy kia vào phòng là hai bên gửi dữ liệu ngay.
- Trong màn hình Ghép nối có **“Chi tiết kết nối”**: từng trạm báo gì (sẵn sàng / quá 12 giây chưa mở được / bị từ chối mã mấy), nhật ký 6 dòng gần nhất và nút **Thử kết nối lại**. Cài đặt hiện **số phiên bản + bản dựng** để biết chắc máy đang chạy bản nào. Nội dung **luôn được mã hóa đầu-cuối** bằng NaCl secretbox (nonce 24 byte ngẫu nhiên mỗi gói), trạm chỉ thấy chuỗi đã mã hóa. Ai không biết mã 6 số thì không đọc được; nếu muốn riêng tư hơn, hãy dùng mục **Cách khác → Tạo mã QR** (khóa ngẫu nhiên 32 byte, dài hơn nên khó đoán hơn mã 6 số).
- Mỗi gói chỉ chứa **dữ liệu của chính máy gửi** (tên, cảm xúc, chu kỳ, kỷ niệm mình viết, lời nhắc) nên hai máy không gửi trả lại dữ liệu của nhau và không lặp vô tận; gói quá lớn thì cắt bớt khoảnh khắc, lời nhắc, tin nhắn rồi mới rút ngắn chữ trong nhật ký — **nhật ký không bao giờ bị bỏ khỏi gói**. **Ảnh Khoảnh khắc có đi qua kênh này** từ 1.6.0: ảnh được nén còn khoảng 100 KB rồi cắt thành gói 3.500 ký tự, máy kia ghép lại và lưu thành `moment-<mã>.jpg`; máy nào thiếu ảnh thì tự gửi lời xin gửi lại.
- **Không dùng `TextEncoder`/`TextDecoder` hay `crypto.getRandomValues`** (React Native không cấp): phần chuyển chữ ↔ byte được tự viết trong `relayProtocol.mjs` (đối chiếu từng byte với chuẩn UTF-8 của Node trong `tests/relay.test.mjs`, có bài chạy khi đã xóa hai lớp đó) và nguồn ngẫu nhiên an toàn lấy từ `expo-crypto` qua `installRandomBytes`. Mọi lỗi JavaScript được ghi vào **“Lỗi gần nhất”** trong Cài đặt thay vì làm văng app.
- Giới hạn thật: cần Internet ở **cả hai** máy; dữ liệu mới chỉ sang nhau khi hai bên cùng mở app (một bên đóng app thì lần mở sau gửi bù); muốn ghép nối phải **đăng nhập tài khoản** (Google/Facebook hoặc Anonymous nếu bạn bật trong dự án) và **Ngắt kết nối** nằm trong Cài đặt khi cần đổi người thương.

### Có gì mới ở 1.18.4 — sửa lỗi cuộc gọi tự ngắt sau 3–5 giây (gói `ring` lặp tự bắn `reject`) & tối ưu TURN riêng `couple-love.metered.live`

**Tải APK 1.18.4 (Android 7.0+, API 24):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-v1.18.4-test-6dee560/MatMaYeu-1.18.4.apk · 78.690.297 byte. **Bản nhẹ (chỉ arm64-v8a):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-v1.18.4-test-6dee560/MatMaYeu-1.18.4-arm64.apk · 56.294.046 byte. **iOS (.ipa chưa ký):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-ios-v1.18.4-test-6dee560/MatMaYeu-1.18.4-unsigned.ipa · 17.186.801 byte. Trong app mở **Cài đặt**, dòng cuối phải là **Mật Mã Yêu 1.18.4, bản dựng 24**. Bản này dựng từ `6dee560eec1dfcbc941e5ca7f52e5d52b9ca067e` (APK build `38678252483`, iOS build `38678252474`).

- **Chặn gói `ring` gửi nhắc sau 350ms tự bắn `reject` (`App.tsx`):** Trước đây `startCall()` gửi nhắc gói `ring` sau `350ms` với mã `mid` mới; máy nhận đã mở màn hình chuông ở gói `ring` đầu nên khi gói `ring` thứ 2 tới thì tưởng đang bận và tự gửi `reject` ngược về máy gọi (khiến máy gọi thoát ngay với *"Cuộc gọi nhỡ · người thương đang bận"*, còn máy nghe bấm bắt máy một mình rồi tự ngắt sau 3–5 giây *"Cuộc gọi đến · 00:05"*). Nay gói `ring` cùng `callId` được bỏ qua ngay và mọi tín hiệu `accept`/`rtc`/`audio` đều làm mới nhịp sống `alive`.
- **Ưu tiên cụm TURN riêng `couple-love.metered.live` (`primaryIceServers`):** Không mở 2 `RTCPeerConnection` chồng nhau và không chờ các máy chủ TURN công cộng miễn phí đã quá tải.

### Có gì mới ở 1.18.3 (bản trước) — sửa cuộc gọi trực tiếp WebRTC + TURN riêng (`couple-love.metered.live`) trên LDPlayer

**Tải APK 1.18.3 (Android 7.0+, API 24):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-v1.18.3-test-b19b6bf/MatMaYeu-1.18.3.apk · 78.688.409 byte. **Bản nhẹ (chỉ arm64-v8a):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-v1.18.3-test-b19b6bf/MatMaYeu-1.18.3-arm64.apk · 56.292.158 byte. **iOS (.ipa chưa ký):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-ios-v1.18.3-test-b19b6bf/MatMaYeu-1.18.3-unsigned.ipa · 17.184.234 byte. Trong app mở **Cài đặt**, dòng cuối phải là **Mật Mã Yêu 1.18.3, bản dựng 23**. Bản này dựng từ `b19b6bf3a07735c77168cc8bb1ea82c05504b4b4` (APK build `38673090771`, iOS build `38673090772`).

- **Gỡ khoá chết `await this.ready` trong `src/services/rtcCall.ts`:** Trước đây `this.ready = this.setup()` chờ hết 2,5 giây `peerStage()` mới xong, trong khi `handle(message)` lại `await this.ready` ở dòng đầu nên mọi tín hiệu `pid`/`offer`/`answer`/`ice` đến sớm bị chặn đứng. Nay tách `this.micReady`, mở thẳng `nativeStage` (WebRTC + TURN `couple-love.metered.live`) ngay từ giây 0 và xử lý tín hiệu tuần tự qua `this.signalChain`.
- **Lọc bỏ địa chỉ ảo `10.0.2.15 typ host` của LDPlayer & tự ép qua TURN (`relay`):** Hai máy ảo LDPlayer đều mang IP nội bộ `10.0.2.15`; nếu để nguyên địa chỉ `typ host` này thì WebRTC tự bắn gói STUN vào chính mình thay vì đi qua máy chủ TURN `couple-love.metered.live`. Bản 1.18.3 lọc bỏ `10.0.2.x typ host` và tự chuyển sang vòng 2 (`iceTransportPolicy: "relay"`) nếu đợt 1 bị NAT chặn.
- **Tự gửi lại `offer` / `answer` / `accept` & giữ kết nối kể cả khi 1 máy ảo thiếu micro.**

### Có gì mới ở 1.18.2 (bản trước) — khôi phục đủ 5 tab + Theme, đăng nhập tài khoản trong app, mã cố định hai chiều không kẹt SQL

**Tải APK 1.18.2 (Android 7.0+, API 24):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-v1.18.2-test-56303e4/MatMaYeu-1.18.2.apk · 78.685.217 byte. **Bản nhẹ (chỉ arm64-v8a):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-v1.18.2-test-56303e4/MatMaYeu-1.18.2-arm64.apk · 56.288.966 byte. **iOS (.ipa chưa ký):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-ios-v1.18.2-test-56303e4/MatMaYeu-1.18.2-unsigned.ipa · 17.182.615 byte. Trong app mở **Cài đặt**, dòng cuối phải là **Mật Mã Yêu 1.18.2, bản dựng 22**. Bản này dựng từ `56303e4cdca4cc3f51c026cf4f0d9636c95824af` (APK build `38669023110`, iOS build `38669022958`).

- **Khôi phục đầy đủ 5 tab dưới đáy (`Yêu nhau`, `Tin nhắn`, `Chăm sóc`, `Nhật ký`, `Cài đặt`), Chủ đề (Theme) và Ảnh nền:** bỏ việc tự đẩy sang `CloudApp` 1.0 cũ và bỏ màn chắn toàn màn hình trước `LocalShell`. Nút **🔗 Ghép nối** nằm ngay trên thanh đầu trang; khi chưa ghép nối thì app chỉ khoá mở phòng mạng (chống kết nối ảo), mọi tính năng trong máy dùng bình thường.
- **Đăng nhập / Đăng ký tài khoản ngay trong app:** nhập **Tên tài khoản hoặc Email + Mật khẩu** trực tiếp trong màn Ghép nối (không cần mở trình duyệt Google trên LDPlayer), hoặc bấm **Dùng ngay trên máy này** để có mã cố định tức thì.
- **Kết nối hai chiều bằng mã cố định 6 ký tự không còn kẹt khi chưa chạy SQL:** tự suy mã 6 ký tự cố định từ tài khoản (`shortCodeFromUid`) và khoá phòng đối xứng (`pairSecretFromCodes`) + kênh lời mời trực tiếp (`inviteSecretForCode` / `pair.invite` / `pair.unpair`), nên một bên nhập mã của bên kia là cả hai máy tự vào chung phòng ngay cả khi máy chủ Supabase chưa chạy `002_pairing.sql`.
- **Sửa bộ lọc gói tin `RelayClient.handle`:** cho phép đầy đủ `typing`, `reaction`, `unsend`, `profile`, `read`, `chatAck`, `pair.invite`, `pair.unpair`.

**141/141 bài kiểm thử xanh**, `tsc` sạch, Prettier sạch. **Chưa thử trên LDPlayer của bạn nên chưa dám nói là đã hết lỗi** — hãy cài đè lên 1.18.1 (không gỡ app), rồi kiểm tra Cài đặt hiện đúng “1.18.2, bản dựng 22”.

### Có gì mới ở 1.18.1 (bản trước) — bản sạch mã nguồn (không thêm tính năng)

**Tải APK 1.18.1 (Android 7.0+, API 24):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-v1.18.1-test-e6d5cb6/MatMaYeu-1.18.1.apk · 78.669.445 byte. **Bản nhẹ (chỉ arm64-v8a):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-v1.18.1-test-e6d5cb6/MatMaYeu-1.18.1-arm64.apk · 56.273.194 byte. **iOS (.ipa chưa ký):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-ios-v1.18.1-test-e6d5cb6/MatMaYeu-1.18.1-unsigned.ipa · 17.170.132 byte. Trong app mở **Cài đặt**, dòng cuối phải là **Mật Mã Yêu 1.18.1, bản dựng 21**. Bản này dựng từ `e6d5cb60c023f47e772949c080be916bf9788102` (APK build `38660107385`, iOS build `38660107403`).

Bản 1.18.1 **giữ nguyên hành vi của 1.18.0**, chỉ dọn lại mã nguồn:

- **Xoá code chết:** `createRoom`, `makeCode`, `roomFromCode`, `roomToQr`, `roomFromQr`, `codePattern` (giao thức mã 6 số/QR cũ), `roomFromState` (đường dựng phòng từ bộ nhớ máy — nguồn của “kết nối ảo”), `lastMessageTimes`, `callStatusText`, `isCallPhase`, `PHASES`, `sameDay`, `randomBytesProblem`, `relayServiceNotificationId`, `getCurrentUser`, kiểu `RelayStatus`; xoá tệp `src/screens/local/MoodLocal.tsx` (125 dòng, không còn đường tới).
- **Bỏ gói thừa:** `aedes-server-factory` (npm gỡ theo 5 gói phụ thuộc). Các gói trông “không được import” nhưng **phải giữ**: `nativewind`, `tailwindcss`, `babel-preset-expo`, `react-native-worklets` (cấu hình babel/metro), `expo-system-ui`, `expo-asset` + `expo-splash-screen` (plugin), `react-native-svg` (gói ngang hàng của `react-native-qrcode-svg`).
- **Tách tệp dài:** `App.tsx` 3589 → **3184** dòng (`src/screens/CloudApp.tsx` 359 dòng, `src/screens/ModeChooser.tsx` 53 dòng, `src/components/LockScreen.tsx` 30 dòng); `src/screens/local/ChatLocal.tsx` 1728 → **1217** dòng (`src/components/MessageRow.tsx` 451 dòng kèm `VoiceBubble`, `src/components/SwipeRow.tsx` 64 dòng); `src/services/relayProtocol.mjs` 876 → **799** dòng.
- **Vòng đời:** mọi `setInterval` / `addEventListener` / kênh realtime đều có hàm dọn trong cùng `useEffect`; thêm `clearTimeout` cho hẹn “đã đọc” trong `ChatLocal`. Bước kiểm tra trong CI bắt buộc mỗi `setInterval` phải có `clearInterval`.
- **Nói thẳng về dung lượng:** bundle JS chỉ giảm **1.526 byte**, APK giảm **752 byte** — code chết vốn đã bị tree-shake nên đây **không phải** bản “nhẹ hơn” đáng kể. Lợi ích thật: mã dễ đọc/sửa, hết rò rỉ hẹn giờ, kiểm thử bám đúng tệp mới.
- **CI tự đọc phiên bản:** workflow APK lấy số phiên bản từ `app.config.js` để đặt tên tệp và tag Release, lần sau tăng bản chỉ sửa một chỗ.

**140/140 bài kiểm thử xanh**, `tsc` sạch, Prettier sạch, `expo export` chạy được. **Chưa thử trên LDPlayer của bạn nên chưa dám nói là đã hết lỗi** — hãy cài đè lên 1.18.0 (không gỡ app), rồi kiểm tra Cài đặt hiện đúng “1.18.1, bản dựng 21”.

### Có gì mới ở 1.18.0 (bản trước) — ghép nối theo tài khoản, hết “kết nối ảo”

**Tải APK 1.18.0 (Android 7.0+, API 24):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-v1.18.0-test-d313f4b/MatMaYeu-1.18.0.apk · 78.670.197 byte. **Bản nhẹ (chỉ arm64-v8a):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-v1.18.0-test-d313f4b/MatMaYeu-1.18.0-arm64.apk · 56.273.946 byte. **iOS (.ipa chưa ký):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-ios-v1.18.0-test-d313f4b/MatMaYeu-1.18.0-unsigned.ipa · 17.170.425 byte. Trong app mở **Cài đặt**, dòng cuối phải là **Mật Mã Yêu 1.18.0, bản dựng 20**. Bản này dựng từ `d313f4b1488d63b8fd997c97056656506360f910`.

- **Bỏ hẳn mã 6 số ngẫu nhiên.** `supabase/migrations/002_pairing.sql` thêm `short_code` (mã cố định, sinh từ `uid`, chống trùng), `partner_id`, `pair_secret`, `paired_at` và các hàm `ensure_profile()` / `pair_with_code(code)` / `unpair()` / `save_profile(name, avatar)`. RLS chỉ cho mỗi người đọc **hồ sơ của mình và của đúng người thương** (`partner_id`), nên không ai dò được người lạ.
- **Đọc lại máy chủ ở mỗi lần mở app:** `src/services/account.ts` gọi `ensure_profile()` lúc khởi động; `src/logic/pairing.mjs` (`pairGate`) quyết định màn hình — chưa đăng nhập → màn đăng nhập; chưa có `partner_id` → **màn nhập mã**; mất mạng khi chưa kiểm tra được → vẫn chặn (không kết nối mù). Chỉ khi máy chủ xác nhận có đôi thì phòng mới được dựng: `roomFromPair(pair_secret)` trong `relayProtocol.mjs`, còn `App.tsx` **bỏ hẳn đường dựng phòng từ `state.relay`** nên không còn “kết nối ảo” khi khôi phục sao lưu.
- **Đăng nhập Google/Facebook:** `signInWithOAuth` + `expo-web-browser` với deep link `haitraitim://auth-callback`, đổi mã PKCE bằng `exchangeCodeForSession`; có thêm nút **Đăng nhập nhanh** (Anonymous Sign-Ins) cho ai muốn thử ngay. Tên/ảnh đại diện đổi trong app được lưu lên Supabase (`save_profile`, tải ảnh vào bucket `avatars/<uid>/avatar.jpg`).
- **“Ngắt kết nối (cả hai máy)”** trong Cài đặt và ở màn ghép nối: `unpair()` xoá `partner_id` của cả hai bên; app theo dõi hàng hồ sơ bằng realtime `postgres_changes` và hỏi lại mỗi 20 giây, nên máy kia tự về màn nhập mã. Dữ liệu đã viết trong máy **không** bị xoá (`pairing.clear` chỉ xoá dấu ghép nối).
- **Chat (Bước 2):** nút “↓ mới nhất” dùng `onScroll` với `contentOffset` / `contentSize` / `layoutMeasurement` — ẩn khi ở cuối, hiện khi cuộn lên quá 140 px, danh sách ngắn hơn khung thì không hiện; **xoá hẳn nhãn “↩ trả lời”** ngoài bong bóng (trả lời bằng nhấn giữ hoặc vuốt ngang).
- **Kiểm thử:** `tests/round18.test.mjs` (20 bài) phủ chốt cổng ghép nối, phòng suy ra từ `pair_secret`, hàm SQL, việc lưu tên/ảnh, nút Ngắt kết nối và hai sửa đổi giao diện chat — tổng **140 bài xanh**; `tsc`, Prettier và `expo export` đều sạch.

### Có gì mới ở 1.17.0 — gói tin nhắn đúng chuẩn, tim 3D đập theo giọng, TURN riêng cho 4G

**Tải APK 1.17.0 (Android 7.0+, API 24):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-v1.17.0-test-068e170/MatMaYeu-1.17.0.apk · 78.566.174 byte (kèm `MatMaYeu-1.17.0.apk.sha256` trong Assets). **Bản nhẹ (chỉ arm64-v8a):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-v1.17.0-test-068e170/MatMaYeu-1.17.0-arm64.apk · 56.169.923 byte. **iOS (.ipa chưa ký):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/mat-ma-yeu-ios-v1.17.0-test-82e33ac/MatMaYeu-1.17.0-unsigned.ipa · 17.134.185 byte. Trong app, mở **Cài đặt** xem dòng cuối: phải là **Mật Mã Yêu 1.17.0, bản dựng 19**. Bản này dựng từ `068e170`.

- **Gói tin nhắn có tên chuẩn:** `reaction` (`{type, messageId, emotion}`), `unsend` (`{type, messageId}`), `typing` (`{type, state}`), `read` (`{type, lastMessageId}`), `profile` (hồ sơ + ảnh đại diện). App **gửi kèm** dạng cũ (`chatReact` / `chatRecall` / `chatRead`) và **đọc được cả hai** dạng, nên một máy 1.16 nhắn với một máy 1.17 vẫn hiện tim, thu hồi, đã xem đầy đủ. Gói “đang gõ” chỉ bắn một lần mỗi 1,2 giây và máy nhận tắt chấm sau 3 giây (không bao giờ kẹt chữ “đang nhập…”).
- **Ảnh đại diện sang máy kia ngay:** `App.tsx` theo dõi `state.me.avatar`, khác tên tệp là bắn `{type:"profile"}` rồi gửi kèm gói ảnh vai `avatar` (`AVATAR_LIMIT_BYTES` 120 KB) qua `sendAvatarFile()`; máy nhận `writeBase64` + `partner.avatar` nên giao diện đổi trong tích tắc. Thiếu tệp thì xin lại (chờ 20 giây mới xin lại lần nữa).
- **Vuốt trả lời bằng `react-native-gesture-handler` 2.28 + `react-native-reanimated` 4.1:** `SwipeRow` trong `ChatLocal.tsx` dùng `Gesture.Pan()` với `activeOffsetX(14)` / `failOffsetY([-14, 14])`, `useSharedValue` + `useAnimatedStyle` (chuyển động trên luồng UI), ngưỡng trả lời 56 px; gốc app bọc `GestureHandlerRootView`.
- **Trái tim 3D WebGL đập theo giọng nói:** `ThreeHeart` nhận thêm `level` (0..1) và `interactive` (màn hình gọi không nuốt thao tác chạm); `useFrame` làm mượt mức tiếng rồi cộng tối đa **+30%** vào `scale` của trái tim. `rtcCall.ts` đọc `audioLevel` thật của track WebRTC mỗi 0,5 giây, thiếu số liệu thì ước lượng theo byte tiếng; `App.tsx` truyền cờ `reduced` (theo `AccessibilityInfo.isReduceMotionEnabled`) để máy yếu dùng tim vẽ sẵn.
- **TURN riêng + chống rớt 4G:** `RTC_TURN_SERVERS` mở đầu bằng máy chủ riêng của bạn (`turn:couple-love.metered.live:80`, `:443`, `:443?transport=tcp`) rồi mới tới PeerJS/Open Relay, `iceCandidatePoolSize: 6`, và khi `connectionState`/`iceConnectionState` là `disconnected` thì app gọi `restartIce()` **trước khi** lùi về kênh ghép nối. Vẫn đổi được sang TURN khác bằng `EXPO_PUBLIC_TURN_URLS/USER/CREDENTIAL` rồi dựng lại APK.
- **Kiểm thử:** `tests/round17.test.mjs` (9 bài) phủ TURN riêng + thứ tự ưu tiên, ICE restart, tên gói tin mới/cũ ở cả hai chiều, đẩy ảnh đại diện tức thì, gesture-handler/reanimated trong cử chỉ vuốt, `level` của trái tim 3D, nút điều khiển cuộc gọi và việc đổi tên sạch — tổng **120 bài xanh**.

### Có gì mới ở 1.16.0 — nhắn tin như Messenger/Zalo, hết lỗi chọn ảnh, tim đập theo giọng nói

**Tải APK 1.16.0 (Android 7.0+, API 24):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.16.0-test-270c362/HaiTraiTim-1.16.0.apk · 77.974.318 byte (kèm `HaiTraiTim-1.16.0.apk.sha256` trong Assets). **Bản nhẹ (chỉ arm64-v8a):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.16.0-test-270c362/HaiTraiTim-1.16.0-arm64.apk · 55.660.069 byte. **iOS (.ipa chưa ký):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-ios-v1.16.0-test-270c362/HaiTraiTim-1.16.0-unsigned.ipa · 16.978.710 byte. Trong app, mở **Cài đặt** xem dòng cuối: phải là **Mật Mã Yêu 1.16.0, bản dựng 18**. Bản này dựng từ `270c362`.

- **Hết lỗi “unregistered ActivityResultLauncher” khi gửi/chụp ảnh.** Đây là lỗi của thư viện chọn ảnh hệ thống: khi Android **dựng lại Activity** vì một thay đổi cấu hình không được khai báo (cỡ chữ, ngôn ngữ, mật độ màn hình, máy ảo thu hồi bộ nhớ), bộ đăng ký launcher bị xoá mà thư viện không đăng ký lại, nên mọi lần mở sau đó đều lỗi cho tới khi khởi động lại tiến trình. Cách sửa: `plugins/with-android-activity-config.js` khai `configChanges` cho `MainActivity` (`mcc, mnc, locale, layoutDirection, fontScale, density, touchscreen, keyboard, keyboardHidden, navigation, orientation, screenLayout, screenSize, smallestScreenSize, uiMode, colorMode`) để **hệ thống không dựng lại Activity**, và **bỏ hẳn hộp chọn ảnh hệ thống khỏi luồng chat**: `src/components/PhotoPicker.tsx` mở **lưới ảnh trong thư viện** (`expo-media-library`, phân trang 60 ảnh, quyền chi tiết cho Android 13+) và **máy ảnh trong app** (`expo-camera`, `takePictureAsync`), ảnh trả về là `file://` nên gửi thẳng qua kênh ghép nối. Nếu máy đã dính lỗi từ bản trước thì mở lại app một lần là sạch.
- **Thu hồi tin nhắn xoá cả hai bên.** `localState.mjs` thêm kind `recalled` + `recalledAt` và action `message.recall`; `relayProtocol.mjs` mang cờ `recalled` trong danh sách tin nhắn gửi đi, nên mọi lần đẩy dữ liệu sau đó máy kia vẫn nhận được dấu thu hồi kể cả khi khung báo tức thời bị mất. Thu hồi là **xoá ruột tin** (chữ, ảnh, tiếng, vị trí về rỗng) rồi đổi kind thành `recalled`, nên mở lại sau này cũng không hiện lại nội dung; hai bên đều thấy dòng “Bạn/Người thương đã thu hồi một tin nhắn”. Khác hẳn **Xoá trên máy này** (chỉ xoá cục bộ).
- **Thả cảm xúc, trả lời, tin thoại, đang nhập, đã xem.** `src/logic/chatExtras.mjs` (thuần, có test) giữ `REACTIONS`, `setReact`, `recallMessage`, `replyPreview`, và các hàm mức tiếng. Cảm xúc đi bằng khung `chatReact`, trả lời đi kèm `reply`, tin thoại ghi bằng `expo-audio` rồi gửi như tin nhắn có `audio` + `durationMs`, “đang nhập” đi bằng `{kind:"typing", state:true}` (gửi khi ngừng gõ 1,2 giây, máy nhận tự tắt sau 3 giây), “đã xem” đi bằng `{kind:"chatRead", ids}` — tin cuối mình đã xem hiện **ảnh đại diện nhỏ của người thương** cạnh tin đó, giống Messenger.
- **Thanh nhập liệu dạng viên thuốc và bớt rối mắt.** `ChatLocal.tsx` viết lại: thanh chat **cố định** ở đáy, ba phần `[+] · [TextInput] · [mic ⇄ Gửi]`, cách mép dưới một chút, bo tròn và đổ bóng; nhấn `+` mở bảng nhỏ (ảnh, chụp, vị trí, sticker, emoji); hàng thao tác dài và khối chú thích bị bỏ; mỗi dòng tin được `memo` hoá và hàm cập nhật được giữ ổn định nên **gõ chữ không làm cả danh sách vẽ lại**.
- **Đè vào tin nhắn/ảnh** (giữ khoảng 0,4 giây) mở bảng: hàng cảm xúc ❤️😂😮😢😡👍 và các nút **Trả lời**, **Thu hồi (xoá cả hai bên)** (chỉ tin của mình), **Lưu ảnh về máy** (tin có ảnh; `saveToLibraryAsync`, máy thiếu quyền thì mở bảng chia sẻ), **Xoá trên máy này**.
- **Ảnh đại diện tự sang máy kia:** gói dữ liệu mang `from.avatar` (tên tệp), máy nhận thấy tên lạ thì `writeBase64` và đặt `partner.avatar`; thiếu tệp thì tự `photoRequest` xin gửi lại — gói ảnh có thêm vai `role:"avatar"` với hạn mức riêng 120 KB.
- **Cuộc gọi:** `rtcCall.ts` báo thêm `level` (mức tiếng 0..1) trong `onStats` mỗi 0,5 giây, lấy từ chỉ số `audioLevel` của track WebRTC nếu máy báo, không thì ước lượng theo byte tiếng đi ra/vào; `CallLocal.tsx` cho trái tim **đập theo mức tiếng** (1 → 1,34 lần, `Animated` với native driver) và đưa **nút Cúp máy đỏ to** + **nút tắt mic** trắng/xám xuống nửa dưới màn hình.
- **Thông báo:** thêm nhóm `tin-nhan` (`Notifications.setNotificationCategoryAsync`) với nút **Trả lời** (nhập thẳng trên thông báo) và **Đã xem**; `notifyNow` gắn `data.open = "chat"` nên bấm là **vào thẳng đoạn chat**. Công tắc **Giữ kết nối khi tắt màn hình** trong Cài đặt bật dịch vụ chạy nổi `dataSync` (`src/services/relayService.ts`) để kênh ghép nối không bị hệ thống đóng khi tắt màn hình; nói rõ giới hạn: nếu người dùng **Buộc dừng** app thì không cách nào nhận tin nữa (muốn thế phải có máy chủ đẩy FCM).
- **Kiểm thử:** `tests/round16.test.mjs` (20 bài) phủ cảm xúc, thu hồi, trả lời, mức tiếng, `configChanges`, PhotoPicker và các khung tin nhắn mới — tổng **111 bài xanh**; thêm `scripts/check-workflows.mjs` (chạy trong `npm run check`) để bắt lỗi cú pháp bash/heredoc trong `.github/workflows` trước khi đẩy lên.

### Có gì mới ở 1.15.0 — cuộc gọi qua NAT khó nhờ TURN dự phòng, giữ cuộc gọi khi tắt màn hình

**Tải APK 1.15.0 (Android 7.0+, API 24):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.15.0-test-91bf7bd/HaiTraiTim-1.15.0.apk · 77.814.316 byte (kèm `HaiTraiTim-1.15.0.apk.sha256` trong Assets). **Bản nhẹ (chỉ arm64-v8a):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.15.0-test-91bf7bd/HaiTraiTim-1.15.0-arm64.apk · 55.500.067 byte. **iOS (.ipa chưa ký):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-ios-v1.15.0-test-91bf7bd/HaiTraiTim-1.15.0-unsigned.ipa · 16.815.744 byte. Trong app, mở **Cài đặt** xem dòng cuối: phải là **1.15.0, bản dựng 17**. Bản này dựng từ `91bf7bd`.

- **Đường tiếng ba lớp, thêm TURN dự phòng:** lớp 1 là **PeerJS 1.5.5** (`peerjs` + shim `shims/webrtc-adapter.js`, `metro.config.js`) nối vào trạm trung chuyển công khai `0.peerjs.com` với TURN miễn phí của PeerJS; quá `RTC_PEER_MS` (2,5 giây) không lên thì `stopPeer()` và chuyển sang lớp 2 — **WebRTC thuần** với `offer`/`answer`/`ICE` đi qua kênh ghép nối; vẫn không lên thì lớp 3 — **tiếng qua kênh ghép nối**. `rtcSignal.mjs` thêm `RTC_TURN_SERVERS` (TURN của PeerJS + **Open Relay của Metered** `openrelay.metered.ca` cổng 80, 443 và `?transport=tcp`) và `ICE_POLICY = "all"` để **ưu tiên P2P** rồi mới tới TURN. Muốn TURN riêng: `EXPO_PUBLIC_TURN_URLS` / `_USER` / `_CREDENTIAL` rồi dựng lại APK. TURN miễn phí là tài nguyên công cộng, có lúc bận — app vẫn còn hai lớp sau để không mất cuộc gọi.
- **Giữ cuộc gọi khi tắt màn hình:** `src/services/callService.ts` dùng **Notifee 9.1.8** dựng **dịch vụ chạy nổi** kênh `cuoc-goi` với thông báo thường trực “Cuộc gọi đang diễn ra…”, nút **Cúp máy** (`cup-may`) và phần thân thông báo mở app; plugin `plugins/with-call-foreground-service.js` mở rộng dịch vụ `app.notifee.core.ForegroundService` thành `foregroundServiceType="microphone"` (`tools:replace`), quyền `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE`, `WAKE_LOCK` khai trong `app.config.js`. iOS thêm `UIBackgroundModes: [audio, voip]`; phiên âm thanh đặt `shouldPlayInBackground: true` và mặt `call.phase === "active"` được áp lại mỗi 3 giây để không bị đổi tuyến ra loa ngoài/loa tai giữa cuộc.
- **Kiểm thử:** `tests/round15.test.mjs` (13 bài) phủ TURN/ICE, thứ tự ba lớp và dịch vụ chạy nổi — tổng **91 bài xanh**, TypeScript sạch, `expo export` và `expo prebuild` đều đã chạy.

### Có gì mới ở 1.14.0 — cuộc gọi tiếng trực tiếp WebRTC, trái tim ở giữa có vũ trụ quay quanh

**Tải APK 1.14.0 (Android 7.0+, API 24):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.14.0-test-a352b9f/HaiTraiTim-1.14.0.apk · 77.339.423 byte. **iOS (.ipa chưa ký):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-ios-v1.14.0-test-a352b9f/HaiTraiTim-1.14.0-unsigned.ipa · 16.671.745 byte.

- **Cuộc gọi dùng WebRTC thật** (`src/services/rtcCall.ts` + `src/logic/rtcSignal.mjs`): `RTCPeerConnection` lấy micro bằng `getUserMedia`, thêm track rồi mời máy kia (`offer`/`answer`/`ICE`). Tín hiệu đi qua **kênh ghép nối sẵn có** (không cần máy chủ riêng), máy chủ **STUN công khai** chỉ giúp hai máy biết địa chỉ của nhau. Khi `connectionState` là `connected`/`completed` thì tiếng đi trực tiếp (RTP/Opus, 20 ms/gói) với **khử vọng và chống ồn của chính WebRTC** — vì vậy không phải tạm ngừng micro khi loa đang phát như cách cũ.
- **Tự quay về khi không nối được:** hết `RTC_TRY_MS` (4 giây) mà chưa `live`, hoặc `getUserMedia` lỗi, hoặc máy không nạp được thư viện native (`require("react-native-webrtc")` nằm trong `try/catch`), app chuyển về đường tiếng cũ qua kênh ghép nối (`rtcFallback`). Mất kết nối giữa cuộc (`failed`) cũng quay về ngay, và nếu nối lại được thì tự chuyển lại sang tiếng trực tiếp.
- **Chỉ một đường tiếng dùng micro tại một thời điểm:** vòng ghi âm từng mảnh chỉ chạy khi `rtcFallback` bật; nối trực tiếp rồi thì `rtcLive` tắt hẳn vòng ghi âm và hàng đợi phát. Nút mic chuyển thẳng thành `track.enabled` của WebRTC.
- **Nhịp sống không còn cắt oan cuộc gọi:** khi `rtcLive`, app không kết thúc cuộc gọi vì thiếu gói `alive` trên kênh ghép nối nữa — WebRTC cho biết máy kia còn sống qua chính luồng tiếng.
- **Bỏ hình cầu, trái tim ở chính giữa:** `HomeLocal.tsx` chỉ còn `<ThreeHeart reduced={reduced} height={330} />`; `ThreeHeart.tsx` có `ORBITS` (ba quỹ đạo nghiêng), `Orbit` (mỗi quỹ đạo mang 4–7 trái tim nhỏ), `useStars` (130 ngôi sao), quầng tinh vân `AdditiveBlending`. Tệp `LoveBridgeArt.tsx` đã xoá hẳn; cả app vẫn chỉ **một** vùng WebGL nên LDPlayer không đơ.
- **Quyền và cấu hình:** `app.config.js` thêm `MODIFY_AUDIO_SETTINGS`, `ACCESS_NETWORK_STATE`, `CHANGE_NETWORK_STATE` cho WebRTC và `NSLocalNetworkUsageDescription` cho iOS; `react-native-webrtc` ghim đúng `124.0.8`.

### Có gì mới ở 1.13.0 — nói chuyện liền mạch hơn, một máy tắt là máy kia tự tắt, cầu tình yêu vẽ theo tranh

**Tải APK 1.13.0 (Android 7.0+, API 24):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.13.0-test-d16a04c/HaiTraiTim-1.13.0.apk · 58.937.849 byte · SHA256 `1733207396ba849cb4d363ff392f8a21c2cd694eb8ad8875328ca0ad5fe7eda6`. **Bản nhẹ (chỉ arm64-v8a):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.13.0-test-d16a04c/HaiTraiTim-1.13.0-arm64.apk · 43.308.364 byte · SHA256 `743f9cc0a6cda9e4081ab67087f278c649e5e8bb2e16758c324ad7b756a3fa5c`. **iOS (.ipa chưa ký):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-ios-v1.13.0-test-cc33e5c/HaiTraiTim-1.13.0-unsigned.ipa · 11.647.809 byte · SHA256 `588c3cbca2cd39e1b0a165e1bc38a4c32c44e9645d7faad6a386aeb6cee82c15`. Trong app, mở **Cài đặt** xem dòng cuối: phải là **1.13.0, bản dựng 15**.

- **Cuộc gọi mượt hơn:** `src/logic/callAudio.mjs` đổi `CALL_FRAME_MS` 900 (mảnh 0,9 giây), `CALL_QUEUE_MAX` 8, `CALL_PLAY_GAP_MS` 40, thêm `CALL_PREBUFFER 2`; `CallLocal.tsx` đặt `PLAY_TICK_MS` 90 và **không phát mảnh đầu khi hàng đợi còn dưới 2 mảnh**. Ghi âm **bỏ qua khi loa đang phát** (`callPlayingRef` do `CallLocal` cập nhật) nên micro không thu lại tiếng loa → hết vọng và hết đứt quãng. Bản ghi xoay vòng 6 tệp `callout-…-<seq %% 6>.m4a`, mỗi gói tối đa 160 KB base64, gửi đi **không `await`**.
- **Một máy kết thúc là máy kia tự kết thúc:** `callLogic.mjs` thêm `CALL_ALIVE_MS` 1500, `CALL_SILENT_END_MS` 5000, `callTimedOut()`, trường `lastSeen`. Bên đang gọi gửi `event: "alive"` mỗi 1,5 giây; máy kia quá 5 giây không thấy nhịp thì áp `{type: "lost"}` và kết thúc với lý do **“Người thương đã kết thúc cuộc gọi”**. Gói `hangup`/`reject` được gửi lại sau 250 ms và 500 ms để bù gói bị mất.
- **Cầu tình yêu là tranh vector theo ảnh bạn gửi:** `src/components/LoveBridgeArt.tsx` (thuần `react-native-svg`, W=360 H=230) vẽ vòm cầu bằng **19 con chim Ô Thước**, trăng tròn có `moonGlow` (RadialGradient), `WaveOrnament` hoa văn sóng bốn góc, `Cloud`, cánh hoa bay; cô dâu áo hồng (`dressPink` LinearGradient, tà áo bay, tóc búi, hoa cài, khăn quàng đỏ) và chú rể áo lam (`robeBlue`). Chỉ một `Animated.View` nhún nhẹ `translateY 0 → -6` trong 3,2 giây. `LoveBridge.tsx` (mô hình 3D cũ) đã xoá, `ThreeHeart` bỏ `BridgeGroup`/`withBridge` — cả màn hình chỉ còn **một** vùng WebGL.
- **Bỏ tab Cảm xúc** ở chế độ trên máy: `localTabs` không còn `mood`, `App.tsx` không còn nhánh `MoodLocal`.

### Có gì mới ở 1.12.0 — hết đơ màn hình, mở được Tin nhắn, cầu tình yêu 3D ăn khớp chủ đề

**Tải APK 1.12.0 (Android 7.0+, API 24):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.12.0-test-65aafef/HaiTraiTim-1.12.0.apk · 58.941.701 byte · SHA256 `48c9a576b713726c3df35af2db54a72e103f39e92e96107379a04d6f680d22dd`. **Bản nhẹ (chỉ arm64-v8a):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.12.0-test-65aafef/HaiTraiTim-1.12.0-arm64.apk · 43.312.216 byte · SHA256 `572b81d62312cd4c0ae94bbb108031eb2babf8670fe4091a97c5007236ff92a8`. Trong app mở **Cài đặt** xem dòng cuối: phải là **1.12.0, bản dựng 14**.

- **Chỉ một vùng WebGL trên màn hình.** `LoveBridge` không còn tự mở `Canvas`; nó xuất `BridgeGroup` và được dựng bên trong canvas của `ThreeHeart` (`withBridge`). Hai canvas cùng lúc làm LDPlayer treo khung hình cũ → không bấm được gì; nay hết.
- **Tin nhắn tách hẳn khỏi khung cuộn chung:** `{!alertPage && tab === "chat" ? <View key="chat" style={{flex:1}}>…} : null}` và ScrollView chỉ dựng khi **không** ở tab Tin nhắn → bấm tab là mở ngay, ô nhắn tin đứng yên.
- **Nhịp 1 giây chỉ chạy khi đang gọi** (`useEffect(..., [call?.id])`), hết giật khi dùng bình thường.
- **Cầu 3D nhẹ và ăn khớp chủ đề:** `BRIDGE_CURVE` (QuadraticBezierCurve3) + `tubeGeometry` cho mặt cầu, hai ống lan can, ván/cột bằng `instancedMesh` (1 draw call mỗi loại), 6 chim Ô Thước, trăng tròn, cô dâu/chú rể chibi có dải lụa; màu lấy từ `theme` (`palette` trong `ThreeHeart`). Canvas dùng `antialias: false`, `alpha`, `powerPreference: "high-performance"`, ít hạt sáng hơn (70 thay vì 110).

### Có gì mới ở 1.11.0 — gọi nói liên tục, nhạc chuông trong máy, cầu tình yêu 3D

**Tải APK 1.11.0 (Android 7.0+, API 24):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.11.0-test-8d9ef2e/HaiTraiTim-1.11.0.apk · 58.942.065 byte · SHA256 `ba6fa99c0e8e2770a126865be92e181a091d001514a9e88a7929022589aa3f14` · dựng từ `8d9ef2e` (build 38559252404). **iOS (.ipa chưa ký):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-ios-v1.11.0-test-8d9ef2e/HaiTraiTim-1.11.0-unsigned.ipa · 11.651.636 byte · SHA256 `2521e74bf022065c7a5ba110f7a022c53654e6a8d462ea709020de7a817b677f` (build 38559252507). Trong app, mở **Cài đặt** xem dòng cuối: phải là **1.11.0, bản dựng 13**.

- **Gọi nói liên tục, không còn giữ nút.** Tiếng nói được ghi thành từng mảnh **0,7 giây** (16 kHz mono, 24 kbit/s) rồi gửi ngay qua kênh ghép nối; máy kia lưu mảnh lại và phát lên loa (`src/logic/callAudio.mjs`: `pushFrame`, `takeFrame`, hàng đợi 6 mảnh, bỏ mảnh cũ để giữ độ trễ thấp). Bạn nói bình thường như Zalo/Messenger — không phải bấm giữ. _Nói thẳng:_ vẫn là tiếng gửi qua kênh ghép nối nên trễ khoảng một giây và có thể ngắt quãng vài chỗ; muốn chất lượng như cuộc gọi điện thoại thật thì phải thêm WebRTC và build lại phần native.
- **Cả hai máy cùng nghe chuông.** Bên nhận nghe **nhạc chuông** (`assets/ringtone.wav`, hoặc nhạc riêng của bạn) và rung; bên gọi nghe **hồi chuông** (`assets/ringback.wav`) như tổng đài.
- **Cài nhạc chuông từ thư viện nhạc trong máy:** Cài đặt → **Nhạc chuông cuộc gọi** → 🎵 _Chọn nhạc trong máy_ (tệp nhạc được sao vào app, chỉ đổi trên máy bạn) và nút **Nhạc mặc định** để quay lại.
- **Kết thúc cuộc gọi là tự đóng, có nhật ký trong đoạn chat.** Cửa sổ gọi tự tắt sau **2,2 giây** (`CALL_CLOSE_MS`), và đoạn chat có một dòng **“📞 Cuộc gọi đi/đến · 01:23”** (cuộc gọi nhỡ ghi “Cuộc gọi nhỡ”); loại tin mới `call` nằm trong `MESSAGE_KINDS`.
- **Popup cuộc gọi thiết kế lại:** vòng sáng thở quanh avatar, tên + trạng thái lớn, **vòng sóng chạy khi đang nói**, nút tròn Mic · Thu nhỏ · Kết thúc, và khi thu nhỏ thì thanh nổi gọn có avatar + đồng hồ + mic + kết thúc.
- **Cầu tình yêu 3D thật** (`src/components/LoveBridge.tsx`): trăng tròn, **đàn chim Ô Thước** bay thành dòng quanh cầu, vòm cầu ghép từ 26 ván + lan can hai bên, **cô dâu chibi** (áo xanh ngọc, khăn đỏ, hoa cài) và **chú rể chibi** (áo lam) chạy từ hai đầu vào giữa, gặp nhau thì tim sáng lên rồi cùng quay về — lặp lại mãi.
- **Nhắn tin nhanh hơn hẳn:** tin nhắn/vị trí không còn kéo theo việc đẩy **cả gói dữ liệu 60 KB** sang 5 trạm MQTT (`publishCurrent` so khoá `lastLiteRef`, chỉ đẩy lại phần không phải tin nhắn; nhịp an toàn 20 giây), dữ liệu xuống máy được **gộp trong 400 ms** (`persistSoon`), và gửi vị trí/ảnh không còn làm khựng đoạn chat.
- **Bảng tin mượt hơn:** mỗi dòng tin là một `MessageRow` nhớ sẵn (`React.memo`) + `renderItem` ổn định nên **đang gõ chữ không vẽ lại danh sách**; thêm `initialNumToRender`, `maxToRenderPerBatch`, `windowSize`, `removeClippedSubviews` cho máy yếu.
- **Ô nhắn tin đứng yên tuyệt đối:** mục Tin nhắn được tách khỏi khung cuộn chung của app, nên dù tin nhắn dài bao nhiêu thì **chỉ phần tin cuộn, thanh chat luôn ở đáy**.
- 71 bài kiểm thử đều xanh (thêm `tests/round12.test.mjs`), TypeScript sạch, `expo export` cho Android thành công.

### Có gì mới ở 1.10.0 — hết chữ ngược, gọi điện, sticker, cầu tình yêu

**Tải APK 1.10.0 (Android 7.0+, API 24):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.10.0-test-0a44d5f/HaiTraiTim-1.10.0.apk · 58.549.853 byte · SHA256 `6e9426fcd457b010ef58bc01f2ba8045f848201e9aea839ba59224e6abe581f0` · dựng từ `0a44d5f` (build 38552769225). **iOS (.ipa chưa ký):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-ios-v1.10.0-test-0a44d5f/HaiTraiTim-1.10.0-unsigned.ipa · 11.458.596 byte · SHA256 `38aad59124ebe92378810bb2fad5e382e209802c8be33f31bd017d34c34669bc` (build 38552769096).

- **Hết chữ bị ngược trong khung chat.** Nguyên nhân: bảng tin trước đây dùng `FlatList inverted`; trên Android kiểu này chạy bằng `transform: [{ scale: -1 }]` nên **ô trống và cả chữ trong đó cũng bị soi gương**. Nay danh sách không lật: `const ordered = [...messages].reverse()` hiển thị cũ → mới, có `scrollToEnd` (và `followRef` theo dõi khi bạn đang ở gần đáy) để tin mới tự hiện ở dưới.
- **Ô nhắn tin được kéo lên** khỏi thanh chuyển mục (`marginBottom`), không còn dính liền.
- **Nhiều sticker hơn:** 4 bộ × 12 sticker (Yêu thương, Vui vẻ, Nhớ nhung, Dễ thương) + bảng 48 emoji chèn thẳng vào câu chữ.
- **Trái tim 3D đẹp hơn** và **2 avatar + tên** nằm trong viên gradient nổi, có nhãn tên riêng.
- **Cầu tình yêu:** cô dâu & chú rể chibi ở hai đầu cầu 3D, tự chạy lại gần nhau rồi gặp nhau ở giữa cầu (`src/components/LoveBridge.tsx`).
- **Gọi điện như Messenger/Zalo:** bấm gọi → máy kia **đổ chuông** → **Nghe/Từ chối** → **giữ nút để nói** (mỗi lần ≤ 25 giây), **bật/tắt mic**, **thu nhỏ cửa sổ** khi đang gọi, kết thúc thì tự ẩn sau 4,5 giây. _Nói thẳng:_ cuộc gọi đi qua kênh ghép nối sẵn có, tính năng như **bộ đàm** (chuông + giữ để nói), **chưa phải thoại hai chiều liên tục** — muốn vậy phải thêm WebRTC và build lại native.
- **Cách 2 tiếng tự gửi lời yêu / thơ** (07:00–22:00, xen kẽ lời yêu và thơ, hai máy cùng mốc thì cùng câu), tắt được trong Cài đặt.
- **Nhắc khi chưa trả lời:** người thương nhắn mà mình chưa rep quá **3 phút** → “Người ấy vẫn đang đợi tin nhắn từ bạn 💌”; quá **1 tiếng** thì kèm một lời yêu; **im lặng từ 22:00–07:00**.
- **Bật/tắt “đã xem”** trong Cài đặt (`settings.readReceipts`).
- **Gửi ảnh và vị trí ngay trong đoạn chat:** chụp ảnh / chọn ảnh trong máy (nén 720 px, ≤ 160 KB) và gửi **vị trí đang ở** kèm nút mở bản đồ (`expo-location`).
- 64 bài kiểm thử đều xanh, TypeScript sạch, `expo export` cho Android thành công.

### Có gì mới ở 1.9.1 — ảnh nền kiểu Zalo

**Tải APK 1.9.1 (Android 7.0+, API 24):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.9.1-test-ef2dc57/HaiTraiTim-1.9.1.apk · 57.934.306 byte · SHA256 `15d43a165d853b67a0889b8dd45cb9aff832c6686f14023932c0b605fa38ad94` · dựng từ `ef2dc57` (build 38543908536). **iOS (.ipa chưa ký):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-ios-v1.9.1-test-ef2dc57/HaiTraiTim-1.9.1-unsigned.ipa · 11.309.849 byte · SHA256 `a313cbb484c9ac5a640d832d861f5b4c24c1f76d40b959038aacf8a8f7d14e08` (build 38543908210).

- **Ảnh nền hiện xuyên qua giao diện.** Hàm `withWallpaper(theme, tint)` trong `src/logic/themes.mjs` đổi `surface`, `soft`, `glass`, `border` và dải `hero` sang `rgba` khi có ảnh nền; lớp phủ `veil` dùng đúng mức `tint` (0,3–0,8) thay vì 0,85 cố định, nên ảnh phía sau hiện rõ như Zalo mà chữ vẫn đọc được.
- **Ba mức trong Cài đặt:** `settings.set` nhận thêm `wallpaperTint` (kẹp 0,3–0,75), mặc định 0,5. Mức này chỉ lưu trên máy bạn, không gửi sang máy người thương.
- 59 bài kiểm thử (thêm bài cho `rgbaOf`, `withWallpaper` và việc kẹp mức) đều xanh.

### Có gì mới ở 1.9.0

**Tải APK 1.9.0 (Android 7.0+, API 24):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.9.0-test-51bc943/HaiTraiTim-1.9.0.apk · 57.931.650 byte · SHA256 `bcbcc29a69407c65b7acfb17a2580bdfb18b2d1e89e4ef42788a586253ad0a11` · dựng từ `51bc943` (build 38541252032). **Bản iOS (.ipa chưa ký, tự ký lại bằng Apple ID miễn phí):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-ios-v1.9.0-test-51bc943/HaiTraiTim-1.9.0-unsigned.ipa (build 38541251941).

- **Chữ theo chủ đề, hết chữ mờ/chữ mất.** Mọi màn hình trên máy lấy màu chữ từ chủ đề: mục “Riêng tư trên máy này”, dòng “Lời yêu thương mỗi ngày (09:00 và 21:00)”, các ngày trên lịch chu kỳ và lịch chọn ngày; bỏ lớp mờ 0.5 đè lên chữ, ngày ngoài tháng vẫn đọc rõ. Bài kiểm thử vẫn canh độ tương phản của cả 14 bảng màu.
- **Thông báo nổi như Messenger.** `Notifications.setNotificationHandler` đặt ngay khi nạp module nên thông báo hiện cả lúc app đang mở; hai kênh Android: `love-messages` (**mức cao nhất**, âm thanh, rung, riêng tư trên màn khoá) cho tin nhắn/tin thoại và `love-reminders` (mức cao) cho lời nhắc; app **hỏi quyền ngay lần mở đầu** — trước đây chỉ hỏi khi tự bật công tắc nên máy chưa từng được cấp quyền; nếu quyền bị tắt, đầu app hiện dòng nhắc kèm nút **Bật thông báo** (mở thẳng Cài đặt máy khi hệ thống không cho hỏi lại).
- **Tin nhắn và tin thoại tới được máy kia.** `flushMessages` chỉ đánh dấu `message.sent` khi `publish()` trả về true; chưa nối được trạm thì tin ở lại hàng chờ và tự gửi lại (trước đây đánh dấu sớm nên tin mất âm thầm). Nhật ký kết nối ghi `Đã gửi sang máy kia: … n tin nhắn`. Tin thoại dùng `VOICE_LIMIT_BYTES` 420 KB (trước là 120 KB nên tin dài bị chặn) và máy nhận **tự xin gửi lại sau 45 giây** nếu vẫn thiếu tệp (`askedPhotosRef` nay là Map có thời hạn). Máy gửi thấy **“đã tới máy kia”** nhờ gói `chatAck` → `message.delivered`.
- **Bảng tin cố định.** `ChatLocal` dùng `FlatList inverted` trong khung chat chiếm hết chiều cao: tin mới nhất ở dưới, tin cũ trôi lên, **kéo lên để xem lại**; ô nhập giới hạn `maxHeight: 96` nên không kéo dài vô tận theo số dòng; có nút **cuộn xuống tin mới nhất** và `busyRef` chặn bấm gửi hai lần liên tiếp gây lặp tin.
- **Chủ đề có hoạ tiết.** Mỗi bảng màu thêm mảng `deco` (5 hoạ tiết) và `ThemeDeco` rải hoạ tiết mờ ở nền (mờ hơn khi có ảnh nền để không che ảnh); thêm hai chủ đề mới **Mèo con** 🐱 và **Vườn hoa** 🌸 (tổng 14 chủ đề); ô xem trước trong Cài đặt hiện luôn hoạ tiết.
- **Chọn ảnh làm nền app:** Đổi giao diện → Ảnh nền, ảnh được nén rồi lưu trên máy, và **gửi sang máy kia** như ảnh khoảnh khắc để hai máy dùng chung giao diện.
- **Lịch chọn ngày tự viết (`src/logic/datepicker.mjs` + `src/components/DatePicker.tsx`):** lưới tháng tự vẽ, lùi/tiến tháng và năm, bấm ngày là chọn, kèm chế độ **gõ thẳng ngày/tháng/năm** (chặn ngày sai, ngày tương lai, năm < 1900). Không dùng hộp thoại hệ thống nên **không còn bị nhảy về hôm nay** giữa lúc chọn.

### Có gì mới ở 1.8.0

**Tải APK 1.8.0 (Android 7.0+, API 24):** https://github.com/hominhtam1922003-lgtm/MangaNhanh/releases/download/hai-trai-tim-v1.8.0-test-cf8c282/HaiTraiTim-1.8.0.apk — 57.921.934 byte · SHA256 `070a194f9c784af24f2d39c31f68f2acbcfaa8800d441486d9c9b7d156f8a94f` · dựng từ `cf8c282` (lần build 38532880571), đăng bằng workflow 38534194891.

- **Đổi giao diện thì mọi chữ tự đổi theo, kể cả khi đặt ảnh làm nền.** Bảng màu có thêm `onDeep` (màu chữ nằm trên nền đậm) nên nút chính, thanh tab đang chọn, nút chọn mã 6 số không còn chữ trắng trên nền sáng; 12 bảng màu được hiệu chỉnh lại và **kiểm tra tự động độ tương phản** (chữ chính ≥ 4,5 · chữ phụ ≥ 3,0 · chữ trên nền đậm ≥ 3,2/4,6) trong `tests/theme_ui.test.mjs`. Nút gạt, dòng báo lỗi khi gõ ngày, tên chủ đề, ô nhập ngày đều lấy màu từ chủ đề. Khi có ảnh nền, lớp `veil` phủ trên ảnh dày hơn ở chủ đề tối (0,82) nên ảnh nền sáng cũng không làm chữ biến mất.
- **Sửa đúng lỗi “máy B viết nhật ký mà máy A không thấy”.** Gói dữ liệu 60 KB trước đây khi quá lớn thì **cắt mất cả phần nhật ký**, nên nhật ký viết thêm không sang được máy kia trong khi cảm xúc/khoảnh khắc vẫn đi. Nay **nhật ký luôn nằm trong gói**; gói quá lớn thì cắt theo thứ tự: khoảnh khắc → lời nhắc → tin nhắn → rút ngắn chữ trong nhật ký, và bài kiểm thử `Gói dữ liệu lớn vẫn giữ nhật ký của mình` canh đúng điều này.
- **Nhìn thấy dữ liệu đã đi hay chưa.** Nhật ký kết nối trong mục **Ghép nối** ghi rõ `Đã gửi sang máy kia: n kỷ niệm · n tin nhắn · cảm xúc “…”` và `Đã nhận từ …: n kỷ niệm · cảm xúc “…”`; thẻ nhật ký gắn nhãn **của bạn** hay **từ <tên người thương>** kèm số bài của người thương, mục Cảm xúc luôn hiện cảm xúc của cả hai bên.
- **Nhắn tin giữa hai máy (mới).** Tab **Nhắn tin**: gửi chữ, **emoji** (24 biểu tượng), **6 câu nhớ nhanh** (💌 Nhớ người thương, 🥰 Thương lắm, 🌙 Ngủ ngon nhé, 🍚 Ăn cơm chưa, ☎️ Gọi cho mình nhé, 💪 Cố lên nhé) và **tin thoại ghi âm tối đa 30 giây** (`voice-<mã>.m4a`, AAC, có thanh chạy và nút nghe lại). Trạng thái từng tin: đang chờ gửi → đã gửi → mới nhận → đã xem; xoá được từng tin.
- **Thông báo kiểu Messenger.** Người thương nhắn, viết nhật ký, đổi cảm xúc hay gửi khoảnh khắc thì máy bạn **nổi thông báo ngay** (`notifyNow`, kênh “love-reminders”) và nội dung cũng nằm trong mục **Lời nhắc**; tab Nhắn tin có chấm đếm tin chưa đọc. Trang chủ thêm thẻ **“Nhớ nhau một cái 💌”** gửi một chạm. Nút **Bật thông báo** trong tab Nhắn tin xin quyền ngay trong app.
- **Tin đi qua chính kênh kết nối sẵn có:** mô tả tin nhắn nằm trong gói dữ liệu (40 tin mới nhất của mình), tệp tin thoại đi theo gói ảnh 3.500 ký tự như Khoảnh khắc; máy nào thiếu tệp thì tự xin gửi lại (`missingVoiceIds`). Không cần máy chủ, không cần tài khoản.
- **Kiểm thử:** thêm `tests/chat.test.mjs` — 4 bài, trong đó có bài **dựng broker MQTT thật (aedes + WebSocket) chạy trên máy** để hai máy nhắn tin và gửi tin thoại cho nhau, và bài kiểm tra gói dữ liệu lớn vẫn giữ nhật ký. Tổng **53/53 bài chạy qua**, TypeScript sạch, `expo export` cho Android thành công.
- **Giới hạn thật:** tin nhắn chỉ sang nhau khi **cả hai máy cùng mở app** (một bên đóng app thì tin nằm chờ và gửi ở lần mở sau); tin thoại đi chậm hơn chữ một chút vì phải cắt thành nhiều mảnh; thông báo nổi cần quyền thông báo của Android và một số máy có thể trì hoãn.

### Có gì mới ở 1.7.0

- **Giao diện thiết kế lại theo chủ đề, hài hoà từ trên xuống dưới.** 12 chủ đề: Hồng kẹo, Đào pastel, Tím mộng mơ, Oải hương, Biển xanh, Bạc hà, Trà xanh, Nắng mai, Hoàng hôn, Sen hồng, Tuyết trắng, Đêm sao. Mỗi chủ đề mang đủ màu cho nền (3 lớp chuyển sắc), thẻ, nút, ô nhập, chip trạng thái, bóng đổ, thanh tab và màn hình khoá — không còn thẻ hồng trên nền tím, và chủ đề tối có màu chữ sáng nên đọc được. Mã nguồn: `src/logic/themes.mjs` (bảng màu) + `src/theme/ThemeContext.tsx` (mọi màn hình lấy màu từ một chỗ).
- **Hai máy dùng chung một giao diện khi đã ghép nối.** `state.appearance = {theme, wallpaper, wallpaperId, updatedAt, by}` đi kèm mỗi gói tin; máy nhận chỉ đổi khi bản của máy kia **mới hơn** (so `updatedAt`) nên hai máy không giành nhau, đổi khi máy kia tắt vẫn áp dụng lúc mở lại.
- **Chọn ảnh thư viện làm hình nền.** Nén còn rộng 1080 / chất lượng 0.72, lưu thành `wallpaper-<mã>.jpg`, phủ lớp `veil` theo chủ đề để chữ vẫn đọc được; ảnh được gửi sang máy kia qua kênh kết nối (`role: "wallpaper"`), máy thiếu ảnh thì tự `photoRequest` xin gửi lại, và gắn vào đúng bản giao diện (`appearance.wallpaper` chỉ nhận khi `wallpaperId` khớp).
- **Lịch chọn ngày tự viết** (`src/logic/datepicker.mjs` + `src/components/DatePicker.tsx`), thay cho hộp thoại hệ điều hành: lùi/tiến tháng **và** năm, nút **Hôm nay**, tháng đang xem là state riêng nên không bị nhịp đếm mỗi giây kéo về tháng hiện tại, và **gõ thẳng Ngày/Tháng/Năm** rồi “Lưu ngày này”. Kiểm tra luôn: ngày không tồn tại (29/2 năm thường, 31/4), ngày tương lai, trước 1900. Dùng cho cả **Ngày bắt đầu yêu** và **Chu kỳ → Ngày đầu kỳ**.
- Giữ nguyên mọi thứ của 1.6.0: Khoảnh khắc kiểu Locket, Lời yêu thương 09:00/21:00 giống nhau trên hai máy, mã 6 số, mã hoá đầu-cuối, chạy hoàn toàn trên máy.

### Có gì mới ở 1.6.0

- **Khoảnh khắc kiểu Locket** thay cho cách gửi/nhận tệp thủ công: ở trang chủ bấm **Chụp ngay** (camera trước, không cần thoát app) hoặc **Chọn từ thư viện**, viết chú thích ngắn, rồi ảnh tự nén và sang máy người thương. Hai bạn cùng xem trong lưới khoảnh khắc 3 cột, mở ra xem lớn kèm **ngày giờ chụp**, ai gửi, đã gửi hay chưa; xóa được từng khoảnh khắc (có hỏi lại). Tối đa 200 khoảnh khắc gần nhất.
- **Sửa lỗi chọn ngày bắt đầu yêu** cứ nhảy về tháng 10/2026: bộ chọn ngày được tách riêng khỏi nhịp đếm từng giây và chỉ nhận ngày đã lưu, chặn ngày tương lai; ngày lưu ở 12 giờ trưa nên đổi múi giờ vẫn đúng ngày.
- **Sửa lỗi đổi ảnh đại diện**: dùng API mới của `expo-image-manipulator` (`manipulate → resize → renderAsync → saveAsync`) và mỗi lần đổi dùng tên tệp mới nên không hiện lại ảnh cũ.
- **Lời yêu thương mỗi ngày**: 45 câu yêu thương/thơ ngắn, chọn theo ngày nên **hai máy luôn nhận cùng một câu** lúc 09:00 và 21:00, không cần mạng; tắt được trong Cài đặt (mục “Lời yêu thương mỗi ngày”).
- **8 chủ đề cho trang chủ** (Hồng, Tím, Biển, Bạc hà, Hoàng hôn, Nắng, Tuyết, Đêm) đổi nền chuyển sắc toàn app, màu nhấn của thanh tab và biểu tượng trang trí — chọn trong **Cài đặt → Hình nền & chủ đề**.

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

Đẩy **toàn bộ nội dung thư mục**, gồm `.github/workflows/build-apk.yml`, `package-lock.json`, source và `scripts`. Workflow tự chạy khi push vào main hoặc chọn **Actions → APK Mật Mã Yêu → Run workflow**.

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

CI: Ubuntu → Node 22 → Java 17 → Android SDK → `npm ci` → tests / TypeScript / format → Expo prebuild → Gradle `assembleRelease` cho ARM64 và ARMv7 → artifact **`HaiTraiTim-1.8.0-APK`**, chứa `.apk` và SHA256, giữ 14 ngày. Tải từ trang run → Artifacts, giải nén và cài APK. Android tối thiểu API 24 (Android 7). Chi phí / hạn mức Actions phụ thuộc repository và tài khoản GitHub, không vô hạn.

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

`scripts/relay-probe.mjs` (chạy trong workflow **Dò trạm kết nối**) đo thật từng trạm công cộng từ runner có Internet thật: mở WebSocket, bắt tay MQTT, hai máy gửi/nhận, và chạy đúng cách app làm (nối song song). `tests/relay.test.mjs` (10 bài, gồm bài chạy mã kết nối khi **không có TextEncoder/TextDecoder** và bài đối chiếu UTF-8 từng byte) và `tests/relaybroker.test.mjs` (broker MQTT thật bằng `aedes` chạy trong CI) kiểm tra phần kết nối tức thời: mã hóa/giải mã gói, sai khóa thì không đọc được, mã 6 số hai máy vào cùng một phòng, bộ mã hóa/giải mã gói MQTT ghép đúng khi dữ liệu về từng byte, mỗi máy chỉ gửi dữ liệu của mình và gói gửi đi không đổi sau khi gộp (không lặp), gói lớn tự cắt bớt, trạng thái chỉ báo khi có thay đổi kèm tên người thương — và bài cuối dựng **broker giả có dội bản tin** để chứng minh: máy ở một mình không tự nhận mình là người thương, hai máy nhập cùng mã 6 số thì **cả hai** cùng nhận dữ liệu và cùng hiện ghép nối.

Tests Node gồm logic lịch và **PostgreSQL thực chạy WASM bằng PGlite + pgcrypto**, áp dụng migration thật trong fixture auth/storage để kiểm tra ghép đôi, hết hạn, giới hạn thử, RLS, privacy revocation, nhật ký/ảnh, hàng chờ và lời nhắc kép. Fixture không thay cho Supabase cloud / Realtime / mạng push thật.

Trước phát hành: kiểm thử Android ↔ iPhone, mã hết hạn/sai, người thứ ba, thu hồi chia sẻ khi partner đang mở màn hình, ảnh, mất mạng, khóa khi đưa app nền, đổi máy bằng email, FCM/APNs khi đóng app và chữ ký nâng cấp. Chỉ đo FPS trên thiết bị cụ thể, không suy từ mã nguồn.
