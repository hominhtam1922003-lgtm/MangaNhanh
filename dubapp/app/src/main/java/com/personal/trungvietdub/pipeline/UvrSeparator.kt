package com.personal.trungvietdub.pipeline

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import java.io.File
import java.nio.FloatBuffer
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min

/**
 * Tách nhạc nền khỏi giọng bằng UVR MDX-NET (model Inst: đầu ra là phần nhạc/nền).
 * Thuật toán bám theo sherpa-onnx (offline-source-separation-uvr-impl.h):
 *  - chunk 15 giây, lề 1 giây hai bên, STFT center=true với n_fft = 2*dim_f, hop 1024, cửa sổ Hann
 *  - model nhận tensor [batch, 4, dim_f, dim_t]: (L re, L im, R re, R im)
 *  - ISTFT overlap-add có chuẩn hóa theo tổng bình phương cửa sổ
 * Đầu vào/đầu ra: stereo interleaved, 44.1 kHz.
 * Giọng gốc = mix - nhạc (tính ở Composer khi cần).
 */
class UvrSeparator(modelFile: File) : AutoCloseable {
    private val env = OrtEnvironment.getEnvironment()
    private val session: OrtSession
    private val sampleRate: Int
    private val nFft: Int
    private val hop: Int
    private val dimF: Int
    private val dimT: Int
    private val dimC: Int
    private val bins: Int
    private val trim: Int
    private val chunkSize: Int
    private val gen: Int
    private val fft: Fft
    private val window: DoubleArray

    init {
        val opts = OrtSession.SessionOptions().apply { setIntraOpNumThreads(4) }
        session = env.createSession(modelFile.absolutePath, opts)
        val md = session.metadata.customMetadata
        require(md["model_type"] == "UVR") { "Model không phải UVR (model_type=${md["model_type"]})" }
        require(md["stems"] == "2") { "Chỉ hỗ trợ model 2 stem" }
        sampleRate = md.getValue("sample_rate").toInt()
        nFft = md.getValue("n_fft").toInt()
        hop = md.getValue("hop_length").toInt()
        dimF = md.getValue("dim_f").toInt()
        dimT = md.getValue("dim_t").toInt()
        dimC = md.getValue("dim_c").toInt()
        require(dimC == 4) { "dim_c phải bằng 4 (stereo re/im), nhận $dimC" }
        require(md["window_type"].orEmpty().ifEmpty { "hann" } == "hann") { "Chỉ hỗ trợ cửa sổ hann" }
        bins = nFft / 2 + 1
        trim = nFft / 2
        chunkSize = hop * (dimT - 1)
        gen = chunkSize - 2 * trim
        fft = Fft(nFft)
        // Hann tuần hoàn, giống torch.hann_window (knf dùng cùng công thức)
        window = DoubleArray(nFft) { 0.5 - 0.5 * cos(2.0 * PI * it / nFft) }
    }

    /** Trả về nhạc nền stereo interleaved cùng độ dài với [stereo44k]. */
    fun separate(stereo44k: FloatArray, onProgress: (Float) -> Unit = {}): FloatArray {
        require(sampleRate == 44100) { "Model cần ${sampleRate} Hz, app đang dùng 44100" }
        val total = stereo44k.size / 2
        val left = FloatArray(total) { stereo44k[it * 2] }
        val right = FloatArray(total) { stereo44k[it * 2 + 1] }
        val outL = FloatArray(total)
        val outR = FloatArray(total)

        var chunk = 15 * sampleRate
        var margin = sampleRate
        if (total < chunk) chunk = total
        if (margin > chunk) margin = chunk

        var i = 0
        while (i < total) {
            val start = max(0, i - margin)
            val end = min(i + chunk + margin, total)
            if (start >= end) break
            val len = end - start
            val (yl, yr) = processChunk(left.copyOfRange(start, end), right.copyOfRange(start, end))
            val s = if (i == 0) 0 else margin
            val e = if (end == total) len else len - margin
            System.arraycopy(yl, s, outL, start + s, e - s)
            System.arraycopy(yr, s, outR, start + s, e - s)
            onProgress(end.toFloat() / total)
            if (end == total) break
            i += chunk
        }

        val out = FloatArray(total * 2)
        for (k in 0 until total) {
            out[k * 2] = outL[k]
            out[k * 2 + 1] = outR[k]
        }
        return out
    }

