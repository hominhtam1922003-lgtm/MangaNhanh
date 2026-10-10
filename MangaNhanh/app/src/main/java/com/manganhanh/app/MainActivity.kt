package com.manganhanh.app

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.KeyboardArrowRight
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.ImageLoader
import coil.compose.AsyncImage
import coil.request.CachePolicy
import coil.request.ImageRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.ConnectionPool
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import org.jsoup.Jsoup
import org.jsoup.nodes.Document
import org.jsoup.nodes.Element
import org.jsoup.select.Elements
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

private val DarkBg = Color(0xFF0F1015)
private val CardBg = Color(0xFF181A20)
private val AccentColor = Color(0xFFFF5252)
private val TextMain = Color(0xFFF0F1F5)
private val TextSub = Color(0xFF8A8F9E)

private const val UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
private const val DOMAIN_CONFIG = "https://raw.githubusercontent.com/hominhtam19220/MangaNhanh/main/domains.json"

enum class SourceType(val label: String) {
    NETTRUYEN("NetTruyen"),
    TRUYENQQ("TruyenQQ")
}

data class Manga(
    val title: String,
    val link: String,
    val cover: String,
    val latestChap: String,
    val source: SourceType
)

data class Chapter(
    val title: String,
    val link: String,
    val source: SourceType
)

data class Genre(
    val name: String,
    val url: String
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MangaApp()
        }
    }
}

object Sources {
    var netTruyenDomain = "https://nettruyen.gg"
    var truyenQqDomain = "https://truyenqqko.com"

    private val client = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .connectionPool(ConnectionPool(20, 5L, TimeUnit.MINUTES))
        .build()

    suspend fun updateDomains() = withContext(Dispatchers.IO) {
        try {
            val req = Request.Builder().url(DOMAIN_CONFIG).build()
            val res = client.newCall(req).execute()
            val body = res.body?.string().orEmpty()
            if (body.isNotBlank()) {
                val json = JSONObject(body)
                val nt = json.optString("nettruyen")
                if (nt.isNotBlank()) netTruyenDomain = nt.trimEnd('/')
                val qq = json.optString("truyenqq")
                if (qq.isNotBlank()) truyenQqDomain = qq.trimEnd('/')
            }
        } catch (_: Exception) {}
    }

    fun getBase(source: SourceType): String = if (source == SourceType.NETTRUYEN) netTruyenDomain else truyenQqDomain
}

