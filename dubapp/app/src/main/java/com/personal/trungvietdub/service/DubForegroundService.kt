package com.personal.trungvietdub.service

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.net.wifi.WifiManager
import android.os.Binder
import android.os.IBinder
import android.os.PowerManager
import android.provider.OpenableColumns
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.personal.trungvietdub.DubApp
import com.personal.trungvietdub.MainActivity
import com.personal.trungvietdub.R
import com.personal.trungvietdub.data.Job
import com.personal.trungvietdub.data.JobLog
import com.personal.trungvietdub.data.JobRepository
import com.personal.trungvietdub.data.JobStatus
import com.personal.trungvietdub.data.OriginalAudioMode
import com.personal.trungvietdub.data.Step
import com.personal.trungvietdub.pipeline.DubbingPipeline
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Worker chạy trong TIẾN TRÌNH RIÊNG (android:process=":worker") dưới dạng foreground service.
 *
 * - Người dùng có thể rời màn hình, tắt màn hình hoặc đóng app: job vẫn chạy, tiến độ hiện trên thông báo.
 * - Các job xếp hàng và chạy LẦN LƯỢT (một job một lúc) để không tranh bộ nhớ/CPU.
 * - Giữ WakeLock (CPU) và WifiLock (mạng cho Gemini) trong lúc có job đang chạy.
 * - Nếu worker chết (native crash, bị hệ thống kill), app khởi động lại worker khi mở; job RUNNING được
 *   tính là một lần thử lại và dừng sau MAX_ATTEMPTS lần.
 */
class DubForegroundService : Service() {
    companion object {
        const val EXTRA_JOB_ID = "job_id"
        private const val NOTIF_ID = 1001
        private const val WAKE_TIMEOUT_MS = 3 * 60 * 60 * 1000L

        private val lock = Any()
        /** Hàng đợi job và các job đang chờ/đang chạy trong tiến trình worker này. */
        private val queue = ArrayDeque<String>()
        private val pending = HashSet<String>()
        private var draining = false

        /** Đưa job vào hàng đợi worker (không tạo job đôi). Gọi được từ app khi đang mở hoặc ở nền. */
        fun start(context: Context, jobId: String) {
            val i = Intent(context, DubForegroundService::class.java).putExtra(EXTRA_JOB_ID, jobId)
            try {
                ContextCompat.startForegroundService(context, i)
            } catch (e: Exception) {
                // Android 12+ không cho khởi động dịch vụ nền khi app ở nền: không để job kẹt ở RUNNING/QUEUED
                JobLog.append(context, jobId, "Không khởi động được worker: ${e.javaClass.simpleName}: ${e.message}")
                val repo = JobRepository.get(context)
                repo.get(jobId)?.let {
                    repo.upsert(
                        it.copy(
                            status = JobStatus.FAILED,
                            error = "Không khởi động được tiến trình nền (${e.javaClass.simpleName}). Mở app và bấm Tiếp tục.",
                        ),
                    )
                }
            }
        }

        fun displayNameOf(context: Context, uri: Uri): String {
            return context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
                ?.use { c -> if (c.moveToFirst()) c.getString(0) else null }
                ?: "video"
        }
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private lateinit var repo: JobRepository
    private val binder = Binder()
    private var wake: PowerManager.WakeLock? = null
    private var wifi: WifiManager.WifiLock? = null

    override fun onCreate() {
        super.onCreate()
        repo = JobRepository.get(this)
    }

    /** Giao diện bind vào đây để phát hiện khi worker bị chết. */
    override fun onBind(intent: Intent?): IBinder = binder

    @SuppressLint("WakelockTimeout")
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val jobId = intent?.getStringExtra(EXTRA_JOB_ID)
        // Phải gọi startForeground ngay sau startForegroundService, kể cả khi không có job mới
        val title = jobId?.let { repo.get(it)?.title } ?: "Lồng tiếng"
        ServiceCompat.startForeground(
            this, NOTIF_ID, notification(title, 0f, "Đang chuẩn bị"),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
        )
        if (jobId == null) {
            stopIfIdle()
            return START_NOT_STICKY
        }
        synchronized(lock) {
            if (jobId in pending) return START_NOT_STICKY
            val job = repo.get(jobId)
            if (job == null) {
                stopIfIdle()
                return START_NOT_STICKY
            }
            pending.add(jobId)
            queue.addLast(jobId)
            if (job.status != JobStatus.RUNNING) {
                repo.upsert(job.copy(status = JobStatus.QUEUED))
            }
            JobLog.append(this, jobId, "Xếp hàng chạy (đang chờ ${queue.size} job)")
            if (!draining) {
                draining = true
                acquireLocks()
                scope.launch { drain() }
            }
        }
        return START_NOT_STICKY
    }

