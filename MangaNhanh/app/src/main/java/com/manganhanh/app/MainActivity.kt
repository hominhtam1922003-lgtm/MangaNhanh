package com.manganhanh.app

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items as columnItems
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items as gridItems
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import org.jsoup.Jsoup
import org.jsoup.nodes.Element
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

private val DarkBg = Color(0xFF0F1015)
private val CardBg = Color(0xFF1B1D25)
private val Accent = Color(0xFFFF5252)
private val MainText = Color(0xFFF0F1F5)
private val SubText = Color(0xFF9DA2B0)

private const val USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36"

private const val PREFS_NAME = "manga_nhanh"
private const val KEY_FAVORITES = "favorite_manga_json"
private const val KEY_HISTORY = "history_manga_json"

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
            MaterialTheme(
                colorScheme = darkColorScheme(
                    background = DarkBg,
                    surface = CardBg,
                    primary = Accent
                )
            ) {
                MangaApp()
            }
        }
    }
}

private object MangaStorage {
    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private fun encode(manga: Manga): String =
        JSONObject().apply {
            put("title", manga.title)
            put("link", manga.link)
            put("cover", manga.cover)
            put("latestChap", manga.latestChap)
            put("source", manga.source.name)
        }.toString()

    private fun decode(value: String): Manga? {
        return try {
            val json = JSONObject(value)
            val source = runCatching {
                SourceType.valueOf(json.optString("source"))
            }.getOrDefault(SourceType.NETTRUYEN)

            Manga(
                title = json.optString("title"),
                link = json.optString("link"),
                cover = json.optString("cover"),
                latestChap = json.optString("latestChap"),
                source = source
            ).takeIf {
                it.title.isNotBlank() && it.link.isNotBlank()
            }
        } catch (_: Exception) {
            null
        }
    }

    fun load(context: Context, key: String): List<Manga> {
        return try {
            val array = JSONArray(
                prefs(context).getString(key, "[]") ?: "[]"
            )

            buildList {
                for (i in 0 until array.length()) {
                    decode(array.optString(i))?.let { add(it) }
                }
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun save(context: Context, key: String, items: List<Manga>) {
        val array = JSONArray()
        items.forEach { array.put(encode(it)) }

        prefs(context).edit()
            .putString(key, array.toString())
            .apply()
    }

    fun addOrReplace(items: List<Manga>, manga: Manga): List<Manga> =
        listOf(manga) + items.filter { it.link != manga.link }

    fun remove(items: List<Manga>, link: String): List<Manga> =
        items.filterNot { it.link == link }
}

private object Sources {
    var netTruyenDomain = "https://nettruyen.gg"
        private set

    var truyenQqDomain = "https://truyenqqko.com"
        private set

    private val client = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(18, TimeUnit.SECONDS)
        .callTimeout(25, TimeUnit.SECONDS)
        .build()

    fun base(source: SourceType): String =
        if (source == SourceType.NETTRUYEN) {
            netTruyenDomain
        } else {
            truyenQqDomain
        }

    suspend fun updateDomains() {
        withContext(Dispatchers.IO) {
            val configUrl =
                "https://raw.githubusercontent.com/hominhtam1922003-lgtm/MangaNhanh/main/MangaNhanh/domains.json"

            try {
                val request = Request.Builder()
                    .url(configUrl)
                    .header("User-Agent", USER_AGENT)
                    .build()

                client.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) return@withContext

                    val json = JSONObject(
                        response.body?.string().orEmpty()
                    )

                    val net = json.optString("nettruyen")
                    if (net.startsWith("https://") ||
                        net.startsWith("http://")
                    ) {
                        netTruyenDomain = net.trimEnd('/')
                    }

                    val qq = json.optString("truyenqq")
                    if (qq.startsWith("https://") ||
                        qq.startsWith("http://")
                    ) {
                        truyenQqDomain = qq.trimEnd('/')
                    }
                }
            } catch (_: Exception) {
                // Tiếp tục dùng domain mặc định nếu tải cấu hình thất bại.
            }
        }
    }
}

private object Scraper {
    private fun absolute(base: String, raw: String): String {
        val value = raw.trim()
        if (value.isBlank()) return ""

        return when {
            value.startsWith("https://") ||
                value.startsWith("http://") -> value
            value.startsWith("//") -> "https:$value"
            value.startsWith("/") -> base.trimEnd('/') + value
            else -> "${base.trimEnd('/')}/$value"
        }
    }