object Scraper {
    suspend fun loadManga(source: SourceType, query: String = "", genreUrl: String = "", isRanking: Boolean = false): List<Manga> = withContext(Dispatchers.IO) {
        val list = mutableListOf<Manga>()
        val base = Sources.getBase(source)
        try {
            val targetUrl = when {
                genreUrl.isNotBlank() -> genreUrl
                query.isNotBlank() -> {
                    if (source == SourceType.NETTRUYEN) "$base/tim-truyen?keyword=${URLEncoder.encode(query, "UTF-8")}"
                    else "$base/tim-kiem/trang-1.html?q=${URLEncoder.encode(query, "UTF-8")}"
                }
                isRanking -> {
                    if (source == SourceType.NETTRUYEN) "$base/hot"
                    else "$base/truyen-hot.html"
                }
                else -> {
                    if (source == SourceType.NETTRUYEN) "$base/trang-chu"
                    else "$base/truyen-moi-cap-nhat.html"
                }
            }

            val doc = Jsoup.connect(targetUrl).userAgent(UA).referrer(base).timeout(15000).get()

            if (source == SourceType.NETTRUYEN) {
                for (item in doc.select(".items .item, .list-items .item, div.item")) {
                    val titleEl = item.select(".title a, h3 a, figcaption a").first() ?: continue
                    val title = titleEl.text().trim()
                    var link = titleEl.attr("href")
                    if (!link.startsWith("http")) link = if (link.startsWith("/")) "$base$link" else "$base/$link"

                    val imgEl = item.select("img").first()
                    var img = imgEl?.attr("data-original").orEmpty().ifBlank { imgEl?.attr("data-src").orEmpty().ifBlank { imgEl?.attr("src").orEmpty() } }
                    if (img.startsWith("//")) img = "https:$img"
                    else if (img.isNotBlank() && !img.startsWith("http")) img = "$base/$img"

                    val chap = item.select(".chapter a, .comic-item-chapter a").first()?.text()?.trim() ?: "Mới"
                    if (title.isNotBlank()) list.add(Manga(title, link, img, chap, source))
                }
            } else {
                for (item in doc.select(".row .item, ul.list_grid li, ul.grid li, .list-stories li, .book_list li")) {
                    val titleEl = item.select(".book_name h3 a, .title-book a, .book_name a, h3 a").first() ?: continue
                    val title = titleEl.attr("title").ifBlank { titleEl.text().trim() }
                    var link = titleEl.attr("href")
                    if (!link.startsWith("http")) link = if (link.startsWith("/")) "$base$link" else "$base/$link"

                    val imgEl = item.select("img").first()
                    var img = imgEl?.attr("src").orEmpty().ifBlank { imgEl?.attr("data-src").orEmpty().ifBlank { imgEl?.attr("data-original").orEmpty() } }
                    if (img.startsWith("//")) img = "https:$img"
                    else if (img.isNotBlank() && !img.startsWith("http")) img = "$base/$img"

                    val chap = item.select(".last_chapter a, .chapter a, ul.chap-list li:first-child a").first()?.text()?.trim() ?: "Mới"
                    if (title.isNotBlank()) list.add(Manga(title, link, img, chap, source))
                }
            }
        } catch (_: Exception) {}
        list
    }

    suspend fun loadGenres(source: SourceType): List<Genre> = withContext(Dispatchers.IO) {
        val genres = mutableListOf<Genre>()
        val base = Sources.getBase(source)
        try {
            val doc = Jsoup.connect(base).userAgent(UA).referrer(base).timeout(15000).get()
            val elements = if (source == SourceType.NETTRUYEN) {
                doc.select(".nav-item.dropdown ul.dropdown-menu li a, .sub-menu li a, .genre-item a")
            } else {
                doc.select(".genre-item a, .menu-list li a, .TopNavGenres li a")
            }
            for (el in elements) {
                val name = el.text().trim()
                var href = el.attr("href")
                if (href.isNotBlank() && name.isNotBlank()) {
                    if (!href.startsWith("http")) href = if (href.startsWith("/")) "$base$href" else "$base/$href"
                    if (genres.none { it.url == href }) {
                        genres.add(Genre(name, href))
                    }
                }
            }
        } catch (_: Exception) {}
        
        if (genres.isEmpty()) {
            genres.add(Genre("Action", "$base/tim-truyen/action"))
            genres.add(Genre("Adventure", "$base/tim-truyen/adventure"))
            genres.add(Genre("Comedy", "$base/tim-truyen/comedy"))
            genres.add(Genre("Drama", "$base/tim-truyen/drama"))
            genres.add(Genre("Fantasy", "$base/tim-truyen/fantasy"))
            genres.add(Genre("Romance", "$base/tim-truyen/romance"))
            genres.add(Genre("Manhua", "$base/tim-truyen/manhua"))
            genres.add(Genre("Manhwa", "$base/tim-truyen/manhwa"))
        }
        genres
    }

