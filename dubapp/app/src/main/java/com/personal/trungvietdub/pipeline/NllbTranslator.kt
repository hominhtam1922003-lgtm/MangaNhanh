package com.personal.trungvietdub.pipeline

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import com.personal.trungvietdub.data.NllbFiles
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.float
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.File
import java.nio.FloatBuffer
import java.nio.LongBuffer
import java.text.Normalizer

/**
 * Tokenizer Unigram (SentencePiece) đọc từ tokenizer.json của Hugging Face.
 * Với tokenizer.json, id của mỗi piece = chỉ số trong mảng model.vocab.
 * Mã ngôn ngữ NLLB (zho_Hans, vie_Latn) nằm trong added_tokens.
 */
class NllbTokenizer(file: File) {
    private val vocab: Array<String>
    private val scores: FloatArray
    private val pieceToId = HashMap<String, Int>()
    private val addedToId = HashMap<String, Int>()
    private val specialIds = HashSet<Int>()
    private val maxPieceLen: Int
    private val unkId: Int

    init {
        val root = Json.parseToJsonElement(file.readText()).jsonObject
        val model = root.getValue("model").jsonObject
        val arr = model.getValue("vocab").jsonArray
        vocab = Array(arr.size) { arr[it].jsonArray[0].jsonPrimitive.content }
        scores = FloatArray(arr.size) { arr[it].jsonArray[1].jsonPrimitive.float }
        unkId = model["unk_id"]?.jsonPrimitive?.int ?: 3
        for (i in vocab.indices) pieceToId.putIfAbsent(vocab[i], i)
        root["added_tokens"]?.jsonArray?.forEach { t ->
            val o = t.jsonObject
            val content = o.getValue("content").jsonPrimitive.content
            val id = o.getValue("id").jsonPrimitive.int
            addedToId[content] = id
            specialIds.add(id)
        }
        specialIds.addAll(listOf(0, 1, 2, 3))
        maxPieceLen = minOf(24, vocab.maxOf { it.length })
    }

    fun langId(code: String): Int = addedToId[code] ?: error("Không có mã ngôn ngữ $code trong tokenizer")

    /** [lang] + các piece của văn bản + </s>. */
    fun encode(text: String, srcLang: String): IntArray {
        val norm = Normalizer.normalize(text.trim().replace(Regex("\\s+"), " "), Normalizer.Form.NFKC)
        if (norm.isEmpty()) return intArrayOf(langId(srcLang), EOS)
        val s = "\u2581" + norm.replace(' ', '\u2581')
        val n = s.length
        val best = DoubleArray(n + 1) { Double.NEGATIVE_INFINITY }
        val prevStart = IntArray(n + 1) { -1 }
        val prevId = IntArray(n + 1)
        best[0] = 0.0
        for (i in 0 until n) {
            if (best[i] == Double.NEGATIVE_INFINITY) continue
            for (l in 1..minOf(maxPieceLen, n - i)) {
                val id = pieceToId[s.substring(i, i + l)] ?: continue
                val sc = best[i] + scores[id]
                if (sc > best[i + l]) {
                    best[i + l] = sc; prevStart[i + l] = i; prevId[i + l] = id
                }
            }
            // ký tự không có trong vocab -> <unk> với điểm phạt
            if (!pieceToId.containsKey(s.substring(i, i + 1))) {
                val sc = best[i] - 100.0
                if (sc > best[i + 1]) {
                    best[i + 1] = sc; prevStart[i + 1] = i; prevId[i + 1] = unkId
                }
            }
        }
        val ids = ArrayList<Int>()
        var pos = n
        while (pos > 0) {
            ids.add(prevId[pos])
            pos = prevStart[pos]
        }
        ids.reverse()
        return (listOf(langId(srcLang)) + ids + listOf(EOS)).toIntArray()
    }

    fun decode(ids: List<Int>): String {
        val sb = StringBuilder()
        for (id in ids) {
            if (id in specialIds || id !in vocab.indices) continue
            sb.append(vocab[id])
        }
        return sb.toString().replace('\u2581', ' ').trim()
    }

    companion object {
        const val EOS = 2
    }
}

