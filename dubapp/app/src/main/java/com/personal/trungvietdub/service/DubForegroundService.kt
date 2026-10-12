package com.personal.trungvietdub.service

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.provider.OpenableColumns
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.personal.trungvietdub.DubApp
import com.personal.trungvietdub.MainActivity
import com.personal.trungvietdub.R
import com.personal.trungvietdub.data.Job
import com.personal.trungvietdub.data.JobRepository
import com.personal.trungvietdub.data.JobStatus
import com.personal.trungvietdub.data.OriginalAudioMode
import com.personal.trungvietdub.data.Step
import com.personal.trungvietdub.pipeline.DubbingPipeline
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.cancel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/** Chạy pipeline dưới foreground service để giảm nguy cơ hệ thống tắt giữa chừng. */
class DubForegroundService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private lateinit var repo: JobRepository

    override fun onCreate() {
        super.onCreate()
        repo = JobRepository(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val jobId = intent?.getStringExtra(EXTRA_JOB_ID) ?: run { stopSelf(); return START_NOT_STICKY }
        val job = repo.get(jobId) ?: run { stopSelf(); return START_NOT_STICKY }
        val mode = OriginalAudioMode.valueOf(
            intent.getStringExtra(EXTRA_MODE) ?: OriginalAudioMode.LOWER.name
        )
        ServiceCompat.startForeground(
            this, NOTIF_ID, notification(job.title, 0f, "Đang chuẩn bị"),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
        )
        scope.launch {
            try { process(job, mode) } finally { ServiceCompat.stopForeground(this@DubForegroundService, ServiceCompat.STOP_FOREGROUND_REMOVE); stopSelf() }
        }
        return START_NOT_STICKY
    }

    private suspend fun process(job: Job, mode: OriginalAudioMode) {
        var current = job.copy(status = JobStatus.RUNNING)
        repo.upsert(current)
                try {
            val result = DubbingPipeline(this).run(
                sourceUri = Uri.parse(job.sourceUri),
                displayName = "dub_${job.id}.mp4",
                requestedMode = mode,
                onProgress = { step, frac, note ->
                    val total = overall(step, frac)
                    current = current.copy(step = step.label + if (note.isNotEmpty()) " ($note)" else "", progress = total)
                    repo.upsert(current)
                    updateNotification(job.title, total, step.label)
                },
                onTranscript = { t -> current = current.copy(transcript = t); repo.upsert(current) },
            )
            current = current.copy(
                status = JobStatus.DONE, progress = 1f, step = "Hoàn tất",
                outputUri = result.outputUri.toString(), transcript = result.transcript,
            )
        } catch (e: Throwable) {
            // Bắt cả Error (UnsatisfiedLinkError, OutOfMemoryError) để job báo lỗi thay vì app bị đóng
            current = current.copy(
                status = JobStatus.FAILED,
                error = "${e.javaClass.simpleName}: ${e.message ?: "không rõ"}",
            )
        }
        repo.upsert(current)
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
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
        getSystemService(android.app.NotificationManager::class.java)
            .notify(NOTIF_ID, notification(title, progress, text))
    }

    private fun notification(title: String, progress: Float, text: String): Notification {
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
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

    override fun onBind(intent: Intent?) = null

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        const val EXTRA_JOB_ID = "job_id"
        const val EXTRA_MODE = "mode"
        private const val NOTIF_ID = 1001

        fun start(context: Context, jobId: String, mode: OriginalAudioMode) {
            val i = Intent(context, DubForegroundService::class.java)
                .putExtra(EXTRA_JOB_ID, jobId)
                .putExtra(EXTRA_MODE, mode.name)
            ContextCompat.startForegroundService(context, i)
        }

        fun displayNameOf(context: Context, uri: Uri): String {
            return context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
                ?.use { c -> if (c.moveToFirst()) c.getString(0) else null }
                ?: "video"
        }
    }
}
