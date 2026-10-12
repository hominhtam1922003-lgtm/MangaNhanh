package com.personal.trungvietdub.data

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import org.apache.commons.compress.compressors.bzip2.BZip2CompressorInputStream
import java.io.BufferedInputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.concurrent.TimeUnit

/** Một file lẻ cần tải, lưu tại models/<id>/<relPath>. */
data class RemoteFile(val relPath: String, val url: String)

/**
 * Mô hình tải một lần. Hoặc là một gói tar.bz2 (archiveUrl), hoặc là nhiều file lẻ (files).
 * Tải xong sẽ ghi file đánh dấu ".complete".
 */
data class ModelSpec(
    val id: String,
    val title: String,
    val approxMb: Int,
    val archiveUrl: String? = null,
    val files: List<RemoteFile> = emptyList(),
)

object ModelCatalog {
    private const val SHERPA = "https://github.com/k2-fsa/sherpa-onnx/releases/download"
    private const val HF_NLLB = "https://huggingface.co/Xenova/nllb-200-distilled-600M/resolve/main"

    val ASR = ModelSpec(
        id = "asr-paraformer-zh-small",
        title = "Nhận diện tiếng Trung (Paraformer small)",
        approxMb = 78,
        archiveUrl = "$SHERPA/asr-models/sherpa-onnx-paraformer-zh-small-2024-03-09.tar.bz2",
    )
    val TTS_VI = ModelSpec(
        id = "tts-vi-vais1000",
        title = "Giọng đọc tiếng Việt (VITS vais1000)",
        approxMb = 67,
        archiveUrl = "$SHERPA/tts-models/vits-piper-vi_VN-vais1000-medium.tar.bz2",
    )
    val UVR = ModelSpec(
        id = "sep-uvr-mdx-inst-hq3",
        title = "Tách giọng gốc, giữ nhạc (UVR MDX-NET)",
        approxMb = 67,
        files = listOf(RemoteFile(
            "UVR-MDX-NET-Inst_HQ_3.onnx",
            "$SHERPA/source-separation-models/UVR-MDX-NET-Inst_HQ_3.onnx",
        )),
    )
    val NLLB = ModelSpec(
        id = "mt-nllb-600m-q",
        title = "Dịch Trung → Việt (NLLB-200 600M, lượng tử hóa)",
        approxMb = 910,
        files = listOf(
            RemoteFile("encoder_model_quantized.onnx", "$HF_NLLB/onnx/encoder_model_quantized.onnx"),
            RemoteFile("decoder_model_merged_quantized.onnx", "$HF_NLLB/onnx/decoder_model_merged_quantized.onnx"),
            RemoteFile("tokenizer.json", "$HF_NLLB/tokenizer.json"),
        ),
    )
    val all = listOf(ASR, TTS_VI, NLLB, UVR)
}

data class AsrFiles(val model: File, val tokens: File)
data class TtsFiles(val model: File, val tokens: File, val espeakDataDir: File)
data class NllbFiles(val encoder: File, val decoder: File, val tokenizer: File)

class ModelManager(private val context: Context) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .build()

    private fun rootOf(spec: ModelSpec) = File(context.filesDir, "models/${spec.id}")

    fun isReady(spec: ModelSpec): Boolean = File(rootOf(spec), ".complete").exists()

    fun asrFiles(): AsrFiles? {
        if (!isReady(ModelCatalog.ASR)) return null
        val tokens = rootOf(ModelCatalog.ASR).walkTopDown().firstOrNull { it.name == "tokens.txt" } ?: return null
        val dir = tokens.parentFile!!
        val model = dir.listFiles()!!.firstOrNull { it.name == "model.int8.onnx" }
            ?: dir.listFiles()!!.firstOrNull { it.name == "model.onnx" }
            ?: return null
        return AsrFiles(model, tokens)
    }

    fun ttsFiles(): TtsFiles? {
        if (!isReady(ModelCatalog.TTS_VI)) return null
        val tokens = rootOf(ModelCatalog.TTS_VI).walkTopDown().firstOrNull { it.name == "tokens.txt" } ?: return null
        val dir = tokens.parentFile!!
        val model = dir.listFiles()!!.firstOrNull { it.name.endsWith(".onnx") } ?: return null
        val espeak = File(dir, "espeak-ng-data")
        if (!espeak.isDirectory) return null
        return TtsFiles(model, tokens, espeak)
    }

    fun uvrFile(): File? =
        if (isReady(ModelCatalog.UVR)) File(rootOf(ModelCatalog.UVR), ModelCatalog.UVR.files[0].relPath) else null

    fun nllbFiles(): NllbFiles? {
        if (!isReady(ModelCatalog.NLLB)) return null
        val r = rootOf(ModelCatalog.NLLB)
        return NllbFiles(
            encoder = File(r, "encoder_model_quantized.onnx"),
            decoder = File(r, "decoder_model_merged_quantized.onnx"),
            tokenizer = File(r, "tokenizer.json"),
        )
    }

    /** Tải model. onProgress nhận 0..1 cho toàn bộ model. */
    suspend fun download(spec: ModelSpec, onProgress: (Float) -> Unit) = withContext(Dispatchers.IO) {
        val root = rootOf(spec)
        root.deleteRecursively()
        root.mkdirs()
        val archiveUrl = spec.archiveUrl
        if (archiveUrl != null) {
            val work = File(context.cacheDir, "dl").apply { mkdirs() }
            val archive = File(work, "${spec.id}.tar.bz2")
            downloadTo(archiveUrl, archive) { onProgress(it * 0.98f) }
            extractTarBz2(archive, root)
            archive.delete()
        } else {
            spec.files.forEachIndexed { i, rf ->
                val dest = File(root, rf.relPath)
                dest.parentFile?.mkdirs()
                downloadTo(rf.url, dest) { onProgress((i + it) / spec.files.size * 0.98f) }
            }
        }
        File(root, ".complete").writeText("ok")
        onProgress(1f)
    }

    private fun downloadTo(url: String, dest: File, onProgress: (Float) -> Unit) {
        client.newCall(Request.Builder().url(url).build()).execute().use { resp ->
            if (!resp.isSuccessful) error("Tải thất bại (HTTP ${resp.code}): $url")
            val body = resp.body ?: error("Phản hồi rỗng")
            val total = body.contentLength().takeIf { it > 0 } ?: 1L
            body.byteStream().use { input ->
                FileOutputStream(dest).use { out ->
                    val buf = ByteArray(64 * 1024)
                    var done = 0L
                    while (true) {
                        val n = input.read(buf)
                        if (n < 0) break
                        out.write(buf, 0, n)
                        done += n
                        onProgress((done.toFloat() / total).coerceIn(0f, 1f))
                    }
                }
            }
        }
    }

    private fun extractTarBz2(archive: File, dest: File) {
        val destCanon = dest.canonicalPath + File.separator
        TarArchiveInputStream(
            BZip2CompressorInputStream(BufferedInputStream(FileInputStream(archive)))
        ).use { tar ->
            var entry = tar.nextTarEntry
            while (entry != null) {
                val out = File(dest, entry.name)
                require(out.canonicalPath.startsWith(destCanon)) { "Đường dẫn tar không hợp lệ" }
                if (entry.isDirectory) {
                    out.mkdirs()
                } else {
                    out.parentFile?.mkdirs()
                    FileOutputStream(out).use { tar.copyTo(it) }
                }
                entry = tar.nextTarEntry
            }
        }
    }
}
