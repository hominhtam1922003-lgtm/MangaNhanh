package com.personal.trungvietdub.pipeline

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Bundle
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Message
import android.os.Messenger
import com.personal.trungvietdub.service.UvrService
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.withTimeoutOrNull
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Gọi UvrService (tiến trình riêng) để tách nhạc nền. Ném exception nếu tiến trình tách giọng chết.
 * Pipeline bắt exception này và chuyển sang chế độ hạ âm lượng.
 */
class UvrClient(private val context: Context) {

    suspend fun separate(
        stereo44: FloatArray,
        model: File,
        workDir: File,
        onProgress: (Float) -> Unit,
    ): FloatArray {
        val inFile = File(workDir, "uvr_in.bin")
        val outFile = File(workDir, "uvr_out.bin")
        writeFloats(inFile, stereo44)

        val thread = HandlerThread("uvr-client").apply { start() }
        // "" = thành công, khác rỗng = thông báo lỗi
        val done = CompletableDeferred<String>()
        val replyMessenger = Messenger(object : Handler(thread.looper) {
            override fun handleMessage(msg: Message) {
                when (msg.what) {
                    UvrService.MSG_PROGRESS -> onProgress(msg.data.getFloat(UvrService.KEY_PROGRESS))
                    UvrService.MSG_DONE -> done.complete("")
                    UvrService.MSG_ERROR -> done.complete(
                        msg.data.getString(UvrService.KEY_ERROR) ?: "lỗi không rõ"
                    )
                }
            }
        })

        val conn = object : ServiceConnection {
            override fun onServiceConnected(name: ComponentName, binder: IBinder) {
                try {
                    val msg = Message.obtain(null, UvrService.MSG_SEPARATE).apply {
                        data = Bundle().apply {
                            putString(UvrService.KEY_INPUT, inFile.absolutePath)
                            putString(UvrService.KEY_OUTPUT, outFile.absolutePath)
                            putString(UvrService.KEY_MODEL, model.absolutePath)
                        }
                        replyTo = replyMessenger
                    }
                    Messenger(binder).send(msg)
                } catch (e: Exception) {
                    done.complete("Không gửi được yêu cầu tới tiến trình tách giọng: ${e.message}")
                }
            }

            override fun onServiceDisconnected(name: ComponentName) {
                done.complete("Tiến trình tách giọng đã dừng (thường do thiếu bộ nhớ hoặc lỗi native)")
            }
        }

        try {
            val ok = context.bindService(
                Intent(context, UvrService::class.java), conn, Context.BIND_AUTO_CREATE
            )
            check(ok) { "Không khởi động được tiến trình tách giọng" }
            val err = withTimeoutOrNull(60 * 60_000L) { done.await() }
                ?: "Hết thời gian tách giọng"
            check(err.isEmpty()) { err }
            return readFloats(outFile)
        } finally {
            runCatching { context.unbindService(conn) }
            thread.quitSafely()
        }
    }

    private fun writeFloats(f: File, data: FloatArray) {
        val bb = ByteBuffer.allocate(data.size * 4).order(ByteOrder.LITTLE_ENDIAN)
        bb.asFloatBuffer().put(data)
        f.writeBytes(bb.array())
    }

    private fun readFloats(f: File): FloatArray {
        val bytes = f.readBytes()
        val out = FloatArray(bytes.size / 4)
        ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer().get(out)
        return out
    }
}
