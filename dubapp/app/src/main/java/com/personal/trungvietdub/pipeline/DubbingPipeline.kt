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
 * Điều phối: giải mã → tách nhạc (tùy chọn) → tìm đoạn → nhận diện → dịch → TTS → ghép → xuất MP4.
 * Mỗi bước lưu kết quả trung gian vào filesDir/… cache của job, nên chạy lại sẽ tiếp tục từ chỗ dừng.
 * Chỉ dọn thư mục job khi đã xuất xong.
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

        val dir = File(context.cacheDir, "jobs/$jobId").apply { mkdirs() }
        val st = StageStore(dir)
        val mm = ModelManager(context)
        val asrFiles: AsrFiles = mm.asrFiles() ?: error("Chưa tải model nhận diện tiếng Trung")
        val ttsFiles: TtsFiles = mm.ttsFiles() ?: error("Chưa tải model giọng Việt")
        log("Xử lý; đã có sẵn từ lần trước: ${st.completed().joinToString().ifEmpty { "chưa có" }}")

        // 1. Giải mã: 44.1 kHz stereo (cho ghép) và 16 kHz mono (cho nhận diện)
        onProgress(Step.DECODE, 0.1f, "")
        if (!st.has("stereo44.bin") || !st.has("mono16.bin")) {
            val pcm = AudioIO.decode(context, sourceUri)
            log("Giải mã: ${pcm.samples.size} mẫu, ${pcm.sampleRate} Hz, ${pcm.channels} kênh, peak=${fmtPeak(pcm.samples)}")
            st.saveFloats("stereo44.bin", AudioIO.convert(pcm, Composer.OUT_RATE, Composer.OUT_CH))
            st.saveFloats("mono16.bin", AudioIO.convert(pcm, Segmenter.SR, 1))
        }
        val stereo44 = st.loadFloats("stereo44.bin")
        val mono16 = st.loadFloats("mono16.bin")
        log("Mono 16 kHz: ${mono16.size} mẫu; ${memInfo()}")
        onProgress(Step.DECODE, 1f, "")

        // 2. Âm thanh gốc: tách giọng (UVR) hoặc hạ âm lượng. Kết quả lưu lại để không chạy lại.
        var effMode = requestedMode
        var base = stereo44
        when {
            st.has("mode.txt") -> {
                effMode = OriginalAudioMode.valueOf(st.loadText("mode.txt"))
                base = if (effMode == OriginalAudioMode.SEPARATE) st.loadFloats("uvr_out.bin") else stereo44
                log("Dùng kết quả âm thanh gốc đã lưu: ${effMode.name}")
            }
            requestedMode == OriginalAudioMode.SEPARATE && !st.has("uvr_started.txt") -> {
                // Đánh dấu TRƯỚC khi chạy: nếu tiến trình chết giữa chừng, lần sau sẽ không thử tách giọng nữa
                st.saveText("uvr_started.txt", "1")
                onProgress(Step.SEPARATE, 0f, "")
                log("Bắt đầu tách giọng (UVR)")
                val uvr = mm.uvrFile() ?: error("Chưa tải model tách giọng")
                try {
                    base = UvrClient(context).separate(stereo44, uvr, dir, jobId) { f ->
                        onProgress(Step.SEPARATE, f, "")
                    }
                    effMode = OriginalAudioMode.SEPARATE
                    log("Tách giọng xong; ${memInfo()}")
                } catch (e: Throwable) {
                    log("Tách giọng lỗi, dùng hạ âm lượng: ${e.javaClass.simpleName}: ${e.message}")
                    effMode = OriginalAudioMode.LOWER
                    base = stereo44
                }
                st.saveText("mode.txt", effMode.name)
            }
            else -> {
                if (requestedMode == OriginalAudioMode.SEPARATE) {
                    log("Tách giọng đã dừng ở lần trước; chuyển sang hạ âm lượng để tránh lặp lỗi")
                    effMode = OriginalAudioMode.LOWER
                }
                base = stereo44
                st.saveText("mode.txt", effMode.name)
            }
        }
        onProgress(Step.SEPARATE, 1f, "")

        // 3. Tìm đoạn có lời nói
        val spans: List<Segmenter.Span> = if (st.has("spans.txt")) {
            parseSpans(st.loadText("spans.txt"))
        } else {
            onProgress(Step.SEGMENT, 0f, "")
            Segmenter.segment(mono16).also { list ->
                st.saveText("spans.txt", list.joinToString("\n") { "${it.startMs} ${it.endMs}" })
            }
        }
        log("Tìm đoạn: ${spans.size} đoạn")
        onProgress(Step.SEGMENT, 1f, "${spans.size} đoạn")
        if (spans.isEmpty()) {
            error("Không tìm thấy đoạn có lời nói (peak=${fmtPeak(mono16)}). Xem nhật ký.")
        }

        // 4. Nhận diện tiếng Trung, lưu từng đoạn
        val texts = ArrayList(st.loadList("texts.json"))
        if (texts.size < spans.size) {
            log("Nhận diện tiếng Trung từ đoạn ${texts.size + 1}/${spans.size}")
            ChineseSpeechRecognizer(asrFiles).use { asr ->
                while (texts.size < spans.size) {
                    val sp = spans[texts.size]
                    val from = (sp.startMs * Segmenter.SR / 1000).toInt()
                    val to = minOf(mono16.size, (sp.endMs * Segmenter.SR / 1000).toInt())
                    texts += asr.transcribe(mono16.copyOfRange(from, to))
                    st.saveList("texts.json", texts)
                    onProgress(Step.ASR, texts.size.toFloat() / spans.size, "")
                }
            }
            log("Nhận diện xong")
        }
        onProgress(Step.ASR, 1f, "")
        val transcript = spans.indices.joinToString("\n") { i -> "[${fmt(spans[i].startMs)}] ${texts[i]}" }
        onTranscript(transcript)

        // 5. Dịch Trung → Việt bằng NLLB, lưu từng câu
        val translated = ArrayList(st.loadList("translated.json"))
        if (translated.size < spans.size) {
            val nllb = mm.nllbFiles()
            log("Dịch từ câu ${translated.size + 1}/${spans.size}; NLLB: ${if (nllb != null) "có model" else "CHƯA có model"}")
            val translator: Translator = if (nllb != null) NllbTranslator(nllb) else UnavailableTranslator()
            translator.use { tr ->
                while (translated.size < spans.size) {
                    val i = translated.size
                    translated += if (texts[i].isBlank()) "" else tr.translate(texts[i])
                    st.saveList("translated.json", translated)
                    onProgress(Step.TRANSLATE, translated.size.toFloat() / spans.size, "")
                }
            }
            log("Dịch xong")
        }
        onProgress(Step.TRANSLATE, 1f, "")

        // 6. Giọng Việt cho từng câu, mỗi câu lưu thành một file
        val voiced = spans.indices.filter { translated[it].isNotBlank() }
        val todo = voiced.filter { !st.has("clip_$it.bin") }
        if (todo.isNotEmpty()) {
            VietnameseTts(ttsFiles).use { tts ->
                todo.forEachIndexed { k, i ->
                    val slot = spans[i].endMs - spans[i].startMs
                    val wav = tts.speak(translated[i], slot, speed)
                    st.saveFloats(
                        "clip_$i.bin",
                        AudioIO.convert(AudioIO.Pcm(wav, tts.sampleRate, 1), Composer.OUT_RATE, 1),
                    )
                    onProgress(Step.TTS, (voiced.size - todo.size + k + 1).toFloat() / voiced.size, "")
                }
            }
        }
        onProgress(Step.TTS, 1f, "")
        log("Tạo giọng Việt xong: ${voiced.size} câu")

        // 7. Ghép âm thanh gốc + giọng Việt
        onProgress(Step.COMPOSE, 0f, "")
        val clips = voiced.map { Composer.Clip(spans[it].startMs, st.loadFloats("clip_$it.bin")) }
        val mixed = Composer.mix(base, clips, effMode)
        onProgress(Step.COMPOSE, 1f, "")

        // 8. Xuất MP4 vào thư viện
        onProgress(Step.EXPORT, 0f, "")
        val aac = File(dir, "dub.m4a")
        VideoExporter.encodeAac(mixed, Composer.OUT_RATE, Composer.OUT_CH, aac)
        val mp4 = File(dir, "out.mp4")
        VideoExporter.muxVideo(context, sourceUri, aac, mp4)
        val outUri = VideoExporter.saveToGallery(context, mp4, displayName)
        log("Xuất MP4 xong")
        onProgress(Step.EXPORT, 1f, "")
        dir.deleteRecursively()
        Result(outUri, transcript, effMode)
    }

    private fun parseSpans(text: String): List<Segmenter.Span> =
        text.lines().filter { it.isNotBlank() }.map { line ->
            val (a, b) = line.trim().split(" ")
            Segmenter.Span(a.toLong(), b.toLong())
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

    private fun fmtPeak(x: FloatArray): String {
        var m = 0f
        for (v in x) {
            val a = if (v < 0f) -v else v
            if (a > m) m = a
        }
        return "%.4f".format(m)
    }

    private fun fmt(ms: Long): String {
        val s = ms / 1000
        return "%02d:%02d".format(s / 60, s % 60)
    }
}
