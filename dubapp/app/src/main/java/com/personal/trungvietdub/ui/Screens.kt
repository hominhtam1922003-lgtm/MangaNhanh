package com.personal.trungvietdub.ui

import androidx.compose.foundation.layout.*
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.personal.trungvietdub.data.Job
import com.personal.trungvietdub.data.JobStatus
import com.personal.trungvietdub.data.ModelCatalog
import com.personal.trungvietdub.data.OriginalAudioMode
import com.personal.trungvietdub.data.Step
import android.net.Uri

@Composable
fun HomeScreen(
    vm: MainViewModel,
    onOpenJob: (String) -> Unit,
    onOpenHistory: () -> Unit,
) {
    val downloads by vm.downloads.collectAsState()
    val ready by vm.ready.collectAsState()
    val error by vm.error.collectAsState()
    var picked by remember { mutableStateOf<Uri?>(null) }
    var pickedName by remember { mutableStateOf("") }
    var minutes by remember { mutableStateOf(0L) }
    var mode by remember { mutableStateOf(OriginalAudioMode.LOWER) }
    var speed by remember { mutableStateOf(1.0f) }
    val picker = rememberLauncherForActivityResult(
        contract = androidx.activity.result.contract.ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri != null) {
            picked = uri
            pickedName = vm.displayName(uri)
            minutes = vm.durationSeconds(uri) / 60
        }
    }
    val ready2 = ModelCatalog.all.all { ready[it.id] == true }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("LỒNG TIẾNG TRUNG → VIỆT", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)

        error?.let {
            Card { Column(Modifier.padding(12.dp)) {
                Text(it, color = MaterialTheme.colorScheme.error)
                TextButton(onClick = { vm.clearError() }) { Text("Đóng") }
            } }
        }

        Card { Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Dữ liệu AI (tải một lần)", fontWeight = FontWeight.SemiBold)
            ModelCatalog.all.forEach { spec ->
                val dl = downloads[spec.id]
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.weight(1f)) {
                        Text(spec.title, style = MaterialTheme.typography.bodyMedium)
                        Text("~${spec.approxMb} MB", style = MaterialTheme.typography.bodySmall)
                    }
                    when {
                        ready[spec.id] == true -> Text("✓ Sẵn sàng")
                        dl != null -> Text("${(dl * 100).toInt()}%")
                        else -> Button(onClick = { vm.download(spec) }) { Text("Tải") }
                    }
                }
                dl?.let { LinearProgressIndicator(progress = { it }, modifier = Modifier.fillMaxWidth()) }
            }
        } }

        Card { Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { picker.launch(arrayOf("video/*")) }, modifier = Modifier.fillMaxWidth()) {
                Text("Chọn video")
            }
            if (picked != null) {
                Text("Video: $pickedName")
                Text("Thời lượng: ${minutes} phút")
                if (minutes >= 5) {
                    Text("Video dài hơn 5 phút có thể xử lý rất lâu hoặc không ổn định.",
                        color = MaterialTheme.colorScheme.tertiary)
                }
            }
            Text("Xử lý âm thanh gốc:", fontWeight = FontWeight.SemiBold)
            OriginalAudioMode.values().forEach { m ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(selected = mode == m, onClick = { mode = m })
                    Text(m.label)
                }
            }
            Text("Tốc độ đọc giọng Việt: ${"%.2f".format(speed)}x", fontWeight = FontWeight.SemiBold)
            Slider(
                value = speed,
                onValueChange = { speed = (Math.round(it * 20) / 20f) },
                valueRange = 0.8f..1.4f,
                steps = 11,
            )
            Text("Câu dài hơn khung gốc sẽ được tăng tốc tự động để khớp với video.",
                style = MaterialTheme.typography.bodySmall)
            Button(
                onClick = {
                    picked?.let { onOpenJob(vm.startJob(it, mode, speed)) }
                },
                enabled = picked != null && ready2,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("BẮT ĐẦU LỒNG TIẾNG") }
            if (!ready2) Text("Hãy tải đủ dữ liệu AI ở trên trước.", style = MaterialTheme.typography.bodySmall)
        } }

        OutlinedButton(onClick = onOpenHistory, modifier = Modifier.fillMaxWidth()) { Text("Lịch sử") }
    }
}

