package com.personal.trungvietdub.pipeline

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/**
 * FFT phức độ dài bất kỳ (phân rã Cooley–Tukey theo thừa số nguyên tố).
 * Dùng cho STFT/ISTFT của UVR (n_fft = 2*dim_f, ví dụ 6144 = 2^11 · 3).
 * Thừa số nguyên tố lớn được tính bằng DFT trực tiếp (chậm nhưng hiếm gặp).
 */
class Fft(val n: Int) {
    private val twRe = DoubleArray(n) { cos(-2.0 * PI * it / n) }
    private val twIm = DoubleArray(n) { sin(-2.0 * PI * it / n) }

    /** Trả về (re, im) của DFT thuận. Không thay đổi đầu vào. */
    fun forward(re: DoubleArray, im: DoubleArray): Pair<DoubleArray, DoubleArray> {
        val outRe = DoubleArray(n)
        val outIm = DoubleArray(n)
        rec(re, im, 0, 1, n, outRe, outIm, 0)
        return outRe to outIm
    }

    private fun smallestFactor(len: Int): Int {
        if (len % 2 == 0) return 2
        var d = 3
        while (d.toLong() * d <= len) {
            if (len % d == 0) return d
            d += 2
        }
        return len
    }

    private fun rec(
        inRe: DoubleArray, inIm: DoubleArray, inOff: Int, stride: Int, len: Int,
        outRe: DoubleArray, outIm: DoubleArray, outOff: Int,
    ) {
        if (len == 1) {
            outRe[outOff] = inRe[inOff]; outIm[outOff] = inIm[inOff]; return
        }
        val p = smallestFactor(len)
        val step = n / len
        if (p == len) {
            for (k in 0 until len) {
                var sr = 0.0
                var si = 0.0
                for (j in 0 until len) {
                    val idx = inOff + j * stride
                    val t = ((j.toLong() * k) % len).toInt() * step
                    val wr = twRe[t]; val wi = twIm[t]
                    sr += inRe[idx] * wr - inIm[idx] * wi
                    si += inRe[idx] * wi + inIm[idx] * wr
                }
                outRe[outOff + k] = sr; outIm[outOff + k] = si
            }
            return
        }
        val m = len / p
        for (r in 0 until p) {
            rec(inRe, inIm, inOff + r * stride, stride * p, m, outRe, outIm, outOff + r * m)
        }
        val yr = DoubleArray(len) { outRe[outOff + it] }
        val yi = DoubleArray(len) { outIm[outOff + it] }
        for (k in 0 until m) {
            for (q in 0 until p) {
                val kk = k + q * m
                var sr = 0.0
                var si = 0.0
                for (r in 0 until p) {
                    val yIdx = r * m + k
                    val t = ((r.toLong() * kk) % len).toInt() * step
                    val wr = twRe[t]; val wi = twIm[t]
                    sr += yr[yIdx] * wr - yi[yIdx] * wi
                    si += yr[yIdx] * wi + yi[yIdx] * wr
                }
                outRe[outOff + kk] = sr; outIm[outOff + kk] = si
            }
        }
    }
}
