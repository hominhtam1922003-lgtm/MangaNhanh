
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
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
import coil.compose.AsyncImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import org.json.JSONObject
import org.jsoup.Jsoup
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

private val DarkBg = Color(0xFF0F1015)
private val CardBg = Color(0xFF181A20)
private val Accent = Color(0xFFFF5252)
private val MainText = Color(0xFFF0F1F5)
private val SubText = Color(0xFF8A8F9E)

private const val UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36"

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

data class Genre(val name: String, val url: String)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = darkColorScheme(
                background = DarkBg,
                surface = CardBg,
                primary = Accent
            )) {
                MangaApp()
            }
        }
    }
}

object Sources {
    var netTruyenDomain = "https://nettruyen.gg"
    var truyenQqDomain = "https://truyenqqko.com"

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    fun base(source: SourceType) =
        if (source == SourceType.NETTRUYEN) netTruyenDomain
        else truyenQqDomain

    suspend fun updateDomains() = withContext(Dispatchers.IO) {
        // Đọc cấu hình domain nếu file tồn tại.
        // Đường dẫn phải trỏ đúng tới domains.json trong repo.
        val configUrl =
            "https://raw.githubusercontent.com/hominhtam1922003-lgtm/MangaNhanh/main/MangaNhanh/domains.json"

        try {
            val request = okhttp3.Request.Builder()
                .url(configUrl)
                .header("User-Agent", UA)
                .build()

            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val body = response.body?.string().orEmpty()
                    val json = JSONObject(body)
                    json.optString("nettruyen")
                        .takeIf { it.startsWith("http") }
                        ?.let { netTruyenDomain = it.trimEnd('/') }

                    json.optString("truyenqq")
                        .takeIf { it.startsWith("http") }
                        ?.let { truyenQqDomain = it.trimEnd('/') }
                }
            }
        } catch (_: Exception) {
            // Giữ domain mặc định nếu không tải được cấu hình.
        }
    }
}

object Scraper {
    private fun absolute(base: String, url: String): String {
        val value = url.trim()
        if (value.isBlank()) return ""
        return when {
            value.startsWith("https://") || value.startsWith("http://") -> value
            value.startsWith("//") -> "https:$value"
            value.startsWith("/") -> base.trimEnd('/') + value
            else -> "$base/$value"
        }
    }

    private fun imageUrl(element: org.jsoup.nodes.Element?, base: String): String {
        if (element == null) return ""
        val raw = listOf(
            "data-original", "data-src", "data-lazy-src",
            "data-cdn", "src"
        ).firstNotNullOfOrNull { key ->
            element.attr(key).takeIf { it.isNotBlank() }
        } ?: return ""
        return absolute(base, raw)
    }

    suspend fun loadManga(
        source: SourceType,
        query: String = "",
        genreUrl: String = "",
        ranking: Boolean = false
    ): List<Manga> = withContext(Dispatchers.IO) {
        val base = Sources.base(source)
        val result = mutableListOf<Manga>()

        val url = when {
            genreUrl.isNotBlank() -> genreUrl
            query.isNotBlank() && source == SourceType.NETTRUYEN ->
                "$base/tim-truyen?keyword=${URLEncoder.encode(query, "UTF-8")}"
            query.isNotBlank() ->
                "$base/tim-kiem/trang-1.html?q=${URLEncoder.encode(query, "UTF-8")}"
            ranking && source == SourceType.NETTRUYEN -> "$base/hot"
            ranking -> "$base/truyen-hot.html"
            source == SourceType.NETTRUYEN -> "$base/trang-chu"
            else -> "$base/truyen-moi-cap-nhat.html"
        }

        try {
            val doc = Jsoup.connect(url)
                .userAgent(UA)
                .referrer(base)
                .timeout(15000)
                .get()

            val selectors = if (source == SourceType.NETTRUYEN) {
                ".items .item, .list-items .item, div.item"
            } else {
                ".row .item, ul.list_grid li, ul.grid li, " +
                    ".list-stories li, .book_list li"
            }

            for (item in doc.select(selectors)) {
                val titleElement = if (source == SourceType.NETTRUYEN) {
                    item.select(".title a, h3 a, figcaption a").first()
                } else {
                    item.select(
                        ".book_name h3 a, .title-book a, .book_name a, h3 a"
                    ).first()
                } ?: continue

                val title = titleElement.attr("title")
                    .ifBlank { titleElement.text() }
                    .trim()
                val link = absolute(base, titleElement.attr("href"))
                val cover = imageUrl(item.selectFirst("img"), base)

                val chapterSelector =
                    ".chapter a, .comic-item-chapter a, " +
                    ".last_chapter a, ul.chap-list li:first-child a"

                val chapter = item.selectFirst(chapterSelector)
                    ?.text()?.trim().orEmpty().ifBlank { "Mới cập nhật" }

                if (title.isNotBlank() && link.isNotBlank() &&
                    result.none { it.link == link }
                ) {
                    result.add(Manga(title, link, cover, chapter, source))
                }
            }
        } catch (_: Exception) {
            // Trả danh sách rỗng nếu website lỗi hoặc chặn truy cập.
        }
        result
    }

