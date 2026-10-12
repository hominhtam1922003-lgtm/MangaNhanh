package com.personal.trungvietdub.ui

import androidx.compose.foundation.layout.*
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.runtime.LaunchedEffect
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.personal.trungvietdub.data.AppSettings
import com.personal.trungvietdub.data.Job
import com.personal.trungvietdub.data.JobStatus
import com.personal.trungvietdub.data.ModelCatalog
import com.personal.trungvietdub.data.OriginalAudioMode
import com.personal.trungvietdub.data.Step
import android.net.Uri
import android.content.Intent
import android.provider.Settings
import android.Manifest
import android.os.Build
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.personal.trungvietdub.notify.Notifications

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
        if (uri != null) picked = uri
    }
    // Đọc tên và thời lượng video ở luồng nền, tránh ANR
    LaunchedEffect(picked) {
        val u = picked ?: return@LaunchedEffect
        val (name, mins) = withContext(Dispatchers.IO) { vm.displayName(u) to vm.durationSeconds(u) / 60 }
        pickedName = name
        minutes = mins
    }
    val ctxHome = LocalContext.current
    var hasKey by remember { mutableStateOf(AppSettings.geminiKey(ctxHome).isNotEmpty()) }
    // Có khóa Gemini thì không cần tải model FireRedASR offline
    val ready2 = ModelCatalog.all.filter { it.id != ModelCatalog.ASR.id }.all { ready[it.id] == true } &&
        (hasKey || ready[ModelCatalog.ASR.id] == true)

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column {
            Text("Lồng tiếng Trung → Việt", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            Text("Chọn video, app tự nhận diện, dịch và lồng giọng Việt", style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        NotificationCard()
        BackgroundRunCard()

        GeminiKeyCard(hasKey) { hasKey = it }
        VoiceModeCard()

        error?.let {
            SectionCard { Column(Modifier.padding(12.dp)) {
                Text(it, color = MaterialTheme.colorScheme.error)
                TextButton(onClick = { vm.clearError() }) { Text("Đóng") }
            } }
        }

        SectionCard { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Dữ liệu AI (tải một lần)", fontWeight = FontWeight.SemiBold)
            // Khi đã có khóa Gemini thì ẩn model FireRedASR offline (không cần tải)
            ModelCatalog.all.filter { !(hasKey && it.id == ModelCatalog.ASR.id) }.forEach { spec ->
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

        SectionCard { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
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
        val ctx = androidx.compose.ui.platform.LocalContext.current
        val version = runCatching { ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName }.getOrDefault("?")
        Text("Phiên bản $version", style = MaterialTheme.typography.bodySmall)
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
        Text(job.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        val animated by animateFloatAsState(job.progress.coerceIn(0f, 1f), label = "progress")
        LinearProgressIndicator(
            progress = { animated },
            modifier = Modifier.fillMaxWidth().height(8.dp),
            trackColor = MaterialTheme.colorScheme.surfaceVariant,
        )
        Text("${(job.progress * 100).toInt()}%  ${job.step}", style = MaterialTheme.typography.bodyMedium)
        Step.values().forEach { s ->
            val done = job.progress >= (Step.values().take(s.ordinal + 1).sumOf { it.weight.toDouble() }.toFloat() - 0.001f)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(
                    if (done) Icons.Filled.CheckCircle else Icons.Filled.RadioButtonUnchecked,
                    contentDescription = null,
                    tint = if (done) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(18.dp),
                )
                Text(s.label, color = if (done) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant)
            }
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

/** Trạng thái quyền thông báo: xin quyền, hoặc mở cài đặt nếu đã từ chối. */
@Composable
fun NotificationCard() {
    val ctx = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var enabled by remember { mutableStateOf(Notifications.enabled(ctx)) }
    var asked by rememberSaveable { mutableStateOf(false) }
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) enabled = Notifications.enabled(ctx)
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }
    val launcher = rememberLauncherForActivityResult(
        contract = androidx.activity.result.contract.ActivityResultContracts.RequestPermission()
    ) { enabled = Notifications.enabled(ctx) }

    SectionCard { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Thông báo tiến độ", fontWeight = FontWeight.SemiBold)
        if (enabled) {
            Text("✓ Đã bật. Thanh tiến độ hiện trên thanh thông báo, và báo khi xong hoặc lỗi.",
                style = MaterialTheme.typography.bodySmall)
        } else {
            Text("Chưa bật: bạn sẽ không thấy tiến độ khi thu nhỏ app.",
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = {
                    asked = true
                    if (Notifications.needsRuntimePermission) {
                        launcher.launch(Manifest.permission.POST_NOTIFICATIONS)
                    } else {
                        enabled = Notifications.enabled(ctx)
                    }
                }) { Text("Bật thông báo") }
                if (asked) {
                    OutlinedButton(onClick = {
                        ctx.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                            putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName)
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        })
                    }) { Text("Mở cài đặt") }
                }
            }
        }
    } }
}

