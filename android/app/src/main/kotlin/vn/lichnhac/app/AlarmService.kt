package vn.lichnhac.app

import android.app.*
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.*
import java.util.ArrayDeque

class AlarmService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private val queue = ArrayDeque<AlarmRecord>()
    @Volatile var current: AlarmRecord? = null
        private set
    private var player: MediaPlayer? = null
    val isSoundPlaying: Boolean get() = try { player?.isPlaying == true } catch (_: Exception) { false }
    private var wakeLock: PowerManager.WakeLock? = null
    private var vibrator: Vibrator? = null
    private val timeout = Runnable { current?.let { dismiss(it.id) } }
    override fun onBind(intent: Intent?) = null
    override fun onCreate() { super.onCreate(); instance = this }
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val id = intent?.getIntExtra("id", -1) ?: -1
        val row = AlarmStore.read(this).firstOrNull { it.id == id }
        if (row == null) { if (current == null) stopSelf(); return START_NOT_STICKY }
        if (current?.id == id || queue.any { it.id == id }) return START_NOT_STICKY
        if (current != null) { queue.add(row); return START_NOT_STICKY }
        try { ring(row) } catch (_: Exception) {
            fallbackNotification(this, row); quiet(); current = null; stopSelf()
        }
        return START_NOT_STICKY
    }
    private fun ring(row: AlarmRecord) {
        current = row
        startForeground(NOTIFICATION_ID, notification(this, row, true))
        wakeLock = getSystemService(PowerManager::class.java).newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK, "LichNhac:Alarm").apply { acquire(6 * 60 * 1000L) }
        playSystemSound()
        vibrator = if (Build.VERSION.SDK_INT >= 31) getSystemService(VibratorManager::class.java).defaultVibrator
            else getSystemService(Vibrator::class.java)
        if (Build.VERSION.SDK_INT >= 26) vibrator?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 500, 600), 0))
            else { @Suppress("DEPRECATION") vibrator?.vibrate(longArrayOf(0, 500, 600), 0) }
        handler.postDelayed(timeout, 5 * 60 * 1000L)
        sendBroadcast(Intent("vn.lichnhac.ALARM_UPDATE").setPackage(packageName))
    }
    private fun playSystemSound() {
        try {
            player = MediaPlayer().apply {
                setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
                setDataSource(this@AlarmService, RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM))
                isLooping = true
                setOnPreparedListener { if (current != null) it.start() }
                setOnErrorListener { _, _, _ -> playFallback(); true }
                prepareAsync()
            }
        } catch (_: Exception) { playFallback() }
    }
    private fun playFallback() {
        if (current == null) return
        player?.release()
        player = try {
            MediaPlayer.create(this, R.raw.alarm_chime,
                AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build(), 0)?.apply {
                isLooping = true; start()
            }
        } catch (_: Exception) { null }
        if (player == null) current?.let { fallbackNotification(this, it) }
    }
    private fun quiet() {
        handler.removeCallbacks(timeout)
        player?.setOnPreparedListener(null); player?.setOnErrorListener(null)
        player?.release(); player = null; vibrator?.cancel(); vibrator = null
        wakeLock?.let { if (it.isHeld) it.release() }; wakeLock = null
    }
    fun dismiss(id: Int) {
        if (current?.id != id) { queue.removeIf { it.id == id }; AlarmStore.remove(this, id); return }
        AlarmStore.remove(this, id); quiet(); current = null; next()
    }
    fun snooze(id: Int, minutes: Int): Boolean {
        val row = current ?: return false
        if (row.id != id || !AlarmStore.snooze(this, row, minutes)) return false
        quiet(); current = null; next(); return true
    }
    private fun next() {
        sendBroadcast(Intent("vn.lichnhac.ALARM_UPDATE").setPackage(packageName))
        if (queue.isNotEmpty()) ring(queue.removeFirst()) else {
            stopForeground(STOP_FOREGROUND_REMOVE); stopSelf()
        }
    }
    fun prune(valid: Map<Int, Long>) {
        queue.removeIf { valid[it.id] != it.original }
        current?.let { if (valid[it.id] != it.original) dismiss(it.id) }
    }
    fun stopAll() { queue.clear(); current?.let { AlarmStore.remove(this, it.id) }; quiet(); current = null; stopForeground(STOP_FOREGROUND_REMOVE); stopSelf() }
    override fun onDestroy() { quiet(); current = null; instance = null; sendBroadcast(Intent("vn.lichnhac.ALARM_UPDATE").setPackage(packageName)); super.onDestroy() }
    companion object {
        @Volatile var instance: AlarmService? = null
        const val NOTIFICATION_ID = 1800000000
        private fun action(c: Context, id: Int, action: String) = PendingIntent.getBroadcast(c,
            id xor action.hashCode(), Intent(c, AlarmReceiver::class.java).setAction(action).putExtra("id", id),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        fun notification(c: Context, r: AlarmRecord, ongoing: Boolean): Notification {
            val manager = c.getSystemService(NotificationManager::class.java)
            val channel = "ringing_alarms_v1"
            if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(NotificationChannel(channel,
                "Báo thức đổ chuông", NotificationManager.IMPORTANCE_HIGH).apply { setSound(null, null); enableVibration(false) })
            val open = PendingIntent.getActivity(c, r.id, Intent(c, AlarmActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra("id", r.id),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(c, channel) else Notification.Builder(c)
            builder.setSmallIcon(R.drawable.ic_notification).setContentTitle("Đến giờ: ${r.title}")
                .setContentText("Bấm để dừng hoặc hoãn 5 phút").setCategory(Notification.CATEGORY_ALARM)
                .setContentIntent(open).setOngoing(ongoing).setAutoCancel(!ongoing)
                .setVisibility(Notification.VISIBILITY_PRIVATE)
                .addAction(Notification.Action.Builder(null, "Dừng", action(c, r.id, "vn.lichnhac.STOP")).build())
                .addAction(Notification.Action.Builder(null, "Hoãn 5 phút", action(c, r.id, "vn.lichnhac.SNOOZE")).build())
            if (Build.VERSION.SDK_INT < 34 || manager.canUseFullScreenIntent()) builder.setFullScreenIntent(open, true)
            if (Build.VERSION.SDK_INT < 26) { @Suppress("DEPRECATION") builder.setPriority(Notification.PRIORITY_MAX) }
            return builder.build()
        }
        fun fallbackNotification(c: Context, r: AlarmRecord) {
            try {
                val manager = c.getSystemService(NotificationManager::class.java)
                val channel = "alarm_fallback_v1"
                if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(NotificationChannel(
                    channel, "Báo thức chuyển sang thông báo", NotificationManager.IMPORTANCE_HIGH).apply {
                    setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                        AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build())
                })
                val open = PendingIntent.getActivity(c, r.id, Intent(c, MainActivity::class.java),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
                val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(c, channel) else Notification.Builder(c)
                builder.setSmallIcon(R.drawable.ic_notification).setContentTitle("Đến giờ: ${r.title}")
                    .setContentText("Android không mở được chuông. Chạm để xem công việc.")
                    .setContentIntent(open).setAutoCancel(true).setVisibility(Notification.VISIBILITY_PRIVATE)
                if (Build.VERSION.SDK_INT < 26) {
                    @Suppress("DEPRECATION") builder.setDefaults(Notification.DEFAULT_SOUND).setPriority(Notification.PRIORITY_HIGH)
                }
                manager.notify(r.id, builder.build())
            } catch (_: Exception) { }
        }
    }
}
