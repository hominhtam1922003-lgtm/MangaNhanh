# Kế hoạch các bước còn lại

1. Dịch Trung→Việt: NLLB-200-distilled-600M dạng ONNX (encoder + decoder + tokenizer SentencePiece). Tham khảo bản đã export của Xenova trên Hugging Face. Triển khai `class NllbTranslator : Translator`.
2. Tách giọng: UVR-MDX-NET-Inst_HQ_3 (ONNX, 66 MB). Thuật toán đã xác minh từ mã sherpa-onnx: STFT n_fft=2*dim_f, hop 1024, chunk 15 giây, margin 1 giây; mô hình nhận tensor [1, 4, dim_f, dim_t] và trả phổ nhạc. Vocal = mix - instrumental.
3. Biên dịch và kiểm thử trên máy thật (RAM 6–8 GB), đo thời gian xử lý video 1–5 phút.
