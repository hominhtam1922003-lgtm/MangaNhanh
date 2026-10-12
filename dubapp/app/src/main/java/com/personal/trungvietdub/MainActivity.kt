package com.personal.trungvietdub

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.runtime.collectAsState
import com.personal.trungvietdub.data.JobLog
import com.personal.trungvietdub.ui.HistoryScreen
import com.personal.trungvietdub.ui.HomeScreen
import com.personal.trungvietdub.ui.JobScreen
import com.personal.trungvietdub.ui.MainViewModel

class MainActivity : ComponentActivity() {
    private val vm: MainViewModel by viewModels()

    private sealed interface Nav {
        data object Home : Nav
        data object History : Nav
        data class Job(val id: String) : Nav
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= 33) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        }
        setContent {
            MaterialTheme(colorScheme = darkColorScheme()) {
                Surface(Modifier.fillMaxSize()) {
                    var nav by rememberSaveable { mutableStateOf<String>("home") }
                    var jobId by rememberSaveable { mutableStateOf<String?>(null) }
                    val jobs by vm.jobs.collectAsState()
                    val current: Nav = when {
                        nav == "history" -> Nav.History
                        nav == "job" && jobId != null -> Nav.Job(jobId!!)
                        else -> Nav.Home
                    }
                    when (current) {
                        Nav.Home -> HomeScreen(
                            vm = vm,
                            onOpenJob = { id -> jobId = id; nav = "job" },
                            onOpenHistory = { nav = "history" },
                        )
                        Nav.History -> HistoryScreen(
                            jobs = jobs,
                            onBack = { nav = "home" },
                            onOpen = { id -> jobId = id; nav = "job" },
                        )
                        is Nav.Job -> JobScreen(
                            job = jobs.firstOrNull { it.id == current.id },
                            log = remember(jobs) { JobLog.tail(this@MainActivity, current.id) },
                            onBack = { nav = "home" },
                            onOpenOutput = { uri -> openVideo(Uri.parse(uri)) },
                        )
                    }
                }
            }
        }
    }

    private fun openVideo(uri: Uri) {
        startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, "video/mp4")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
    }
}
