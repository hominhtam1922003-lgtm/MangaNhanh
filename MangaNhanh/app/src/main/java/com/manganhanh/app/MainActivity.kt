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
import androidx.compose.material.icons.filled.Favorite
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
import org.jsoup.nodes.Document
import org.jsoup.nodes.Element
import org.jsoup.select.Elements
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
            val text = res.body?.string().orEmpty()
            if (text.isNotBlank()) {
                val json = JSONObject(text)
                val nt = json.optString("nettruyen")
                if (nt.isNotBlank()) {
                    netTruyenBase = nt.trimEnd('/')
                }
                val qq = json.optString("truyenqq")
                if (qq.isNotBlank()) {
                    truyenQqBase = qq.trimEnd('/')
                }
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
                    val doc: Document = Jsoup.connect(url).userAgent(USER_AGENT).referrer(base).timeout(15000).get()
                    val items: Elements = doc.select(".items .item, .list-items .item, div.item")
                    for (el: Element in items) {
                        val titleEl: Element = el.select(".title a, h3 a, figcaption a").first() ?: continue
                        val title = titleEl.text().trim()
                        var detailUrl = titleEl.attr("href")
                        if (detailUrl.startsWith("http") == false) {
                            detailUrl = if (detailUrl.startsWith("/")) "$base$detailUrl" else "$base/$detailUrl"
                        }

                        val imgEl: Element? = el.select("img").first()
                        var cover = imgEl?.attr("data-original").orEmpty().ifBlank {
                            imgEl?.attr("data-src").orEmpty().ifBlank {
                                imgEl?.attr("src").orEmpty()
                            }
                        }
                        if (cover.startsWith("//")) {
                            cover = "https:$cover"
                        } else if (cover.isNotBlank() && cover.startsWith("http") == false) {
                            cover = if (cover.startsWith("/")) "$base$cover" else "$base/$cover"
                        }

                        val chap = el.select(".chapter a, .comic-item-chapter a").first()?.text()?.trim() ?: "Mới cập nhật"
                        if (title.isNotBlank()) {
                            list.add(MangaItem(title, detailUrl, cover, chap, source))
                        }
                    }
                }
                MangaSource.TRUYENQQ -> {
                    val url = if (keyword.isBlank()) {
                        "$base/truyen-moi-cap-nhat.html"
                    } else {
                        "$base/tim-kiem/trang-1.html?q=" + URLEncoder.encode(keyword, "UTF-8")
                    }
                    val doc: Document = Jsoup.connect(url).userAgent(USER_AGENT).referrer(base).timeout(15000).get()
                    val items: Elements = doc.select("ul.list_grid li, ul.grid li, .list-stories li")
                    for (el: Element in items) {
                        val titleEl: Element = el.select(".book_avatar a, .book_name a, h3 a").first() ?: continue
                        val title = titleEl.attr("title").ifBlank { titleEl.text().trim() }
                        var detailUrl = titleEl.attr("href")
                        if (detailUrl.startsWith("http") == false) {
                            detailUrl = if (detailUrl.startsWith("/")) "$base$detailUrl" else "$base/$detailUrl"
                        }

                        val imgEl: Element? = el.select("img").first()
                        var cover = imgEl?.attr("src").orEmpty().ifBlank {
                            imgEl?.attr("data-src").orEmpty()
                        }
                        if (cover.startsWith("//")) {
                            cover = "https:$cover"
                        } else if (cover.isNotBlank() && cover.startsWith("http") == false) {
                            cover = if (cover.startsWith("/")) "$base$cover" else "$base/$cover"
                        }

                        val chap = el.select(".last_chapter a, .chapter a").first()?.text()?.trim() ?: "Mới cập nhật"
                        if (title.isNotBlank()) {
                            list.add(MangaItem(title, detailUrl, cover, chap, source))
                        }
                    }
                }
            }
        } catch (_: Exception) {}
        list
    }

    suspend fun fetchChapters(source: MangaSource, detailUrl: String): Pair<String, List<ChapterItem>> = withContext(Dispatchers.IO) {
        val chapters = mutableListOf<ChapterItem>()
        var description = "Đang cập nhật tóm tắt..."
        val base = DomainManager.getBase(source)
        try {
            val doc: Document = Jsoup.connect(detailUrl).userAgent(USER_AGENT).referrer(base).timeout(15000).get()
            when (source) {
                MangaSource.NETTRUYEN -> {
                    val descEl: Element? = doc.select(".detail-content p, .comic-description, .detail-summary").first()
                    if (descEl != null && descEl.text().isNotBlank()) {
                        description = descEl.text().trim()
                    }

                    val rows: Elements = doc.select(".list-chapter li, #nt_listchapter li, .chapter-list div.row")
                    for (row: Element in rows) {
                        val a: Element = row.select("a").first() ?: continue
                        val t = a.text().trim()
                        var url = a.attr("href")
                        if (url.startsWith("http") == false) {
                            url = if (url.startsWith("/")) "$base$url" else "$base/$url"
                        }
                        if (t.isNotBlank()) {
                            chapters.add(ChapterItem(t, url, source))
                        }
                    }
                }
                MangaSource.TRUYENQQ -> {
                    val descEl: Element? = doc.select(".story-detail-info, .story-detail-summary, .detail-content").first()
                    if (descEl != null && descEl.text().isNotBlank()) {
                        description = descEl.text().trim()
                    }

                    val rows: Elements = doc.select(".works-chapter-list .works-chapter-item a, .list_chapter a")
                    for (a: Element in rows) {
                        val t = a.text().trim()
                        var url = a.attr("href")
                        if (url.startsWith("http") == false) {
                            url = if (url.startsWith("/")) "$base$url" else "$base/$url"
                        }
                        if (t.isNotBlank()) {
                            chapters.add(ChapterItem(t, url, source))
                        }
                    }
                }
            }
        } catch (_: Exception) {}
        Pair(description, chapters)
    }

    suspend fun fetchPages(source: MangaSource, chapterUrl: String): List<String> = withContext(Dispatchers.IO) {
        val pages = mutableListOf<String>()
        val base = DomainManager.getBase(source)
        try {
            val doc: Document = Jsoup.connect(chapterUrl).userAgent(USER_AGENT).referrer(base).timeout(15000).get()
            val elements: Elements = doc.select(".page-chapter img, .reading-detail img, .chapter-content img, .story-see-content img")
            for (img: Element in elements) {
                var src = img.attr("data-original").orEmpty().ifBlank {
                    img.attr("data-src").orEmpty().ifBlank {
                        img.attr("data-cdn").orEmpty().ifBlank {
                            img.attr("src").orEmpty()
                        }
                    }
                }

                if (src.startsWith("//")) {
                    src = "https:$src"
                } else if (src.isNotBlank() && src.startsWith("http") == false) {
                    src = if (src.startsWith("/")) "$base$src" else "$base/$src"
                }

                val lower = src.lowercase()
                if (src.isNotBlank() && !lower.contains("icon") && !lower.contains("banner") && !lower.contains("logo")) {
                    pages.add(src)
                }
            }
        } catch (_: Exception) {}
        pages
    }
}

