package com.manganhanh.app

import android.graphics.BitmapFactory
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
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

/* ---------- Màu & Theme ---------- */
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

/* ---------- Data ---------- */
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

/* ---------- App chính ---------- */
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
                    if (query.isBlank()) MangaScraper.latest(source) else MangaScraper.search(source, query)
                }
            }
            result.onSuccess { mangas = it }
                .onFailure { errorMessage = it.message ?: "Không tải được dữ liệu." }
            loading = false
        }
    }

    LaunchedEffect(source) { loadManga() }

    Surface(modifier = Modifier.fillMaxSize(), color = AppBackground) {
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
                                runCatching { MangaScraper.chapterPages(selectedChapter!!.url) }.getOrDefault(emptyList())
                            }
                            loading = false
                        }
                    }
                )

                selectedManga != null -> DetailScreen(
                    manga = selectedManga!!,
                    isFavorite = favorites.any { it.url == selectedManga!!.url },
                    onBack = { selectedManga = null },
                    onFavorite = {
                        val current = selectedManga!!
                        favorites = if (favorites.any { it.url == current.url })
                            favorites.filterNot { it.url == current.url }
                        else listOf(current) + favorites
                    },
                    onOpenChapter = { chapter ->
                        selectedChapter = chapter
                        history = listOf(selectedManga!!) + history.filterNot { it.url == selectedManga!!.url }
                        scope.launch {
                            loading = true
                            readerPages = withContext(Dispatchers.IO) {
                                runCatching { MangaScraper.chapterPages(chapter.url) }.getOrDefault(emptyList())
                            }
                            loading = false
                        }
                    }
                )

                else -> HomeScreen(
                    source = source,
                    onSourceChange = { source = it; selectedGenre = null },
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
                        if (selectedGenre == null) list else list.filter { item ->
                            item.genres.any { it.equals(selectedGenre, true) }
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

/* ---------- Home ---------- */
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
        modifier = Modifier.fillMaxSize().padding(horizontal = 14.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth().padding(top = 16.dp, bottom = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text("MangaNhanh", fontSize = 26.sp, fontWeight = FontWeight.ExtraBold, color = Foreground)
                Text("Đọc truyện tranh mỗi ngày", fontSize = 12.sp, color = Muted)
            }
            Text("● ONLINE", color = Accent, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            SourceType.values().forEach { item ->
                Surface(
                    color = if (source == item) Accent else Panel,
                    shape = RoundedCornerShape(18.dp),
                    modifier = Modifier.clip(RoundedCornerShape(18.dp)).clickable { onSourceChange(item) }
                ) {
                    Text(
                        item.label,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 9.dp),
                        color = Foreground,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }

        Spacer(Modifier.height(12.dp))

        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = searchText,
                onValueChange = onSearchTextChange,
                modifier = Modifier.weight(1f),
                singleLine = true,
                placeholder = { Text("Tìm tên truyện...", color = Muted) },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Tìm") },
                shape = RoundedCornerShape(14.dp)
            )
            Spacer(Modifier.width(8.dp))
            Button(onClick = onSearch, shape = RoundedCornerShape(12.dp)) { Text("Tìm") }
        }

        Spacer(Modifier.height(12.dp))

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            AppTab.values().forEach { tab ->
                val icon = when (tab) {
                    AppTab.HOME -> Icons.Default.Home
                    AppTab.RANKING -> Icons.Default.Star      // SỬA: không còn Home
                    AppTab.GENRES -> Icons.Default.Search
                    AppTab.FAVORITES -> Icons.Default.Favorite
                    AppTab.HISTORY -> Icons.Default.History     // SỬA: thêm import
                }
                Surface(
                    color = if (selectedTab == tab) Accent else Panel,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f).clickable {
                        onTabChange(tab)
                        if (tab != AppTab.GENRES) onGenreChange(null)
                    }
                ) {
                    Column(
                        modifier = Modifier.padding(vertical = 9.dp, horizontal = 2.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(icon, contentDescription = tab.label, tint = Foreground, modifier = Modifier.size(17.dp))
                        Spacer(Modifier.height(3.dp))
                        Text(tab.label, fontSize = 9.sp, color = Foreground, maxLines = 1)
                    }
                }
            }
        }

        if (selectedTab == AppTab.GENRES) {
            Spacer(Modifier.height(12.dp))
            Text("Chọn thể loại", fontWeight = FontWeight.Bold, color = Foreground)
            Spacer(Modifier.height(8.dp))
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                genres.chunked(3).forEach { rowGenres ->
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        rowGenres.forEach { genre ->
                            FilterChip(
                                selected = selectedGenre == genre,
                                onClick = {
                                    onGenreChange(if (selectedGenre == genre) null else genre)
                                },
                                label = { Text(genre, fontSize = 11.sp) }
                            )
                        }
                    }
                }
            }
        }

        Spacer(Modifier.height(12.dp))

        when {
            loading -> Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Accent)
            }
            errorMessage != null -> Column(
                modifier = Modifier.fillMaxWidth().weight(1f),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text("Không tải được truyện", color = Foreground, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(6.dp))
                Text(errorMessage!!, color = Muted, fontSize = 12.sp)
                Spacer(Modifier.height(12.dp))
                Button(onClick = onRefresh) { Text("Thử lại") }
            }
            mangas.isEmpty() -> EmptyMessage(
                title = "Chưa có truyện để hiển thị",
                subtitle = "Kiểm tra kết nối hoặc thử nguồn truyện khác."
            )
            else -> LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(9.dp),
                contentPadding = PaddingValues(bottom = 20.dp)
            ) {
                items(mangas, key = { it.url }) { manga ->
                    MangaCard(manga = manga, onClick = { onMangaClick(manga) })
                }
            }
        }
    }
}

