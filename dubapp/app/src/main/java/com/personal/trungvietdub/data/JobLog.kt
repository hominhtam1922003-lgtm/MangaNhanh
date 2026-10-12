package com.personal.trungvietdub.data

import android.content.Context
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Nhật ký từng bước của mỗi job, lưu tại filesDir/logs/<jobId>.log và hiển thị trên màn hình Tiến trình. */
object JobLog {
    private fun file(context: Context, id: String) = File(context.filesDir, "logs/$id.log")

    fun append(context: Context, id: String, msg: String) {
        try {
            val f = file(context, id)
            f.parentFile?.mkdirs()
            val ts = SimpleDateFormat("HH:mm:ss", Locale.US).format(Date())
            f.appendText("$ts $msg\n")
        } catch (_: Exception) {
            // Ghi nhật ký không được phép làm hỏng job
        }
    }

    fun tail(context: Context, id: String, lines: Int = 60): String = try {
        file(context, id).takeIf { it.exists() }?.readLines()?.takeLast(lines)?.joinToString("\n") ?: ""
    } catch (_: Exception) {
        ""
    }
}
