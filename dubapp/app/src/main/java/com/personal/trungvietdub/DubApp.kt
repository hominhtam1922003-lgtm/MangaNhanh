package com.personal.trungvietdub

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter

class DubApp : Application() {
    override fun onCreate() {
        super.onCreate()
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.notif_channel_name),
            NotificationManager.IMPORTANCE_LOW
        ).apply { description = getString(R.string.notif_channel_desc) }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        val result = NotificationChannel(
            RESULT_CHANNEL_ID,
            "Kết quả lồng tiếng",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply { description = "Thông báo khi video lồng tiếng xong hoặc lỗi" }
        getSystemService(NotificationManager::class.java).createNotificationChannel(result)
        installCrashRecorder()
    }

    /** Ghi stack trace khi app crash để lần mở sau hiển thị cho người dùng. */
    private fun installCrashRecorder() {
        val file = File(filesDir, CRASH_FILE)
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            runCatching {
                val sw = StringWriter()
                error.printStackTrace(PrintWriter(sw))
                file.writeText("[${thread.name}] ${sw}")
            }
            previous?.uncaughtException(thread, error)
        }
    }

    companion object {
        const val CHANNEL_ID = "dub_progress"
        const val RESULT_CHANNEL_ID = "dub_result"
        const val CRASH_FILE = "last_crash.txt"
    }
}