    suspend fun loadDetails(manga: Manga): Pair<String, List<Chapter>> = withContext(Dispatchers.IO) {
        val chapters = mutableListOf<Chapter>()
        var desc = "Đang cập nhật giới thiệu..."
        val base = Sources.getBase(manga.source)
        try {
            val doc: Document = Jsoup.connect(manga.link).userAgent(UA).referrer(base).timeout(15000).get()
            
            val descEl = doc.select(".detail-content p, .comic-description, .detail-summary, .story-detail-info").first()
            if (descEl != null && descEl.text().isNotBlank()) {
                desc = descEl.text().trim()
            }

            val rows: Elements = doc.select(".list-chapter li, #nt_listchapter li, .chapter-list div.row, .works-chapter-list .works-chapter-item, .list_chapter li, .chap-list .row")
            for (row: Element in rows) {
                val a: Element = row.select("a").first() ?: continue
                val t = a.text().trim()
                var url = a.attr("href")
                if (!url.startsWith("http")) {
                    url = if (url.startsWith("/")) "$base$url" else "$base/$url"
                }
                if (t.isNotBlank() && chapters.none { it.link == url }) {
                    chapters.add(Chapter(t, url, manga.source))
                }
            }
            
            if (chapters.isEmpty()) {
                val directLinks = doc.select(".list-chapter a, #nt_listchapter a, .list_chapter a, .chap-list a")
                for (a in directLinks) {
                    val t = a.text().trim()
                    var url = a.attr("href")
                    if (!url.startsWith("http")) {
                        url = if (url.startsWith("/")) "$base$url" else "$base/$url"
                    }
                    if (t.isNotBlank() && chapters.none { it.link == url }) {
                        chapters.add(Chapter(t, url, manga.source))
                    }
                }
            }
        } catch (_: Exception) {}
        Pair(desc, chapters)
    }

    suspend fun loadPages(chapter: Chapter): List<String> = withContext(Dispatchers.IO) {
        val pages = mutableListOf<String>()
        val base = Sources.getBase(chapter.source)
        try {
            val doc = Jsoup.connect(chapter.link).userAgent(UA).referrer(base).timeout(15000).get()
            for (img in doc.select(".page-chapter img, .reading-detail img, .chapter-content img, .story-see-content img")) {
                var src = img.attr("data-original").orEmpty().ifBlank {
                    img.attr("data-src").orEmpty().ifBlank {
                        img.attr("data-cdn").orEmpty().ifBlank { img.attr("src").orEmpty() }
                    }
                }
                if (src.startsWith("//")) src = "https:$src"
                else if (src.isNotBlank() && !src.startsWith("http")) src = "$base/$src"

                val lower = src.lowercase()
                if (src.isNotBlank() && !lower.contains("banner") && !lower.contains("logo") && !lower.contains("icon")) {
                    pages.add(src)
                }
            }
        } catch (_: Exception) {}
        pages
    }
}

fun buildCoilLoader(context: Context, referer: String): ImageLoader {
    val okHttpClient = OkHttpClient.Builder()
        .addInterceptor { chain ->
            val req = chain.request().newBuilder()
                .header("User-Agent", UA)
                .header("Referer", referer)
                .build()
            chain.proceed(req)
        }
        .connectionPool(ConnectionPool(30, 5L, TimeUnit.MINUTES))
        .build()

    return ImageLoader.Builder(context)
        .okHttpClient(okHttpClient)
        .diskCachePolicy(CachePolicy.ENABLED)
        .memoryCachePolicy(CachePolicy.ENABLED)
        .crossfade(true)
        .build()
}

@Composable
fun MangaApp() {
    var curManga by remember { mutableStateOf<Manga?>(null) }
    var readingSession by remember { mutableStateOf<Pair<Chapter, List<Chapter>>?>(null) }
    var source by remember { mutableStateOf(SourceType.NETTRUYEN) }
    var favorites by remember { mutableStateOf(setOf<String>()) }

    LaunchedEffect(Unit) {
        Sources.updateDomains()
    }

    MaterialTheme(colorScheme = darkColorScheme(background = DarkBg, surface = CardBg)) {
        Surface(Modifier.fillMaxSize(), color = DarkBg) {
            when {
                readingSession != null && curManga != null -> {
                    val currentChap = readingSession!!.first
                    val allChaps = readingSession!!.second
                    ReaderView(
                        manga = curManga!!,
                        chapter = currentChap,
                        allChapters = allChaps,
                        onBack = { readingSession = null },
                        onSelectChapter = { newChap ->
                            readingSession = Pair(newChap, allChaps)
                        }
                    )
                }
                curManga != null -> {
                    DetailView(
                        manga = curManga!!,
                        isFav = favorites.contains(curManga!!.link),
                        onToggleFav = {
                            favorites = if (favorites.contains(curManga!!.link)) favorites - curManga!!.link else favorites + curManga!!.link
                        },
                        onRead = { chap, listChaps -> 
                            readingSession = Pair(chap, listChaps) 
                        },
                        onBack = { curManga = null }
                    )
                }
                else -> {
                    HomeView(
                        source = source,
                        onSourceChange = { source = it },
                        onSelectManga = { curManga = it },
                        favorites = favorites
                    )
                }
            }
        }
    }
}

