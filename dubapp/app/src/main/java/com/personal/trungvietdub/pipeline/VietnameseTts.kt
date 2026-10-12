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
     * Nếu bản đọc tốc độ thường dài hơn khung, đọc lại nhanh hơn (tối đa 1.6x).
     */
    fun speak(text: String, slotMs: Long): FloatArray {
        val first = tts.generate(text, sid = 0, speed = 1.0f)
        val durMs = first.samples.size * 1000L / first.sampleRate
        if (slotMs <= 0 || durMs <= slotMs) return first.samples
        val speed = (durMs.toFloat() / slotMs).coerceIn(1.0f, 1.6f)
        return tts.generate(text, sid = 0, speed = speed).samples
    }

    override fun close() = tts.release()
}