    private fun getDocument(url: String, base: String) =
        Jsoup.connect(url)
            .userAgent(USER_AGENT)
            .referrer(base)
            .timeout(20000)
            .get()

    private fun imageUrl(element: Element?, base: String): String {
        if (element == null) return ""

        val attributes = listOf(
            "data-original",
            "data-src",
            "data-lazy-src",
            "data-cdn",
            "src"
        )

        for (attribute in attributes) {
            val value = element.attr(attribute).trim()
            if (value.isNotBlank()) {
                return absolute(base, value)
            }
        }

        return ""
    }

    suspend fun loadManga(
        source: SourceType,
        query: String = "",
        genreUrl: String = "",
        ranking: Boolean = false
    ): List<Manga> = withContext(Dispatchers.IO) {
        val base = Sources.base(source)
        val encoded = URLEncoder.encode(query, "UTF-8")

        val url = when {
            genreUrl.isNotBlank() -> genreUrl

            query.isNotBlank() &&
                source == SourceType.NETTRUYEN ->
                "$base/tim-truyen?keyword=$encoded"

            query.isNotBlank() ->
                "$base/tim-kiem/trang-1.html?q=$encoded"

            ranking && source == SourceType.NETTRUYEN ->
                "$base/hot"

            ranking ->
                "$base/truyen-hot.html"

            source == SourceType.NETTRUYEN ->
                "$base/trang-chu"

            else ->
                "$base/truyen-moi-cap-nhat.html"
        }

        val result = mutableListOf<Manga>()

        try {
            val document = getDocument(url, base)

            val selector = if (source == SourceType.NETTRUYEN) {
                ".items .item, .list-items .item, div.item"
            } else {
                ".row .item, ul.list_grid li, ul.grid li, " +
                    ".list-stories li, .book_list li"
            }

            for (item in document.select(selector)) {
                val titleElement = if (
                    source == SourceType.NETTRUYEN
                ) {
                    item.selectFirst(".title a, h3 a, figcaption a")
                } else {
                    item.selectFirst(
                        ".book_name h3 a, .title-book a, " +
                            ".book_name a, h3 a"
                    )
                } ?: continue

                val title = titleElement.attr("title")
                    .ifBlank { titleElement.text() }
                    .trim()

                val link = absolute(base, titleElement.attr("href"))
                val cover = imageUrl(item.selectFirst("img"), base)

                val chapter = item.selectFirst(
                    ".chapter a, .comic-item-chapter a, " +
                        ".last_chapter a, .chap-list li:first-child a"
                )?.text()?.trim()
                    .orEmpty()
                    .ifBlank { "Chưa có thông tin chương" }

                if (title.isNotBlank() &&
                    link.isNotBlank() &&
                    result.none { it.link == link }
                ) {
                    result.add(
                        Manga(
                            title = title,
                            link = link,
                            cover = cover,
                            latestChap = chapter,
                            source = source
                        )
                    )
                }
            }
        } catch (_: Exception) {
            // Website có thể đổi cấu trúc hoặc chặn truy cập.
        }

        result
    }

    suspend fun loadGenres(source: SourceType): List<Genre> =
        withContext(Dispatchers.IO) {
            val base = Sources.base(source)
            val result = mutableListOf<Genre>()

            try {
                val document = getDocument(base, base)

                val selector = if (
                    source == SourceType.NETTRUYEN
                ) {
                    ".nav-item.dropdown ul.dropdown-menu li a, " +
                        ".sub-menu li a, .genre-item a"
                } else {
                    ".genre-item a, .menu-list li a, .TopNavGenres li a"
                }

                for (element in document.select(selector)) {
                    val name = element.text().trim()
                    val url = absolute(base, element.attr("href"))

                    if (name.isNotBlank() &&
                        url.isNotBlank() &&
                        result.none { it.url == url }
                    ) {
                        result.add(Genre(name, url))
                    }
                }
            } catch (_: Exception) {
                // Danh sách thể loại sẽ rỗng nếu website không truy cập được.
            }

            result
        }