@Composable
fun HomeView(
    source: SourceType,
    onSourceChange: (SourceType) -> Unit,
    onSelectManga: (Manga) -> Unit,
    favorites: Set<String>
) {
    val context = LocalContext.current
    var query by remember { mutableStateOf("") }
    var tab by remember { mutableIntStateOf(0) }
    var selectedGenre by remember { mutableStateOf<Genre?>(null) }
    var list by remember { mutableStateOf<List<Manga>>(emptyList()) }
    var genres by remember { mutableStateOf<List<Genre>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    val loader = remember(source) { buildCoilLoader(context, Sources.getBase(source)) }

    LaunchedEffect(source, tab, selectedGenre, query) {
        loading = true
        if (tab == 2 && genres.isEmpty()) {
            genres = Scraper.loadGenres(source)
        }
        list = when {
            tab == 1 -> Scraper.loadManga(source, isRanking = true)
            tab == 2 && selectedGenre != null -> Scraper.loadManga(source, genreUrl = selectedGenre!!.url)
            tab == 3 -> Scraper.loadManga(source, query).filter { favorites.contains(it.link) }
            else -> Scraper.loadManga(source, query)
        }
        loading = false
    }

    Column(Modifier.fillMaxSize().statusBarsPadding()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("MANGA NHANH", color = AccentColor, fontWeight = FontWeight.ExtraBold, fontSize = 22.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SourceType.entries.forEach { s ->
                    val active = s == source
                    Text(
                        text = s.label,
                        color = if (active) Color.White else TextSub,
                        fontWeight = if (active) FontWeight.Bold else FontWeight.Normal,
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (active) AccentColor else CardBg)
                            .clickable { 
                                onSourceChange(s)
                                selectedGenre = null
                            }
                            .padding(horizontal = 12.dp, vertical = 6.dp),
                        fontSize = 12.sp
                    )
                }
            }
        }

        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            val tabs = listOf("Mới nhất", "🔥 Xếp hạng", "🏷️ Thể loại", "❤️ Yêu thích")
            tabs.forEachIndexed { index, title ->
                val active = tab == index
                Text(
                    text = title,
                    color = if (active) Color.White else TextSub,
                    fontSize = 12.sp,
                    fontWeight = if (active) FontWeight.Bold else FontWeight.Normal,
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(if (active) Color(0xFF2A2E3D) else CardBg)
                        .clickable { 
                            tab = index
                            if (index != 2) selectedGenre = null
                        }
                        .padding(horizontal = 10.dp, vertical = 6.dp)
                )
            }
        }

        if (tab != 2) {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                placeholder = { Text("Tìm truyện...", color = TextSub) },
                leadingIcon = { Icon(Icons.Default.Search, null, tint = TextSub) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = CardBg,
                    unfocusedContainerColor = CardBg,
                    focusedBorderColor = AccentColor,
                    unfocusedBorderColor = Color.Transparent,
                    focusedTextColor = TextMain,
                    unfocusedTextColor = TextMain
                )
            )
        }

        if (loading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = AccentColor)
            }
        } else {
            if (tab == 2 && selectedGenre == null) {
                LazyVerticalGrid(
                    columns = GridCells.Fixed(2),
                    contentPadding = PaddingValues(16.dp),
                    ho
