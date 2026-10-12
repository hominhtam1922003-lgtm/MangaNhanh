package com.personal.trungvietdub.pipeline

import android.content.Context
import android.net.Uri
import com.personal.trungvietdub.data.AsrFiles
import com.personal.trungvietdub.data.ModelManager
import com.personal.trungvietdub.data.OriginalAudioMode
import com.personal.trungvietdub.data.Step
import com.personal.trungvietdub.data.TtsFiles
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/**
 * Điều phối toàn bộ luồng: giải mã → tìm đoạn → nhận diện → dịch → TTS → ghép → xuất MP4.
 * onProgress(step, fraction trong bước, ghi chú) — tiến độ tổng được tính theo trọng số Step.
 */
class DubbingPipeline(
    private val context: Context,
    private val translator: Translator = UnavailableTranslator(),
) {
    data class Result(val outputUri: Uri, val transcript: String)

    suspend fun run(
        sourceUri: Uri,
        displayName: String,
        mode: OriginalAudioMode,
        onProgress: (Step, Float, String) -> Unit,
        onTranscript: (String) -> Unit,
    ): Result = withContext(Dispatchers.Default) {
        val mm = ModelManager(context)
        val asrFiles: AsrFiles = mm.asrFiles() ?: error("Chưa tải model nhận diện tiếng Trung")
        val ttsFiles: TtsFiles = mm.ttsFiles() ?: error("Chưa tải model giọng Việt")
        val work = File(context.cacheDir, "work/${System.currentTimeMillis()}").apply { mkdirs() }

        try {
            // 1. Tách audio: 16 kHz mono cho ASR, 44.1 kHz stereo cho ghép
            onProgress(Step.DECODE, 0f, "")
            val pcm = AudioIO.decode(context, sourceUri)
            val mono16 = AudioIO.convert(pcm, Segmenter.SR, 1)
            val stereo44 = AudioIO.convert(pcm, Composer.OUT_RATE, Composer.OUT_CH)
            onProgress(Step.DECODE, 1f, "")

            // 2. Tìm đoạn có lời nói
            onProgress(Step.SEGMENT, 0f, "")
            val spans = Segmenter.segment(mono16)
            onProgress(Step.SEGMENT, 1f, "${spans.size} đoạn")

            // 3. Nhận diện tiếng Trung
            val texts = ArrayList<String>(spans.size)
            ChineseSpeechRecognizer(asrFiles).use { asr ->
                spans.forEachIndexed { i, sp ->
                    val from = (sp.startMs * Segmenter.SR / 1000).toInt()
                    val to = minOf(mono16.size, (sp.endMs * Segmenter.SR / 1000).toInt())
                    texts += asr.transcribe(mono16.copyOfRange(from, to))
                    onProgress(Step.ASR, (i + 1f) / spans.size, "")
                }
            }
            val transcript = spans.indices.joinToString("\n") { i ->
                "[${fmt(spans[i].startMs)}] ${texts[i]}"
            }
            onTranscript(transcript)

            // 4. Dịch — hiện nay có thể báo lỗi rõ ràng nếu chưa có model
            val translated = ArrayList<String>(spans.size)
            spans.indices.forEach { i ->
                translated += if (texts[i].isBlank()) "" else translator.translate(texts[i])
                onProgress(Step.TRANSLATE, (i + 1f) / spans.size, "")
            }

            // 5. Giọng Việt cho từng đoạn
            val clips = ArrayList<Composer.Clip>()
            VietnameseTts(ttsFiles).use { tts ->
                spans.indices.forEach { i ->
                    if (translated[i].isNotBlank()) {
                        val slot = spans[i].endMs - spans[i].startMs
                        val wav = tts.speak(translated[i], slot)
                        val mono44 = AudioIO.convert(
                            AudioIO.Pcm(wav, tts.sampleRate, 1), Composer.OUT_RATE, 1
                        )
                        clips += Composer.Clip(spans[i].startMs, mono44)
                    }
                    onProgress(Step.TTS, (i + 1f) / spans.size, "")
                }
            }

            // 6. Ghép nhạc nền + giọng Việt
            onProgress(Step.COMPOSE, 0f, "")
            val mixed = Composer.mix(stereo44, clips, mode)
            onProgress(Step.COMPOSE, 1f, "")

            // 7. Xuất MP4
            onProgress(Step.EXPORT, 0f, "")
            val aac = File(work, "dub.m4a")
            VideoExporter.encodeAac(mixed, Composer.OUT_RATE, Composer.OUT_CH, aac)
            val mp4 = File(work, "out.mp4")
            VideoExporter.muxVideo(context, sourceUri, aac, mp4)
            val outUri = VideoExporter.saveToGallery(context, mp4, displayName)
            onProgress(Step.EXPORT, 1f, "")
            Result(outUri, transcript)
        } finally {
            work.deleteRecursively()
        }
    }

    private fun fmt(ms: Long): String {
        val s = ms / 1000
        return "%02d:%02d".format(s / 60, s % 60)
    }
}
