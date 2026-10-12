package com.personal.trungvietdub.data

import android.content.Context
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import java.io.File
import java.io.RandomAccessFile

/**
 * Lịch sử job dạng JSON trong filesDir/jobs.json.
 * Được dùng chung bởi tiến trình UI và tiến trình worker, nên mọi thao tác đọc/ghi đều khóa file.
 */
class JobRepository private constructor(context: Context) {
    companion object {
        const val MAX_ATTEMPTS = 3

        @Volatile
        private var instance: JobRepository? = null

        fun get(context: Context): JobRepository =
            instance ?: synchronized(this) {
                instance ?: JobRepository(context.applicationContext).also { instance = it }
            }
    }

    private val file = File(context.filesDir, "jobs.json")
    private val lockFile = File(context.filesDir, "jobs.lock")
    private val json = Json { ignoreUnknownKeys = true }
    private val serializer = ListSerializer(Job.serializer())

    /** Khóa JVM trước (FileLock không cho hai luồng cùng tiến trình giữ cùng lúc), rồi mới khóa file giữa các tiến trình. */
    private val jvmMonitor = Any()

    private inline fun <T> locked(block: () -> T): T = synchronized(jvmMonitor) {
        val raf = RandomAccessFile(lockFile, "rw")
        try {
            val lock = raf.channel.lock()
            val result = try {
                block()
            } finally {
                lock.release()
            }
            result
        } finally {
            raf.close()
        }
    }

    private fun readUnlocked(): List<Job> {
        if (!file.exists()) return emptyList()
        return try {
            json.decodeFromString(serializer, file.readText())
        } catch (e: Exception) {
            // File hỏng: giữ lại bản lỗi để xem sau, bắt đầu lại danh sách trống
            file.renameTo(File(file.parentFile, "jobs.corrupt.json"))
            emptyList()
        }
    }

    private fun writeUnlocked(list: List<Job>) {
        val tmp = File(file.parentFile, "jobs.json.tmp")
        tmp.writeText(json.encodeToString(serializer, list))
        if (!tmp.renameTo(file)) {
            file.writeText(tmp.readText())
            tmp.delete()
        }
    }

    fun readAll(): List<Job> = locked { readUnlocked() }

    fun get(id: String): Job? = readAll().firstOrNull { it.id == id }

    fun upsert(job: Job) {
        locked {
            val cur = readUnlocked().toMutableList()
            val idx = cur.indexOfFirst { it.id == job.id }
            if (idx >= 0) cur[idx] = job else cur.add(0, job)
            writeUnlocked(cur)
        }
    }

}
