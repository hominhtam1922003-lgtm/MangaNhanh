package com.personal.trungvietdub.service

import android.app.Service
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.Message
import android.os.Messenger
import com.personal.trungvietdub.pipeline.UvrSeparator
import java.io.File

/**
 * Chạy UVR (ONNX Runtime) trong TIẾN TRÌNH RIÊNG (android:process=":uvr").
 * Nếu native crash hoặc bị kill vì thiếu bộ nhớ, chỉ tiến trình này chết; app chính nhận
 * onServiceDisconnected và chuyển sang chế độ hạ âm lượng thay vì để cả app văng.
 *
 * Dữ liệu: input/output là file float32 little-endian (stereo interleaved, 44.1 kHz).
 */
class UvrService : Service() {
    companion object {
        const val MSG_SEPARATE = 1
        const val MSG_PROGRESS = 2
        const val MSG_DONE = 3
        const val MSG_ERROR = 4
        const val KEY_INPUT = "input"
        const val KEY_OUTPUT = "output"
        const val KEY_MODEL = "model"
        const val KEY_ERROR = "error"
        const val KEY_PROGRESS = "progress"
    }

    private lateinit var messenger: Messenger

    override fun onCreate() {
        super.onCreate()
        messenger = Messenger(Handler(Looper.getMainLooper()) { msg ->
            if (msg.what == MSG_SEPARATE) {
                val input = msg.data.getString(KEY_INPUT)!!
                val output = msg.data.getString(KEY_OUTPUT)!!
                val model = msg.data.getString(KEY_MODEL)!!
                val reply = msg.replyTo
                Thread { run(input, output, model, reply) }.start()
            }
            true
        })
    }

    override fun onBind(intent: Intent?): IBinder = messenger.binder

    private fun run(input: String, output: String, model: String, reply: Messenger?) {
        fun send(what: Int, data: Bundle? = null) {
            try {
                reply?.send(Message.obtain(null, what).apply { this.data = data ?: Bundle() })
            } catch (_: Exception) {
                // Client đã ngắt kết nối
            }
        }
        try {
            UvrSeparator(File(model)).use { sep ->
                sep.separateFile(File(input), File(output)) { f ->
                    send(MSG_PROGRESS, Bundle().apply { putFloat(KEY_PROGRESS, f) })
                }
            }
            send(MSG_DONE)
        } catch (e: Throwable) {
            send(MSG_ERROR, Bundle().apply {
                putString(KEY_ERROR, "${e.javaClass.simpleName}: ${e.message ?: "không rõ"}")
            })
        }
    }
}
