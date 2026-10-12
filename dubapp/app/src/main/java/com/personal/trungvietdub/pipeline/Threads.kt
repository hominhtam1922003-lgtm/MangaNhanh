package com.personal.trungvietdub.pipeline

import android.app.ActivityManager
import android.content.Context

/** Cấu hình song song theo phần cứng: số nhân CPU và RAM tổng. */
object Threads {
    private const val GB = 1024L * 1024 * 1024

    val cpu: Int get() = Runtime.getRuntime().availableProcessors()

    /** Số worker chạy song song (ASR/TTS). Máy mạnh (≥8 nhân, ≥8 GB RAM) chạy 3 worker. */
    fun workers(context: Context): Int {
        val am = context.getSystemService(ActivityManager::class.java)
        val mi = ActivityManager.MemoryInfo()
        am.getMemoryInfo(mi)
        val ram = mi.totalMem
        return when {
            cpu >= 8 && ram >= 8 * GB -> 3
            cpu >= 6 && ram >= 6 * GB -> 2
            else -> 1
        }
    }

    /** Số luồng ORT/sherpa cho mỗi worker, chia đều số nhân. */
    fun threadsPerWorker(workers: Int): Int = (cpu / workers).coerceIn(1, 6)

    /** Số luồng cho một phiên suy luận đơn lẻ (NLLB, UVR, mặc định). */
    val inference: Int get() = cpu.coerceIn(2, 6)
}