@Composable
fun JobScreen(job: Job?, log: String, onBack: () -> Unit, onOpenOutput: (String) -> Unit, onResume: () -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.Filled.ArrowBack, contentDescription = "Quay lại") }
            Text("Tiến trình", style = MaterialTheme.typography.titleLarge)
        }
        if (job == null) Text("Không tìm thấy job") else JobDetails(job, log, onResume, onOpenOutput)
    }
}

/** Nội dung chi tiết của một job (tách riêng để tránh return sớm trong lambda của Column). */
@Composable
private fun ColumnScope.JobDetails(
    job: Job, log: String, onResume: () -> Unit, onOpenOutput: (String) -> Unit,
) {
        Text(job.title, fontWeight = FontWeight.SemiBold)
        LinearProgressIndicator(progress = { job.progress.coerceIn(0f, 1f) }, modifier = Modifier.fillMaxWidth())
        Text("${(job.progress * 100).toInt()}%  ${job.step}")
        Step.values().forEach { s ->
            val done = job.progress >= (Step.values().take(s.ordinal + 1).sumOf { it.weight.toDouble() }.toFloat() - 0.001f)
            Text((if (done) "✓ " else "○ ") + s.label)
        }
        if (job.status == JobStatus.FAILED) {
            Text("Lỗi: ${job.error ?: "không rõ"}", color = MaterialTheme.colorScheme.error)
        }
        Text("Trạng thái: ${job.status}", style = MaterialTheme.typography.bodySmall)
        if (log.isNotBlank()) {
            Text("Nhật ký:", fontWeight = FontWeight.SemiBold)
            Text(log, style = MaterialTheme.typography.bodySmall, fontFamily = FontFamily.Monospace)
        }
        if (job.status == JobStatus.FAILED) {
            Button(onClick = onResume, modifier = Modifier.fillMaxWidth()) {
                Text("Tiếp tục (dùng lại các bước đã lưu)")
            }
        }
        if (job.status == JobStatus.RUNNING && job.attempts > 0) {
            Text("Đang tự khôi phục: lần ${job.attempts + 1}/${com.personal.trungvietdub.data.JobRepository.MAX_ATTEMPTS}")
        }
        if (job.transcript.isNotBlank()) {
            Text("Lời tiếng Trung đã nhận diện:", fontWeight = FontWeight.SemiBold)
            Text(job.transcript, style = MaterialTheme.typography.bodySmall)
        }
        job.outputUri?.let { uri ->
            Button(onClick = { onOpenOutput(uri) }, modifier = Modifier.fillMaxWidth()) { Text("Mở video đã lưu") }
        }
}

@Composable
fun HistoryScreen(jobs: List<Job>, onBack: () -> Unit, onOpen: (String) -> Unit) {
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.Filled.ArrowBack, contentDescription = "Quay lại") }
            Text("Lịch sử", style = MaterialTheme.typography.titleLarge)
        }
        if (jobs.isEmpty()) Text("Chưa có video nào được xử lý.")
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(jobs, key = { it.id }) { j ->
                Card(onClick = { onOpen(j.id) }, modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(12.dp)) {
                        Text(j.title, fontWeight = FontWeight.SemiBold)
                        Text(
                            when (j.status) {
                                JobStatus.DONE -> "Hoàn tất"
                                JobStatus.FAILED -> "Lỗi"
                                JobStatus.RUNNING -> "Đang xử lý ${(j.progress * 100).toInt()}%"
                                JobStatus.QUEUED -> "Chờ"
                            },
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            }
        }
    }
}
