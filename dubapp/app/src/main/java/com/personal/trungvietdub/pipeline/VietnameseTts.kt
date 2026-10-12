package com.personal.trungvietdub.pipeline

import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsVitsModelConfig
import com.personal.trungvietdub.data.TtsFiles

/** Giọng Việt offline (VITS / Piper). Trả về mono float + sampleRate của model. */
class VietnameseTts(files: TtsFiles) : AutoCloseable {
    private val tts: OfflineTts

    init {
        val config = OfflineTtsConfig(
            model = OfflineTtsModelConfig(
                vits = OfflineTtsVitsModelConfig(
                    model = files.model.absolutePath,
                    tokens = files.tokens.absolutePath,
                    dataDir = files.espeakDataDir.absolutePath,
                ),
                numThreads = 4,
                provider = "cpu",
            ),
            maxNumSentences = 1,
        )
        tts = OfflineTts(assetManager = null, config = config)
    }

    val sampleRate: Int get() = tts.sampleRate()

    /**
     * Tạo giọng đọc cho [text] sao cho vừa khung [slotMs].
     * [userSpeed] là tốc độ người dùng chọn (1.0 = bình thường). Nếu bản đọc dài hơn khung,
     * tăng tốc thêm tối đa 1.6x để khớp; nếu ngắn hơn khung thì giữ nguyên, không kéo dài giọng.
     */
    fun speak(text: String, slotMs: Long, userSpeed: Float = 1.0f): FloatArray {
        val base = userSpeed.coerceIn(0.5f, 2.0f)
        val first = tts.generate(text, sid = 0, speed = base)
        val durMs = first.samples.size * 1000L / first.sampleRate
        if (slotMs <= 0 || durMs <= slotMs) return first.samples
        val extra = (durMs.toFloat() / slotMs).coerceIn(1.0f, 1.6f)
        return tts.generate(text, sid = 0, speed = base * extra).samples
    }

    override fun close() = tts.release()
}
