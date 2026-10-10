package com.manganhanh.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.jsoup.Jsoup
import org.jsoup.nodes.Document
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MangaNhanhTheme {
                MangaApp()
            }
        }
    }
}

private val AppBackground = androidx.compose.ui.graphics.Color(0xFF101116)
private val Panel = androidx.compose.ui.graphics.Color(0xFF1B1D25)
private val Accent = androidx.compose.ui.graphics.Color(0xFFFF6B35)
private val Foreground = androidx.compose.ui.graphics.Color(0xFFF4F4F6)
private val Muted = androidx.compose.ui.graphics.Color(0xFF9DA3B4)

@Composable
private fun MangaNhanhTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = Accent,
            background = AppBackground,
            surface = Panel,
            onPrimary = androidx.compose.ui.graphics.Color.White,
            onBackground = Foreground,
            onSurface = Foreground
        ),
        content = content
    )
}

enum class SourceType(val label: String, val baseUrl: String) {
    NETTRUYEN("NetTruyen", "https://nettruyen.gg"),
    TRUYENQQ("TruyenQQ", "https://truyenqqko.com")
}

data class Manga(
    val title: String,
    val url: String,
    val image: String = "",
    val description: String = "",
    val genres: List<String> = emptyList(),
    val chapters: List<Chapter> = emptyList(),
    val source: SourceType = SourceType.NETTRUYEN
)

data class Chapter(val title: String, val url: String)

private enum class AppTab(val label: String) {
    HOME("Mới"),
    RANKING("Xếp hạng"),
    GENRES("Thể loại"),
    FAVORITES("Yêu thích"),
    HISTORY("Lịch sử")
}

@Composable
private fun MangaApp() {
    var source by remember { mutableStateOf(SourceType.NETTRUYEN) }
    var searchText by remember { mutableStateOf("") }
    var selectedTab by remember { mutableStateOf(AppTab.HOME) }
    var selectedGenre by remember { mutableStateOf<String?>(null) }
    var mangas by remember { mutableStateOf<List<Manga>>(emptyList()) }
    var favorites by remember { mutableStateOf<List<Manga>>(emptyList()) }
    var history by remember { mutableStateOf<List<Manga>>(emptyList()) }
    var selectedManga by remember { mutableStateOf<Manga?>(null) }
    var selectedChapter by remember { mutableStateOf<Chapter?>(null) }
    var readerPages by remember { mutableStateOf<List<String>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    fun loadManga(query: String = "") {
        scope.launch {
            loading = true
            errorMessage = null

            val result = withContext(Dispatchers.IO) {
                runCatching {
                    if (query.isBlank()) {
                        MangaScraper.latest(source)
                    } else {
                        MangaScraper.search(source, query)
                    }
                }
            }

            result.onSuccess { mangas = it }
                .onFailure {
                    errorMessage = it.message ?: "Không tải được dữ liệu."
                }

            loading = false
        }
    }

    LaunchedEffect(source) {
        loadManga()
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = AppBackground
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            when {
                selectedChapter != null -> ReaderScreen(
                    chapter = selectedChapter!!,
                    pages = readerPages,
                    loading = loading,
                    onBack = { selectedChapter = null },
                    onReload = {
                        scope.launch {
                            loading = true
                            readerPages = withContext(Dispatchers.IO) {
                                runCatching {
                                    MangaScraper.chapterPages(
                                        selectedChapter!!.url
                                    )
                                }.getOrDefault(emptyList())
                            }
                            loading = false
                        }
                    }
                )

                selectedManga != null -> DetailScreen(
                    manga = selectedManga!!,
                    isFavorite = favorites.any {
                        it.url == selectedManga!!.url
                    },
                    onBack = { selectedManga = null },
                    onFavorite = {
                        val current = selectedManga!!
                        favorites = if (
                            favorites.any { it.url == current.url }
                        ) {
                            favorites.filterNot {
                                it.url == current.url
                            }
                        } else {
                            listOf(current) + favorites
                        }
                    },
                    onOpenChapter = { chapter ->
                        selectedChapter = chapter
                        history = listOf(selectedManga!!) +
                            history.filterNot {
                                it.url == selectedManga!!.url
                            }

                        scope.launch {
                            loading = true
                            readerPages = withContext(Dispatchers.IO) {
                                runCatching {
                                    MangaScraper.chapterPages(chapter.url)
                                }.getOrDefault(emptyList())
                            }
                            loading = false
                        }
                    }
                )

                else -> HomeScreen(
                    source = source,
                    onSourceChange = {
                        source = it
                        selectedGenre = null
                    },
                    searchText = searchText,
                    onSearchTextChange = { searchText = it },
                    onSearch = { loadManga(searchText) },
                    selectedTab = selectedTab,
                    onTabChange = { selectedTab = it },
                    selectedGenre = selectedGenre,
                    onGenreChange = { selectedGenre = it },
                    mangas = when (selectedTab) {
                        AppTab.FAVORITES -> favorites
                        AppTab.HISTORY -> history
                        else -> mangas
                    }.let { list ->
                        if (selectedGenre == null) {
                            list
                        } else {
                            list.filter { item ->
                                item.genres.any {
                                    it.equals(selectedGenre, true)
                                }
                            }
                        }
                    },
                    loading = loading,
                    errorMessage = errorMessage,
                    onRefresh = { loadManga(searchText) },
                    onMangaClick = { selectedManga = it }
                )
            }
        }
    }
}

