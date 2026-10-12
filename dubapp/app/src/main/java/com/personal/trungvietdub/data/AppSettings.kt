package com.personal.trungvietdub.data

import android.content.Context

/** Cài đặt cục bộ trên máy. Khóa API chỉ được gửi tới Google khi xử lý nhận diện. */
object AppSettings {
    private const val PREFS = "settings"
    private const val KEY_GEMINI = "gemini_api_key"

    fun geminiKey(context: Context): String =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_GEMINI, "").orEmpty().trim()

    fun setGeminiKey(context: Context, key: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_GEMINI, key.trim()).apply()
    }

    private const val KEY_VOICE = "voice_mode"

    /** "auto" (theo giọng gốc), "female" hoặc "male". */
    fun voiceMode(context: Context): String =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_VOICE, "auto") ?: "auto"

    fun setVoiceMode(context: Context, mode: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_VOICE, mode).apply()
    }
}