fun rememberDynamicImageLoader(context: Context, referer: String): ImageLoader {
    val client = OkHttpClient.Builder()
        .addInterceptor { chain ->
            val req = chain.request().newBuilder()
                .header("User-Agent", USER_AGENT)
                .header("Referer", referer)
                .build()
            chain.proceed(req)
        }
        .build()
    return ImageLoader.Builder(context).okHttpClient(client).build()
}

@Composable
fun MangaApp() {
    var selectedManga by remember { mutableStateOf<MangaItem?>(null) }
    var readingChapter by remember { mutableStateOf<ChapterItem?>(null) }
    var query by remember { mutableStateOf("") }
    var currentSource by remember { mutableStateOf(MangaSource.NETTRUYEN) }
    var tab by remember { mutableStateOf(0) }
    var favorites by remember { mutableStateOf(setOf<String>()) }
    var initialized by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        DomainManager.syncDomains()
        initialized = true
    }

    MaterialTheme(colorScheme = darkColorScheme(background = Bg, surface = Surface, primary = Accent)) {
        Surface(Modifier.fillMaxSize(), color = Bg) {
            if (!initialized) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Accent)
                }
            } else {
                when {
                    readingChapter != null && selectedManga != null -> {
                        ReaderScreen(
                            manga = selectedManga!!,
                            chapter = readingChapter!!,
                            onBack = { readingChapter = null }
                        )
                    }
                    selectedManga != null -> {
                        DetailScreen(
                            manga = selectedManga!!,
                            favorite = favorites.contains(selectedManga!!.detailUrl),
                            onBack = { selectedManga = null },
                            onFavorite = {
                                favorites = if (favorites.contains(selectedManga!!.detailUrl)) {
                                    favorites - selectedManga!!.detailUrl
                                } else {
                                    favorites + selectedManga!!.detailUrl
                                }
                            },
                            onRead = { ch -> readingChapter = ch }
                        )
                    }
                    else -> {
                        HomeScreen(
                            source = currentSource,
                            onSourceChange = { currentSource = it },
                            query = query,
                            onQuery = { query = it },
                            tab = tab,
                            onTab = { tab = it },
                            favorites = favorites,
                            onOpen = { selectedManga = it }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun HomeScreen(
    source: MangaSource,
    onSourceChange: (MangaSource) -> Unit,
    query: String,
    onQuery: (String) -> Unit,
    tab: Int,
    onTab: (Int) -> Unit,
    favorites: Set<String>,
    onOpen: (MangaItem) -> Unit
) {
    val context = LocalContext.current
    val base = DomainManager.getBase(source)
    val imageLoader = remember(source, base) { rememberDynamicImageLoader(context, base) }
    var mangaList by remember { mutableStateOf<List<MangaItem>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(source, query) {
        loading = true
        mangaList = ScraperManager.fetchMangaList(source, query)
        loading = false
    }

    val displayList = mangaList.filter { tab != 1 || favorites.contains(it.detailUrl) }

    Column(Modifier.fillMaxSize().statusBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("MANGA NHANH", fontSize = 20.sp, fontWeight = FontWeight.Black, color = Accent, letterSpacing = 1.2.sp)
                Text("Nguồn: ${source.displayName} ($base)", fontSize = 11.sp, color = Muted)
            }
        }

        OutlinedTextField(
            value = query,
            onValueChange = onQuery,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            placeholder = { Text("Tìm truyện trên ${source.displayName}…", color = Muted) },
            leadingIcon = { Icon(Icons.Default.Search, null, tint = Muted) },
            singleLine = true,
            shape = RoundedCornerShape(14.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Color(0xFF555963),
                unfocusedBorderColor = Color(0xFF303239),
                focusedTextColor = Accent,
                unfocusedTextColor = Accent
            )
        )

        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            MangaSource.values().forEach { s ->
                val isSelected = s == source
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (isSelected) ChipActive else Color.Transparent)
                        .clickable { onSourceChange(s) }
                        .padding(horizontal = 14.dp, vertical = 6.dp)
                ) {
                    Text(
                        s.displayName,
                        color = if (isSelected) Accent else Muted,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                        fontSize = 13.sp
                    )
                }
            }
        }

        Row(Modifier.padding(horizontal = 20.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(20.dp)) {
            Text("Mới cập nhật", color = if (tab == 0) Accent else Muted, fontWeight = FontWeight.SemiBold, modifier = Modifier.clickable { onTab(0) })
            Text("Yêu thích", color = if (tab == 1) Accent else Muted, fontWeight = FontWeight.SemiBold, modifier = Modifier.clickable { onTab(1) })
        }

        if (loading) {
            Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Accent)
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.weight(1f)
            ) {
                items(displayList) { manga ->
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Surface).clickable { onOpen(manga) }.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        AsyncImage(
                            model = ImageRequest.Builder(context).data(manga.coverUrl).crossfade(true).build(),
                            imageLoader = imageLoader,
                            contentDescription = manga.title,
                            modifier = Modifier.size(width = 76.dp, height = 100.dp).clip(RoundedCornerShape(10.dp)),
                            contentScale = ContentScale.Crop
                        )

                        Column(Modifier.weight(1f).padding(start = 14.dp)) {
                            Text(manga.title, color = Accent, fontWeight = FontWeight.Bold, fontSize = 15.sp, maxLines = 2)
                            Spacer(Modifier.height(6.dp))
                            Text(manga.latestChap, color = Muted, fontSize = 12.sp)
                        }
                    }
                }
                if (displayList.
