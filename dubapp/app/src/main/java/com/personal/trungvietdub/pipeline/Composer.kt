package com.personal.trungvietdub.pipeline

import com.personal.trungvietdub.data.OriginalAudioMode

/** Ghép nhạc/âm thanh gốc (stereo 44.1 kHz) với các đoạn giọng Việt đặt đúng mốc thời gian. */
object Composer {
    const val OUT_RATE = 44_100
    const val OUT_CH = 2

    class Clip(val startMs: Long, val mono44k: FloatArray)

    fun mix(
        original: FloatArray,            // stereo interleaved, OUT_RATE
        clips: List<Clip>,
        mode: OriginalAudioMode,
        originalGain: Float = 0.25f,     // khi LOWER: giữ ~25% âm lượng gốc (nhạc vẫn nghe được)
        voiceGain: Float = 1.0f,
    ): FloatArray {
        val frames = original.size / OUT_CH
        val out = FloatArray(original.size)
        val gain = when (mode) {
            OriginalAudioMode.LOWER -> originalGain
            OriginalAudioMode.MUTE -> 0f
        }
        for (i in original.indices) out[i] = original[i] * gain

        for (clip in clips) {
            val startFrame = (clip.startMs * OUT_RATE / 1000).toInt()
            for (i in clip.mono44k.indices) {
                val f = startFrame + i
                if (f >= frames) break
                val v = clip.mono44k[i] * voiceGain
                out[f * OUT_CH] += v
                out[f * OUT_CH + 1] += v
            }
        }
        // chống clipping
        var peak = 0f
        for (v in out) if (kotlin.math.abs(v) > peak) peak = kotlin.math.abs(v)
        if (peak > 0.98f) {
            val s = 0.98f / peak
            for (i in out.indices) out[i] *= s
        }
        return out
    }
}
