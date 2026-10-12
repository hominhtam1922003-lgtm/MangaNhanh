package com.personal.trungvietdub.ui

import android.app.Application
import android.content.Intent
import android.media.MediaMetadataRetriever
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.personal.trungvietdub.data.Job
import com.personal.trungvietdub.data.JobRepository
import com.personal.trungvietdub.data.ModelCatalog
import com.personal.trungvietdub.data.ModelManager
import com.personal.trungvietdub.data.ModelSpec
import com.personal.trungvietdub.data.OriginalAudioMode
import com.personal.trungvietdub.service.DubForegroundService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID

class MainViewModel(app: Application) : AndroidViewModel(app) {
    private val repo = JobRepository(app)
    private val models = ModelManager(app)

    val jobs: StateFlow<List<Job>> = repo.jobs

    /** Tiến trình tải theo model id: null = chưa tải, 0..1 = đang tải. */
    private val _downloads = MutableStateFlow<Map<String, Float>>(emptyMap())
    val downloads: StateFlow<Map<String, Float>> = _downloads.asStateFlow()

    private val _ready = MutableStateFlow(ModelCatalog.all.associate { it.id to models.isReady(it) })
    val ready: StateFlow<Map<String, Boolean>> = _ready.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    val allModelsReady get() = _ready.value.values.all { it }

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

    /** Tạo job mới và chạy trong foreground service. Trả về id job. */
    fun startJob(uri: Uri, mode: OriginalAudioMode): String {
        val app = getApplication<Application>()
        try {
            app.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        } catch (_: Exception) { /* một số nguồn không hỗ trợ quyền bền */ }
        val id = UUID.randomUUID().toString()
        repo.upsert(Job(id = id, title = displayName(uri), sourceUri = uri.toString()))
        DubForegroundService.start(app, id, mode)
        return id
    }

    fun job(id: String): Job? = repo.get(id)

    fun clearError() { _error.value = null }
}