    suspend fun loadDetails(
        manga: Manga
    ): Pair<String, List<Chapter>> = withContext(Dispatchers.IO) {
        val base = Sources.base(manga.source)
        val chapters = mutableListOf<Chapter>()
        var description = "Chưa có giới thiệu."

        try {
            val document = getDocument(manga.link, base)

            val descriptionElement = document.selectFirst(
                ".detail-content p, .comic-description, " +
                    ".detail-summary, .story-detail-info, " +
                    ".detail-content, .description"
            )

            if (descriptionElement != null &&
                descriptionElement.text().isNotBlank()
            ) {
                description = descriptionElement.text().trim()
            }

            val selectors = listOf(
                ".list-chapter li",
                "#nt_listchapter li",
                ".chapter-list div.row",
                ".works-chapter-list .works-chapter-item",
                ".list_chapter li",
                ".chap-list .row"
            )

            for (selector in selectors) {
                for (row in document.select(selector)) {
                    val anchor = row.selectFirst("a") ?: continue
                    addChapter(chapters, anchor, base, manga.source)
                }
            }

            if (chapters.isEmpty()) {
                for (anchor in document.select(
                    ".list-chapter a, #nt_listchapter a, " +
                        ".list_chapter a, .chap-list a"
                )) {
                    addChapter(chapters, anchor, base, manga.source)
                }
            }
        } catch (_: Exception) {
            // Giữ dữ liệu mặc định nếu tải chi tiết thất bại.
        }

        description to chapters
    }

    private fun addChapter(
        chapters: MutableList<Chapter>,
        anchor: Element,
        base: String,
        source: SourceType
    ) {
        val title = anchor.text().trim()
        val link = absolute(base, anchor.attr("href"))

        if (title.isNotBlank() &&
            link.isNotBlank() &&
            chapters.none { it.link == link }
        ) {
            chapters.add(Chapter(title, link, source))
        }
    }

