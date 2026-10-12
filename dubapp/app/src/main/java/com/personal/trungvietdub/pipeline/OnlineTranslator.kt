package com.personal.trungvietdub.pipeline

import okhttp3.FormBody
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import java.util.concurrent.TimeUnit

/**
 * Dịch Trung → Việt miễn phí, không cần khóa API (endpoint web của Google Translate, client=gtx).
 * Gửi cả khối câu liên tiếp trong một lần gọi để mô hình thấy ngữ cảnh, rồi tách lại theo dòng.
 * Nếu số dòng nhận về không khớp thì dịch lẻ từng dòng để không gán nhầm câu.
 */
object OnlineTranslator {
    /** Số câu mỗi khối. */
    const val CHUNK = 25

    /** Số câu đứng trước khối được gửi kèm làm ngữ cảnh (kết quả của chúng bị bỏ). */
    const val CTX = 3

    private const val URL = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=vi&dt=t"

    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .callTimeout(90, TimeUnit.SECONDS)
        .build()

    /** Dịch [lines] theo thứ tự thời gian. Trả về danh sách cùng kích thước; dòng rỗng trả về "". Gọi từ luồng IO. */
    fun translate(lines: List<String>): List<String> {
        val clean = lines.map { it.replace('\n', ' ').trim() }
        val out = MutableList(clean.size) { "" }
        val idx = clean.indices.filter { clean[it].isNotEmpty() }
        if (idx.isEmpty()) return out

        val parts = request(idx.joinToString("\n") { clean[it] })
            .split('\n').map { it.trim() }.filter { it.isNotEmpty() }
        if (parts.size == idx.size) {
            idx.forEachIndexed { k, i -> out[i] = parts[k] }
        } else {
            idx.forEach { i -> out[i] = request(clean[i]).trim() }
        }
        return out
    }

    private fun request(text: String): String {
        val body = FormBody.Builder().add("q", text).build()
        val req = Request.Builder()
            .url(URL)
            .post(body)
            .header("User-Agent", "Mozilla/5.0")
            .build()
        client.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) error("Dịch online lỗi HTTP ${resp.code}")
            val root = JSONArray(resp.body!!.string())
            val segs = root.getJSONArray(0)
            val sb = StringBuilder()
            for (i in 0 until segs.length()) sb.append(segs.getJSONArray(i).optString(0, ""))
            return sb.toString()
        }
    }
}
