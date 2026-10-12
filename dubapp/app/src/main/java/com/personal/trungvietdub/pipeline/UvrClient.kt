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

    /** Ghi float32 little-endian theo khối 1 MB, không tạo mảng byte lớn. */
    private fun writeFloats(f: File, data: FloatArray) {
        val chunkFloats = 1 shl 18
        val bytes = ByteArray(chunkFloats * 4)
        val fb = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer()
        java.io.FileOutputStream(f).use { out ->
            var i = 0
            while (i < data.size) {
                val n = minOf(chunkFloats, data.size - i)
                fb.clear()
                fb.put(data, i, n)
                out.write(bytes, 0, n * 4)
                i += n
            }
        }
    }

    /** Đọc float32 little-endian theo khối. */
    private fun readFloats(f: File): FloatArray {
        val n = (f.length() / 4).toInt()
        val out = FloatArray(n)
        val bb = ByteBuffer.allocate(1 shl 20).order(ByteOrder.LITTLE_ENDIAN)
        var pos = 0
        java.io.FileInputStream(f).channel.use { ch ->
            while (pos < n) {
                bb.clear()
                bb.limit(minOf(bb.capacity(), (n - pos) * 4))
                while (bb.hasRemaining()) {
                    if (ch.read(bb) < 0) error("File kết quả bị thiếu dữ liệu")
                }
                bb.flip()
                val count = bb.limit() / 4
                bb.asFloatBuffer().get(out, pos, count)
                pos += count
            }
        }
        return out
    }
}
