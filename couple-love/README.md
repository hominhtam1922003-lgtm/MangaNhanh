# Hai Trái Tim 💕

Ứng dụng Android/iOS bằng **React Native · Expo SDK 54 · NativeWind · Three.js/R3F native · Supabase**. Tất cả nội dung giao diện của ứng dụng bằng tiếng Việt.

## Hai chế độ chạy

Khi mở app lần đầu, bạn chọn một trong hai chế độ và có thể đổi lại trong Cài đặt:

1. **Trên máy này · không cần máy chủ (mặc định, đầy đủ tính năng)** — đếm ngày yêu, trái tim 3D, chu kỳ, nhật ký, cảm xúc, lời nhắc hẹn giờ trên máy, sinh trắc học và sao lưu tệp. Hai máy ghép nối bằng **mã 6 số** rồi tự gửi dữ liệu cho nhau khi cả hai cùng mở app (xem mục _Kết nối tức thời_ bên dưới) — không cần tài khoản, không cần máy chủ; khi một bên không có mạng thì vẫn có cách **mã dán tay / tệp dữ liệu**.
2. **Đồng bộ hai máy** — cần một dự án Supabase do bạn tạo (xem mục 2 bên dưới). Đổi lại bạn có cập nhật tức thời Android ↔ iPhone, nhật ký chung, lời nhắc kép gửi tới cả hai máy.

Không có máy chủ nào được nhúng sẵn trong APK và tôi không tạo tài khoản thay bạn. Chế độ 1 chạy hoàn toàn độc lập, không cần đăng ký gì.

### Kết nối tức thời giữa hai máy (không cần máy chủ)

- Một bạn bấm **Tạo mã 6 số** (máy đó là _chủ phòng_), bạn kia nhập đúng 6 số đó ở mục **Ghép nối → Bước 2** (máy đó là _khách_: màn hình ghi “Bạn đang vào phòng của người thương” và không hiện lại mã như thể mình vừa tạo). Cùng 6 số thì hai máy suy ra đúng một phòng (id phòng + khóa 32 byte bằng SHA-512 của `haitraitim-code-v3|<6 số>`) nên **chỉ cần một bên nhập, cả hai bên cùng vào phòng**.
- Vào phòng là **mỗi máy vừa gửi dữ liệu của mình vừa nhận dữ liệu của người thương**, cả hai đều hiện “Đã ghép nối với …” và chip trạng thái trên đầu app. Không phải quét hai lần, không phải làm lại ở bên nào.
- Kênh truyền là MQTT 3.1.1 qua WebSocket tới **năm trạm công cộng miễn phí nối SONG SONG** (EMQX 8084, EMQX châu Á 8084, Eclipse 443, HiveMQ 8884, Mosquitto 8081): trạm nào vào được thì dùng ngay, trạm chết không làm chậm trạm khác. Bản tin đi trên mọi trạm đang sẵn sàng và **chống trùng theo mã bản tin**, nên hai máy chỉ cần **một** trạm chung. Dữ liệu chỉ được gửi **sau khi trạm xác nhận đăng ký phòng (SUBACK)** — gửi sớm hơn là mất tin. Nhịp giữ kết nối 10 giây và **chào nhau tức thì**: vừa thấy máy kia vào phòng là hai bên gửi dữ liệu ngay.
- Trong màn hình Ghép nối có **“Chi tiết kết nối”**: từng trạm báo gì (sẵn sàng / quá 12 giây chưa mở được / bị từ chối mã mấy), nhật ký 6 dòng gần nhất và nút **Thử kết nối lại**. Cài đặt hiện **số phiên bản + bản dựng** để biết chắc máy đang chạy bản nào. Nội dung **luôn được mã hóa đầu-cuối** bằng NaCl secretbox (nonce 24 byte ngẫu nhiên mỗi gói), trạm chỉ thấy chuỗi đã mã hóa. Ai không biết mã 6 số thì không đọc được; nếu muốn riêng tư hơn, hãy dùng mục **Cách khác → Tạo mã QR** (khóa ngẫu nhiên 32 byte, dài hơn nên khó đoán hơn mã 6 số).
- Mỗi gói chỉ chứa **dữ liệu của chính máy gửi** (tên, cảm xúc, chu kỳ, kỷ niệm mình viết, lời nhắc) nên hai máy không gửi trả lại dữ liệu của nhau và không lặp vô tận; gói quá lớn thì cắt bớt khoảnh khắc, lời nhắc, tin nhắn rồi mới rút ngắn chữ trong nhật ký — **nhật ký không bao giờ bị bỏ khỏi gói**. **Ảnh Khoảnh khắc có đi qua kênh này** từ 1.6.0: ảnh được nén còn khoảng 100 KB rồi cắt thành gói 3.500 ký tự, máy kia ghép lại và lưu thành `moment-<mã>.jpg`; máy nào thiếu ảnh thì tự gửi lời xin gửi lại.
- **Không dùng `TextEncoder`/`TextDecoder` hay `crypto.getRandomValues`** (React Native không cấp): phần chuyển chữ ↔ byte được tự viết trong `relayProtocol.mjs` (đối chiếu từng byte với chuẩn UTF-8 của Node trong `tests/relay.test.mjs`, có bài chạy khi đã xóa hai lớp đó) và nguồn ngẫu nhiên an toàn lấy từ `expo-crypto` qua `installRandomBytes`. Mọi lỗi JavaScript được ghi vào **“Lỗi gần nhất”** trong Cài đặt thay vì làm văng app.
- Giới hạn thật: cần Internet ở **cả hai** máy; dữ liệu mới chỉ sang nhau khi hai bên cùng mở app (một bên đóng app thì lần mở sau gửi bù); mã 6 số chỉ có 1.000.000 khả năng nên đừng dán công khai ở nơi nhiều người thấy.

### Có gì mới ở 1.10.0 — hết chữ ngược, gọi điện, sticker, cầu tình yêu

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
