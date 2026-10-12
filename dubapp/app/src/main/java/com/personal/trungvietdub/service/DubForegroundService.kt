package com.personal.trungvietdub.service

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Binder
import android.os.IBinder
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
import java.util.concurrent.ConcurrentHashMap

/**
 * Worker: chạy pipeline trong TIẾN TRÌNH RIÊNG (android:process=":worker").
 * Nếu worker chết vì native crash hoặc bị hệ thống kill, giao diện không bị kéo theo;
 * giao diện (ViewModel) sẽ tự khởi động lại worker và pipeline chạy tiếp từ các bước đã lưu.
 */
class DubForegroundService : Service() {
    companion object {
        const val EXTRA_JOB_ID = "job_id"
        private const val NOTIF_ID = 1001

        /** Job đang chạy trong tiến trình worker này, tránh chạy trùng. */
        private val running: MutableSet<String> = ConcurrentHashMap.newKeySet()

        fun start(context: Context, jobId: String) {
            val i = Intent(context, DubForegroundService::class.java).putExtra(EXTRA_JOB_ID, jobId)
            ContextCompat.startForegroundService(context, i)
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

    override fun onCreate() {
        super.onCreate()
        repo = JobRepository.get(this)
    }

    /** Giao diện bind vào đây để phát hiện khi worker bị chết. */
    override fun onBind(intent: Intent?): IBinder = binder

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val jobId = intent?.getStringExtra(EXTRA_JOB_ID) ?: run { stopSelf(); return START_NOT_STICKY }
        val job = repo.get(jobId) ?: run { stopSelf(); return START_NOT_STICKY }
        ServiceCompat.startForeground(
            this, NOTIF_ID, notification(job.title, 0f, "Đang chuẩn bị"),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
        )
        if (!running.add(jobId)) return START_NOT_STICKY
        scope.launch {
            try {
                process(job)
            } finally {
                running.remove(jobId)
                ServiceCompat.stopForeground(this@DubForegroundService, ServiceCompat.STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
        return START_NOT_STICKY
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
        return NotificationCompat.Builder(this, DubApp.CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setProgress(100, (progress * 100).toInt(), false)
            .setContentIntent(open)
            .build()
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}
