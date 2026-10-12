package com.personal.trungvietdub.pipeline

import ai.onnxruntime.OnnxJavaType
import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtException
import ai.onnxruntime.TensorInfo
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import com.personal.trungvietdub.data.NllbFiles
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.File
import java.nio.FloatBuffer
import java.nio.LongBuffer
import java.text.Normalizer

/**
 * Tokenizer BPE (SentencePiece-BPE) đọc từ tokenizer.json của Hugging Face (Xenova/nllb-200-distilled-600M).
 * Định dạng: model.vocab là object piece -> id; model.merges là danh sách "a b" theo thứ tự ưu tiên.
 * Mỗi từ được thêm tiền tố ▁ (thay khoảng trắng), rồi ghép theo merges có rank thấp nhất trước.
 * Mã ngôn ngữ NLLB (zho_Hans, vie_Latn) nằm trong added_tokens.
 */
class NllbTokenizer(file: File) {
    private val pieceToId = HashMap<String, Int>()
    private val idToPiece: Array<String?>
    private val merges = HashMap<String, Int>()
    private val addedToId = HashMap<String, Int>()
    private val specialIds = HashSet<Int>()
    private val unkId: Int

    init {
        val root = Json.parseToJsonElement(file.readText()).jsonObject
        val model = root.getValue("model").jsonObject
        val type = model["type"]?.jsonPrimitive?.content ?: "BPE"
        require(type == "BPE") { "Tokenizer kiểu $type chưa được hỗ trợ (cần BPE)" }

        for ((piece, idEl) in model.getValue("vocab").jsonObject) {
            pieceToId[piece] = idEl.jsonPrimitive.int
        }
        val maxId = pieceToId.values.maxOrNull() ?: 0
        idToPiece = arrayOfNulls(maxId + 1)
        for ((p, id) in pieceToId) idToPiece[id] = p

        unkId = model["unk_id"]?.jsonPrimitive?.int ?: 3

        model["merges"]?.jsonArray?.forEachIndexed { rank, m ->
            val key = if (m is JsonArray) m[0].jsonPrimitive.content + " " + m[1].jsonPrimitive.content
            else m.jsonPrimitive.content
            merges.putIfAbsent(key, rank)
        }

        root["added_tokens"]?.jsonArray?.forEach { t ->
            val o = t.jsonObject
            val content = o.getValue("content").jsonPrimitive.content
            val id = o.getValue("id").jsonPrimitive.int
            addedToId[content] = id
            specialIds.add(id)
        }
        specialIds.addAll(listOf(0, 1, 2, 3))
    }

    fun langId(code: String): Int = addedToId[code] ?: error("Không có mã ngôn ngữ $code trong tokenizer")

    /** [lang] + các token của văn bản + </s>. */
    fun encode(text: String, srcLang: String): IntArray {
        val out = ArrayList<Int>()
        out.add(langId(srcLang))
        val norm = Normalizer.normalize(text.trim().replace(Regex("\\s+"), " "), Normalizer.Form.NFKC)
        if (norm.isNotEmpty()) {
            for (word in norm.split(' ')) {
                if (word.isEmpty()) continue
                out.addAll(bpe("\u2581$word"))
            }
        }
        out.add(EOS)
        return out.toIntArray()
    }

    private fun bpe(word: String): List<Int> {
        val syms = ArrayList<String>()
        var i = 0
        while (i < word.length) {
            val n = Character.charCount(word.codePointAt(i))
            syms.add(word.substring(i, i + n))
            i += n
        }
        while (syms.size > 1) {
            var bestRank = Int.MAX_VALUE
            var bestIdx = -1
            for (k in 0 until syms.size - 1) {
                val r = merges["${syms[k]} ${syms[k + 1]}"] ?: continue
                if (r < bestRank) { bestRank = r; bestIdx = k }
            }
            if (bestIdx < 0) break
            syms[bestIdx] = syms[bestIdx] + syms[bestIdx + 1]
            syms.removeAt(bestIdx + 1)
        }
        return syms.map { pieceToId[it] ?: unkId }
    }

    fun decode(ids: List<Int>): String {
        val sb = StringBuilder()
        for (id in ids) {
            if (id in specialIds || id < 0 || id >= idToPiece.size) continue
            sb.append(idToPiece[id] ?: continue)
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
                // Tensor tạo mới trong vòng này (đóng cuối vòng). hiddenT và mask là tensor dùng chung, KHÔNG đóng ở đây.
                val created = ArrayList<OnnxTensor>()
                try {
                    val seqShape = longArrayOf(1, seq.size.toLong())
                    for ((name, node) in decoder.inputInfo) {
                        val want = (node.info as TensorInfo).type
                        when {
                            name == "input_ids" -> feeds[name] = OnnxTensor.createTensor(env, LongBuffer.wrap(seq), seqShape)
                                .also { created.add(it) }
                            name == "encoder_hidden_states" -> feeds[name] = hiddenT
                            name == "encoder_attention_mask" ->
                                if (want == OnnxJavaType.FLOAT) feeds[name] = OnnxTensor.createTensor(
                                    env, FloatBuffer.wrap(FloatArray(n) { 1f }), srcShape,
                                ).also { created.add(it) }
                                else feeds[name] = mask
                            name == "use_cache_branch" -> feeds[name] = OnnxTensor.createTensor(env, booleanArrayOf(false))
                                .also { created.add(it) }
                            name.startsWith("past_key_values") -> feeds[name] = OnnxTensor.createTensor(
                                env, FloatBuffer.allocate(0), longArrayOf(1, heads.toLong(), 0, headDim.toLong()),
                            ).also { created.add(it) }
                            else -> error("Decoder có input chưa hỗ trợ: $name ($want)")
                        }
                    }
                    val next = (try {
                        decoder.run(feeds)
                    } catch (e: OrtException) {
                        val sig = decoder.inputInfo.entries.joinToString { "${it.key}:${(it.value.info as TensorInfo).type}" }
                        throw IllegalStateException("${e.message}\nDecoder inputs: $sig", e)
                    }).use { res ->
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