/* ---------- Card ---------- */
@Composable
private fun MangaCard(manga: Manga, onClick: () -> Unit) {
    Surface(
        color = Panel,
        shape = RoundedCornerShape(15.dp),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick)
    ) {
        Row(modifier = Modifier.padding(14.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            if (manga.image.isNotBlank()) {
                NetworkImage(
                    url = manga.image,
                    modifier = Modifier.size(100.dp, 130.dp).clip(RoundedCornerShape(10.dp)).background(Panel)
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    manga.title, fontWeight = FontWeight.Bold, fontSize = 15.sp,
                    color = Foreground, maxLines = 2, overflow = TextOverflow.Ellipsis
                )
                Spacer(Modifier.height(5.dp))
                Text(
                    manga.description.ifBlank { "Nhấn để xem thông tin và danh sách chương." },
                    fontSize = 12.sp, color = Muted, maxLines = 2, overflow = TextOverflow.Ellipsis
                )
                if (manga.genres.isNotEmpty()) {
                    Spacer(Modifier.height(7.dp))
                    Text(
                        manga.genres.take(3).joinToString(" · "),
                        fontSize = 10.sp, color = Accent
                    )
                }
            }
        }
    }
}

/* ---------- Chi tiết ---------- */
@Composable
private fun DetailScreen(
    manga: Manga,
    isFavorite: Boolean,
    onBack: () -> Unit,
    onFavorite: () -> Unit,
    onOpenChapter: (Chapter) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Quay lại") }
                Spacer(Modifier.width(8.dp))
                Text("Chi tiết truyện", fontWeight = FontWeight.Bold, fontSize = 20.sp, modifier = Modifier.weight(1f))
                IconButton(onClick = onFavorite) {
                    Icon(Icons.Default.Favorite, contentDescription = "Yêu thích", tint = if (isFavorite) Accent else Muted)
                }
            }
        }

        item {
            Text(manga.title, fontSize = 23.sp, fontWeight = FontWeight.ExtraBold, color = Foreground, lineHeight = 28.sp)
        }

        item {
            Text(
                manga.description.ifBlank { "Chưa có mô tả cho truyện này." },
                color = Muted, fontSize = 13.sp
            )
        }

        if (manga.genres.isNotEmpty()) {
            item {
                Text(
                    "Thể loại: ${manga.genres.joinToString(", ")}",
                    fontSize = 12.sp, color = Accent, fontWeight = FontWeight.SemiBold
                )
            }
        }

        item {
            Spacer(modifier = Modifier.height(4.dp))
            Text("Danh sách chương", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Foreground)
        }

        if (manga.chapters.isEmpty()) {
            item { Text("Chưa có chương nào.", color = Muted, fontSize = 13.sp) }
        } else {
            items(manga.chapters, key = { it.url }) { chapter ->
                Surface(color = Panel, shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth()
                            .clickable { onOpenChapter(chapter) }
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            chapter.title,
                            fontWeight = FontWeight.Medium,
                            color = Foreground,
                            fontSize = 14.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f)
                        )
                        Spacer(Modifier.width(8.dp))
                        Text("Đọc", color = Accent, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                }
            }
        }
    }
}