    /** Chạy lần lượt các job trong hàng đợi; hết việc thì dừng dịch vụ. */
    private suspend fun drain() {
        while (true) {
            val next = synchronized(lock) {
                if (queue.isEmpty()) {
                    draining = false
                    releaseLocks()
                    ServiceCompat.stopForeground(this@DubForegroundService, ServiceCompat.STOP_FOREGROUND_REMOVE)
                    stopSelf()
                    return
                }
                queue.removeFirst()
            }
            try {
                val job = repo.get(next)
                if (job != null && job.status != JobStatus.DONE && job.status != JobStatus.FAILED) {
                    runOne(job)
                }
            } finally {
                synchronized(lock) { pending.remove(next) }
            }
        }
    }

    private suspend fun runOne(job: Job) {
        // Trạng thái RUNNING còn lại từ lần trước = worker đã chết giữa chừng: tính là một lần thử lại
        val crashed = job.status == JobStatus.RUNNING
        val tries = if (crashed) job.attempts + 1 else job.attempts
        if (crashed && tries >= JobRepository.MAX_ATTEMPTS) {
            JobLog.append(this, job.id, "Worker đã dừng $tries lần; dừng tự động, chờ người dùng bấm Tiếp tục")
            repo.upsert(
                job.copy(
                    status = JobStatus.FAILED, attempts = tries,
                    error = "Xử lý đã dừng $tries lần liên tiếp (thường do lỗi native hoặc thiếu bộ nhớ). " +
                        "Bấm Tiếp tục để chạy lại từ các bước đã lưu.",
                ),
            )
            return
        }
        process(job.copy(attempts = tries))
    }

    private fun acquireLocks() {
        if (wake == null) {
            wake = getSystemService(PowerManager::class.java)
                .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "TrungVietDub:job")
                .apply { setReferenceCounted(false); acquire(WAKE_TIMEOUT_MS) }
        }
        if (wifi == null) {
            @Suppress("DEPRECATION")
            wifi = (applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager)
                .createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "TrungVietDub:net")
                .apply { setReferenceCounted(false); acquire() }
        }
    }

    private fun releaseLocks() {
        runCatching { wake?.release() }
        runCatching { wifi?.release() }
        wake = null
        wifi = null
    }

    private fun stopIfIdle() {
        synchronized(lock) {
            if (!draining) {
                ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
    }

    private suspend fun process(job: Job) {
        val mode = runCatching { OriginalAudioMode.valueOf(job.mode) }.getOrDefault(OriginalAudioMode.LOWER)
        var current = job.copy(status = JobStatus.RUNNING, error = null)
        repo.upsert(current)
        JobLog.append(this, job.id, "Worker khởi động (lần ${job.attempts + 1}, mode=${mode.name}, tốc độ=${job.speed})")
        try {
            val result = DubbingPipeline(this).run(
                jobId = job.id,
                sourceUri = Uri.parse(job.sourceUri),
                displayName = "dub_${job.id}.mp4",
                requestedMode = mode,
                speed = job.speed,
                onProgress = { step, frac, note ->
                    val total = overall(step, frac)
                    current = current.copy(
                        step = step.label + if (note.isNotEmpty()) " ($note)" else "",
                        progress = total,
                    )
                    repo.upsert(current)
                    updateNotification(job.title, total, step.label)
                },
                onTranscript = { t ->
                    current = current.copy(transcript = t)
                    repo.upsert(current)
                },
            )
            current = current.copy(
                status = JobStatus.DONE, progress = 1f, step = "Hoàn tất",
                outputUri = result.outputUri.toString(), transcript = result.transcript,
            )
        } catch (e: Throwable) {
            JobLog.append(this, job.id, "LỖI: ${e.javaClass.name}: ${e.message}")
            current = current.copy(
                status = JobStatus.FAILED,
                error = "${e.javaClass.simpleName}: ${e.message ?: "không rõ"}",
            )
        }
        repo.upsert(current)
        com.personal.trungvietdub.notify.Notifications.postResult(
            this, job.id, job.title,
            ok = current.status == JobStatus.DONE,
            text = if (current.status == JobStatus.DONE) "Đã lưu vào thư viện (Movies/TrungVietDub)"
            else "Lỗi: ${current.error ?: "không rõ"}. Mở app để tiếp tục.",
        )
    }

    private fun overall(step: Step, frac: Float): Float {
        var acc = 0f
        for (s in Step.values()) {
            if (s == step) return acc + s.weight * frac
            acc += s.weight
        }
        return acc
    }

    private fun updateNotification(title: String, progress: Float, text: String) {
        getSystemService(NotificationManager::class.java).notify(NOTIF_ID, notification(title, progress, text))
    }

    private fun notification(title: String, progress: Float, text: String): Notification {
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val waiting = synchronized(lock) { queue.size }
        val extra = if (waiting > 0) " · còn $waiting job chờ" else ""
        return NotificationCompat.Builder(this, DubApp.CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(text + extra)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setProgress(100, (progress * 100).toInt(), false)
            .setContentIntent(open)
            .build()
    }

    override fun onDestroy() {
        releaseLocks()
        scope.cancel()
        super.onDestroy()
    }
}
