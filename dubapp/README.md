# Lồng Tiếng Trung Việt (`com.personal.trungvietdub`)

App Android: chọn video tiếng Trung (ưu tiên < 5 phút) → nhận diện tiếng Trung → dịch → giọng Việt AI → ghép với nhạc nền gốc → xuất MP4 vào thư viện.

## Trạng thái hiện tại

| Bước | Trạng thái |
|---|---|
| Tách audio, chọn video, xuất MP4, lịch sử, tiến trình | ✅ Đã viết |
| Nhận diện tiếng Trung (sherpa-onnx Paraformer small) | ✅ Đã viết, API đối chiếu với mã sherpa-onnx v1.13.8 |
| Giọng Việt offline (sherpa-onnx VITS vais1000) | ✅ Đã viết, cần kiểm tra trên máy thật |
| Dịch Trung → Việt (NLLB-200 600M, ONNX lượng tử hóa, tokenizer.json) | ⚠️ Đã viết, **chưa chạy thử**. Tên input decoder đọc động từ model; không dùng KV-cache (chậm hơn nhưng đơn giản) |
| Tách giọng gốc, giữ nhạc nền (UVR MDX-NET Inst_HQ_3) | ⚠️ Đã viết, **chưa chạy thử**. Thuật toán chunk/STFT/ISTFT đã kiểm chứng bằng Python: tái tạo tín hiệu sai số ~1e-16, FFT 6144 sai số ~1e-13 |
| Build APK | ⚠️ Chưa biên dịch: môi trường phát triển không có JDK/Android SDK |

**Những điểm chưa kiểm chứng (cần log từ máy thật nếu lỗi):**
- Tên tensor của decoder NLLB (`input_ids`, `encoder_hidden_states`, `encoder_attention_mask`, `use_cache_branch`, `past_key_values.*`) giả định theo convention của Xenova/optimum. Code chạy được với các tên đó.
- Metadata trong `UVR-MDX-NET-Inst_HQ_3.onnx` (sample_rate, n_fft, dim_f, dim_t, dim_c, model_type=UVR, stems=2) giả định theo script `add_meta_data_and_quantize.py` của sherpa-onnx.
- Cửa sổ Hann dùng công thức tuần hoàn `0.5-0.5·cos(2πn/N)`.
- ONNX Runtime Java 1.17.3 và `libonnxruntime.so` đóng gói trong sherpa AAR có thể lệch phiên bản; nếu crash khi khởi tạo session, cần đồng bộ phiên bản.
- Tải model từ `huggingface.co` (NLLB) không kiểm tra được từ môi trường phát triển.

Khi tách giọng lỗi, app tự chuyển sang "Hạ âm lượng audio gốc" và ghi lý do vào tiến trình, job vẫn hoàn tất.

## Model tải lần đầu (trong app)

- `paraformer-zh-small` (~78 MB): nhận diện tiếng Trung
- `vits-piper-vi_VN-vais1000-medium` (~67 MB): giọng đọc tiếng Việt
- `UVR-MDX-NET-Inst_HQ_3.onnx` (~67 MB): tách nhạc nền (source-separation-models)
- NLLB-200 600M ONNX lượng tử hóa (~910 MB, Hugging Face Xenova): dịch Trung → Việt

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
│   ├── Translator.kt        # Interface dịch + UnavailableTranslator
│   ├── NllbTranslator.kt    # Tokenizer Unigram (tokenizer.json) + ONNX NLLB
│   ├── UvrSeparator.kt      # UVR MDX-NET: chunk 15s, STFT/ISTFT, ONNX
│   ├── Fft.kt               # FFT độ dài bất kỳ (6144 = 2^11·3)
│   ├── VietnameseTts.kt
│   ├── Composer.kt          # Trộn nhạc gốc + giọng Việt đúng mốc thời gian
│   ├── VideoExporter.kt     # AAC encode, mux với video gốc (không re-encode hình), lưu MediaStore
│   └── DubbingPipeline.kt   # Điều phối các bước
├── service/DubForegroundService.kt
└── ui/                      # MainViewModel, Screens
```

## Giới hạn đã biết

- Nhận diện đoạn bằng năng lượng; đoạn quá dài bị cắt 12 giây. Dịch từng đoạn độc lập nên ngữ cảnh giữa các câu bị mất.
- Dịch greedy không KV-cache: mỗi đoạn có thể mất vài chục giây trên máy yếu.
- Tách giọng: 20 chunk cho video 5 phút, mỗi chunk chạy UVR trên CPU; có thể mất vài phút.
- Giọng Việt đọc nhanh tối đa 1.6x để vừa khung thời gian gốc; nếu vẫn dài hơn, phần thừa có thể đè lên đoạn kế tiếp.
- Máy RAM dưới 6 GB có thể gặp lỗi bộ nhớ với video dài.
