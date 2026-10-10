
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
    private fun preferences(context: Context) =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private fun encode(manga: Manga): String {
        return JSONObject().apply {
            put("title", manga.title)
            put("link", manga.link)
            put("cover", manga.cover)
            put("latestChap", manga.latestChap)
            put("source", manga.source.name)
        }.toString()
    }

    private fun decode(value: String): Manga? {
        return try {
            val json = JSONObject(value)
            Manga(
                title = json.optString("title"),
                link = json.optString("link"),
                cover = json.optString("cover"),
                latestChap = json.optString("latestChap"),
                source = runCatching {
                    SourceType.valueOf(json.optString("source"))
                }.getOrDefault(SourceType.NETTRUYEN)
            ).takeIf { it.link.isNotBlank() && it.title.isNotBlank() }
        } catch (_: Exception) {
            null
        }
    }

    fun load(context: Context, key: String): List<Manga> {
        val values = preferences(context)
            .getString(key, "[]") ?: "[]"

        return try {
            val array = JSONArray(values)
            buildList {
                for (i in 0 until array.length()) {
                    val item = decode(array.optString(i))
                    if (item != null) add(item)
                }
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun save(context: Context, key: String, manga: List<Manga>) {
        val array = JSONArray()
        manga.forEach { array.put(encode(it)) }

        preferences(context).edit()
            .putString(key, array.toString())
            .apply()
    }

    fun addOrReplace(
        current: List<Manga>,
        manga: Manga
    ): List<Manga> {
        return listOf(manga) + current.filter { it.link != manga.link }
    }

    fun remove(current: List<Manga>, link: String): List<Manga> {
        return current.filter { it.link != link }
    }
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

    fun base(source: SourceType): String {
        return if (source == SourceType.NETTRUYEN) {
            netTruyenDomain
        } else {
            truyenQqDomain
        }
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

                    json.optString("nettruyen")
                        .takeIf { it.startsWith("https://") || it.startsWith("http://") }
                        ?.let { netTruyenDomain = it.trimEnd('/') }

                    json.optString("truyenqq")
                        .takeIf { it.startsWith("https://") || it.startsWith("http://") }
                        ?.let { truyenQqDomain = it.trimEnd('/') }
                }
            } catch (_: Exception) {
                // Giữ domain mặc định nếu không tải được cấu hình.
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

    private fun imageUrl(
        element: Element?,
        base: String
    ): String {
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
                val titleElement = if (source == SourceType.NETTRUYEN) {
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
                )?.text()?.trim().orEmpty()
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

                val selector = if (source == SourceType.NETTRUYEN) {
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
                // Trả danh sách rỗng khi không truy cập được.
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
            // Giữ mô tả mặc định.
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

                    val isUnwanted =
                        lower.contains("banner") ||
                            lower.contains("logo") ||
                            lower.contains("icon")

                    if (src.isNotBlank() &&
                        !isUnwanted &&
                        pages.none { it == src }
                    ) {
                        pages.add(src)
                    }
                }
            } catch (_: Exception) {
                // Không có ảnh hoặc website đổi cấu trúc.
            }

            pages
        }
}

@Composable
fun MangaApp() {
    val context = LocalContext.current

    var source by remember {
        mutableStateOf(SourceType.NETTRUYEN)
    }

    var selectedManga by remember {
        mutableStateOf<Manga?>(null)
    }

    var selectedChapter by remember {
        mutableStateOf<Chapter?>(null)
    }

    var chapterList by remember {
        mutableStateOf<List<Chapter>>(emptyList())
    }

    var favorites by remember {
        mutableStateOf(
            MangaStorage.load(context, KEY_FAVORITES)
        )
    }

    var history by remember {
        mutableStateOf(
            MangaStorage.load(context, KEY_HISTORY)
        )
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
                val currentChapter = selectedChapter!!

                ReaderScreen(
                    chapter = currentChapter,
                    onBack = {
                        selectedChapter = null
                    },
                    onPrevious = {
                        val index = chapterList.indexOfFirst {
                            it.link == currentChapter.link
                        }

                        if (index >= 0 &&
                            index < chapterList.lastIndex
                        ) {
                            selectedChapter = chapterList[index + 1]
                        }
                    },
                    onNext = {
                        val index = chapterList.indexOfFirst {
                            it.link == currentChapter.link
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
                    isFavorite = favorites.any {
                        it.link == manga.link
                    },
                    onBack = {
                        selectedManga = null
                    },
                    onFavorite = {
                        favorites =
                            if (favorites.any { it.link == manga.link }) {
                                MangaStorage.remove(favorites, manga.link)
                            } else {
                                MangaStorage.addOrReplace(favorites, manga)
                            }

                        MangaStorage.save(
                            context,
                            KEY_FAVORITES,
                            favorites
                        )
                    },
                    onRead = { chapter, chapters ->
                        chapterList = chapters
                        selectedChapter = chapter

                        history = MangaStorage.addOrReplace(
                            history,
                            manga
                        )

                        MangaStorage.save(
                            context,
                            KEY_HISTORY,
                            history
                        )
                    }
                )
            }