@Composable
private fun HomeScreen(
    source: SourceType,
    onSourceChange: (SourceType) -> Unit,
    searchText: String,
    onSearchTextChange: (String) -> Unit,
    onSearch: () -> Unit,
    selectedTab: AppTab,
    onTabChange: (AppTab) -> Unit,
    selectedGenre: String?,
    onGenreChange: (String?) -> Unit,
    mangas: List<Manga>,
    loading: Boolean,
    errorMessage: String?,
    onRefresh: () -> Unit,
    onMangaClick: (Manga) -> Unit
) {
    val genres = listOf(
        "Action", "Adventure", "Comedy", "Drama",
        "Fantasy", "Romance", "School Life", "Shounen"
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 14.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 16.dp, bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    "MangaNhanh",
                    fontSize = 26.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = Foreground
                )
                Text(
                    "Đọc truyện tranh mỗi ngày",
                    fontSize = 12.sp,
                    color = Muted
                )
            }

            Text(
                "● ONLINE",
                color = Accent,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold
            )
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            SourceType.values().forEach { item ->
                Surface(
                    color = if (source == item) Accent else Panel,
                    shape = RoundedCornerShape(18.dp),
                    modifier = Modifier
                        .clip(RoundedCornerShape(18.dp))
                        .clickable { onSourceChange(item) }
                ) {
                    Text(
                        item.label,
                        modifier = Modifier.padding(
                            horizontal = 14.dp,
                            vertical = 9.dp
                        ),
                        color = Foreground,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }

        Spacer(Modifier.height(12.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = searchText,
                onValueChange = onSearchTextChange,
                modifier = Modifier.weight(1f),
                singleLine = true,
                placeholder = {
                    Text("Tìm tên truyện...", color = Muted)
                },
                leadingIcon = {
                    Icon(
                        Icons.Default.Search,
                        contentDescription = "Tìm kiếm"
                    )
                },
                shape = RoundedCornerShape(14.dp)
            )

            Spacer(Modifier.width(8.dp))

            Button(
                onClick = onSearch,
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("Tìm")
            }
        }

        Spacer(Modifier.height(12.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            AppTab.values().forEach { tab ->
                val icon = when (tab) {
                    AppTab.HOME -> Icons.Default.Home
                    AppTab.RANKING -> Icons.Default.Home
                    AppTab.GENRES -> Icons.Default.Search
                    AppTab.FAVORITES -> Icons.Default.Favorite
                    AppTab.HISTORY -> Icons.Default.History
                }

                Surface(
                    color = if (selectedTab == tab) Accent else Panel,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .weight(1f)
                        .clickable {
                            onTabChange(tab)
                            if (tab != AppTab.GENRES) {
                                onGenreChange(null)
                            }
                        }
                ) {
                    Column(
                        modifier = Modifier.padding(
                            vertical = 9.dp,
                            horizontal = 2.dp
                        ),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            icon,
                            contentDescription = tab.label,
                            tint = Foreground,
                            modifier = Modifier.size(17.dp)
                        )
                        Spacer(Modifier.height(3.dp))
                        Text(
                            tab.label,
                            fontSize = 9.sp,
                            color = Foreground,
                            maxLines = 1
                        )
                    }
                }
            }
        }

        if (selectedTab == AppTab.GENRES) {
            Spacer(Modifier.height(12.dp))
            Text(
                "Chọn thể loại",
                fontWeight = FontWeight.Bold,
                color = Foreground
            )
            Spacer(Modifier.height(8.dp))

            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                genres.chunked(3).forEach { rowGenres ->
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        rowGenres.forEach { genre ->
                            FilterChip(
                                selected = selectedGenre == genre,
                                onClick = {
                                    onGenreChange(
                                        if (selectedGenre == genre) {
                                            null
                                        } else {
                                            genre
                                        }
                                    )
                                },
                                label = {
                                    Text(genre, fontSize = 11.sp)
                                }
                            )
                        }
                    }
                }
            }
        }

        Spacer(Modifier.height(12.dp))

        when {
            loading -> {
                Box(
                    Modifier.fillMaxWidth().weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = Accent)
                }
            }

            errorMessage != null -> {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        "Không tải được truyện",
                        color = Foreground,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        errorMessage,
                        color = Muted,
                        fontSize = 12.sp
                    )
                    Spacer(Modifier.height(12.dp))
                    Button(onClick = onRefresh) {
                        Text("Thử lại")
                    }
                }
            }

            mangas.isEmpty() -> {
                EmptyMessage(
                    title = "Chưa có truyện để hiển thị",
                    subtitle = "Kiểm tra kết nối hoặc thử nguồn truyện khác."
                )
            }

            else -> {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(9.dp),
                    contentPadding = PaddingValues(bottom = 20.dp)
                ) {
                    items(mangas, key = { it.url }) { manga ->
                        MangaCard(
                            manga = manga,
                            onClick = { onMangaClick(manga) }
                        )
                    }
                }
            }
        }
    }
}
@Composable
private fun MangaCard(
    manga: Manga,
    onClick: () -> Unit
) {
    Surface(
        color = Panel,
        shape = RoundedCornerShape(15.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(
                manga.title,
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                color = Foreground,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(Modifier.height(5.dp))

            Text(
                manga.description.ifBlank {
                    "Nhấn để xem thông tin và danh sách chương."
                },
                fontSize = 12.sp,
                color = Muted,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            if (manga.genres.isNotEmpty()) {
                Spacer(Modifier.height(7.dp))
                Text(
                    manga.genres.take(4).joinToString(" · "),
                    fontSize = 10.sp,
                    color = Accent
                )
            }
        }
    }
}

@Composable
private fun DetailScreen(
    manga: Manga,
    isFavorite: Boolean,
    onBack: () -> Unit,
    onFavorite: () -> Unit,
    onOpenChapter: (Chapter) -> Unit
) {
    Column(
        Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) {
                Icon(
                    Icons.Default.ArrowBack,
                    contentDescription = "Quay lại"
                )
            }

            Text(
                "Chi tiết truyện",
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp
            )

            Spacer(Modifier.weight(1f))

            IconButton(onClick = onFavorite) {
                Icon(
                    Icons.Default.Favorite,
                    contentDescription = "Yêu thích",
                    tint = if (isFavorite) Accent else Muted
                )
            }
        }

        Spacer(Modifier.height(12.dp))

        Text(
            manga.title,
            fontSize = 23.sp,
            fontWeight = FontWeight.ExtraBold
        )

        Spacer(Modifier.height(8.dp))

        Text(
            manga.description.ifBlank {
                "Chưa có mô tả cho truyện này."
            },
            color = Muted,
            fontSize = 13.sp
        )

        Spacer(Modifier.height(10.dp))

        if (manga.genres.isNotEmpty()) {
            Text(
                manga.genres.joinToString(" · "),
                color = Accent,
                fontSize = 12.sp
            )
        }

        Spacer(Modifier.height(18.dp))

        Text(
            "Danh sách chương",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold
        )

        Spacer(Modifier.height(8.dp))

        if (manga.chapters.isEmpty()) {
            EmptyMessage(
                "Chưa lấy được danh sách chương",
                "Trang nguồn có thể đã thay đổi cấu trúc."
            )
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(7.dp)
            ) {
                items(manga.chapters) { chapter ->
                    Surface(
                        color = Panel,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                onOpenChapter(chapter)
                            }
                    ) {
                        Text(
                            chapter.title,
                            modifier = Modifier.padding(14.dp),
                            color = Foreground
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ReaderScreen(
    chapter: Chapter,
    pages: List<String>,
    loading: Boolean,
    onBack: () -> Unit,
    onReload: () -> Unit
) {
    Column(
        Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) {
                Icon(
                    Icons.Default.ArrowBack,
                    contentDescription = "Quay lại"
                )
            }

            Column(Modifier.weight(1f)) {
                Text(
                    "Đang đọc",
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp
                )

                Text(
                    chapter.title,
                    color = Muted,
                    fontSize = 11.sp,
                    maxLines = 1
                )
            }
        }

        when {
            loading -> {
                Box(
                    Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = Accent)
                }
            }

            pages.isEmpty() -> {
                EmptyMessage(
                    "Không tải được trang truyện",
                    "Thử tải lại hoặc quay lại danh sách chương."
                ) {
                    onReload()
                }
            }

            else -> {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(pages) { url ->
                        Text(
                            "Ảnh trang truyện: $url",
                            color = Muted,
                            fontSize = 11.sp
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyMessage(
    title: String,
    subtitle: String,
    action: (() -> Unit)? = null
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            title,
            color = Foreground,
            fontWeight = FontWeight.Bold
        )

        Spacer(Modifier.height(6.dp))

        Text(
            subtitle,
            color = Muted,
            fontSize = 12.sp
        )

        if (action != null) {
            Spacer(Modifier.height(12.dp))

            Button(onClick = action) {
                Text("Tải lại")
            }
        }
    }
}

private object MangaScraper {
    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(25, TimeUnit.SECONDS)
        .followRedirects(true)
        .build()

    private fun fetch(url: String): Document {
        val request = Request.Builder()
            .url(url)
            .header(
                "User-Agent",
                "Mozilla/5.0 (Android 14; Mobile) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36"
            )
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                error("HTTP ${response.code}")
            }

            val html = response.body?.string()
                ?: error("Trang không có nội dung")

            return Jsoup.parse(html, url)
        }
    }

    fun latest(source: SourceType): List<Manga> {
        val doc = fetch(source.baseUrl)
        return parseMangaCards(doc, source).take(60)
    }

    fun search(
        source: SourceType,
        query: String
    ): List<Manga> {
        val encoded = URLEncoder.encode(query, "UTF-8")

        val candidates = listOf(
            "${source.baseUrl}/tim-truyen?keyword=$encoded",
            "${source.baseUrl}/search?keyword=$encoded",
            "${source.baseUrl}/tim-kiem?keyword=$encoded"
        )

        for (url in candidates) {
            val result = runCatching {
                parseMangaCards(fetch(url), source)
            }.getOrDefault(emptyList())

            if (result.isNotEmpty()) {
                return result.take(60)
            }
        }

        return emptyList()
    }

    private fun parseMangaCards(
        doc: Document,
        source: SourceType
    ): List<Manga> {
        val selectors = listOf(
            ".item",
            ".comic-item",
            ".book-item",
            ".list-truyen .row",
            ".search-story-item",
            "article"
        )

        val elements = selectors
            .asSequence()
            .map { doc.select(it) }
            .firstOrNull { it.size > 0 }
            ?: doc.select("a[href]")

        val output = LinkedHashMap<String, Manga>()

        for (element in elements) {
            val anchor = if (element.tagName() == "a") {
                element
            } else {
                element.selectFirst("a[href]") ?: continue
            }

            val title = anchor.attr("title")
                .ifBlank { anchor.text().trim() }
                .ifBlank {
                    element.selectFirst("img")
                        ?.attr("alt")
                        .orEmpty()
                }

            val href = anchor.absUrl("href")
                .ifBlank { anchor.attr("href") }

            if (title.length < 2) continue
            if (href.isBlank() || !href.startsWith("http")) continue
            if (href.contains("javascript:")) continue
            if (href == source.baseUrl) continue

            val imageElement = element.selectFirst("img")

            val image = imageElement?.let {
                it.absUrl("data-src")
                    .ifBlank { it.absUrl("data-original") }
                    .ifBlank { it.absUrl("src") }
            }.orEmpty()

            val description = element
                .selectFirst(
                    ".chapter, .latest-chapter, .summary, .description"
                )
                ?.text()
                ?.trim()
                .orEmpty()

            output.putIfAbsent(
                href,
                Manga(
                    title = title,
                    url = href,
                    image = image,
                    description = description,
                    source = source
                )
            )
        }

        return output.values.toList()
    }

    fun details(manga: Manga): Manga {
        val doc = fetch(manga.url)

        val title = doc
            .selectFirst("h1, .title-detail, .detail-title")
            ?.text()
            ?.trim()
            .orEmpty()
            .ifBlank { manga.title }

        val description = doc
            .selectFirst(
                ".detail-content, .description, .story-detail-info, #item-detail"
            )
            ?.text()
            ?.trim()
            .orEmpty()

        val genres = doc
            .select(
                ".kind a, .genres a, .detail-content a[href*='the-loai']"
            )
            .map { it.text().trim() }
            .filter { it.isNotBlank() }
            .distinct()

        val chapterElements = doc.select(
            ".list-chapter a[href], " +
                ".chapter-list a[href], " +
                ".works-chapter-list a[href], " +
                "a[href*='chapter']"
        )

        val chapters = chapterElements
            .mapNotNull { anchor ->
                val href = anchor.absUrl("href")
                val name = anchor.text().trim()

                if (href.startsWith("http") && name.isNotBlank()) {
                    Chapter(name, href)
                } else {
                    null
                }
            }
            .distinctBy { it.url }

        return manga.copy(
            title = title,
            description = description,
            genres = genres,
            chapters = chapters
        )
    }

    fun chapterPages(url: String): List<String> {
        val doc = fetch(url)

        val selectors = listOf(
            ".reading-detail img",
            ".reading-content img",
            ".chapter-content img",
            "#chapter-content img",
            ".page-chapter img",
            "img"
        )

        for (selector in selectors) {
            val images = doc.select(selector)
                .mapNotNull { img ->
                    val value = img.absUrl("data-src")
                        .ifBlank { img.absUrl("data-original") }
                        .ifBlank { img.absUrl("src") }

                    value.takeIf {
                        it.startsWith("http") &&
                            !it.contains("logo", true)
                    }
                }
                .distinct()

            if (images.isNotEmpty()) {
                return images
            }
        }

        return emptyList()
    }
}