    suspend fun loadPages(chapter: Chapter): List<String> =
        withContext(Dispatchers.IO) {
            val base = Sources.base(chapter.source)
            val pages = mutableListOf<String>()

            try {
                val document = getDocument(chapter.link, base)
                val selector =
                    ".page-chapter img, .reading-detail img, " +
                        ".chapter-content img, .story-see-content img"

                for (img in document.select(selector)) {
                    val src = imageUrl(img, base)
                    val lower = src.lowercase()

                    val unwanted =
                        lower.contains("banner") ||
                            lower.contains("logo") ||
                            lower.contains("icon")

                    if (src.isNotBlank() &&
                        !unwanted &&
                        pages.none { it == src }
                    ) {
                        pages.add(src)
                    }
                }
            } catch (_: Exception) {
                // Không tải được trang truyện.
            }

            pages
        }
}

@Composable
fun MangaApp() {
    val context = LocalContext.current

    var source by remember { mutableStateOf(SourceType.NETTRUYEN) }
    var selectedManga by remember { mutableStateOf<Manga?>(null) }
    var selectedChapter by remember { mutableStateOf<Chapter?>(null) }
    var chapterList by remember { mutableStateOf<List<Chapter>>(emptyList()) }

    var favorites by remember {
        mutableStateOf(Storage.load(context, FAVORITES_KEY))
    }
    var history by remember {
        mutableStateOf(Storage.load(context, HISTORY_KEY))
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = Bg
    ) {
        when {
            selectedChapter != null -> {
                val chapter = selectedChapter!!

                ReaderScreen(
                    chapter = chapter,
                    onBack = { selectedChapter = null },
                    onPrevious = {
                        val index = chapterList.indexOfFirst {
                            it.link == chapter.link
                        }
                        if (index >= 0 && index < chapterList.lastIndex) {
                            selectedChapter = chapterList[index + 1]
                        }
                    },
                    onNext = {
                        val index = chapterList.indexOfFirst {
                            it.link == chapter.link
                        }
                        if (index > 0) {
                            selectedChapter = chapterList[index - 1]
                        }
                    }
                )
            }

            selectedManga != null -> {
                val manga = selectedManga!!

                DetailScreen(
                    manga = manga,
                    isFavorite = favorites.any { it.link == manga.link },
                    onBack = { selectedManga = null },
                    onFavorite = {
                        favorites = if (
                            favorites.any { it.link == manga.link }
                        ) {
                            Storage.remove(favorites, manga.link)
                        } else {
                            Storage.add(favorites, manga)
                        }
                        Storage.save(context, FAVORITES_KEY, favorites)
                    },
                    onRead = { chapter, chapters ->
                        chapterList = chapters
                        selectedChapter = chapter
                        history = Storage.add(history, manga)
                        Storage.save(context, HISTORY_KEY, history)
                    }
                )
            }

            else -> {
                HomeScreen(
                    source = source,
                    favorites = favorites,
                    history = history,
                    onSourceChange = { source = it },
                    onSelect = { selectedManga = it }
                )
            }
        }
    }
}

@Composable
fun HomeScreen(
    source: SourceType,
    favorites: List<Manga>,
    history: List<Manga>,
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
        if (tab == 3) {
            mangaList = favorites
            loading = false
        } else if (tab == 4) {
            mangaList = history
            loading = false
        } else {
            loading = true
            error = ""

            try {
                if (tab == 2 && genres.isEmpty()) {
                    genres = Scraper.loadGenres(source)
                }

                mangaList = when {
                    tab == 2 && selectedGenre == null -> emptyList()
                    tab == 2 && selectedGenre != null ->
                        Scraper.loadManga(
                            source = source,
                            genreUrl = selectedGenre!!.url
                        )
                    tab == 1 ->
                        Scraper.loadManga(source = source, ranking = true)
                    else ->
                        Scraper.loadManga(source = source, query = query)
                }
            } catch (_: Exception) {
                mangaList = emptyList()
                error = "Không tải được dữ liệu. Hãy thử lại."
            }

            loading = false
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Bg)
            .statusBarsPadding()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                "MANGA NHANH",
                color = Accent,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 20.sp
            )

            Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                SourceType.values().forEach { item ->
                    Text(
                        item.label,
                        color = Foreground,
                        fontSize = 11.sp,
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (source == item) Accent else Panel)
                            .clickable {
                                onSourceChange(item)
                                selectedGenre = null
                                genres = emptyList()
                            }
                            .padding(8.dp)
                    )
                }
            }
        }

        val tabNames = listOf(
            "Mới", "Xếp hạng", "Thể loại", "Yêu thích", "Đã đọc"
        )

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            tabNames.forEachIndexed { index, name ->
                Text(
                    name,
                    color = Foreground,
                    fontSize = 10.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(6.dp))
                        .background(if (tab == index) Accent else Panel)
                        .clickable {
                            tab = index
                            selectedGenre = null
                        }
                        .padding(vertical = 11.dp, horizontal = 1.dp)
                )
            }
        }

        if (tab == 0) {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(10.dp),
                placeholder = { Text("Tìm truyện...") },
                singleLine = true
            )
        }

        if (tab == 2 && selectedGenre != null) {
            TextButton(onClick = { selectedGenre = null }) {
                Text("← Tất cả thể loại", color = Foreground)
            }
        }

        when {
            loading -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = Accent)
                }
            }

            tab == 2 && selectedGenre == null -> {
                if (genres.isEmpty()) {
                    EmptyMessage("Không tải được thể loại từ website.")
                } else {
                    LazyVerticalGrid(
                        columns = GridCells.Fixed(2),
                        contentPadding = PaddingValues(12.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        gridItems(items = genres, key = { it.url }) { genre ->
                            Surface(
                                color = Panel,
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { selectedGenre = genre }
                            ) {
                                Text(
                                    genre.name,
                                    color = Foreground,
                                    modifier = Modifier.padding(14.dp)
                                )
                            }
                        }
                    }
                }
            }

            mangaList.isEmpty() -> {
                EmptyMessage(
                    error.ifBlank {
                        when (tab) {
                            3 -> "Chưa có truyện yêu thích."
                            4 -> "Chưa có lịch sử đọc."
                            else -> "Không tìm thấy truyện."
                        }
                    }
                )
            }

            else -> {
                LazyVerticalGrid(
                    columns = GridCells.Fixed(2),
                    contentPadding = PaddingValues(10.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    gridItems(items = mangaList, key = { it.link }) { manga ->
                        MangaCard(manga = manga) {
                            onSelect(manga)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun MangaCard(manga: Manga, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Panel)
            .clickable { onClick() }
            .padding(8.dp)
    ) {
        if (manga.cover.isNotBlank()) {
            AsyncImage(
                model = manga.cover,
                contentDescription = manga.title,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(205.dp)
                    .clip(RoundedCornerShape(8.dp)),
                contentScale = ContentScale.Crop
            )
        } else {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(205.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color(0xFF30323A)),
                contentAlignment = Alignment.Center
            ) {
                Text("Không có ảnh", color = Muted)
            }
        }

        Spacer(Modifier.height(8.dp))

        Text(
            manga.title,
            color = Foreground,
            fontWeight = FontWeight.SemiBold,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            fontSize = 14.sp
        )

        Spacer(Modifier.height(4.dp))

        Text(
            manga.latestChap,
            color = Muted,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            fontSize = 11.sp
        )
    }
}

@Composable
fun DetailScreen(
    manga: Manga,
    isFavorite: Boolean,
    onBack: () -> Unit,
    onFavorite: () -> Unit,
    onRead: (Chapter, List<Chapter>) -> Unit
) {
    var description by remember(manga.link) {
        mutableStateOf("Đang tải thông tin truyện...")
    }
    var chapters by remember(manga.link) {
        mutableStateOf<List<Chapter>>(emptyList())
    }
    var loading by remember(manga.link) { mutableStateOf(true) }

    LaunchedEffect(manga.link) {
        loading = true
        val result = Scraper.loadDetails(manga)
        description = result.first
        chapters = result.second
        loading = false
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Bg)
            .statusBarsPadding()
    ) {
        TextButton(onClick = onBack) {
            Text("← Quay lại", color = Foreground)
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(14.dp)
        ) {
            item {
                if (manga.cover.isNotBlank()) {
                    AsyncImage(
                        model = manga.cover,
                        contentDescription = manga.title,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(250.dp),
                        contentScale = ContentScale.Fit
                    )
                }

                Spacer(Modifier.height(12.dp))

                Text(
                    manga.title,
                    color = Foreground,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold
                )

                Spacer(Modifier.height(6.dp))

                Text(manga.latestChap, color = Muted)

                Button(
                    onClick = onFavorite,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        if (isFavorite) "♥ Bỏ yêu thích"
                        else "♡ Thêm yêu thích"
                    )
                }

                Spacer(Modifier.height(12.dp))

                Text(
                    "Giới thiệu",
                    color = Accent,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )

                Spacer(Modifier.height(5.dp))

                Text(description, color = Foreground)

                Spacer(Modifier.height(16.dp))

                Text(
                    "Danh sách chương",
                    color = Accent,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )

                if (loading) {
                    CircularProgressIndicator(color = Accent)
                } else if (chapters.isEmpty()) {
                    Text(
                        "Không tải được danh sách chương.",
                        color = Muted
                    )
                }
            }

            columnItems(items = chapters, key = { it.link }) { chapter ->
                Surface(
                    color = Panel,
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp)
                        .clickable { onRead(chapter, chapters) }
                ) {
                    Text(
                        chapter.title,
                        color = Foreground,
                        modifier = Modifier.padding(14.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun ReaderScreen(
    chapter: Chapter,
    onBack: () -> Unit,
    onPrevious: () -> Unit,
    onNext: () -> Unit
) {
    var pages by remember(chapter.link) {
        mutableStateOf<List<String>>(emptyList())
    }
    var loading by remember(chapter.link) { mutableStateOf(true) }

    LaunchedEffect(chapter.link) {
        loading = true
        pages = Scraper.loadPages(chapter)
        loading = false
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .statusBarsPadding()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Panel),
            verticalAlignment = Alignment.CenterVertically
        ) {
            TextButton(onClick = onBack) {
                Text("← Trở lại", color = Foreground)
            }

            Text(
                chapter.title,
                color = Foreground,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f)
            )
        }

        when {
            loading -> {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = Accent)
                }
            }

            pages.isEmpty() -> {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .padding(20.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        "Không tải được ảnh chương. Website có thể đã đổi cấu trúc.",
                        color = Foreground,
                        textAlign = TextAlign.Center
                    )
                }
            }

            else -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                ) {
                    columnItems(items = pages, key = { it }) { page ->
                        AsyncImage(
                            model = page,
                            contentDescription = "Trang truyện",
                            modifier = Modifier.fillMaxWidth(),
                            contentScale = ContentScale.FillWidth
                        )
                    }
                }
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Panel)
                .padding(8.dp),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            Button(onClick = onPrevious) {
                Text("Chương trước")
            }

            Button(onClick = onNext) {
                Text("Chương sau")
            }
        }
    }
}

@Composable
fun EmptyMessage(message: String) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = message,
            color = Muted,
            textAlign = TextAlign.Center
        )
    }
} 
