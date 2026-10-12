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
    /** Model ưu tiên theo thứ tự; lỗi 404/429/5xx thì chuyển sang model sau. */
    private val MODELS = listOf("gemini-2.5-pro", "gemini-2.5-flash")

    private class HttpError(val code: Int, msg: String) : Exception(msg)

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(300, TimeUnit.SECONDS)
        .callTimeout(600, TimeUnit.SECONDS)
        .build()

    /** [parts]: các phần nội dung (text / inline_data). Trả về chuỗi JSON do model sinh ra. */
    fun generateJson(apiKey: String, parts: JSONArray, schema: JSONObject): String {
        val body = JSONObject()
            .put("contents", JSONArray().put(JSONObject().put("parts", parts)))
            .put(
                "generationConfig",
                JSONObject()
                    .put("temperature", 0)
                    .put("responseMimeType", "application/json")
                    .put("responseSchema", schema),
            )
            .toString()
        var last: Exception? = null
        for (model in MODELS) {
            for (attempt in 1..3) {
                try {
                    return call(apiKey, model, body)
                } catch (e: HttpError) {
                    last = e
                    if (e.code == 429 && attempt < 3) { Thread.sleep(20_000L * attempt); continue }
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
