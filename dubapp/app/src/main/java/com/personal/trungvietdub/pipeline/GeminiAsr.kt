package com.personal.trungvietdub.pipeline

import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Nhận diện tiếng Trung bằng Gemini (online). Gửi audio 16 kHz mono (đã tách lời) theo khối,
 * model trả về JSON các câu kèm thời điểm bắt đầu/kết thúc (giây).
 * Dùng khóa API Gemini của người dùng (gói miễn phí của Google AI Studio).
 */
object GeminiAsr {
    /** Độ dài mỗi khối gửi đi (giây). Khối 4 phút ≈ 7.7 MB WAV, nằm trong giới hạn 20 MB của inline audio. */
    const val WINDOW_SEC = 240

    data class Seg(val startMs: Long, val endMs: Long, val text: String)

    private const val PROMPT_SPANS =
        "Đây là một đoạn audio tiếng Trung (phổ thông) gồm nhiều đoạn lời nói. Với MỖI đoạn trong danh sách, " +
            "hãy chép lời nói trong khoảng [start, end] (giây) bằng chữ Hán giản thể, nguyên văn, KHÔNG dịch, " +
            "KHÔNG thêm chú thích. Đoạn không có lời thì để chuỗi rỗng. Trả về JSON {\"items\": [{\"id\":..., \"text\":...}]} " +
            "và phải có đủ mọi id trong danh sách. Bỏ qua nhạc nền và tiếng ồn."

    private val SCHEMA_SPANS = JSONObject()
        .put("type", "OBJECT")
        .put(
            "properties",
            JSONObject().put(
                "items",
                JSONObject()
                    .put("type", "ARRAY")
                    .put(
                        "items",
                        JSONObject()
                            .put("type", "OBJECT")
                            .put(
                                "properties",
                                JSONObject()
                                    .put("id", JSONObject().put("type", "INTEGER"))
                                    .put("text", JSONObject().put("type", "STRING")),
                            )
                            .put("required", JSONArray(listOf("id", "text"))),
                    ),
            ),
        )
        .put("required", JSONArray(listOf("items")))

    private const val PROMPT =
        "Đây là một đoạn audio tiếng Trung (phổ thông). Hãy chép lời nói nguyên văn bằng chữ Hán giản thể, " +
            "KHÔNG dịch và KHÔNG thêm chú thích. Chia thành các câu hoặc cụm tự nhiên, mỗi đoạn kèm thời điểm " +
            "bắt đầu và kết thúc tính bằng giây từ đầu audio. Bỏ qua nhạc nền và tiếng ồn. " +
            "Nếu không có lời nói thì trả về danh sách rỗng."

    private val SCHEMA = JSONObject()
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

    /**
     * Nhận diện một khối audio 16 kHz mono theo các đoạn VAD đã biết ([spans] = (startMs, endMs) tính từ đầu khối).
     * Gemini chỉ chép lời cho từng id đoạn, nên lời luôn gắn đúng đoạn, không phụ thuộc mốc thời gian Gemini tự đoán.
     * Trả về map: chỉ số đoạn trong khối -> lời (thiếu id thì không có trong map).
     */
    fun transcribeSpans(apiKey: String, samples16k: FloatArray, spans: List<Pair<Long, Long>>): Map<Int, String> {
        if (spans.isEmpty()) return emptyMap()
        val b64 = Base64.encodeToString(wav16(samples16k, 16_000), Base64.NO_WRAP)
        val list = JSONArray()
        spans.forEachIndexed { k, sp ->
            list.put(JSONObject().put("id", k).put("start", sp.first / 1000.0).put("end", sp.second / 1000.0))
        }
        val prompt = PROMPT_SPANS + "\nDanh sách đoạn (JSON): " + list.toString()
        val parts = JSONArray()
            .put(JSONObject().put("inline_data", JSONObject().put("mime_type", "audio/wav").put("data", b64)))
            .put(JSONObject().put("text", prompt))
        val json = JSONObject(GeminiApi.generateJson(apiKey, parts, SCHEMA_SPANS))
        val arr = json.optJSONArray("items") ?: JSONArray()
        val out = HashMap<Int, String>()
        for (n in 0 until arr.length()) {
            val o = arr.getJSONObject(n)
            out[o.getInt("id")] = o.optString("text", "").trim()
        }
        return out
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
