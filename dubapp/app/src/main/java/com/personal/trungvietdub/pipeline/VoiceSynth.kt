package com.personal.trungvietdub.pipeline

import android.content.Context
import android.net.Uri
import com.personal.trungvietdub.data.TtsFiles
import java.io.File
import kotlin.math.roundToInt

/**
 * Tạo giọng Việt cho một câu: ưu tiên giọng neural edge-tts (miễn phí, không cần key),
 * nếu lỗi mạng/dịch vụ thì dùng VITS offline. Mỗi worker có một instance riêng.
 */
class VoiceSynth(
    private val context: Context,
    private val workDir: File,
    private val ttsFiles: TtsFiles,
    private val threads: Int,
    private val speed: Float,
) : AutoCloseable {
    private var vits: VietnameseTts? = null

    /** Trả về (âm thanh mono 44.1 kHz, nguồn "edge" hoặc "vits"). */
    fun synth(index: Int, text: String, slotMs: Long): Pair<FloatArray, String> {
        try {
            return edge(index, text, slotMs) to "edge"
        } catch (_: Exception) {
            // Mất mạng hoặc dịch vụ không chính thức lỗi: chuyển sang VITS offline
        }
        val v = vits ?: VietnameseTts(ttsFiles, threads).also { vits = it }
        val wav = v.speak(text, slotMs, speed)
        return AudioIO.convert(AudioIO.Pcm(wav, v.sampleRate, 1), Composer.OUT_RATE, 1) to "vits"
    }

    private fun edge(index: Int, text: String, slotMs: Long): FloatArray {
        val baseRate = ((speed - 1f) * 100f).roundToInt()
        var pcm = decodeMp3(index, EdgeTts.synthesize(text, EdgeTts.VOICE_FEMALE, EdgeTts.rateFor(speed)))
        val durMs = pcm.size * 1000L / Composer.OUT_RATE
        if (slotMs > 0 && durMs > slotMs * 1.05) {
            // Câu dài hơn khung gốc: tăng tốc để vừa khung, tối đa +60%
            val extra = ((durMs.toDouble() / slotMs - 1.0) * 100.0).roundToInt()
            val pct = (baseRate + extra).coerceIn(baseRate, 60)
            val rate = if (pct >= 0) "+$pct%" else "$pct%"
            pcm = decodeMp3(index, EdgeTts.synthesize(text, EdgeTts.VOICE_FEMALE, rate))
        }
        return pcm
    }

    private fun decodeMp3(index: Int, mp3: ByteArray): FloatArray {
        val f = File(workDir, "edge_$index.mp3")
        f.writeBytes(mp3)
        try {
            return AudioIO.convert(AudioIO.decode(context, Uri.fromFile(f)), Composer.OUT_RATE, 1)
        } finally {
            f.delete()
        }
    }

    override fun close() {
        vits?.close()
    }
}
