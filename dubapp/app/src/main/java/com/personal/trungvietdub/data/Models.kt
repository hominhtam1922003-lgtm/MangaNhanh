package com.personal.trungvietdub.data

import kotlinx.serialization.Serializable

enum class JobStatus { QUEUED, RUNNING, DONE, FAILED }

enum class Step(val label: String, val weight: Float) {
    DECODE("Tách audio", 0.10f),
    SEGMENT("Tìm đoạn có lời nói", 0.05f),
    ASR("Nhận diện tiếng Trung", 0.30f),
    TRANSLATE("Dịch sang tiếng Việt", 0.15f),
    TTS("Tạo giọng Việt", 0.20f),
    COMPOSE("Ghép nhạc nền + giọng Việt", 0.10f),
    EXPORT("Xuất MP4 vào thư viện", 0.10f),
}

@Serializable
data class Job(
    val id: String,
    val title: String,
    val sourceUri: String,
    val status: JobStatus = JobStatus.QUEUED,
    val step: String = "",
    val progress: Float = 0f,
    val outputUri: String? = null,
    val transcript: String = "",
    val error: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
)

/** Tùy chọn xử lý âm thanh gốc. */
enum class OriginalAudioMode(val label: String) {
    LOWER("Hạ âm lượng lời gốc (giữ nguyên nhạc)"),
    MUTE("Tắt toàn bộ audio gốc"),
}
