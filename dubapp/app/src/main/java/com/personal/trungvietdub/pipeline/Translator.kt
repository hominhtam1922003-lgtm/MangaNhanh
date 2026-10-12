package com.personal.trungvietdub.pipeline

/**
 * Dịch Trung → Việt. Bản hiện tại CHƯA có model dịch được tích hợp,
 * nên pipeline sẽ dừng ở bước dịch với thông báo rõ ràng thay vì trả về bản dịch giả.
 *
 * Hướng tích hợp tiếp theo: NLLB-200-distilled-600M (ONNX, encoder/decoder + SentencePiece),
 * triển khai thành một lớp mới implement [Translator].
 */
interface Translator {
    suspend fun translate(zh: String): String
}

class UnavailableTranslator : Translator {
    override suspend fun translate(zh: String): String =
        throw IllegalStateException(
            "Chưa tích hợp model dịch Trung → Việt. Bản này đã nhận diện được tiếng Trung, " +
                "nhưng chưa thể tạo lời Việt."
        )
}