    suspend fun loadGenres(source: SourceType): List<Genre> =
        withContext(Dispatchers.IO) {
            val base = Sources.base(source)
            val genres = mutableListOf<Genre>()

            try {
                val doc = Jsoup.connect(base)
                    .userAgent(UA)
                    .referrer(base)
                    .timeout(15000)
                    .get()

                val selector = if (source == SourceType.NETTRUYEN) {
                    ".nav-item.dropdown ul.dropdown-menu li a, " +
                        ".sub-menu li a, .genre-item a"
                } else {
                    ".genre-item a, .menu-list li a, .TopNavGenres li a"
                }

                for (element in doc.select(selector)) {
                    val name = element.text().trim()
                    val url = absolute(base, element.attr("href"))
                    if (name.isNotBlank() && url.isNotBlank() &&
                        genres.none { it.url == url }
                    ) {
                        genres.add(Genre(name, url))
                    }
                }
            } catch (_: Exception) {
            }
            genres
        }

    suspend fun loadDetails(manga: Manga): Pair<String, List<Chapter>> =
        withContext(Dispatchers.IO) {
            val chapters = mutableListOf<Chapter>()
            var description = "Chưa có giới thiệu."
            val base = Sources.base(manga.source)

            try {
                val doc = Jsoup.connect(manga.link)
                    .userAgent(UA)
                    .referrer(base)
                    .timeout(15000)
                    .get()

                val descElement = doc.selectFirst(
                    ".detail-content p, .comic-description, " +
                        ".detail-summary, .story-detail-info"
                )
                if (descElement != null && descElement.text().isNotBlank()) {
                    description = descElement.text().trim()
                }

                val selector =
                    ".list-chapter li, #nt_listchapter li, " +
                    ".chapter-list div.row, .works-chapter-list " +
                    ".works-chapter-item, .list_chapter li, .chap-list .row"

                for (row in doc.select(selector)) {
                    val a = row.selectFirst("a") ?: continue
                    val title = a.text().trim()
                    val link = absolute(base, a.attr("href"))

                    if (title.isNotBlank() && link.isNotBlank() &&
                        chapters.none { it.link == link }
                    ) {
                        chapters.add(Chapter(title, link, manga.source))
                    }
                }

                if (chapters.isEmpty()) {
                    for (a in doc.select(
                        ".list-chapter a, #nt_listchapter a, " +
                            ".list_chapter a, .chap-list a"
                    )) {
                        val title = a.text().trim()
                        val link = absolute(base, a.attr("href"))
                        if (title.isNotBlank() && link.isNotBlank() &&
                            chapters.none { it.link == link }
                        ) {
                            chapters.add(Chapter(title, link, manga.source))
                        }
                    }
                }
            } catch (_: Exception) {
            }

            description to chapters
        }

    suspend fun loadPages(chapter: Chapter): List<String> =
        withContext(Dispatchers.IO) {
            val base = Sources.base(chapter.source)
            val pages = mutableListOf<String>()

            try {
                val doc = Jsoup.connect(chapter.link)
                    .userAgent(UA)
                    .referrer(base)
                    .timeout(15000)
                    .get()

                val selector =
                    ".page-chapter img, .reading-detail img, " +
                    ".chapter-content img, .story-see-content img"

                for (img in doc.select(selector)) {
                    val src = imageUrl(img, base)
                    val lower = src.lowercase()

                    if (src.isNotBlank() &&
                        !lower.contains("banner") &&
                        !lower.contains("logo") &&
                        !lower.contains("icon") &&
                        pages.none { it == src }
                    ) {
                        pages.add(src)
                    }
                }
            } catch (_: Exception) {
            }
            pages
        }
}

