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
    /** Số giây audio ngữ cảnh đặt trước mỗi khối (không xuất kết quả). */
    const val CONTEXT_SEC = 12
    /** Số khối gọi Gemini song song (I/O bound, giới hạn bởi hạn mức của khóa). */
    const val PARALLEL = 3

    data class Seg(val startMs: Long, val endMs: Long, val text: String)

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

    /** Kết quả cho một đoạn VAD: lời gốc, bản dịch tiếng Việt, và giới tính người nói ("f", "m" hoặc "u" = chưa rõ). */
    data class Line(val zh: String, val vi: String, val gender: String)

    private const val PROMPT_WINDOW =
        "Đây là audio tiếng Trung (phổ thông) lồng tiếng cho một video. Đầu audio có thể có một đoạn ngữ cảnh " +
            "(không có trong danh sách): hãy nghe để hiểu mạch nhưng KHÔNG xuất kết quả cho đoạn đó. " +
            "Với MỖI đoạn trong danh sách (id, start, end, maxSyl tính bằng giây): " +
            "1) zh: chép nguyên văn lời trong khoảng [start, end] bằng chữ Hán giản thể, không thêm chú thích; " +
            "để chuỗi rỗng nếu không có lời. " +
            "2) vi: dịch sang tiếng Việt tự nhiên, đúng ngữ cảnh của cả video, giữ cách xưng hô nhất quán giữa các đoạn; " +
            "số âm tiết tiếng Việt KHÔNG vượt quá maxSyl để khớp thời lượng lồng tiếng; không thêm chú thích. " +
            "3) g: giới tính người nói của đoạn: f (nữ), m (nam), hoặc u (không rõ). " +
            "Bỏ qua nhạc nền và tiếng ồn. Trả về JSON dạng items là mảng gồm id, zh, vi, g " +
            "và phải có đủ mọi id trong danh sách."

    private val SCHEMA_WINDOW = JSONObject()
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
                                    .put("zh", JSONObject().put("type", "STRING"))
                                    .put("vi", JSONObject().put("type", "STRING"))
                                    .put(
                                        "g",
                                        JSONObject().put("type", "STRING").put("enum", JSONArray(listOf("f", "m", "u"))),
                                    ),
                            )
                            .put("required", JSONArray(listOf("id", "zh", "vi", "g"))),
                    ),
            ),
        )
        .put("required", JSONArray(listOf("items")))

    /**
     * Nhận diện + dịch trong MỘT lượt gọi cho cả khối (giảm số lượt API so với nhận diện rồi dịch riêng).
     * [audio]: đoạn audio 16 kHz mono gồm cả ngữ cảnh ở đầu; [ids]: chỉ số đoạn VAD cần xử lý;
     * [spans]: (startMs, endMs) của từng id, tính từ đầu [audio]; [slotsMs]: độ dài khung gốc của từng id.
     * Trả về map: id -> Line (thiếu id thì không có trong map).
     */
    fun transcribeAndTranslate(
        apiKey: String,
        audio: FloatArray,
        ids: List<Int>,
        spans: List<Pair<Long, Long>>,
        slotsMs: List<Long>,
    ): Map<Int, Line> {
        if (ids.isEmpty()) return emptyMap()
        val b64 = Base64.encodeToString(wav16(audio, 16_000), Base64.NO_WRAP)
        val list = JSONArray()
        ids.forEachIndexed { k, id ->
            // Khoảng 4,5 âm tiết mỗi giây ở tốc độ thường; cho thêm 1 âm tiết để tránh cắt lời
            val maxSyl = maxOf(2, Math.round(slotsMs[k] / 1000.0 * 4.5).toInt() + 1)
            list.put(
                JSONObject().put("id", id)
                    .put("start", spans[k].first / 1000.0)
                    .put("end", spans[k].second / 1000.0)
                    .put("maxSyl", maxSyl),
            )
        }
        val prompt = PROMPT_WINDOW + "\nDanh sách đoạn (JSON): " + list.toString()
        val parts = JSONArray()
            .put(JSONObject().put("inline_data", JSONObject().put("mime_type", "audio/wav").put("data", b64)))
            .put(JSONObject().put("text", prompt))
        val json = JSONObject(GeminiApi.generateJson(apiKey, parts, SCHEMA_WINDOW))
        val arr = json.optJSONArray("items") ?: JSONArray()
        val out = HashMap<Int, Line>()
        for (n in 0 until arr.length()) {
            val o = arr.getJSONObject(n)
            out[o.getInt("id")] = Line(
                o.optString("zh", "").trim(),
                o.optString("vi", "").replace('\n', ' ').trim(),
                o.optString("g", "u"),
            )
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