/**
 * Dịch Trung → Việt bằng NLLB-200-distilled-600M (ONNX lượng tử hóa).
 * Giải mã greedy, không dùng KV-cache: mỗi bước chạy lại toàn bộ prefix (chậm hơn nhưng đơn giản và đúng).
 * Các tên input được đọc từ session, không hard-code cho decoder.
 */
class NllbTranslator(files: NllbFiles) : Translator {
    private val env = OrtEnvironment.getEnvironment()
    private val opts = OrtSession.SessionOptions().apply { setIntraOpNumThreads(4) }
    private val encoder: OrtSession = env.createSession(files.encoder.absolutePath, opts)
    private val decoder: OrtSession = env.createSession(files.decoder.absolutePath, opts)
    private val tok = NllbTokenizer(files.tokenizer)
    private val vieId = tok.langId("vie_Latn")
    private val pastNames = decoder.inputNames.filter { it.startsWith("past_key_values") }
    private val hasCacheBranch = decoder.inputNames.contains("use_cache_branch")

    override suspend fun translate(zh: String): String {
        val src = tok.encode(zh, "zho_Hans")
        val n = src.size
        val srcIds = LongArray(n) { src[it].toLong() }
        val ones = LongArray(n) { 1L }
        val srcShape = longArrayOf(1, n.toLong())

        OnnxTensor.createTensor(env, LongBuffer.wrap(srcIds), srcShape).use { ids ->
            OnnxTensor.createTensor(env, LongBuffer.wrap(ones), srcShape).use { mask ->
                encoder.run(mapOf("input_ids" to ids, "attention_mask" to mask)).use { res ->
                    val h = res.get(0) as OnnxTensor
                    val dim = h.info.shape[2].toInt()
                    val hidden = FloatArray(h.floatBuffer.remaining())
                    h.floatBuffer.get(hidden)
                    return decodeLoop(hidden, dim, n, mask, srcShape, ones)
                }
            }
        }
    }

    private fun decodeLoop(
        hidden: FloatArray, dim: Int, n: Int,
        mask: OnnxTensor, srcShape: LongArray, ones: LongArray,
    ): String {
        val heads = 16
        val headDim = dim / heads
        val maxLen = minOf(256, n * 2 + 16)
        val generated = mutableListOf(NllbTokenizer.EOS, vieId)

        OnnxTensor.createTensor(env, FloatBuffer.wrap(hidden), longArrayOf(1, n.toLong(), dim.toLong())).use { hiddenT ->
            repeat(maxLen) {
                val seq = LongArray(generated.size) { generated[it].toLong() }
                val feeds = HashMap<String, OnnxTensor>()
                val created = ArrayList<OnnxTensor>()
                fun add(name: String, t: OnnxTensor) { feeds[name] = t; created.add(t) }
                try {
                    add("input_ids", OnnxTensor.createTensor(env, LongBuffer.wrap(seq), longArrayOf(1, seq.size.toLong())))
                    add("encoder_hidden_states", hiddenT)
                    add("encoder_attention_mask", mask)
                    if (hasCacheBranch) add("use_cache_branch", OnnxTensor.createTensor(env, booleanArrayOf(false)))
                    for (p in pastNames) {
                        add(p, OnnxTensor.createTensor(env, FloatBuffer.allocate(0),
                            longArrayOf(1, heads.toLong(), 0, headDim.toLong())))
                    }
                    val next = decoder.run(feeds).use { res ->
                        val logits = res.get(0) as OnnxTensor
                        val v = logits.info.shape[2].toInt()
                        val t = logits.info.shape[1].toInt()
                        val fb = logits.floatBuffer
                        val off = (t - 1) * v
                        var best = 0
                        var bestV = Float.NEGATIVE_INFINITY
                        for (j in 0 until v) {
                            val x = fb.get(off + j)
                            if (x > bestV) { bestV = x; best = j }
                        }
                        best
                    }
                    if (next == NllbTokenizer.EOS) return@repeat
                    generated.add(next)
                } finally {
                    created.forEach { it.close() }
                }
            }
        }
        return tok.decode(generated.drop(2))
    }

    override fun close() {
        encoder.close()
        decoder.close()
    }
}
