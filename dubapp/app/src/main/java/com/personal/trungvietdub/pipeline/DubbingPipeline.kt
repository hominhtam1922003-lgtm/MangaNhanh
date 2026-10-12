package com.personal.trungvietdub.pipeline

import android.content.Context
import android.net.Uri
import com.personal.trungvietdub.data.AppSettings
import com.personal.trungvietdub.data.AsrFiles
import com.personal.trungvietdub.data.JobLog
import com.personal.trungvietdub.data.ModelManager
import com.personal.trungvietdub.data.OriginalAudioMode
import com.personal.trungvietdub.data.Step
import com.personal.trungvietdub.data.TtsFiles
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.concurrent.atomic.AtomicInteger

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
        // Có khóa Gemini thì nhận diện bằng Gemini (online, chính xác nhất); không có thì dùng FireRedASR offline
        val geminiKey = AppSettings.geminiKey(context)
        val asrFiles: AsrFiles? = if (geminiKey.isEmpty()) {
            mm.asrFiles() ?: error("Chưa tải model nhận diện tiếng Trung, hoặc hãy nhập khóa Gemini ở màn hình chính")
        } else null
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

        // 2. Tách nhạc nền bằng UVR (luôn chạy để nhận diện lời trên giọng sạch).
        //    Kết quả là nhạc nền (uvr_out.bin); giọng = gốc − nhạc nền.
        var music: FloatArray? = if (st.has("uvr_out.bin")) st.loadFloats("uvr_out.bin") else null
        if (music == null && !st.has("uvr_started.txt")) {
            // Đánh dấu TRƯỚC khi chạy: nếu tiến trình chết giữa chừng, lần sau không thử lại UVR (tránh lặp lỗi)
            st.saveText("uvr_started.txt", "1")
            onProgress(Step.SEPARATE, 0f, "")
            val uvr = mm.uvrFile()
            if (uvr != null) {
                log("Tách nhạc nền (UVR) để nhận diện lời trên giọng sạch")
                try {
                    music = UvrClient(context).separate(stereo44, uvr, dir, jobId) { f ->
                        onProgress(Step.SEPARATE, f, "")
                    }
                    log("Tách nhạc nền xong; ${memInfo()}")
                } catch (e: Throwable) {
                    log("Tách nhạc nền lỗi, nhận diện trên audio gốc: ${e.javaClass.simpleName}: ${e.message}")
                }
            } else {
                log("Chưa có model tách nhạc; nhận diện trên audio gốc")
            }
        }
        onProgress(Step.SEPARATE, 1f, "")

        val effMode = if (requestedMode == OriginalAudioMode.SEPARATE && music == null) {
            log("Không tách được nhạc nền; chuyển sang hạ âm lượng audio gốc")
            OriginalAudioMode.LOWER
        } else requestedMode
        val base: FloatArray = if (effMode == OriginalAudioMode.SEPARATE) music!! else stereo44

        // Nguồn cho nhận diện: giọng đã tách nếu có, nếu không thì audio gốc
        val m = music
        val speech16: FloatArray = if (m != null) {
            val vocals = FloatArray(stereo44.size) { k -> stereo44[k] - m[k] }
            AudioIO.convert(AudioIO.Pcm(vocals, Composer.OUT_RATE, Composer.OUT_CH), Segmenter.SR, 1)
        } else mono16
        log("Nguồn nhận diện: ${if (m != null) "giọng đã tách" else "audio gốc"}; peak=${fmtPeak(speech16)}")

        // Checkpoint cũ được tạo từ audio gốc; khi đổi sang giọng đã tách thì xóa để tính lại
        if (!st.has("speech_v2.txt")) {
            dir.listFiles()?.filter {
                it.name == "spans.txt" || it.name == "texts.json" || it.name == "translated.json" ||
                    it.name.startsWith("asr_") || it.name.startsWith("clip_")
            }?.forEach { it.delete() }
            st.saveText("speech_v2.txt", "1")
        }

        // 3. Tìm đoạn có lời nói
        val spans: List<Segmenter.Span> = if (st.has("spans.txt")) {
            parseSpans(st.loadText("spans.txt"))
        } else {
            onProgress(Step.SEGMENT, 0f, "")
            Segmenter.segment(speech16).also { list ->
                st.saveText("spans.txt", list.joinToString("\n") { "${it.startMs} ${it.endMs}" })
            }
        }
        log("Tìm đoạn: ${spans.size} đoạn")
        onProgress(Step.SEGMENT, 1f, "${spans.size} đoạn")
        if (spans.isEmpty()) {
            error("Không tìm thấy đoạn có lời nói (peak=${fmtPeak(speech16)}). Xem nhật ký.")
        }

        // Số worker song song theo phần cứng (máy mạnh: 3). Mỗi worker chia đều số nhân CPU.
        val workers = Threads.workers(context)
        val threadsPer = Threads.threadsPerWorker(workers)
        log("Chạy song song: $workers worker × $threadsPer luồng (${Threads.cpu} nhân)")
        // Mọi callback tiến trình đi qua một khóa, vì nhiều worker báo tiến độ cùng lúc
        val reportLock = Any()
        fun report(step: Step, frac: Float, note: String) = synchronized(reportLock) { onProgress(step, frac, note) }

        // 4. Nhận diện tiếng Trung; kết quả lưu asr_<i>.txt cho từng đoạn VAD
        if (geminiKey.isNotEmpty()) {
            // Gemini: gửi audio theo khối 4 phút, tuần tự để tránh vượt giới hạn tốc độ; mỗi khối lưu gem_<w>.json
            val win = GeminiAsr.WINDOW_SEC * Segmenter.SR
            val wins = (speech16.size + win - 1) / win
            log("Nhận diện bằng Gemini: $wins khối ${GeminiAsr.WINDOW_SEC} giây")
            val gemTodo = (0 until wins).filter { !st.has("gem_$it.json") }
            val gemDone = AtomicInteger(wins - gemTodo.size)
            runParallel(
                2, gemTodo,
                setup = { Unit },
                teardown = { },
                work = { _, w ->
                    val from = w * win
                    val to = minOf(speech16.size, from + win)
                    val segs = withContext(Dispatchers.IO) { GeminiAsr.transcribe(geminiKey, speech16.copyOfRange(from, to)) }
                    val offset = w * GeminiAsr.WINDOW_SEC * 1000L
                    st.saveText("gem_$w.json", GeminiAsr.toJson(segs.map { it.copy(startMs = it.startMs + offset, endMs = it.endMs + offset) }))
                    report(Step.ASR, gemDone.incrementAndGet().toFloat() / wins, "Gemini ${gemDone.get()}/$wins")
                },
            )
            val all = (0 until wins).flatMap { GeminiAsr.fromJson(st.loadText("gem_$it.json")) }
            val assigned = GeminiAsr.assign(all, spans.map { it.startMs to it.endMs })
            spans.indices.forEach { st.saveText("asr_$it.txt", assigned[it]) }
            log("Nhận diện Gemini xong: ${all.size} câu → ${spans.size} đoạn")
            report(Step.ASR, 1f, "")
        } else {
            // Offline: FireRedASR, song song theo worker
            val asrTodo = spans.indices.filter { !st.has("asr_$it.txt") }
            if (asrTodo.isNotEmpty()) {
                log("Nhận diện tiếng Trung: còn ${asrTodo.size}/${spans.size} đoạn")
                val done = AtomicInteger(spans.size - asrTodo.size)
                runParallel(
                    workers, asrTodo,
                    setup = { ChineseSpeechRecognizer(asrFiles!!, threadsPer) },
                    teardown = { it.close() },
                    work = { asr, i ->
                        val sp = spans[i]
                        val from = (sp.startMs * Segmenter.SR / 1000).toInt()
                        val to = minOf(speech16.size, (sp.endMs * Segmenter.SR / 1000).toInt())
                        st.saveText("asr_$i.txt", asr.transcribe(speech16.copyOfRange(from, to)))
                        report(Step.ASR, done.incrementAndGet().toFloat() / spans.size, "")
                    },
                )
                log("Nhận diện xong")
            }
        }
        val texts: List<String> = spans.indices.map { st.loadText("asr_$it.txt") }
        report(Step.ASR, 1f, "")
        val transcript = spans.indices.joinToString("\n") { i -> "[${fmt(spans[i].startMs)}] ${texts[i]}" }
        onTranscript(transcript)

        // 5. Dịch theo khối ngữ cảnh: mỗi khối ~25 câu liên tiếp (kèm 3 câu trước làm ngữ cảnh), dịch cả khối một lần
        val todoSet = spans.indices.filter { !st.has("tg_$it.txt") }.toSet()
        if (todoSet.isNotEmpty()) {
            log("Dịch ${todoSet.size} câu theo khối ngữ cảnh (" + (if (geminiKey.isNotEmpty()) "Gemini" else "Google Translate miễn phí") + ")")
            val fallbacks = AtomicInteger(0)
            val lastErr = java.util.concurrent.atomic.AtomicReference<String>("")
            val chunks = spans.indices.toList().chunked(OnlineTranslator.CHUNK).filter { c -> c.any { it in todoSet } }
            val done = AtomicInteger(spans.size - todoSet.size)
            runParallel(
                2, chunks,
                setup = { Unit },
                teardown = { },
                work = { _, chunk ->
                    val first = chunk.first()
                    val ctxStart = maxOf(0, first - OnlineTranslator.CTX)
                    val range = ctxStart..chunk.last()
                    val lines = range.map { texts[it] }
                    val out = withContext(Dispatchers.IO) {
                        if (geminiKey.isNotEmpty()) {
                            try {
                                GeminiTranslator.translate(geminiKey, lines)
                            } catch (e: Exception) {
                                // Gemini lỗi hoặc trả sai số câu: dùng Google Translate cho khối này
                                fallbacks.incrementAndGet()
                                lastErr.set(e.message ?: e.javaClass.simpleName)
                                OnlineTranslator.translate(lines)
                            }
                        } else {
                            OnlineTranslator.translate(lines)
                        }
                    }
                    for (i in chunk) {
                        if (i in todoSet) {
                            st.saveText("tg_$i.txt", out[i - ctxStart])
                            done.incrementAndGet()
                        }
                    }
                    report(Step.TRANSLATE, done.get().toFloat() / spans.size, "")
                },
            )
            if (fallbacks.get() > 0) log("Gemini dịch lỗi ${fallbacks.get()} khối, đã dùng Google Translate. Lỗi cuối: ${lastErr.get()}")
            log("Dịch xong")
        }
        val translated: List<String> = spans.indices.map { st.loadText("tg_$it.txt") }
        report(Step.TRANSLATE, 1f, "")
        val nonBlank = translated.count { it.isNotBlank() }
        val sample = translated.firstOrNull { it.isNotBlank() }?.take(80) ?: "(rỗng)"
        log("Kết quả dịch: $nonBlank/${spans.size} câu có nội dung. Ví dụ: $sample")
        if (nonBlank == 0) {
            error("Bản dịch rỗng: không có câu nào được dịch, nên không có giọng Việt. Kiểm tra kết nối mạng rồi tiếp tục.")
        }

        // Phụ đề SRT tiếng Việt, lưu vào Download/TrungVietDub
        val srtName = displayName.substringBeforeLast('.') + ".srt"
        val srt = Subtitles.srt(spans.indices.map { Triple(spans[it].startMs, spans[it].endMs, translated[it]) })
        log("Phụ đề tiếng Việt: ${Subtitles.save(context, srtName, srt)}")

        // 6. Giọng Việt song song: edge-tts (neural, miễn phí) trước, VITS offline dự phòng khi lỗi
        val voiced = spans.indices.filter { translated[it].isNotBlank() }
        val todo = voiced.filter { !st.has("clip_$it.bin") }
        if (todo.isNotEmpty()) {
            val done = AtomicInteger(voiced.size - todo.size)
            val edgeN = AtomicInteger(0)
            val vitsN = AtomicInteger(0)
            runParallel(
                workers, todo,
                setup = { VoiceSynth(context, dir, ttsFiles, threadsPer, speed) },
                teardown = { it.close() },
                work = { vs, i ->
                    val slot = spans[i].endMs - spans[i].startMs
                    val (pcm, src) = vs.synth(i, translated[i], slot)
                    if (src == "edge") edgeN.incrementAndGet() else vitsN.incrementAndGet()
                    st.saveFloats("clip_$i.bin", pcm)
                    report(Step.TTS, done.incrementAndGet().toFloat() / voiced.size, "")
                },
            )
            log("Giọng: edge-tts ${edgeN.get()} câu, VITS dự phòng ${vitsN.get()} câu")
        }
        report(Step.TTS, 1f, "")
        val clipPeaks = voiced.map { i -> st.loadFloats("clip_$i.bin").maxOfOrNull { kotlin.math.abs(it) } ?: 0f }
        log("Tạo giọng Việt xong: ${voiced.size} câu; peak giọng=${"%.4f".format(clipPeaks.maxOrNull() ?: 0f)}")
        if ((clipPeaks.maxOrNull() ?: 0f) < 1e-4f) {
            error("Giọng Việt tạo ra bị im lặng (model TTS lỗi). Xem nhật ký.")
        }

        // 7. Ghép âm thanh gốc + giọng Việt
        report(Step.COMPOSE, 0f, "")
        val clips = voiced.map { Composer.Clip(spans[it].startMs, st.loadFloats("clip_$it.bin")) }
        val mixed = Composer.mix(base, clips, effMode)
        report(Step.COMPOSE, 1f, "")

        // 8. Xuất MP4 vào thư viện: mã hóa AAC trong bộ nhớ rồi ghép với video gốc vào một muxer
        report(Step.EXPORT, 0f, "")
        val audio = VideoExporter.encodeAac(mixed, Composer.OUT_RATE, Composer.OUT_CH)
        val mp4 = File(dir, "out.mp4")
        VideoExporter.muxVideo(context, sourceUri, audio, mp4)
        val outUri = VideoExporter.saveToGallery(context, mp4, displayName)
        log("Xuất MP4 xong")
        report(Step.EXPORT, 1f, "")
        dir.deleteRecursively()
        Result(outUri, transcript, effMode)
    }

    /** Chạy [work] cho từng phần tử của [items] bằng [workers] coroutine song song; mỗi worker có tài nguyên riêng. */
    private suspend fun <W, T> runParallel(
        workers: Int,
        items: List<T>,
        setup: () -> W,
        teardown: (W) -> Unit,
        work: suspend (W, T) -> Unit,
    ) {
        if (items.isEmpty()) return
        val next = AtomicInteger(0)
        coroutineScope {
            repeat(minOf(workers, items.size)) {
                launch(Dispatchers.Default) {
                    val w = setup()
                    try {
                        while (true) {
                            val k = next.getAndIncrement()
                            if (k >= items.size) break
                            work(w, items[k])
                        }
                    } finally {
                        teardown(w)
                    }
                }
            }
        }
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
