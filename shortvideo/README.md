# 🎬 ShortVideo — Xem phim AI & video ngắn kiểu Douyin

Ứng dụng xem video dọc (cuộn lên/xuống, mỗi video một màn hình), kèm:

- 🈶 **Tự tạo phụ đề tiếng Trung** (nút **Sub AI**): backend tải video, tách âm thanh bằng ffmpeg, nhận dạng giọng nói bằng **faster-whisper** (có timestamp).
- 🇻🇳 **Dịch sang tiếng Việt** tự động (tuỳ chọn) qua **LibreTranslate** tự host — miễn phí, không cần khoá API.
- 📝 **Chữ chạy song song**: hiển thị tiếng Trung và tiếng Việt cùng lúc. Có 3 chế độ: *Chữ đè* (overlay trên video), *Song song* (2 cột dưới video), *Tắt*.
- 🔊 **Thuyết minh bằng giọng AI**: đọc câu tiếng Việt (hoặc tiếng Trung nếu chưa có bản dịch) theo đúng nhịp phụ đề, tự hạ âm gốc của video. Dùng giọng tổng hợp của trình duyệt/Android (Web Speech API), miễn phí, không cần mạng khi đã cài gói giọng.
- ➕ Dán link video trực tiếp (`.mp4`, `.webm`) để thêm vào feed; danh sách mặc định nằm ở `public/sources.json`.
- 📄 Hỗ trợ file phụ đề `.vtt` có sẵn: dòng 1 = tiếng Trung, dòng 2 = tiếng Việt.

## ⚠️ Về nguồn video

- App **không** kèm bộ tải/scrape Douyin. Nội dung Douyin thuộc bản quyền của người sáng tạo và điều khoản của nền tảng cấm tải/tái phân phối tự động. Nếu bạn có quyền sử dụng một video, hãy dán link file video trực tiếp của nó.
- Phim AI/video ngắn: nên dùng nguồn có giấy phép rõ ràng (CC, public domain, hoặc video do bạn tự làm/được cấp phép).
- Backend tải bất kỳ URL http(s) nào bạn gửi. Chỉ chạy trên máy cá nhân/mạng nội bộ, đừng public trực tiếp (tránh bị lợi dụng làm proxy tải file).

## 🚀 Chạy

Yêu cầu: Node ≥ 18, Python ≥ 3.10, **ffmpeg** trong PATH.

### 1. Frontend
```bash
cd shortvideo
npm install
npm run dev            # http://localhost:5173
```

### 2. Backend phụ đề
```bash
cd shortvideo/server
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8787
```

Biến môi trường (tuỳ chọn):

| Biến | Ý nghĩa | Mặc định |
|---|---|---|
| `WHISPER_MODEL` | `tiny`/`base`/`small`/`medium`/`large-v3`. Model lớn chính xác hơn nhưng chậm | `small` |
| `WHISPER_DEVICE` | `cpu` hoặc `cuda` | `cpu` |
| `WHISPER_COMPUTE` | `int8`, `float16`, … | `int8` |
| `LIBRETRANSLATE_URL` | Ví dụ `http://127.0.0.1:5000`. Bỏ trống = không dịch | (trống) |
| `LIBRETRANSLATE_API_KEY` | Khoá nếu server LibreTranslate yêu cầu | (trống) |

Chạy LibreTranslate để dịch (tuỳ chọn): `pip install libretranslate && libretranslate --load-only zh,vi`.

Frontend gọi `/api/...` và Vite tự chuyển tiếp sang backend (`SV_API` để đổi địa chỉ).

### 3. Thêm video
- Dán link mp4 vào ô trên cùng → **+**.
- Hoặc sửa `public/sources.json`:
```json
[
  { "id": "my-film-1", "title": "Phim AI tập 1", "url": "https://.../film.mp4",
    "subtitles": "https://.../film.vtt", "tags": ["AI", "phim ngắn"] }
]
```

### 4. Dùng
1. Vuốt lên/xuống để chuyển video.
2. Bấm **文 Sub AI** để tạo phụ đề tiếng Trung + Việt (có thể mất vài phút với video dài trên CPU).
3. Bấm nút ▤ để đổi kiểu hiển thị phụ đề.
4. Bấm **🔊 Thuyết minh** để bật giọng AI đọc.

## 📌 Giới hạn hiện tại
- Nhận dạng chạy hoàn toàn trên máy backend; video dài (>10 phút) trên CPU sẽ chậm — nên dùng GPU hoặc model `base`/`tiny`.
- Job lưu trong bộ nhớ: khởi động lại backend thì job đang chạy bị mất (kết quả đã xong vẫn còn trong `server/cache/`).
- Thuyết minh dùng giọng có sẵn của trình duyệt; chất lượng giọng phụ thuộc máy (nên cài gói giọng tiếng Việt/Trung trong cài đặt hệ thống).
- Chưa đóng gói APK cho app này; có thể bọc bằng Capacitor tương tự app MangaNhanh ở thư mục gốc nếu cần.