@Composable
fun MangaApp() {
    val context = LocalContext.current
    val prefs = remember {
        context.getSharedPreferences("manga_nhanh", Context.MODE_PRIVATE)
    }

    var source by remember { mutableStateOf(SourceType.NETTRUYEN) }
    var selectedManga by remember { mutableStateOf<Manga?>(null) }
    var selectedChapter by remember { mutableStateOf<Chapter?>(null) }
    var chapterList by remember { mutableStateOf<List<Chapter>>(emptyList()) }
    var favorites by remember {
        mutableStateOf(prefs.getStringSet("favorites", emptySet())?.toSet() ?: emptySet())
    }
    var history by remember {
        mutableStateOf(prefs.getStringSet("history", emptySet())?.toSet() ?: emptySet())
    }

    LaunchedEffect(Unit) {
        Sources.updateDomains()
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = DarkBg
    ) {
        when {
            selectedChapter != null && selectedManga != null -> {
                ReaderScreen(
                    chapter = selectedChapter!!,
                    onBack = { selectedChapter = null },
                    onPrevious = {
                        val i = chapterList.indexOfFirst {
                            it.link == selectedChapter!!.link
                        }
                        if (i < chapterList.lastIndex) selectedChapter = chapterList[i + 1]
                    },
                    onNext = {
                        val i = chapterList.indexOfFirst {
                            it.link == selectedChapter!!.link
                        }
                        if (i > 0) selectedChapter = chapterList[i - 1]
                    }
                )
            }

            selectedManga != null -> {
                DetailScreen(
                    manga = selectedManga!!,
                    favorite = favorites.contains(selectedManga!!.link),
                    onBack = { selectedManga = null },
                    onFavorite = {
                        val link = selectedManga!!.link
                        favorites = if (link in favorites) favorites - link
                        else favorites + link
                        prefs.edit().putStringSet("favorites", favorites).apply()
                    },
                    onRead = { chapter, chapters ->
                        chapterList = chapters
                        selectedChapter = chapter
                        history = history + selectedManga!!.link
                        prefs.edit().putStringSet("history", history).apply()
                    }
                )
            }

            else -> HomeScreen(
                source = source,
                favorites = favorites,
                history = history,
                onSourceChange = { source = it },
                onSelect = { selectedManga = it }
            )
        }
    }
}

@Composable
fun HomeScreen(
    source: SourceType,
    favorites: Set<String>,
    history: Set<String>,
    onSourceChange: (SourceType) -> Unit,
    onSelect: (Manga) -> Unit
) {
    var query by remember { mutableStateOf("") }
    var tab by remember { mutableIntStateOf(0) }
    var selectedGenre by remember { mutableStateOf<Genre?>(null) }
    var mangaList by remember { mutableStateOf<List<Manga>>(emptyList()) }
    var genres by remember { mutableStateOf<List<Genre>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }

    LaunchedEffect(source, tab, selectedGenre, query, favorites, history) {
        loading = true
        error = ""
        try {
            if (tab == 2 && genres.isEmpty()) {
                genres = Scraper.loadGenres(source)
            }

            val loaded = when {
                tab == 1 -> Scraper.loadManga(source, ranking = true)
                tab == 2 && selectedGenre != null ->
                    Scraper.loadManga(source, genreUrl = selectedGenre!!.url)
                else -> Scraper.loadManga(source, query = query)
            }

            mangaList = when (tab) {
                3 -> loaded.filter { it.link in favorites }
                4 -> loaded.filter { it.link in history }
                else -> loaded
            }
        } catch (_: Exception) {
            mangaList = emptyList()
            error = "Không tải được dữ liệu. Hãy thử lại."
        }
        loading = false
    }

    Column(
        Modifier.fillMaxSize().statusBarsPadding()
    ) {
        Row(
            Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                "MANGA NHANH",
                color = Accent,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 21.sp
            )
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                SourceType.entries.forEach { item ->
                    Text(
                        item.label,
                        color = if (source == item) Color.White else SubText,
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (source == item) Accent else CardBg)
                            .clickable {
                                onSourceChange(item)
                                selectedGenre = null
                                genres = emptyList()
                            }
                            .padding(horizontal = 10.dp, vertical = 8.dp),
                        fontSize = 12.sp
                    )
                }
            }
        }

        Row(
            Modifier.fillMaxWidth().padding(horizontal = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            listOf("Mới", "Xếp hạng", "Thể loại", "Yêu thích", "Đã đọc")
                .forEachIndexed { index, title ->
                    Text(
                        title,
                        color = if (tab == index) Color.White else SubText,
                        fontSize = 11.sp,
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(6.dp))
                            .background(if (tab == index) Color(0xFF343746) else CardBg)
                            .clickable {
                                tab = index
                                selectedGenre = null
                            }
                            .padding(vertical = 10.dp),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                }
        }

        if (tab != 2) {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier.fillMaxWidth().padding(12.dp),
                placeholder = { Text("Tìm truyện...", color = SubText) },
                leadingIcon = { Icon(Icons.Default.Search, null) },
                singleLine = true
            )
        }

        if (loading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Accent)
            }
        } else if (tab == 2 && selectedGenre == null) {
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                contentPadding = PaddingValues(12.dp),
             
