package com.personal.trungvietdub.notify

import android.app.Notification
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.personal.trungvietdub.DubApp

/** Thông báo kết quả (xong/lỗi). Tiến độ đang chạy do DubForegroundService hiển thị. */
object Notifications {
    /** Người dùng đã bật thông báo cho app chưa (Android 13+ cần quyền runtime POST_NOTIFICATIONS). */
    fun enabled(context: Context): Boolean = NotificationManagerCompat.from(context).areNotificationsEnabled()

    fun postResult(context: Context, jobId: String, title: String, ok: Boolean, text: String) {
        if (!enabled(context)) return
        val n: Notification = NotificationCompat.Builder(context, DubApp.RESULT_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setContentTitle(if (ok) "Lồng tiếng xong: $title" else "Lồng tiếng lỗi: $title")
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setAutoCancel(true)
            .build()
        try {
            NotificationManagerCompat.from(context).notify(jobId.hashCode(), n)
        } catch (_: SecurityException) {
            // Quyền bị thu hồi giữa chừng: bỏ qua thông báo
        }
    }

    val needsRuntimePermission: Boolean get() = Build.VERSION.SDK_INT >= 33
}
