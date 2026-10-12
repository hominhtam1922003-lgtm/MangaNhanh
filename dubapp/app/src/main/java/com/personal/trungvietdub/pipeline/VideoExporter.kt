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
import android.os.Environment
import android.provider.MediaStore
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder

/** Mã hóa AAC, ghép với track video gốc (không re-encode video) và lưu vào thư viện. */
object VideoExporter {
    private const val AAC = "audio/mp4a-latm"

    fun encodeAac(pcmStereo: FloatArray, sampleRate: Int, channels: Int, outFile: File) {
        val fmt = MediaFormat.createAudioFormat(AAC, sampleRate, channels).apply {
            setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
            setInteger(MediaFormat.KEY_BIT_RATE, 160_000)
            setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16 * 1024)
        }
        val codec = MediaCodec.createEncoderByType(AAC)
        codec.configure(fmt, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        codec.start()
        val muxer = MediaMuxer(outFile.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
        var track = -1
        var muxerStarted = false
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
                oi == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                    track = muxer.addTrack(codec.outputFormat)
                    muxer.start()
                    muxerStarted = true
                }
                oi >= 0 -> {
                    val ob = codec.getOutputBuffer(oi)!!
                    if (info.size > 0 && muxerStarted && (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0) {
                        ob.position(info.offset)
                        ob.limit(info.offset + info.size)
                        muxer.writeSampleData(track, ob, info)
                    }
                    codec.releaseOutputBuffer(oi, false)
                    if ((info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) done = true
                }
            }
        }
        codec.stop(); codec.release()
        muxer.stop(); muxer.release()
    }

    /** Ghép video gốc (copy) với file AAC mới, xen kẽ theo timestamp. */
    fun muxVideo(context: Context, sourceVideo: Uri, audioM4a: File, out: File) {
        val v = MediaExtractor().apply { setDataSource(context, sourceVideo, null) }
        val a = MediaExtractor().apply { setDataSource(audioM4a.absolutePath) }
        var vi = -1
        for (i in 0 until v.trackCount) {
            if (v.getTrackFormat(i).getString(MediaFormat.KEY_MIME)?.startsWith("video/") == true) { vi = i; break }
        }
        require(vi >= 0) { "Không tìm thấy track hình" }
        val ai = 0
        val muxer = MediaMuxer(out.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)

        val rotation = MediaMetadataRetriever().let { r ->
            r.setDataSource(context, sourceVideo)
            val rot = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
            r.release()
            rot
        }
        muxer.setOrientationHint(rotation)

        val vTrack = muxer.addTrack(v.getTrackFormat(vi))
        val aTrack = muxer.addTrack(a.getTrackFormat(ai))
        muxer.start()
        v.selectTrack(vi)
        a.selectTrack(ai)

        val buf = ByteBuffer.allocate(4 * 1024 * 1024)
        val info = MediaCodec.BufferInfo()
        while (true) {
            val vt = if (v.sampleTime >= 0) v.sampleTime else Long.MAX_VALUE
            val at = if (a.sampleTime >= 0) a.sampleTime else Long.MAX_VALUE
            if (vt == Long.MAX_VALUE && at == Long.MAX_VALUE) break
            val fromVideo = vt <= at
            val ex = if (fromVideo) v else a
            buf.clear()
            val n = ex.readSampleData(buf, 0)
            if (n < 0) { ex.advance(); continue }
            info.offset = 0
            info.size = n
            info.presentationTimeUs = ex.sampleTime
            info.flags = if ((ex.sampleFlags and MediaExtractor.SAMPLE_FLAG_SYNC) != 0)
                MediaCodec.BUFFER_FLAG_KEY_FRAME else 0
            muxer.writeSampleData(if (fromVideo) vTrack else aTrack, buf, info)
            ex.advance()
        }
        muxer.stop(); muxer.release()
        v.release(); a.release()
    }

    /** Lưu file vào Movies/TrungVietDub qua MediaStore. Trả về content Uri. */
    fun saveToGallery(context: Context, file: File, displayName: String): Uri {
        val values = ContentValues().apply {
            put(MediaStore.Video.Media.DISPLAY_NAME, displayName)
            put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
            put(MediaStore.Video.Media.RELATIVE_PATH, "${Environment.DIRECTORY_MOVIES}/TrungVietDub")
            put(MediaStore.Video.Media.IS_PENDING, 1)
        }
        val resolver = context.contentResolver
        val uri = resolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values)
            ?: error("Không tạo được mục trong thư viện")
        resolver.openOutputStream(uri)!!.use { out -> file.inputStream().use { it.copyTo(out) } }
        values.clear()
        values.put(MediaStore.Video.Media.IS_PENDING, 0)
        resolver.update(uri, values, null, null)
        return uri
    }
}
