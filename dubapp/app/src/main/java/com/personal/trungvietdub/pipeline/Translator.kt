package com.personal.trungvietdub.pipeline

/** Dịch một đoạn tiếng Trung sang tiếng Việt. */
interface Translator : AutoCloseable {
    suspend fun translate(zh: String): String
    override fun close() {}
}

/** Dùng khi chưa tải model dịch; báo lỗi rõ ràng thay vì trả về bản dịch giả. */
class UnavailableTranslator : Translator {
    override suspend fun translate(zh: String): String =
        throw IllegalStateException("Chưa tải model dịch NLLB. Hãy tải mục \"Dịch Trung → Việt\" ở màn hình chính.")
}
