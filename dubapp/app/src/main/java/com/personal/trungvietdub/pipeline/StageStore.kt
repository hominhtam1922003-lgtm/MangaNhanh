package com.personal.trungvietdub.pipeline

import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Lưu kết quả trung gian của từng bước trong thư mục job.
 * Mọi lần ghi đều qua file tạm rồi đổi tên, nên tiến trình chết giữa chừng không để lại file hỏng.
 */
class StageStore(private val dir: File) {
    private val json = Json { ignoreUnknownKeys = true }
    private val listSer = ListSerializer(String.serializer())

    fun has(name: String): Boolean = File(dir, name).exists()

    fun completed(): List<String> = dir.listFiles()?.map { it.name }?.sorted() ?: emptyList()

    fun saveText(name: String, text: String) {
        atomic(name) { it.writeText(text) }
    }

    fun loadText(name: String): String = File(dir, name).readText()

    fun saveList(name: String, list: List<String>) {
        atomic(name) { it.writeText(json.encodeToString(listSer, list)) }
    }

    fun loadList(name: String): List<String> {
        if (!has(name)) return emptyList()
        return try {
            json.decodeFromString(listSer, File(dir, name).readText())
        } catch (e: Exception) {
            emptyList()
        }
    }

    fun saveFloats(name: String, data: FloatArray) {
        atomic(name) { f ->
            val chunk = 1 shl 18
            val bytes = ByteArray(chunk * 4)
            val fb = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer()
            FileOutputStream(f).use { out ->
                var i = 0
                while (i < data.size) {
                    val n = minOf(chunk, data.size - i)
                    fb.clear()
                    fb.put(data, i, n)
                    out.write(bytes, 0, n * 4)
                    i += n
                }
            }
        }
    }

    fun loadFloats(name: String): FloatArray {
        val f = File(dir, name)
        val n = (f.length() / 4).toInt()
        val out = FloatArray(n)
        val bb = ByteBuffer.allocate(1 shl 20).order(ByteOrder.LITTLE_ENDIAN)
        var pos = 0
        f.inputStream().channel.use { ch ->
            while (pos < n) {
                bb.clear()
                bb.limit(minOf(bb.capacity(), (n - pos) * 4))
                while (bb.hasRemaining()) {
                    if (ch.read(bb) < 0) error("File $name bị thiếu dữ liệu")
                }
                bb.flip()
                val count = bb.limit() / 4
                bb.asFloatBuffer().get(out, pos, count)
                pos += count
            }
        }
        return out
    }

    private inline fun atomic(name: String, write: (File) -> Unit) {
        val tmp = File(dir, "$name.tmp")
        write(tmp)
        if (!tmp.renameTo(File(dir, name))) error("Không ghi được $name")
    }
}
