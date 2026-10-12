package com.personal.trungvietdub.pipeline

import android.content.Context
import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import java.nio.ByteOrder

/** Giải mã audio của video thành PCM float và chuyển đổi kênh / tần số lấy mẫu. */
object AudioIO {

    class Pcm(val samples: FloatArray, val sampleRate: Int, val channels: Int)

    private class FloatBuf(cap: Int) {
        var a = FloatArray(cap)
        var n = 0
        fun add(v: Float) {
            if (n == a.size) a = a.copyOf(a.size * 2)
            a[n++] = v
        }
        fun toArray(): FloatArray = a.copyOf(n)
    }

    fun decode(context: Context, uri: Uri): Pcm {
        val ex = MediaExtractor()
        ex.setDataSource(context, uri, null)
        var track = -1
        var format: MediaFormat? = null
        for (i in 0 until ex.trackCount) {
            val f = ex.getTrackFormat(i)
            if (f.getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true) {
                track = i; format = f; break
            }
        }
        require(track >= 0 && format != null) { "Video không có âm thanh" }
        ex.selectTrack(track)

        val codec = MediaCodec.createDecoderByType(format.getString(MediaFormat.KEY_MIME)!!)
        codec.configure(format, null, null, 0)
        codec.start()

        var sampleRate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
        var channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
        var encoding = AudioFormat.ENCODING_PCM_16BIT
        val out = FloatBuf(1 shl 20)
        val info = MediaCodec.BufferInfo()
        var inputDone = false
        var outputDone = false

        while (!outputDone) {
            if (!inputDone) {
                val idx = codec.dequeueInputBuffer(10_000)
                if (idx >= 0) {
                    val buf = codec.getInputBuffer(idx)!!
                    val n = ex.readSampleData(buf, 0)
                    if (n < 0) {
                        codec.queueInputBuffer(idx, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                        inputDone = true
                    } else {
                        codec.queueInputBuffer(idx, 0, n, ex.sampleTime, 0)
                        ex.advance()
                    }
                }
            }
            val oi = codec.dequeueOutputBuffer(info, 10_000)
            when {
                oi == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                    val f = codec.outputFormat
                    sampleRate = f.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                    channels = f.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                    encoding = if (f.containsKey(MediaFormat.KEY_PCM_ENCODING))
                        f.getInteger(MediaFormat.KEY_PCM_ENCODING) else AudioFormat.ENCODING_PCM_16BIT
                }
                oi >= 0 -> {
                    val ob = codec.getOutputBuffer(oi)!!
                    if (info.size > 0) {
                        ob.position(info.offset)
                        ob.limit(info.offset + info.size)
                        val bb = ob.slice().order(ByteOrder.nativeOrder())
                        if (encoding == AudioFormat.ENCODING_PCM_FLOAT) {
                            val fb = bb.asFloatBuffer()
                            while (fb.hasRemaining()) out.add(fb.get())
                        } else {
                            val sb = bb.asShortBuffer()
                            while (sb.hasRemaining()) out.add(sb.get() / 32768f)
                        }
                    }
                    codec.releaseOutputBuffer(oi, false)
                    if ((info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) outputDone = true
                }
            }
        }
        codec.stop(); codec.release(); ex.release()
        return Pcm(out.toArray(), sampleRate, channels)
    }

    /** Chuyển sang [outRate] Hz và [outChannels] kênh (interleaved). */
    fun convert(pcm: Pcm, outRate: Int, outChannels: Int): FloatArray {
        val inCh = pcm.channels
        val inFrames = pcm.samples.size / inCh
        // 1) đổi số kênh
        val mixed = FloatArray(inFrames * outChannels)
        for (f in 0 until inFrames) {
            if (outChannels == 1) {
                var s = 0f
                for (c in 0 until inCh) s += pcm.samples[f * inCh + c]
                mixed[f] = s / inCh
            } else {
                for (c in 0 until outChannels) {
                    mixed[f * outChannels + c] = pcm.samples[f * inCh + minOf(c, inCh - 1)]
                }
            }
        }
        if (pcm.sampleRate == outRate) return mixed
        // 2) đổi tần số lấy mẫu (nội suy tuyến tính)
        val ratio = pcm.sampleRate.toDouble() / outRate
        val outFrames = (inFrames / ratio).toInt()
        val res = FloatArray(outFrames * outChannels)
        for (f in 0 until outFrames) {
            val pos = f * ratio
            val i0 = pos.toInt()
            val i1 = minOf(i0 + 1, inFrames - 1)
            val t = (pos - i0).toFloat()
            for (c in 0 until outChannels) {
                val a = mixed[i0 * outChannels + c]
                val b = mixed[i1 * outChannels + c]
                res[f * outChannels + c] = a + (b - a) * t
            }
        }
        return res
    }
}
