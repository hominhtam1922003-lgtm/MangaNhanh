package com.personal.trungvietdub

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager

class DubApp : Application() {
    override fun onCreate() {
        super.onCreate()
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.notif_channel_name),
            NotificationManager.IMPORTANCE_LOW
        ).apply { description = getString(R.string.notif_channel_desc) }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    companion object {
        const val CHANNEL_ID = "dub_progress"
    }
}
