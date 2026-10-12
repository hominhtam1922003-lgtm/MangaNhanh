package com.personal.trungvietdub.data

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import java.io.File

/** Lưu lịch sử job dạng JSON trong filesDir/jobs.json. */
class JobRepository private constructor(context: Context) {
    companion object {
        @Volatile private var instance: JobRepository? = null

        /** Một instance duy nhất trong cả tiến trình: UI và service phải cùng thấy trạng thái job. */
        fun get(context: Context): JobRepository =
            instance ?: synchronized(this) {
                instance ?: JobRepository(context.applicationContext).also { instance = it }
            }
    }

    private val file = File(context.filesDir, "jobs.json")
    private val json = Json { ignoreUnknownKeys = true; prettyPrint = false }
    private val serializer = ListSerializer(Job.serializer())
    private val _jobs = MutableStateFlow(load())
    val jobs: StateFlow<List<Job>> = _jobs.asStateFlow()

    @Synchronized
    fun upsert(job: Job) {
        val current = _jobs.value.toMutableList()
        val idx = current.indexOfFirst { it.id == job.id }
        if (idx >= 0) current[idx] = job else current.add(0, job)
        _jobs.value = current
        file.writeText(json.encodeToString(serializer, current))
    }

    fun get(id: String): Job? = _jobs.value.firstOrNull { it.id == id }

    private fun load(): List<Job> = try {
        if (file.exists()) json.decodeFromString(serializer, file.readText())
            // Job đang chạy khi app bị tắt thì đánh dấu lỗi.
            .map { if (it.status == JobStatus.RUNNING || it.status == JobStatus.QUEUED)
                it.copy(status = JobStatus.FAILED, error = "Bị gián đoạn khi app đóng") else it }
        else emptyList()
    } catch (e: Exception) {
        emptyList()
    }
}
