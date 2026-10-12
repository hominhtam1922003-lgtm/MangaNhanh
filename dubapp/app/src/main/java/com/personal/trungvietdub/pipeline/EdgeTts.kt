package com.personal.trungvietdub.pipeline

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import java.io.ByteArrayOutputStream
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.math.roundToInt

/**
 * Giọng neural Microsoft Edge (Read Aloud), miễn phí, không cần API key.
 * Giao thức được đối chiếu với mã nguồn edge-tts (rany2/edge-tts). Dịch vụ không chính thức:
 * nếu lỗi, [synthesize] ném exception và pipeline tự chuyển sang VITS.
 */
object EdgeTts {
    const val VOICE_FEMALE = "vi-VN-HoaiMyNeural"
    const val VOICE_MALE = "vi-VN-NamMinhNeural"

    private const val HOST = "speech.platform.bing.com/consumer/speech/synthesize/readaloud"
    private const val TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4"
    private const val WSS_URL = "wss://$HOST/edge/v1?TrustedClientToken=$TRUSTED_CLIENT_TOKEN"
    private const val CHROMIUM_FULL = "143.0.3650.75"
    private const val SEC_MS_GEC_VERSION = "1-$CHROMIUM_FULL"
    private const val WIN_EPOCH = 11644473600L
    private const val TIMEOUT_SEC = 40L

    private val http: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(TIMEOUT_SEC, TimeUnit.SECONDS)
            .build()
    }

    /** Kết quả: MP3 bytes của toàn bộ câu. [rate] dạng "+20%" hoặc "-10%". */
    fun synthesize(text: String, voice: String, rate: String): ByteArray {
        val out = ByteArrayOutputStream()
        val done = CountDownLatch(1)
        var failure: Throwable? = null
        val req = Request.Builder()
            .url("$WSS_URL&ConnectionId=${connectId()}&Sec-MS-GEC=${generateSecMsGec()}&Sec-MS-GEC-Version=$SEC_MS_GEC_VERSION")
            .header("Pragma", "no-cache")
            .header("Cache-Control", "no-cache")
            .header("Origin", "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold")
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0")
            .header("Cookie", "muid=${randomMuid()};")
            .build()

        val listener = object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                webSocket.send(
                    "X-Timestamp:${dateString()}\r\n" +
                        "Content-Type:application/json; charset=utf-8\r\n" +
                        "Path:speech.config\r\n\r\n" +
                        "{\"context\":{\"synthesis\":{\"audio\":{\"metadataoptions\":{" +
                        "\"sentenceBoundaryEnabled\":\"false\",\"wordBoundaryEnabled\":\"false\"}," +
                        "\"outputFormat\":\"audio-24khz-48kbitrate-mono-mp3\"}}}}",
                )
                webSocket.send(
                    "X-RequestId:${connectId()}\r\n" +
                        "Content-Type:application/ssml+xml\r\n" +
                        "X-Timestamp:${dateString()}Z\r\n" +
                        "Path:ssml\r\n\r\n" +
                        ssml(text, voice, rate),
                )
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                val headers = parseHeaders(text.substringBefore("\r\n\r\n", ""))
                when (headers["Path"]) {
                    "turn.end" -> {
                        webSocket.close(1000, null)
                        done.countDown()
                    }
                    "audio.metadata", "response", "turn.start", null -> Unit
                    else -> {
                        failure = IllegalStateException("Edge TTS trả về luồng không rõ: ${headers["Path"]}")
                        webSocket.close(1000, null)
                        done.countDown()
                    }
                }
            }

            override fun onMessage(webSocket: WebSocket, bytes: ByteString) {
                val data = bytes.toByteArray()
                if (data.size < 2) return
                val headerLen = ((data[0].toInt() and 0xff) shl 8) or (data[1].toInt() and 0xff)
                if (headerLen > data.size - 2) return
                val headers = parseHeaders(String(data, 2, headerLen, Charsets.UTF_8))
                if (headers["Path"] != "audio") return
                val audio = data.copyOfRange(2 + headerLen, data.size)
                if (audio.isNotEmpty()) out.write(audio)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                failure = t
                done.countDown()
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                done.countDown()
            }
        }

        val socket = http.newWebSocket(req, listener)
        if (!done.await(TIMEOUT_SEC, TimeUnit.SECONDS)) {
            socket.cancel()
            throw IllegalStateException("Edge TTS quá thời gian")
        }
        failure?.let { throw IllegalStateException("Edge TTS lỗi: ${it.message}", it) }
        val bytes = out.toByteArray()
        check(bytes.isNotEmpty()) { "Edge TTS không trả về âm thanh" }
        return bytes
    }

    /** "+20%" từ hệ số tốc độ (1.2 → +20%), giới hạn để dịch vụ chấp nhận. */
    fun rateFor(speed: Float): String {
        val pct = ((speed - 1f) * 100f).roundToInt().coerceIn(-50, 100)
        return if (pct >= 0) "+$pct%" else "$pct%"
    }

    private fun ssml(text: String, voice: String, rate: String): String {
        val escaped = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace("\"", "&quot;").replace("'", "&apos;")
        return "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='vi-VN'>" +
            "<voice name='$voice'><prosody pitch='+0Hz' rate='$rate' volume='+0%'>$escaped</prosody></voice></speak>"
    }

    private fun parseHeaders(block: String): Map<String, String> {
        val map = HashMap<String, String>()
        for (line in block.split("\r\n")) {
            val idx = line.indexOf(':')
            if (idx > 0) map[line.substring(0, idx)] = line.substring(idx + 1)
        }
        return map
    }

    private fun connectId(): String = UUID.randomUUID().toString().replace("-", "")

    private fun randomMuid(): String {
        val r = java.security.SecureRandom()
        return ByteArray(16).also { r.nextBytes(it) }.joinToString("") { "%02X".format(it) }
    }

    /** Chuỗi thời gian kiểu JavaScript, như edge-tts dùng cho X-Timestamp. */
    private fun dateString(): String {
        val f = SimpleDateFormat("EEE MMM dd yyyy HH:mm:ss 'GMT+0000 (Coordinated Universal Time)'", Locale.US)
        f.timeZone = TimeZone.getTimeZone("UTC")
        return f.format(Date())
    }

    /** Sec-MS-GEC: SHA256 của (thời gian Windows làm tròn 5 phút + token), in hoa. */
    internal fun generateSecMsGec(nowUnixSec: Long = System.currentTimeMillis() / 1000): String {
        var ticks = nowUnixSec + WIN_EPOCH
        ticks -= ticks % 300
        val windowTicks = ticks * 10_000_000L
        val digest = MessageDigest.getInstance("SHA-256")
            .digest("$windowTicks$TRUSTED_CLIENT_TOKEN".toByteArray(Charsets.US_ASCII))
        return digest.joinToString("") { "%02X".format(it) }
    }
}