    private fun processChunk(l: FloatArray, r: FloatArray): Pair<FloatArray, FloatArray> {
        val len = l.size
        val pad = gen - len % gen
        val padLen = trim + len + pad + trim
        val pl = FloatArray(padLen)
        val pr = FloatArray(padLen)
        System.arraycopy(l, 0, pl, trim, len)
        System.arraycopy(r, 0, pr, trim, len)
        val numSeg = (len + pad) / gen

        // ---- STFT -> tensor [numSeg, 4, dimF, dimT]
        val input = FloatArray(numSeg * 4 * dimF * dimT)
        for (s in 0 until numSeg) {
            val start = s * gen
            for (ch in 0..1) {
                val src = if (ch == 0) pl else pr
                val (re, im) = stft(src, start)
                for (f in 0 until dimF) for (t in 0 until dimT) {
                    input[((s * 4 + 2 * ch) * dimF + f) * dimT + t] = re[t * bins + f]
                    input[((s * 4 + 2 * ch + 1) * dimF + f) * dimT + t] = im[t * bins + f]
                }
            }
        }

        // ---- Chạy model
        val output = FloatArray(input.size)
        val shape = longArrayOf(numSeg.toLong(), 4, dimF.toLong(), dimT.toLong())
        OnnxTensor.createTensor(env, FloatBuffer.wrap(input), shape).use { x ->
            session.run(mapOf(session.inputNames.first() to x)).use { res ->
                val t = res.get(0) as OnnxTensor
                t.floatBuffer.rewind()
                t.floatBuffer.get(output)
            }
        }

        // ---- ISTFT overlap-add
        val yl = FloatArray(len + pad)
        val yr = FloatArray(len + pad)
        val specRe = FloatArray(dimT * bins)
        val specIm = FloatArray(dimT * bins)
        for (s in 0 until numSeg) {
            val start = s * gen
            for (ch in 0..1) {
                specRe.fill(0f); specIm.fill(0f)
                for (f in 0 until dimF) for (t in 0 until dimT) {
                    specRe[t * bins + f] = output[((s * 4 + 2 * ch) * dimF + f) * dimT + t]
                    specIm[t * bins + f] = output[((s * 4 + 2 * ch + 1) * dimF + f) * dimT + t]
                }
                val acc = istft(specRe, specIm)
                val dst = if (ch == 0) yl else yr
                // sample gen[k] nằm tại acc[n + k] (bỏ phần lề trim)
                for (k in 0 until gen) dst[start + k] = acc[nFft + k].toFloat()
            }
        }
        return yl.copyOf(len) to yr.copyOf(len)
    }

    /** STFT center=true của đoạn x[start, start+chunkSize). Trả về (re, im) dạng [dimT * bins]. */
    private fun stft(x: FloatArray, start: Int): Pair<FloatArray, FloatArray> {
        val re = FloatArray(dimT * bins)
        val im = FloatArray(dimT * bins)
        val bufRe = DoubleArray(nFft)
        val bufIm = DoubleArray(nFft)
        for (f in 0 until dimT) {
            for (q in 0 until nFft) {
                val p = reflect(f * hop + q - trim, chunkSize)
                bufRe[q] = x[start + p] * window[q]
                bufIm[q] = 0.0
            }
            val (fr, fi) = fft.forward(bufRe, bufIm)
            for (b in 0 until bins) {
                re[f * bins + b] = fr[b].toFloat()
                im[f * bins + b] = fi[b].toFloat()
            }
        }
        return Pair(re, im)
    }

    /** ISTFT một đoạn; trả về mảng độ dài nFft + (dimT-1)*hop đã chuẩn hóa. */
    private fun istft(re: FloatArray, im: FloatArray): DoubleArray {
        val num = nFft + (dimT - 1) * hop
        val acc = DoubleArray(num)
        val den = DoubleArray(num)
        val xr = DoubleArray(nFft)
        val xi = DoubleArray(nFft)
        for (f in 0 until dimT) {
            // ifft(X) = conj(fft(conj(X)))/n ; phần thực = Re(fft(conj X))/n
            for (k in 0 until bins) {
                xr[k] = re[f * bins + k].toDouble()
                xi[k] = -im[f * bins + k].toDouble()
            }
            for (k in bins until nFft) {
                xr[k] = re[f * bins + (nFft - k)].toDouble()
                xi[k] = im[f * bins + (nFft - k)].toDouble()
            }
            val (fr, _) = fft.forward(xr, xi)
            for (q in 0 until nFft) {
                val w = window[q]
                acc[f * hop + q] += fr[q] / nFft * w
                den[f * hop + q] += w * w
            }
        }
        for (a in 0 until num) if (den[a] > 1e-8) acc[a] /= den[a]
        return acc
    }

    private fun reflect(p: Int, len: Int): Int = when {
        p < 0 -> -p
        p >= len -> 2 * (len - 1) - p
        else -> p
    }

    override fun close() {
        session.close()
    }
}
