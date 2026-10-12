package com.personal.trungvietdub.pipeline

import android.content.ContentValues
import android.content.Context
import android.os.Build
import android.os.Environment
import android.provider.MediaStore

/** Phụ đề SRT tiếng Việt, lưu vào thư mục Download/TrungVietDub. */
object Subtitles {
    private const val REL_DIR = "TrungVietDub"

    /** [entries]: (startMs, endMs, text) theo thứ tự thời gian. */
    fun srt(entries: List<Triple<Long, Long, String>>): String {
        val sb = StringBuilder()
        var n = 0
        for ((start, end, text) in entries) {
            if (text.isBlank()) continue
            n++
            sb.append(n).append('\n')
            sb.append(stamp(start)).append(" --> ").append(stamp(maxOf(end, start + 500))).append('\n')
            sb.append(text.trim()).append("\n\n")
        }
        return sb.toString()
    }

    private fun stamp(ms: Long): String {
        val h = ms / 3_600_000
        val m = (ms / 60_000) % 60
        val s = (ms / 1000) % 60
        val milli = ms % 1000
        return "%02d:%02d:%02d,%03d".format(h, m, s, milli)
    }

    /** Ghi file .srt; trả về mô tả nơi lưu để ghi vào nhật ký. */
    fun save(context: Context, displayName: String, content: String): String {
        val bytes = content.toByteArray(Charsets.UTF_8)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val resolver = context.contentResolver
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, displayName)
                put(MediaStore.Downloads.MIME_TYPE, "application/x-subrip")
                put(MediaStore.Downloads.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/$REL_DIR")
                put(MediaStore.Downloads.IS_PENDING, 1)
            }
            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                ?: error("Không tạo được file phụ đề")
            resolver.openOutputStream(uri)!!.use { it.write(bytes) }
            values.clear()
            values.put(MediaStore.Downloads.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
            return "Download/$REL_DIR/$displayName"
        }
        val dir = java.io.File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), REL_DIR)
        if (!dir.exists() && !dir.mkdirs()) error("Không tạo được thư mục Download/$REL_DIR")
        java.io.File(dir, displayName).writeBytes(bytes)
        return "Download/$REL_DIR/$displayName"
    }
}
