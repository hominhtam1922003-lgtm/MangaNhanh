package com.personal.trungvietdub.pipeline

import android.util.Base64
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.TimeUnit

/**
 * Nhận diện tiếng Trung bằng Gemini (online). Gửi audio 16 kHz mono (đã tách lời) theo khối,
 * model trả về JSON các câu kèm thời điểm bắt đầu/kết thúc (giây).
 * Dùng khóa API Gemini của người dùng (gói miễn phí của Google AI Studio).
 */
object GeminiAsr {
    /** Model ưu tiên theo thứ tự; lỗi 404/429/5xx thì chuyển sang model sau. */
    private val MODELS = listOf("gemini-2.5-pro", "gemini-2.5-flash")

    /** Độ dài mỗi khối gửi đi (giây). Khối 4 phút ≈ 7.7 MB WAV, nằm trong giới hạn 20 MB của inline audio. */
    const val WINDOW_SEC = 240

    data class Seg(val startMs: Long, val endMs: Long, val text: String)

    private class HttpError(val code: Int, msg: String) : Exception(msg)

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(300, TimeUnit.SECONDS)
        .callTimeout(600, TimeUnit.SECONDS)
        .build()

    private const val PROMPT =
        "Đây là một đoạn audio tiếng Trung (phổ thông). Hãy chép lời nói nguyên văn bằng chữ Hán giản thể, " +
            "KHÔNG dịch và KHÔNG thêm chú thích. Chia thành các câu hoặc cụm tự nhiên, mỗi đoạn kèm thời điểm " +
            "bắt đầu và kết thúc tính bằng giây từ đầu audio. Bỏ qua nhạc nền và tiếng ồn. " +
            "Nếu không có lời nói thì trả về danh sách rỗng."

    /** Nhận diện một khối audio 16 kHz mono. Thời gian trả về tính từ đầu khối. */
    fun transcribe(apiKey: String, samples16k: FloatArray): List<Seg> {
        val b64 = android.util.Base64.encodeToString(wav16(samples16k, 16_000), Base64.NO_WRAP)
        val body = requestJson(b64)
        var last: Exception? = null
        for (model in MODELS) {
            for (attempt in 1..3) {
                try {
                    return call(apiKey, model, body)
                } catch (e: HttpError) {
                    last = e
                    if (e.code == 429 && attempt < 3) { Thread.sleep(20_000L * attempt); continue }
                    if (e.code == 404 || e.code == 429 || e.code >= 500) break
                    throw IllegalStateException("Gemini nhận diện lỗi: ${e.message}", e)
                } catch (e: java.io.IOException) {
                    last = e
                    if (attempt >= 3) break
                    Thread.sleep(3_000L * attempt)
                }
            }
        }
        throw IllegalStateException("Gemini nhận diện lỗi: ${last?.message}", last)
    }

    private fun requestJson(b64: String): String {
        val schema = JSONObject()
            .put("type", "OBJECT")
            .put(
                "properties",
                JSONObject().put(
                    "segments",
                    JSONObject()
                        .put("type", "ARRAY")
                        .put(
                            "items",
                            JSONObject()
                                .put("type", "OBJECT")
                                .put(
                                    "properties",
                                    JSONObject()
                                        .put("start", JSONObject().put("type", "NUMBER"))
                                        .put("end", JSONObject().put("type", "NUMBER"))
                                        .put("text", JSONObject().put("type", "STRING")),
                                )
                                .put("required", JSONArray(listOf("start", "end", "text"))),
                        ),
                ),
            )
            .put("required", JSONArray(listOf("segments")))
        return JSONObject()
            .put(
                "contents",
                JSONArray().put(
                    JSONObject().put(
                        "parts",
                        JSONArray()
                            .put(JSONObject().put("inline_data", JSONObject().put("mime_type", "audio/wav").put("data", b64)))
                            .put(JSONObject().put("text", PROMPT)),
                    ),
                ),
            )
            .put(
                "generationConfig",
                JSONObject()
                    .put("temperature", 0)
                    .put("responseMimeType", "application/json")
                    .put("responseSchema", schema),
            )
            .toString()
    }

    private fun call(apiKey: String, model: String, body: String): List<Seg> {
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
            val json = JSONObject(parts.getJSONObject(0).getString("text"))
            val arr = json.optJSONArray("segments") ?: JSONArray()
            return (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                Seg(
                    startMs = (o.getDouble("start") * 1000).toLong(),
                    endMs = (o.getDouble("end") * 1000).toLong(),
                    text = o.getString("text").trim(),
                )
            }.filter { it.text.isNotEmpty() }
        }
    }

    /**
     * Gán các câu Gemini vào từng đoạn VAD ([spans] = (startMs, endMs)) theo độ chồng lấp lớn nhất;
     * câu không chồng lên đoạn nào thì gán cho đoạn có tâm gần nhất. Trả về lời cho từng đoạn.
     */
    fun assign(segs: List<Seg>, spans: List<Pair<Long, Long>>): List<String> {
        val out = MutableList(spans.size) { StringBuilder() }
        if (spans.isEmpty()) return out.map { it.toString() }
        for (s in segs.sortedBy { it.startMs }) {
            var best = -1
            var bestOverlap = 0L
            for ((i, sp) in spans.withIndex()) {
                val ov = minOf(s.endMs, sp.second) - maxOf(s.startMs, sp.first)
                if (ov > bestOverlap) { bestOverlap = ov; best = i }
            }
            if (best < 0) {
                val mid = (s.startMs + s.endMs) / 2
                best = spans.indices.minByOrNull { i ->
                    val c = (spans[i].first + spans[i].second) / 2
                    kotlin.math.abs(c - mid)
                } ?: 0
            }
            out[best].append(s.text)
        }
        return out.map { it.toString() }
    }

    fun toJson(segs: List<Seg>): String = JSONArray().apply {
        segs.forEach { put(JSONObject().put("s", it.startMs).put("e", it.endMs).put("t", it.text)) }
    }.toString()

    fun fromJson(text: String): List<Seg> {
        val arr = JSONArray(text)
        return (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            Seg(o.getLong("s"), o.getLong("e"), o.getString("t"))
        }
    }

    /** WAV PCM 16-bit mono. */
    fun wav16(samples: FloatArray, sampleRate: Int): ByteArray {
        val dataLen = samples.size * 2
        val bb = ByteBuffer.allocate(44 + dataLen).order(ByteOrder.LITTLE_ENDIAN)
        bb.put("RIFF".toByteArray()).putInt(36 + dataLen).put("WAVE".toByteArray())
        bb.put("fmt ".toByteArray()).putInt(16).putShort(1).putShort(1)
            .putInt(sampleRate).putInt(sampleRate * 2).putShort(2).putShort(16)
        bb.put("data".toByteArray()).putInt(dataLen)
        for (v in samples) bb.putShort((v.coerceIn(-1f, 1f) * 32767f).toInt().toShort())
        return bb.array()
    }
}
