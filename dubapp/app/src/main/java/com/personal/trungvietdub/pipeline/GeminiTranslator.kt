package com.personal.trungvietdub.pipeline

import org.json.JSONArray
import org.json.JSONObject

/**
 * Dịch Trung → Việt bằng Gemini. Gửi cả khối câu liên tiếp (có câu ngữ cảnh) để model giữ được mạch
 * và cách xưng hô xuyên suốt. Số câu trả về phải khớp đầu vào, nếu không thì báo lỗi để chuyển sang dự phòng.
 */
object GeminiTranslator {
    private const val PROMPT =
        "Bạn là dịch giả phụ đề phim. Dưới đây là danh sách các câu tiếng Trung liên tiếp, lấy từ cùng một video " +
            "(đầu vào là JSON mảng chuỗi). Hãy dịch từng câu sang tiếng Việt tự nhiên, đúng ngữ cảnh của cả đoạn, " +
            "giữ cách xưng hô nhất quán, ngắn gọn để khớp thời lượng lồng tiếng, không thêm chú thích. " +
            "Một số câu đầu có thể là ngữ cảnh; vẫn dịch đầy đủ. " +
            "Trả về JSON {\"lines\": [...]} có ĐÚNG cùng số phần tử và cùng thứ tự với đầu vào."

    private val SCHEMA = JSONObject()
        .put("type", "OBJECT")
        .put(
            "properties",
            JSONObject().put("lines", JSONObject().put("type", "ARRAY").put("items", JSONObject().put("type", "STRING"))),
        )
        .put("required", JSONArray(listOf("lines")))

    /** Trả về bản dịch cho từng dòng; dòng rỗng trả về "". */
    fun translate(apiKey: String, lines: List<String>): List<String> {
        val out = MutableList(lines.size) { "" }
        val idx = lines.indices.filter { lines[it].isNotBlank() }
        if (idx.isEmpty()) return out
        val input = JSONArray(idx.map { lines[it].replace('\n', ' ').trim() })
        val parts = JSONArray().put(JSONObject().put("text", PROMPT + "\nĐầu vào: " + input.toString()))
        val arr = JSONObject(GeminiApi.generateJson(apiKey, parts, SCHEMA)).getJSONArray("lines")
        if (arr.length() != idx.size) {
            error("Gemini trả ${arr.length()} câu, cần ${idx.size}")
        }
        idx.forEachIndexed { k, i -> out[i] = arr.getString(k).trim() }
        return out
    }
}
