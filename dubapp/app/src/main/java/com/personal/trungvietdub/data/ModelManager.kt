package com.personal.trungvietdub.data

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import org.apache.commons.compress.compressors.bzip2.BZip2CompressorInputStream
import java.io.BufferedInputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.concurrent.TimeUnit

/** Mô hình tải một lần từ GitHub Releases của k2-fsa/sherpa-onnx (tar.bz2). */
data class ModelSpec(
    val id: String,
    val title: String,
    val url: String,
    val approxMb: Int,
)

object ModelCatalog {
    val ASR = ModelSpec(
        id = "asr-paraformer-zh-small",
        title = "Nhận diện tiếng Trung (Paraformer small)",
        url = "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-paraformer-zh-small-2024-03-09.tar.bz2",
        approxMb = 78,
    )
    val TTS_VI = ModelSpec(
        id = "tts-vi-vais1000",
        title = "Giọng đọc tiếng Việt (VITS vais1000)",
        url = "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-vi_VN-vais1000-medium.tar.bz2",
        approxMb = 67,
    )
    val all = listOf(ASR, TTS_VI)
}

/** Đường dẫn file đã giải nén, dùng để khởi tạo sherpa-onnx. */
data class AsrFiles(val model: File, val tokens: File)
data class TtsFiles(val model: File, val tokens: File, val espeakDataDir: File)

class ModelManager(private val context: Context) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    private fun rootOf(spec: ModelSpec) = File(context.filesDir, "models/${spec.id}")

    fun isReady(spec: ModelSpec): Boolean = findTokens(spec) != null

    private fun findTokens(spec: ModelSpec): File? =
        rootOf(spec).walkTopDown().firstOrNull { it.name == "tokens.txt" }

    fun asrFiles(): AsrFiles? {
        val tokens = findTokens(ModelCatalog.ASR) ?: return null
        val dir = tokens.parentFile!!
        val model = dir.listFiles()!!.firstOrNull { it.name == "model.int8.onnx" }
            ?: dir.listFiles()!!.firstOrNull { it.name == "model.onnx" }
            ?: return null
        return AsrFiles(model, tokens)
    }

    fun ttsFiles(): TtsFiles? {
        val tokens = findTokens(ModelCatalog.TTS_VI) ?: return null
        val dir = tokens.parentFile!!
        val model = dir.listFiles()!!.firstOrNull { it.name.endsWith(".onnx") } ?: return null
        val espeak = File(dir, "espeak-ng-data")
        if (!espeak.isDirectory) return null
        return TtsFiles(model, tokens, espeak)
    }

    /** Tải và giải nén. onProgress nhận giá trị 0..1. */
    suspend fun download(spec: ModelSpec, onProgress: (Float) -> Unit) = withContext(Dispatchers.IO) {
        val work = File(context.cacheDir, "dl").apply { mkdirs() }
        val archive = File(work, "${spec.id}.tar.bz2")
        val request = okhttp3.Request.Builder().url(spec.url).build()
        client.newCall(request).execute().use { resp ->
            if (!resp.isSuccessful) error("Tải model thất bại: HTTP ${resp.code}")
            val body = resp.body ?: error("Phản hồi rỗng")
            val total = body.contentLength().takeIf { it > 0 } ?: (spec.approxMb * 1_000_000L)
            body.byteStream().use { input ->
                FileOutputStream(archive).use { out ->
                    val buf = ByteArray(64 * 1024)
                    var done = 0L
                    while (true) {
                        val n = input.read(buf)
                        if (n < 0) break
                        out.write(buf, 0, n)
                        done += n
                        onProgress((done.toFloat() / total).coerceIn(0f, 0.99f))
                    }
                }
            }
        }
        onProgress(0.99f)
        val target = rootOf(spec)
        target.deleteRecursively()
        target.mkdirs()
        extractTarBz2(archive, target)
        archive.delete()
        onProgress(1f)
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
