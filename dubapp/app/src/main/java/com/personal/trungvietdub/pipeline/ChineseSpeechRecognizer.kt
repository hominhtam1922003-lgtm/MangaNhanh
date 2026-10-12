package com.personal.trungvietdub.pipeline

import com.k2fsa.sherpa.onnx.FeatureConfig
import com.k2fsa.sherpa.onnx.OfflineModelConfig
import com.k2fsa.sherpa.onnx.OfflineParaformerModelConfig
import com.k2fsa.sherpa.onnx.OfflineRecognizer
import com.k2fsa.sherpa.onnx.OfflineRecognizerConfig
import com.personal.trungvietdub.data.AsrFiles

/** Nhận diện tiếng Trung offline bằng sherpa-onnx (Paraformer). Input: mono 16 kHz. */
class ChineseSpeechRecognizer(files: AsrFiles) : AutoCloseable {
    private val recognizer: OfflineRecognizer

    init {
        val config = OfflineRecognizerConfig(
            featConfig = FeatureConfig(sampleRate = Segmenter.SR, featureDim = 80),
            modelConfig = OfflineModelConfig(
                paraformer = OfflineParaformerModelConfig(model = files.model.absolutePath),
                tokens = files.tokens.absolutePath,
                numThreads = Threads.inference,
                provider = "cpu",
                modelType = "paraformer",
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
            return recognizer.getResult(stream).text.trim()
        } finally {
            stream.release()
        }
    }

    override fun close() = recognizer.release()
}
