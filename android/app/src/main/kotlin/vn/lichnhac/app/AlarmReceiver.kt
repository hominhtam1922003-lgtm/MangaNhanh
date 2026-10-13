package vn.lichnhac.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == "vn.lichnhac.STOP") {
            AlarmService.instance?.dismiss(intent.getIntExtra("id", -1)); return
        }
        if (intent.action == "vn.lichnhac.SNOOZE") {
            AlarmService.instance?.snooze(intent.getIntExtra("id", -1), 5); return
        }
        val record = AlarmStore.fired(context, intent.getIntExtra("id", -1)) ?: return
        val service = Intent(context, AlarmService::class.java).putExtra("id", record.id)
        try {
            if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(service) else context.startService(service)
        } catch (_: Exception) {
            AlarmService.fallbackNotification(context, record)
        }
    }
}
class AlarmRestoreReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) { AlarmStore.restore(context) }
}
