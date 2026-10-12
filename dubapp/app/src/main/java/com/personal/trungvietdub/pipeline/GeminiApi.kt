package com.personal.trungvietdub.pipeline

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

/** Lớp gọi Gemini generateContent dùng chung: trả JSON theo schema, tự thử lại và đổi model khi cần. */
object GeminiApi {
    /** Model ưu tiên theo thứ tự (model cũ có thể bị ngừng cấp cho người dùng mới, khi đó 404 và chuyển model sau). */
    private val MODELS = listOf("gemini-3.8-flash", "gemini-3.5-flash", "gemini-2.5-pro")

    /** Model đã trả lời thành công lần gần nhất: các lần sau bắt đầu từ đó để không tốn lượt gọi lỗi 404. */
    @Volatile private var preferred: String? = null

    private class HttpError(val code: Int, msg: String) : Exception(msg)

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(300, TimeUnit.SECONDS)
        .callTimeout(600, TimeUnit.SECONDS)
        .connectionPool(okhttp3.ConnectionPool(8, 5, TimeUnit.MINUTES))
        .build()

    /** [parts]: các phần nội dung (text / inline_data). Trả về chuỗi JSON do model sinh ra. */
    fun generateJson(apiKey: String, parts: JSONArray, schema: JSONObject): String {
        val models = listOfNotNull(preferred) + MODELS.filter { it != preferred }
        var last: Exception? = null
        for (model in models) {
            val body = JSONObject()
                .put("contents", JSONArray().put(JSONObject().put("parts", parts)))
                .put(
                    "generationConfig",
                    JSONObject()
                        .put("temperature", 0)
                        .put("responseMimeType", "application/json")
                        .put("responseSchema", schema)
                        .apply {
                            // Model Flash 3.x: suy luận mức thấp để giảm độ trễ (không ảnh hưởng nhiều tới chép lời/dịch)
                            if (model.contains("flash") && !model.startsWith("gemini-2")) {
                                put("thinkingConfig", JSONObject().put("thinkingLevel", "LOW"))
                            }
                        },
                )
                .toString()
            for (attempt in 1..4) {
                try {
                    val out = call(apiKey, model, body)
                    preferred = model
                    return out
                } catch (e: HttpError) {
                    last = e
                    if (e.code == 429 && attempt < 4) { Thread.sleep(15_000L * attempt); continue }
                    if (e.code == 404 || e.code == 429 || e.code >= 500) break
                    throw IllegalStateException(e.message, e)
                } catch (e: IOException) {
                    last = e
                    if (attempt >= 3) break
                    Thread.sleep(3_000L * attempt)
                }
            }
        }
        throw IllegalStateException("Gemini lỗi: ${last?.message}", last)
    }

    private fun call(apiKey: String, model: String, body: String): String {
        val req = Request.Builder()
            .url("https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent")
            .header("x-goog-api-key", apiKey)
            .post(body.toRequestBody("application/json".toMediaType()))
            .build()
        client.newCall(req).execute().use { resp ->
            val text = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) throw HttpError(resp.code, "HTTP ${resp.code} ($model): ${text.take(300)}")
            val cand = JSONObject(text).getJSONArray("candidates").getJSONObject(0)
            val parts = cand.optJSONObject("content")?.optJSONArray("parts")
                ?: throw IllegalStateException("Gemini không trả nội dung (${cand.optString("finishReason")})")
            return parts.getJSONObject(0).getString("text")
        }
    }
}
