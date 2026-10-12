package com.personal.trungvietdub.ui

import android.app.Application
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.IBinder
import android.content.ServiceConnection
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.personal.trungvietdub.data.Job
import com.personal.trungvietdub.data.JobLog
import com.personal.trungvietdub.data.JobRepository
import com.personal.trungvietdub.data.JobStatus
import com.personal.trungvietdub.data.ModelCatalog
import com.personal.trungvietdub.data.ModelManager
import com.personal.trungvietdub.data.ModelSpec
import com.personal.trungvietdub.data.OriginalAudioMode
import com.personal.trungvietdub.service.DubForegroundService
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.UUID

class MainViewModel(app: Application) : AndroidViewModel(app) {
    private val repo = JobRepository.get(app)
    private val models = ModelManager(app)

    private val _jobs = MutableStateFlow<List<Job>>(emptyList())
    val jobs: StateFlow<List<Job>> = _jobs.asStateFlow()

    /** Kết nối tới worker của từng job; bị đứt = worker đã chết. */
    private val links = HashMap<String, ServiceConnection>()

    /** Tiến trình tải theo model id: null = chưa tải, 0..1 = đang tải. */
    private val _downloads = MutableStateFlow<Map<String, Float>>(emptyMap())
    val downloads: StateFlow<Map<String, Float>> = _downloads.asStateFlow()

    private val _ready = MutableStateFlow(ModelCatalog.all.associate { it.id to models.isReady(it) })
    val ready: StateFlow<Map<String, Boolean>> = _ready.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    val allModelsReady get() = _ready.value.values.all { it }

    init {
        // App vừa mở lại sau khi bị văng/đóng: tự chạy tiếp các job còn dở (giới hạn MAX_ATTEMPTS).
        val crashFile = java.io.File(app.filesDir, com.personal.trungvietdub.DubApp.CRASH_FILE)
        if (crashFile.exists()) {
            val text = runCatching { crashFile.readText() }.getOrDefault("")
            crashFile.delete()
            _error.value = "App đã dừng đột ngột lần trước. Chi tiết lỗi:\n" + text.take(1500)
        }
        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) { repo.readAll() }
                    .filter { it.status == JobStatus.RUNNING || it.status == JobStatus.QUEUED }
                    .forEach { onWorkerDied(it.id) }
            }.onFailure { e ->
                _error.value = (_error.value ?: "") + "\nKhông khởi động lại được job: ${e.message}"
            }
        }
        viewModelScope.launch {
            while (isActive) {
                val list = withContext(Dispatchers.IO) { repo.readAll() }
                _jobs.value = list
                list.forEach { j ->
                    if (j.status == JobStatus.DONE || j.status == JobStatus.FAILED) unwatch(j.id)
                }
                delay(1000)
            }
        }
    }

    fun download(spec: ModelSpec) {
        if (_downloads.value.containsKey(spec.id)) return
        _downloads.value = _downloads.value + (spec.id to 0f)
        viewModelScope.launch {
            try {
                models.download(spec) { p -> _downloads.value = _downloads.value + (spec.id to p) }
            } catch (e: Exception) {
                _error.value = "Tải ${spec.title} lỗi: ${e.message}"
            } finally {
                _downloads.value = _downloads.value - spec.id
                _ready.value = ModelCatalog.all.associate { it.id to models.isReady(it) }
            }
        }
    }

    fun durationSeconds(uri: Uri): Long {
        val r = MediaMetadataRetriever()
        return try {
            r.setDataSource(getApplication(), uri)
            (r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L) / 1000
        } catch (e: Exception) {
            0L
        } finally {
            r.release()
        }
    }

    fun displayName(uri: Uri): String = DubForegroundService.displayNameOf(getApplication(), uri)

    /** Tạo job mới, chạy trong worker và theo dõi worker. Trả về id job. */
    fun startJob(uri: Uri, mode: OriginalAudioMode, speed: Float): String {
        val app = getApplication<Application>()
        try {
            app.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        } catch (_: Exception) { /* một số nguồn không hỗ trợ quyền bền */ }
        val id = UUID.randomUUID().toString()
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                repo.upsert(
                    Job(
                        id = id, title = displayName(uri), sourceUri = uri.toString(),
                        mode = mode.name, speed = speed,
                    ),
                )
            }
            DubForegroundService.start(app, id)
            watch(id)
        }
        return id
    }

    /** Người dùng bấm Tiếp tục: chạy lại job từ các bước đã lưu, reset số lần thử. */
    fun resume(jobId: String) {
        val app = getApplication<Application>()
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                val job = repo.get(jobId) ?: return@withContext
                repo.upsert(job.copy(status = JobStatus.RUNNING, attempts = 0, error = null))
                JobLog.append(app, jobId, "Người dùng bấm Tiếp tục")
            }
            DubForegroundService.start(app, jobId)
            watch(jobId)
        }
    }

    fun job(id: String): Job? = repo.get(id)

    fun clearError() { _error.value = null }

    private fun watch(jobId: String) {
        if (links.containsKey(jobId)) return
        val app = getApplication<Application>()
        val conn = object : ServiceConnection {
            override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {}

            override fun onServiceDisconnected(name: ComponentName?) {
                onWorkerDied(jobId)
            }
        }
        links[jobId] = conn
        app.bindService(Intent(app, DubForegroundService::class.java), conn, Context.BIND_AUTO_CREATE)
    }

    private fun unwatch(jobId: String) {
        val conn = links.remove(jobId) ?: return
        runCatching { getApplication<Application>().unbindService(conn) }
    }

    /** Worker chết giữa chừng (crash native, bị kill...). Tự khởi động lại tối đa MAX_ATTEMPTS lần. */
    private fun onWorkerDied(jobId: String) {
        unwatch(jobId)
        val app = getApplication<Application>()
        val job = repo.get(jobId) ?: return
        if (job.status == JobStatus.DONE || job.status == JobStatus.FAILED) return
        val tries = job.attempts + 1
        if (tries >= JobRepository.MAX_ATTEMPTS) {
            JobLog.append(app, jobId, "Worker đã dừng $tries lần; dừng tự động, chờ người dùng bấm Tiếp tục")
            repo.upsert(
                job.copy(
                    status = JobStatus.FAILED,
                    attempts = tries,
                    error = "Xử lý đã dừng $tries lần liên tiếp (thường do lỗi native hoặc thiếu bộ nhớ). " +
                        "Bấm Tiếp tục để chạy lại từ các bước đã lưu.",
                ),
            )
            return
        }
        repo.upsert(job.copy(status = JobStatus.RUNNING, attempts = tries))
        JobLog.append(app, jobId, "Worker bị dừng; tự khởi động lại lần ${tries + 1}/${JobRepository.MAX_ATTEMPTS}")
        DubForegroundService.start(app, jobId)
        watch(jobId)
    }
}
