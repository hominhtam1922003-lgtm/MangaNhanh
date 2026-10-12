package com.personal.trungvietdub.pipeline

import com.k2fsa.sherpa.onnx.FeatureConfig
import com.k2fsa.sherpa.onnx.OfflineModelConfig
import com.k2fsa.sherpa.onnx.OfflineFireRedAsrModelConfig
import com.k2fsa.sherpa.onnx.OfflineRecognizer
import com.k2fsa.sherpa.onnx.OfflineRecognizerConfig
import com.personal.trungvietdub.data.AsrFiles

/** Nhận diện tiếng Trung offline bằng sherpa-onnx (FireRedASR large, int8). Input: mono 16 kHz. */
class ChineseSpeechRecognizer(files: AsrFiles, threads: Int = Threads.inference) : AutoCloseable {
    private val recognizer: OfflineRecognizer

    init {
        val config = OfflineRecognizerConfig(
            featConfig = FeatureConfig(sampleRate = Segmenter.SR, featureDim = 80),
            modelConfig = OfflineModelConfig(
                fireRedAsr = OfflineFireRedAsrModelConfig(
                    encoder = files.encoder.absolutePath,
                    decoder = files.decoder.absolutePath,
                ),
                tokens = files.tokens.absolutePath,
                numThreads = threads,
                provider = "cpu",
            ),
            decodingMethod = "greedy_search",
        )
        recognizer = OfflineRecognizer(assetManager = null, config = config)
    }

    fun transcribe(samples: FloatArray): String {
        val stream = recognizer.createStream()
        try {
            stream.acceptWaveform(samples, Segmenter.SR)
            recognizer.decode(stream)
            // Bỏ thẻ điều khiển nếu có, ví dụ <|zh|><|NEUTRAL|>
            return recognizer.getResult(stream).text.replace(Regex("<\\|[^|]*\\|>"), "").trim()
        } finally {
            stream.release()
        }
    }

    override fun close() = recognizer.release()
}
