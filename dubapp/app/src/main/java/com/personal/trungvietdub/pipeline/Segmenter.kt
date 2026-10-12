package com.personal.trungvietdub.pipeline

import kotlin.math.log10
import kotlin.math.sqrt

/**
 * Tìm các đoạn có lời nói bằng năng lượng (RMS) theo khung 30ms.
 * Ngưỡng tự động dựa trên mức nền (percentile 20) để chịu được nhạc nền vừa phải.
 * Đây là cách đơn giản, không thay thế được VAD thần kinh trong các video rất ồn.
 */
object Segmenter {
    const val SR = 16_000
    private const val FRAME = 480          // 30 ms
    private const val MIN_SEG_MS = 400L
    private const val MAX_SEG_MS = 12_000L
    private const val GAP_MS = 350L        // khoảng lặng để tách hai câu
    private const val PAD_MS = 120L

    data class Span(val startMs: Long, val endMs: Long)

    fun segment(mono: FloatArray): List<Span> {
        val frames = mono.size / FRAME
        if (frames == 0) return emptyList()
        val db = DoubleArray(frames) { f ->
            var s = 0.0
            val base = f * FRAME
            for (i in 0 until FRAME) s += mono[base + i].toDouble() * mono[base + i]
            10 * log10(sqrt(s / FRAME) + 1e-9)
        }
        val sorted = db.sortedArray()
        val floor = sorted[(frames * 0.2).toInt().coerceAtMost(frames - 1)]
        val threshold = maxOf(floor + 10.0, -50.0)

        val spans = ArrayList<Span>()
        var start = -1
        var lastVoice = -1
        fun close(endFrame: Int) {
            if (start < 0) return
            val s = maxOf(0L, start * 30L - PAD_MS)
            val e = minOf(mono.size * 1000L / SR, endFrame * 30L + PAD_MS)
            if (e - s >= MIN_SEG_MS) spans.add(Span(s, e))
            start = -1
        }
        for (f in 0 until frames) {
            val voice = db[f] > threshold
            if (voice) {
                if (start < 0) start = f
                lastVoice = f
                if ((f - start) * 30L >= MAX_SEG_MS) {
                    close(f + 1)
                }
            } else if (start >= 0 && (f - lastVoice) * 30L >= GAP_MS) {
                close(lastVoice + 1)
            }
        }
        close(lastVoice + 1)
        return spans
    }
}
