package com.personal.trungvietdub.pipeline

import com.personal.trungvietdub.data.OriginalAudioMode

/** Ghép nhạc/âm thanh gốc (stereo 44.1 kHz) với các đoạn giọng Việt đặt đúng mốc thời gian. */
object Composer {
    const val OUT_RATE = 44_100
    const val OUT_CH = 2

    class Clip(val startMs: Long, val mono44k: FloatArray)

    fun mix(
        base: FloatArray,                // stereo interleaved, OUT_RATE: nhạc đã tách, hoặc audio gốc
        clips: List<Clip>,
        mode: OriginalAudioMode,
        voiceGain: Float = 1.0f,
    ): FloatArray {
        val frames = base.size / OUT_CH
        val out = FloatArray(base.size)
        val gain = when (mode) {
            OriginalAudioMode.SEPARATE -> 1.0f   // base đã là nhạc nền (không còn giọng gốc)
            OriginalAudioMode.LOWER -> 0.25f     // giữ ~25% audio gốc, vẫn còn lẫn giọng Trung
            OriginalAudioMode.MUTE -> 0f
        }
        for (i in base.indices) out[i] = base[i] * gain

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
