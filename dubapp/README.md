# Lồng Tiếng Trung Việt (`com.personal.trungvietdub`)

App Android: chọn video tiếng Trung (ưu tiên < 5 phút) → nhận diện tiếng Trung → dịch → giọng Việt AI → ghép với nhạc nền gốc → xuất MP4 vào thư viện.

## Trạng thái hiện tại (quan trọng)

| Bước | Trạng thái |
|---|---|
| Tách audio, chọn video, xuất MP4, lịch sử, tiến trình | ✅ Đã viết |
| Tải model (sherpa-onnx) + nhận diện tiếng Trung (Paraformer small) | ✅ Đã viết, dùng API đã kiểm tra trong mã nguồn sherpa-onnx v1.13.8 |
| Giọng Việt offline (VITS vais1000) | ✅ Đã viết, cần kiểm tra trên máy thật |
| **Dịch Trung → Việt** | ⏳ **Chưa tích hợp.** App sẽ báo lỗi rõ ràng ở bước này. Hướng: NLLB-200 ONNX + SentencePiece |
| **Tách giọng gốc, giữ nhạc nền** | ⏳ Chưa tích hợp. Hiện có 2 chế độ: hạ âm lượng lời gốc, hoặc tắt audio gốc. Hướng: UVR MDX-NET (`UVR-MDX-NET-Inst_HQ_3.onnx`, có sẵn trong release `source-separation-models` của sherpa-onnx) |
| Build APK trên máy thật, chạy thử | ⚠️ Chưa được kiểm chứng. Môi trường phát triển không có JDK/Android SDK nên mã chưa được biên dịch |

## Model tải lần đầu (trong app)

- `paraformer-zh-small` (~78 MB): nhận diện tiếng Trung
- `vits-piper-vi_VN-vais1000-medium` (~67 MB): giọng đọc tiếng Việt

Nguồn: GitHub Releases của [k2-fsa/sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx/releases). Không cần API key, không cần đăng nhập.

## Build APK (không cần Android Studio)

Workflow `.github/workflows/build-dub-apk.yml` (ở root repo) tự tải `sherpa-onnx-1.13.8.aar` vào `app/libs/` rồi chạy `./gradlew assembleDebug`. APK nằm ở artifact `TrungVietDub-debug-apk`.

Build thủ công:

```bash
cd dubapp
mkdir -p app/libs
curl -fL -o app/libs/sherpa-onnx-1.13.8.aar \
  https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.13.8/sherpa-onnx-1.13.8.aar
./gradlew assembleDebug
```

## Cấu trúc

```
app/src/main/java/com/personal/trungvietdub/
├── MainActivity.kt          # Compose: Home / Tiến trình / Lịch sử
├── DubApp.kt
├── data/                    # Models, JobRepository (JSON), ModelManager (tải + giải nén tar.bz2)
├── pipeline/
│   ├── AudioIO.kt           # Giải mã audio video (MediaCodec), đổi kênh/tần số
│   ├── Segmenter.kt         # Tìm đoạn có lời nói (năng lượng RMS)
│   ├── ChineseSpeechRecognizer.kt
│   ├── Translator.kt        # Interface dịch; hiện là UnavailableTranslator
│   ├── VietnameseTts.kt
│   ├── Composer.kt          # Trộn nhạc gốc + giọng Việt đúng mốc thời gian
│   ├── VideoExporter.kt     # AAC encode, mux với video gốc (không re-encode hình), lưu MediaStore
│   └── DubbingPipeline.kt   # Điều phối các bước
├── service/DubForegroundService.kt
└── ui/                      # MainViewModel, Screens
```

## Giới hạn đã biết

- Nhận diện bằng năng lượng nên nhạc nền to có thể bị coi là lời nói; đoạn quá dài bị cắt 12 giây.
- Giọng Việt đọc nhanh tối đa 1.6x để vừa khung thời gian gốc; nếu vẫn dài hơn, phần thừa có thể đè lên đoạn kế tiếp.
- Máy RAM dưới 6 GB có thể gặp lỗi bộ nhớ với video dài.
