package com.personal.trungvietdub.pipeline

import android.content.Context
import android.net.Uri
import com.personal.trungvietdub.data.AsrFiles
import com.personal.trungvietdub.data.JobLog
import com.personal.trungvietdub.data.ModelManager
import com.personal.trungvietdub.data.OriginalAudioMode
import com.personal.trungvietdub.data.Step
import com.personal.trungvietdub.data.TtsFiles
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/**
 * Điều phối: giải mã → (tách nhạc) → tìm đoạn → nhận diện → dịch → TTS → ghép → xuất MP4.
 * onProgress(step, tiến độ trong bước 0..1, ghi chú).
 */
class DubbingPipeline(private val context: Context) {
    data class Result(val outputUri: Uri, val transcript: String, val effectiveMode: OriginalAudioMode)

    suspend fun run(
        jobId: String,
        sourceUri: Uri,
        displayName: String,
        requestedMode: OriginalAudioMode,
        speed: Float,
        onProgress: (Step, Float, String) -> Unit,
        onTranscript: (String) -> Unit,
    ): Result = withContext(Dispatchers.Default) {
        fun log(msg: String) = JobLog.append(context, jobId, msg)
        log("Bắt đầu xử lý")
        onProgress(Step.DECODE, 0f, "đang kiểm tra model")
        val mm = ModelManager(context)
        val asrFiles: AsrFiles = mm.asrFiles() ?: error("Chưa tải model nhận diện tiếng Trung")
        val ttsFiles: TtsFiles = mm.ttsFiles() ?: error("Chưa tải model giọng Việt")
        val work = File(context.cacheDir, "work/${System.currentTimeMillis()}").apply { mkdirs() }
        log("Model sẵn sàng: ASR, TTS")

        try {
            // 1. Giải mã: 44.1 kHz stereo (cho ghép) và 16 kHz mono (cho ASR). PCM gốc được giải phóng ngay.
            onProgress(Step.DECODE, 0.1f, "đang giải mã")
            val (stereo44, mono16) = run {
                val pcm = AudioIO.decode(context, sourceUri)
                log("Giải mã: ${pcm.samples.size} mẫu, ${pcm.sampleRate} Hz, ${pcm.channels} kênh, peak=${"%.4f".format(peak(pcm.samples))}")
                AudioIO.convert(pcm, Composer.OUT_RATE, Composer.OUT_CH) to AudioIO.convert(pcm, Segmenter.SR, 1)
            }
            log("Mono 16 kHz: ${mono16.size} mẫu, peak=${"%.4f".format(peak(mono16))}; ${memInfo()}")
            onProgress(Step.DECODE, 1f, "")

            // 2. Tách giọng gốc → nhạc nền (UVR MDX-NET). Lỗi thì dùng hạ âm lượng để không mất job.
            var mode = requestedMode
            var base = stereo44
            if (mode == OriginalAudioMode.SEPARATE) {
                onProgress(Step.SEPARATE, 0f, "")
                val uvr = mm.uvrFile() ?: error("Chưa tải model tách giọng")
                log("Bắt đầu tách giọng (UVR)")
                try {
                    // Chạy trong tiến trình riêng (:uvr) để native crash không làm sập app
                    base = UvrClient(context).separate(stereo44, uvr, work, jobId) { f ->
                        onProgress(Step.SEPARATE, f, "")
                    }
                    log("Tách giọng xong; ${memInfo()}")
                } catch (e: Throwable) {
                    log("Tách giọng lỗi, chuyển sang hạ âm lượng: ${e.javaClass.simpleName}: ${e.message}")
                    mode = OriginalAudioMode.LOWER
                    base = stereo44
                    onProgress(Step.SEPARATE, 1f, "lỗi tách giọng, dùng hạ âm lượng: ${e.message}")
                }
            }

            // 3. Tìm đoạn có lời nói
            onProgress(Step.SEGMENT, 0f, "")
            val spans = Segmenter.segment(mono16)
            log("Tìm đoạn: ${spans.size} đoạn")
            onProgress(Step.SEGMENT, 1f, "${spans.size} đoạn")
            if (spans.isEmpty()) {
                error("Không tìm thấy đoạn có lời nói (peak=${"%.4f".format(peak(mono16))}, ${mono16.size} mẫu). Xem nhật ký để biết chi tiết.")
            }

            // 4. Nhận diện tiếng Trung
            val texts = ArrayList<String>(spans.size)
            log("Nhận diện tiếng Trung...")
            ChineseSpeechRecognizer(asrFiles).use { asr ->
                spans.forEachIndexed { i, sp ->
                    val from = (sp.startMs * Segmenter.SR / 1000).toInt()
                    val to = minOf(mono16.size, (sp.endMs * Segmenter.SR / 1000).toInt())
                    texts += asr.transcribe(mono16.copyOfRange(from, to))
                    onProgress(Step.ASR, (i + 1f) / spans.size, "")
                }
            }
            log("Nhận diện xong")
            val transcript = spans.indices.joinToString("\n") { i -> "[${fmt(spans[i].startMs)}] ${texts[i]}" }
            onTranscript(transcript)

            // 5. Dịch Trung → Việt bằng NLLB
            val translated = ArrayList<String>(spans.size)
            val nllb = mm.nllbFiles()
            log("Dịch bằng NLLB: ${if (nllb != null) "có model" else "CHƯA có model"}")
            val translator: Translator = if (nllb != null) NllbTranslator(nllb) else UnavailableTranslator()
            log("Tạo tokenizer/session NLLB xong")
            translator.use { tr ->
                spans.indices.forEach { i ->
                    translated += if (texts[i].isBlank()) "" else tr.translate(texts[i])
                    onProgress(Step.TRANSLATE, (i + 1f) / spans.size, "")
                }
            }

            // 6. Giọng Việt cho từng đoạn, đặt đúng mốc thời gian
            log("Dịch xong")
            val clips = ArrayList<Composer.Clip>()
            VietnameseTts(ttsFiles).use { tts ->
                spans.indices.forEach { i ->
                    if (translated[i].isNotBlank()) {
                        val slot = spans[i].endMs - spans[i].startMs
                        val wav = tts.speak(translated[i], slot, speed)
                        val mono44 = AudioIO.convert(AudioIO.Pcm(wav, tts.sampleRate, 1), Composer.OUT_RATE, 1)
                        clips += Composer.Clip(spans[i].startMs, mono44)
                    }
                    onProgress(Step.TTS, (i + 1f) / spans.size, "")
                }
            }

            log("Tạo giọng Việt xong: ${clips.size} đoạn")
            // 7. Ghép nhạc nền + giọng Việt
            onProgress(Step.COMPOSE, 0f, "")
            val mixed = Composer.mix(base, clips, mode)
            onProgress(Step.COMPOSE, 1f, "")

            // 8. Xuất MP4: AAC mới + video gốc (copy), lưu vào thư viện
            onProgress(Step.EXPORT, 0f, "")
            val aac = File(work, "dub.m4a")
            VideoExporter.encodeAac(mixed, Composer.OUT_RATE, Composer.OUT_CH, aac)
            val mp4 = File(work, "out.mp4")
            VideoExporter.muxVideo(context, sourceUri, aac, mp4)
            val outUri = VideoExporter.saveToGallery(context, mp4, displayName)
            log("Xuất MP4 xong")
            onProgress(Step.EXPORT, 1f, "")
            Result(outUri, transcript, mode)
        } finally {
            work.deleteRecursively()
        }
    }

    private fun memInfo(): String {
        val rt = Runtime.getRuntime()
        val used = (rt.totalMemory() - rt.freeMemory()) / 1048576
        val am = context.getSystemService(android.app.ActivityManager::class.java)
        val mi = android.app.ActivityManager.MemoryInfo()
        am.getMemoryInfo(mi)
        return "heap ${used}MB/${rt.maxMemory() / 1048576}MB, RAM trống ${mi.availMem / 1048576}MB" +
            (if (mi.lowMemory) " (THIẾU BỘ NHỚ)" else "")
    }

    private fun peak(x: FloatArray): Float {
        var m = 0f
        for (v in x) { val a = if (v < 0f) -v else v; if (a > m) m = a }
        return m
    }

    private fun fmt(ms: Long): String {
        val s = ms / 1000
        return "%02d:%02d".format(s / 60, s % 60)
    }
}
