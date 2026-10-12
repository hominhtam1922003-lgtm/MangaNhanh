package com.personal.trungvietdub.pipeline

import android.content.ContentValues
import android.content.Context
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.media.MediaMuxer
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder

/** Âm thanh AAC đã mã hóa, giữ trong bộ nhớ (vài MB cho video 5 phút) để ghép một lần duy nhất. */
class EncodedAudio(val format: MediaFormat, val samples: List<Sample>) {
    class Sample(val ptsUs: Long, val flags: Int, val bytes: ByteArray)
}

/** Mã hóa AAC, ghép với track video gốc (không re-encode video) và lưu vào thư viện. */
object VideoExporter {
    private const val AAC = "audio/mp4a-latm"

    /** Mã hóa PCM stereo thành AAC trong bộ nhớ. Không tạo file trung gian, không dùng muxer riêng cho âm thanh. */
    fun encodeAac(pcmStereo: FloatArray, sampleRate: Int, channels: Int): EncodedAudio {
        require(pcmStereo.isNotEmpty()) { "Không có âm thanh để mã hóa" }
        val fmt = MediaFormat.createAudioFormat(AAC, sampleRate, channels).apply {
            setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
            setInteger(MediaFormat.KEY_BIT_RATE, 160_000)
            setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16 * 1024)
        }
        val codec = MediaCodec.createEncoderByType(AAC)
        var outFormat: MediaFormat? = null
        val samples = ArrayList<EncodedAudio.Sample>()
        try {
            codec.configure(fmt, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
            codec.start()
            val info = MediaCodec.BufferInfo()
            var inPos = 0
            var inputEos = false
            var done = false
            while (!done) {
                if (!inputEos) {
                    val idx = codec.dequeueInputBuffer(10_000)
                    if (idx >= 0) {
                        val buf = codec.getInputBuffer(idx)!!
                        buf.clear()
                        buf.order(ByteOrder.nativeOrder())
                        val count = minOf(buf.capacity() / 2, pcmStereo.size - inPos)
                        if (count <= 0) {
                            codec.queueInputBuffer(idx, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                            inputEos = true
                        } else {
                            for (i in 0 until count) {
                                val s = (pcmStereo[inPos + i] * 32767f).toInt().coerceIn(-32768, 32767)
                                buf.putShort(s.toShort())
                            }
                            val pts = (inPos / channels) * 1_000_000L / sampleRate
                            codec.queueInputBuffer(idx, 0, count * 2, pts, 0)
                            inPos += count
                        }
                    }
                }
                val oi = codec.dequeueOutputBuffer(info, 10_000)
                when {
                    oi == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> outFormat = codec.outputFormat
                    oi >= 0 -> {
                        val ob = codec.getOutputBuffer(oi)!!
                        if (info.size > 0 && (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0) {
                            val bytes = ByteArray(info.size)
                            ob.position(info.offset)
                            ob.limit(info.offset + info.size)
                            ob.get(bytes)
                            samples.add(EncodedAudio.Sample(info.presentationTimeUs, info.flags, bytes))
                        }
                        codec.releaseOutputBuffer(oi, false)
                        if ((info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) done = true
                    }
                }
            }
        } finally {
            runCatching { codec.stop() }
            codec.release()
        }
        val f = outFormat ?: throw IllegalStateException("Bộ mã hóa AAC không trả về định dạng đầu ra")
        check(samples.isNotEmpty()) { "Bộ mã hóa AAC không tạo được khung nào" }
        return EncodedAudio(f, samples)
    }

    /**
     * Ghép video gốc (copy, không re-encode) với âm thanh AAC đã mã hóa vào MỘT muxer.
     * Hai luồng mẫu được xen kẽ theo thời gian; timestamp mỗi track luôn tăng dần.
     */
    fun muxVideo(context: Context, sourceVideo: Uri, audio: EncodedAudio, out: File) {
        val v = MediaExtractor().apply { setDataSource(context, sourceVideo, null) }
        var muxer: MediaMuxer? = null
        var vCount = 0
        var aCount = 0
        try {
            var vi = -1
            for (i in 0 until v.trackCount) {
                if (v.getTrackFormat(i).getString(MediaFormat.KEY_MIME)?.startsWith("video/") == true) { vi = i; break }
            }
            require(vi >= 0) { "Không tìm thấy track hình" }
            v.selectTrack(vi)

            val rotation = MediaMetadataRetriever().let { r ->
                try {
                    r.setDataSource(context, sourceVideo)
                    r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
                } finally {
                    r.release()
                }
            }
            val m = MediaMuxer(out.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
            muxer = m
            m.setOrientationHint(rotation)
            val vTrack = m.addTrack(v.getTrackFormat(vi))
            val aTrack = m.addTrack(audio.format)
            m.start()

            val buf = ByteBuffer.allocate(4 * 1024 * 1024)
            val info = MediaCodec.BufferInfo()
            var vLast = -1L
            var aLast = -1L
            var ai = 0
            while (true) {
                val vt = if (v.sampleTime >= 0) v.sampleTime else Long.MAX_VALUE
                val at = if (ai < audio.samples.size) audio.samples[ai].ptsUs else Long.MAX_VALUE
                if (vt == Long.MAX_VALUE && at == Long.MAX_VALUE) break

                if (at <= vt) {
                    val s = audio.samples[ai++]
                    val pts = maxOf(s.ptsUs, aLast + 1)
                    aLast = pts
                    val bb = ByteBuffer.wrap(s.bytes)
                    info.set(0, s.bytes.size, pts, if ((s.flags and MediaCodec.BUFFER_FLAG_KEY_FRAME) != 0) MediaCodec.BUFFER_FLAG_KEY_FRAME else 0)
                    m.writeSampleData(aTrack, bb, info)
                    aCount++
                } else {
                    buf.clear()
                    val n = v.readSampleData(buf, 0)
                    if (n < 0) { v.advance(); continue }
                    val pts = maxOf(v.sampleTime, vLast + 1)
                    vLast = pts
                    buf.position(0)
                    buf.limit(n)
                    info.set(0, n, pts,
                        if ((v.sampleFlags and MediaExtractor.SAMPLE_FLAG_SYNC) != 0) MediaCodec.BUFFER_FLAG_KEY_FRAME else 0)
                    m.writeSampleData(vTrack, buf, info)
                    vCount++
                    v.advance()
                }
            }
            require(vCount > 0) { "Video không có khung hình nào được ghép" }
            try {
                m.stop()
            } catch (e: IllegalStateException) {
                throw IllegalStateException(
                    "Ghi MP4 lỗi khi hoàn tất: ${e.message} (hình=$vCount, tiếng=$aCount, " +
                        "mẫu tiếng tổng=${audio.samples.size}, định dạng=${audio.format})", e,
                )
            }
        } finally {
            runCatching { muxer?.release() }
            v.release()
        }
    }

    /** Lưu file vào Movies/TrungVietDub và trả về content Uri. Android 10+ dùng MediaStore không cần quyền; Android 9 trở xuống ghi trực tiếp vào thư mục (cần WRITE_EXTERNAL_STORAGE). */
    fun saveToGallery(context: Context, file: File, displayName: String): Uri {
        val resolver = context.contentResolver
        val values = ContentValues().apply {
            put(MediaStore.Video.Media.DISPLAY_NAME, displayName)
            put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            values.put(MediaStore.Video.Media.RELATIVE_PATH, "${Environment.DIRECTORY_MOVIES}/TrungVietDub")
            values.put(MediaStore.Video.Media.IS_PENDING, 1)
            val uri = resolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values)
                ?: error("Không tạo được mục trong thư viện")
            resolver.openOutputStream(uri)!!.use { out -> file.inputStream().use { it.copyTo(out) } }
            values.clear()
            values.put(MediaStore.Video.Media.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
            return uri
        }
        // Android 9 trở xuống: ghi file thật rồi đăng ký với MediaStore qua DATA
        val dir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MOVIES), "TrungVietDub")
        if (!dir.exists() && !dir.mkdirs()) error("Không tạo được thư mục Movies/TrungVietDub (kiểm tra quyền lưu trữ)")
        val dest = File(dir, displayName)
        file.copyTo(dest, overwrite = true)
        values.put(MediaStore.Video.Media.DATA, dest.absolutePath)
        return resolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values)
            ?: error("Không đăng ký được video vào thư viện")
    }
}