/** Nhập khóa API Gemini (miễn phí tại aistudio.google.com) để nhận diện tiếng Trung bằng Gemini. */
@Composable
fun GeminiKeyCard(hasKey: Boolean, onChanged: (Boolean) -> Unit) {
    val ctx = LocalContext.current
    var text by remember { mutableStateOf("") }
    SectionCard { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Nhận diện tiếng Trung: Gemini", fontWeight = FontWeight.SemiBold)
        if (hasKey) {
            Text("✓ Đã lưu khóa API. Video sẽ được gửi tới Gemini để nhận diện (cần mạng).",
                style = MaterialTheme.typography.bodySmall)
            OutlinedButton(onClick = {
                AppSettings.setGeminiKey(ctx, "")
                onChanged(false)
            }) { Text("Xóa khóa") }
        } else {
            Text("Chưa có khóa: app sẽ dùng FireRedASR offline (phải tải model ~1.5 GB). " +
                "Nhập khóa Gemini miễn phí từ aistudio.google.com để nhận diện chính xác hơn.",
                style = MaterialTheme.typography.bodySmall)
            OutlinedTextField(
                value = text,
                onValueChange = { text = it },
                label = { Text("Khóa API Gemini") },
                singleLine = true,
                visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth(),
            )
            Button(
                onClick = {
                    AppSettings.setGeminiKey(ctx, text)
                    text = ""
                    onChanged(AppSettings.geminiKey(ctx).isNotEmpty())
                },
                enabled = text.trim().length > 10,
            ) { Text("Lưu khóa") }
        }
    } }
}

/** Chọn giọng đọc lồng tiếng: theo giọng gốc (Gemini nhận giới tính), hoặc cố định nữ/nam. */
@Composable
fun VoiceModeCard() {
    val ctx = LocalContext.current
    var mode by remember { mutableStateOf(AppSettings.voiceMode(ctx)) }
    SectionCard { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("Giọng đọc tiếng Việt", fontWeight = FontWeight.SemiBold)
        listOf("auto" to "Theo giọng gốc (Gemini nhận nam/nữ)", "female" to "Giọng nữ", "male" to "Giọng nam")
            .forEach { (value, label) ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(selected = mode == value, onClick = {
                        mode = value
                        AppSettings.setVoiceMode(ctx, value)
                    })
                    Text(label)
                }
            }
    } }
}

/** Cho phép chạy nền không bị hệ thống tiết kiệm pin dừng giữa chừng (job vẫn chạy khi tắt màn hình). */
@Composable
fun BackgroundRunCard() {
    val ctx = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val pm = ctx.getSystemService(android.os.PowerManager::class.java)
    var exempt by remember { mutableStateOf(pm.isIgnoringBatteryOptimizations(ctx.packageName)) }
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) exempt = pm.isIgnoringBatteryOptimizations(ctx.packageName)
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }
    SectionCard { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Chạy nền", fontWeight = FontWeight.SemiBold)
        Text(
            "Job chạy trong dịch vụ nền: bạn có thể thoát app hoặc tắt màn hình. Các job xếp hàng và chạy lần lượt.",
            style = MaterialTheme.typography.bodySmall,
        )
        if (exempt) {
            Text("✓ Đã cho phép chạy nền không hạn chế.", style = MaterialTheme.typography.bodySmall)
        } else {
            Text("Nên cho phép để Android không dừng job khi tắt màn hình.",
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
            Button(onClick = {
                ctx.startActivity(Intent(
                    android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                    android.net.Uri.parse("package:${ctx.packageName}"),
                ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }) { Text("Cho phép chạy nền") }
        }
    } }
}
