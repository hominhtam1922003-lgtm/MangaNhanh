package vn.lichnhac.app

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.util.TimeZone
import android.app.NotificationManager
import android.media.AudioManager
import android.os.Build
import android.provider.Settings
import android.content.Intent
import android.net.Uri

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "vn.lichnhac.app/text_input")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "editVietnamese" -> VietnameseEditor.show(this, call.argument<String>("text") ?: "", result)
                    "keyboardSettings" -> {
                        try { startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS)); result.success(null) }
                        catch (_: Exception) { result.error("KEYBOARD_SETTINGS", "Không mở được cài đặt bàn phím.", null) }
                    }
                    else -> result.notImplemented()
                }
            }
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "vn.lichnhac.app/alarms")
            .setMethodCallHandler { call, result ->
                try {
                    when (call.method) {
                        "capabilities" -> {
                            val audio = getSystemService(AudioManager::class.java)
                            result.success(mapOf("exact" to AlarmStore.allowed(this),
                                "fullScreen" to (Build.VERSION.SDK_INT < 34 || getSystemService(NotificationManager::class.java).canUseFullScreenIntent()),
                                "volume" to audio.getStreamVolume(AudioManager.STREAM_ALARM),
                                "maxVolume" to audio.getStreamMaxVolume(AudioManager.STREAM_ALARM)))
                        }
                        "sync" -> {
                            val tasks = call.argument<List<Map<String, Any>>>("tasks") ?: emptyList()
                            result.success(AlarmStore.sync(this, tasks.map {
                                AlarmRecord((it["id"] as Number).toInt(), it["title"] as String, (it["at"] as Number).toLong())
                            }))
                        }
                        "openRingingAlarm" -> {
                            if (AlarmService.instance?.current == null) {
                                result.error("NO_RINGING_ALARM", "Hiện không có báo thức đang đổ chuông.", null)
                            } else {
                                startActivity(Intent(this, AlarmActivity::class.java))
                                result.success(null)
                            }
                        }
                        "clear" -> { AlarmStore.clear(this); result.success(null) }
                        "openExactSettings" -> {
                            if (Build.VERSION.SDK_INT >= 31) startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:$packageName")))
                            result.success(null)
                        }
                        "openFullScreenSettings" -> {
                            if (Build.VERSION.SDK_INT >= 34) startActivity(Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:$packageName")))
                            result.success(null)
                        }
                        "openSoundSettings" -> { startActivity(Intent(Settings.ACTION_SOUND_SETTINGS)); result.success(null) }
                        else -> result.notImplemented()
                    }
                } catch (_: Exception) { result.error("ALARM_ERROR", "Chưa cập nhật được báo thức Android.", null) }
            }
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "vn.lichnhac.app/timezone")
            .setMethodCallHandler { call, result ->
                if (call.method == "getTimeZone") {
                    result.success(TimeZone.getDefault().id)
                } else {
                    result.notImplemented()
                }
            }
    }
}