/* ---------- Đọc trang ---------- */
@Composable
private fun ReaderScreen(
    chapter: Chapter,
    pages: List<String>,
    loading: Boolean,
    onBack: () -> Unit,
    onReload: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(chapter.title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Quay lại") }
                },
                actions = {
                    IconButton(onClick = onReload) { Icon(Icons.Default.Refresh, contentDescription = "Tải lại") }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = AppBackground)
            )
        }
    ) { inner ->
        Box(modifier = Modifier.padding(inner).fillMaxSize().background(AppBackground)) {
            when {
                loading && pages.isEmpty() -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Accent)
                }
                pages.isEmpty() -> Column(
                    modifier = Modifier.fillMaxSize(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text("Không tải được trang", color = Foreground, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(8.dp))
                    Button(onClick = onReload) { Text("Thử lại") }
                }
                else -> LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                    contentPadding = PaddingValues(8.dp)
                ) {
                    items(pages, key = { it }) { url ->
                        NetworkImage(
                            url = url,
                            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp))
                        )
                    }
                }
            }
        }
    }
}

/* ---------- Hỗ trợ tải ảnh từ URL ---------- */
@Composable
private fun NetworkImage(url: String, modifier: Modifier = Modifier) {
    var bitmap by remember(url) { mutableStateOf<android.graphics.Bitmap?>(null) }

    LaunchedEffect(url) {
        val result = withContext(Dispatchers.IO) {
            runCatching {
                val client = OkHttpClient.Builder()
                    .connectTimeout(15, TimeUnit.SECONDS)
                    .readTimeout(15, TimeUnit.SECONDS)
                    .build()
                val request = Request.Builder().url(url).build()
                client.newCall(request).execute().use { response ->
                    if (response.isSuccessful) {
                        response.body?.byteStream()?.use { stream ->
                            BitmapFactory.decodeStream(stream)
                        }
                    } else null
                }
            }.getOrNull()
        }
        bitmap = result
    }

    if (bitmap != null) {
        Image(
            bitmap = bitmap!!.asImageBitmap(),
            contentDescription = null,
            modifier = modifier
        )
    } else {
        Box(modifier = modifier.background(Panel), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp, color = Accent)
        }
    }
}

/* ---------- Empty message ---------- */
@Composable
private fun EmptyMessage(title: String, subtitle: String) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(title, fontWeight = FontWeight.Bold, color = Foreground, fontSize = 16.sp, textAlign = TextAlign.Center)
        Spacer(Modifier.height(6.dp))
        Text(subtitle, color = Muted, fontSize = 12.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 32.dp))
    }
}

/* ---------- Scraper stub (bạn thay bằng code thật) ---------- */
object MangaScraper {
    fun latest(source: SourceType): List<Manga> = emptyList()
    fun search(source: SourceType, query: String): List<Manga> = emptyList()
    fun chapterPages(chapterUrl: String): List<String> = emptyList()
}
