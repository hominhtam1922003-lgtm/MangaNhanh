package com.manganhanh.app

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.ImageLoader
import coil.compose.AsyncImage
import coil.request.ImageRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import org.jsoup.Jsoup
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

private val Bg = Color(0xFF101114)
private val Surface = Color(0xFF1B1D22)
private val Muted = Color(0xFF9A9DA6)
private val Accent = Color(0xFFE8E9ED)
private val ChipActive = Color(0xFF2E323B)

private const val USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
private const val CONFIG_URL = "https://raw.githubusercontent.com/hominhtam19220/MangaNhanh/main/domains.json"

enum class MangaSource(val displayName: String) {
    NETTRUYEN("NetTruyen"),
    TRUYENQQ("TruyenQQ")
}

data class MangaItem(
    val title: String,
    val detailUrl: String,
    val coverUrl: String,
    val latestChap: String,
    val source: MangaSource
)

data class ChapterItem(
    val title: String,
    val chapterUrl: String,
    val source: MangaSource
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { MangaApp() }
    }
}

object DomainManager {
    var netTruyenBase = "https://nettruyen.gg"
    var truyenQqBase = "https://truyenqqko.com"

    private val client = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.SECONDS)
        .build()

    suspend fun syncDomains() = withContext(Dispatchers.IO) {
        try {
            val req = Request.Builder().url(CONFIG_URL).build()
            val res = client.newCall(req).execute()
            val text = res.body?.string() ?: ""
            if (text.isNotBlank()) {
                val json = JSONObject(text)
                json.optString("nettruyen").takeIf { it.isNotBlank() }?.let { netTruyenBase = it.trimEnd('/') }
                json.optString("truyenqq").takeIf { it.isNotBlank() }?.let { truyenQqBase = it.trimEnd('/') }
            }
        } catch (_: Exception) {}
    }

    fun getBase(source: MangaSource): String {
        return if (source == MangaSource.NETTRUYEN) netTruyenBase else truyenQqBase
    }
}

object ScraperManager {
    suspend fun fetchMangaList(source: MangaSource, keyword: String = ""): List<MangaItem> = withContext(Dispatchers.IO) {
        val list = mutableListOf<MangaItem>()
        val base = DomainManager.getBase(source)
        try {
            when (source) {
                MangaSource.NETTRUYEN -> {
                    val url = if (keyword.isBlank()) {
                        "$base/trang-chu"
                    } else {
                        "$base/tim-truyen?keyword=" + URLEncoder.encode(keyword, "UTF-8")
                    }
                    val doc = Jsoup.connect(url).userAgent(USER_AGENT).referrer(base).timeout(15000).get()
                    val items = doc.select(".items .item, .list-items .item, div.item")
                    for (el in items) {
                        val titleEl = el.select(".title a, h3 a, figcaption a").first() ?: continue
                        val title = titleEl.text().trim()
                        var detailUrl = titleEl.attr("href")
                        if (!detailUrl.startsWith("http")) detailUrl = base + if (detailUrl.startsWith("/")) detailUrl else "/$detailUrl"

                        val imgEl = el.select("img").first()
                        var cover = imgEl?.attr("data-original")?.takeIf { it.isNotBlank() }
                            ?: imgEl?.attr("data-src")?.takeIf { it.isNotBlank() }
                            ?: imgEl?.attr("src") ?: ""
                        if (cover.startsWith("//")) cover = "https:$cover"
                        else if (!cover.startsWith("http") && cover.isNotBlank())
                        
