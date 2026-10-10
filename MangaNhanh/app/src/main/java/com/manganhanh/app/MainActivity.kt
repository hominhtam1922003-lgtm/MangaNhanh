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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
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
import coil.ImageLoader
import coil.compose.AsyncImage
import coil.request.CachePolicy
import coil.request.ImageRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.ConnectionPool
import okhttp3.OkHttpClient
import okhttp3.Request
import org.jsoup.Connection
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

data class Manga(
    val title: String,
    val link: String,
    val cover: String,
    val latestChap: String
)

data class Chapter(
    val title: String,
    val link: String
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
    val domains = listOf("https://nettruyenvn.info", "https://nettruyenin.com", "https://www.nettruyenww.com")
    var currentDomain = domains[0]

    suspend fun checkWorkingDomain() = withContext(Dispatchers.IO) {
        for (d in domains) {
            try {
                val res = Jsoup.connect(d)
                    .userAgent(UA)
                    .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")
                    .header("Accept-Language", "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7")
                    .timeout(6000)
                    .execute()
                if (res.statusCode() == 200 && res.parse().select(".items .item, .comic-item").isNotEmpty()) {
                    currentDomain = d
                    break
                }
            } catch (_: Exception) {}
        }
    }
}

// Hàm tiện ích giúp kết nối Jsoup vượt qua các bộ lọc cơ bản
fun connectSafe(url: String): Connection {
    return Jsoup.connect(url)
        .userAgent(UA)
        .referrer(Sources.currentDomain)
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8")
        .header("Accept-Language", "vi-VN,vi;q=0.9")
        .header("Connection", "keep-alive")
        .timeout(15000)
        .followRedirects(true)
}

object Scraper {
    suspend fun loadManga(query: String = "", genreUrl: String = "", isRanking: Boolean = false): List<Manga> = withContext(Dispatchers.IO) {
        val list = mutableListOf<Manga>()
        val base = Sources.currentDomain
        try {
            val targetUrl = when {
                genreUrl.isNotBlank() -> genreUrl
                query.isNotBlank() -> "$base/tim-truyen?keyword=${URLEncoder.encode(query, "UTF-8")}"
                isRanking -> "$base/hot"
                else -> "$base/trang-chu"
            }

            val doc = connectSafe(targetUrl).get()

            for (item in doc.select(".items .item, .list-items .item, div.item, .comic-item")) {
                val titleEl = item.select(".title a, h3 a, figcaption a, .comic-title a").first() ?: continue
                val title = titleEl.text().trim()
                var link = titleEl.attr("href")
                if (!link.startsWith("http")) link = if (link.startsWith("/")) "$base$link" else "$base/$link"

                val imgEl = item.select("img").first()
                var img = imgEl?.attr("data-original").orEmpty().ifBlank { imgEl?.attr("data-src").orEmpty().ifBlank { imgEl?.attr("src").orEmpty() } }
                if (img.startsWith("//")) img = "https:$img"
                else if (img.isNotBlank() && !img.startsWith("http")) img = "$base/$img"

                val chap = item.select(".chapter a, .comic-item-chapter a, ul.list-chap li:first-child a").first()?.text()?.trim() ?: "Mới"
                if (title.isNotBlank()) list.add(Manga(title, link, img, chap))
            }
        } catch (_: Exception) {}
        list
    }

    suspend fun loadGenres(): List<Genre> = withContext(Dispatchers.IO) {
        val genres = mutableListOf<Genre>()
        val base = Sources.currentDomain
        try {
            val doc = connectSafe(base).get()
            val elements = doc.select(".nav-item.dropdown ul.dropdown-menu li a, .sub-menu li a, .genre-item a, ul.genre-list li a")
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
        val base = Sources.currentDomain
        try {
            val doc: Document = connectSafe(manga.link).get()
            
            val descEl = doc.select(".detail-content p, .comic-description, .detail-summary, .summary-content").first()
            if (descEl != null && descEl.text().isNotBlank()) {
                desc = descEl.text().trim()
            }

            // Bóc tách ID truyện từ trang chi tiết để gọi thẳng vào API lấy full toàn bộ danh sách chương không bị giới hạn 20 chương
            var comicId = ""
            val ratingEl = doc.select("[data-id]").first()
            if (ratingEl != null) {
                comicId = ratingEl.attr("data-id")
            }
            if (comicId.isBlank()) {
                for (script in doc.select("script")) {
                    val text = script.html()
                    if (text.contains("comicId") || text.contains("id_comic")) {
                        val match = Regex("""(comicId|id_comic)\s*[:=]\s*(\d+)""").find(text)
                        if (match != null) {
                            comicId = match.groupValues[2]
                            break
                        }
                    }
                }
            }

            if (comicId.isNotBlank()) {
                try {
                    val apiLink = "$base/Comic/Chapter/ListChapter?comicId=$comicId"
                    val apiDoc = connectSafe(apiLink).referrer(manga.link).get()
                    val apiRows = apiDoc.select("li, .row, a")
                    for (el in apiRows) {
                        val a = if (el.tagName() == "a") el else el.select("a").first() ?: continue
                        val t = a.text().trim()
                        var url = a.attr("href")
                        if (url.isNotBlank()) {
                            if (!url.startsWith("http")) url = if (url.startsWith("/")) "$base$url" else "$base/$url"
                            if (t.isNotBlank() && chapters.none { it.link == url }) {
                                chapters.add(Chapter(t, url))
                            }
                        }
                    }
                } catch (_: Exception) {}
            }

            // Dự phòng quét danh sách thông thường trên trang
            if (chapters.isEmpty()) {
                val rows: Elements = doc.select("#nt_listchapter li, .list-chapter li, ul.list-chapter li, .chapter-list div.row")
                for (row: Element in rows) {
                    val a: Element = row.select("a").first() ?: continue
                    val t = a.text().trim()
                    var url = a.attr("href")
                    if (!url.startsWith("http")) {
                        url = if (url.startsWith("/")) "$base$url" else "$base/$url"
                    }
                    if (t.isNotBlank() && chapters.none { it.link == url }) {
                        chapters.add(Chapter(t, url))
                    }
                }
            }
        } catch (_: Exception) {}
        Pair(desc, chapters)
    }

    suspend fun loadPages(chapter: Chapter): List<String> = withContext(Dispatchers.IO) {
        val pages = mutableListOf<String>()
        val base = Sources.currentDomain
        try {
            val doc = connectSafe(chapter.link).get()
            for (img in doc.select(".page-chapter img, .reading-detail img, .chapter-content img")) {
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

fun buildCoilLoader(context: Context): ImageLoader {
    val okHttpClient = OkHttpClient.Builder()
        .addInterceptor { chain ->
            val req = chain.request().newBuilder()
                .header("User-Agent", UA)
                .header("Referer", Sources.currentDomain)
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
    var favorites by remember { mutableStateOf(setOf<String>()) }
    var isInitialized by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        Sources.checkWorkingDomain()
        isInitialized = true
    }

    MaterialTheme(colorScheme = darkColorScheme(background = DarkBg, surface = CardBg)) {
        Surface(Modifier.fillMaxSize(), color = DarkBg) {
            if (!isInitialized) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = AccentColor)
                }
            } else {
                when {
                    readingSession != null && curManga != null -> {
                        ReaderView(
                            manga = curManga!!,
                            chapter = readingSession!!.first,
                            allChapters = readingSession!!.second,
                            onBack = { readingSession = null },
                            onSelectChapter = { newChap -> readingSession = Pair(newChap, readingSession!!.second) }
                        )
                    }
                    curManga != null -> {
                        DetailView(
                            manga = curManga!!,
                            isFav = favorites.contains(curManga!!.link),
                            onToggleFav = {
                                favorites = if (favorites.contains(curManga!!.link)) favorites - curManga!!.link else favorites + curManga!!.link
                            },
                            onRead = { chap, listChaps -> readingSession = Pair(chap, listChaps) },
                            onBack = { curManga = null }
                        )
                    }
                    else -> {
                        HomeView(
                            onSelectManga = { curManga = it },
                            favorites = favorites
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun HomeView(
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
    val loader = remember { buildCoilLoader(context) }

    LaunchedEffect(tab, selectedGenre, query) {
        loading = true
        if (tab == 2 && genres.isEmpty()) {
            genres = Scraper.loadGenres()
        }
        list = when {
            tab == 1 -> Scraper.loadManga(isRanking = true)
            tab == 2 && selectedGenre != null -> Scraper.loadManga(genreUrl = selectedGenre!!.url)
            tab == 3 -> Scraper.loadManga(query).filter { favorites.contains(it.link) }
            else -> Scraper.loadManga(query)
        }
        loading = false
    }

    Column(Modifier.fillMaxSize().statusBarsPadding()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("MANGA NHANH", color = AccentColor, fontWeight = FontWeight.ExtraBold, fontSize = 22.sp)
        }

        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
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
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(genres) { genre ->
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(CardBg)
                                .clickable { selectedGenre = genre }
                                .padding(16.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(genre.name, color = TextMain, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                    }
                }
            } else {
                if (tab == 2 && selectedGenre != null) {
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Thể loại: ${selectedGenre!!.name}", color = AccentColor, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Spacer(Modifier.weight(1f))
                        TextButton(onClick = { selectedGenre = null }) {
                            Text("Đổi thể loại", color = TextSub, fontSize = 12.sp)
                        }
                    }
                }

                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(list) { m ->
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(CardBg)
                                .clickable { onSelectManga(m) }
                                .padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            AsyncImage(
                                model = ImageRequest.Builder(context).data(m.cover).crossfade(true).build(),
                                imageLoader = loader,
                                contentDescription = m.title,
                                modifier = Modifier.size(70.dp, 95.dp).clip(RoundedCornerShape(8.dp)),
                                contentScale = ContentScale.Crop
                            )
                            Spacer(Modifier.width(14.dp))
                            Column(Modifier.weight(1f)) {
                                Text(m.title, color = TextMain, fontWeight = FontWeight.Bold, fontSize = 15.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                Spacer(Modifier.height(6.dp))
                                Text(m.latestChap, color = AccentColor, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun DetailView(
    manga: Manga,
    isFav: Boolean,
    onToggleFav: () -> Unit,
    onRead: (Chapter, List<Chapter>) -> Unit,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    var desc by remember { mutableStateOf("Đang tải dữ liệu...") }
    var chaps by remember { mutableStateOf<List<Chapter>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    val loader = remember { buildCoilLoader(context) }

    LaunchedEffect(manga.link) {
        val (d, c) = Scraper.loadDetails(manga)
        desc = d
        chaps = c
        loading = false
    }

    Column(Modifier.fillMaxSize().statusBarsPadding()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = TextMain)
            }
            Text("Chi tiết", color = TextMain, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.weight(1f))
            IconButton(onClick = onToggleFav) {
                Icon(if (isFav) Icons.Default.Favorite else Icons.Default.FavoriteBorder, null, tint = AccentColor)
            }
        }

        Row(Modifier.fillMaxWidth().padding(16.dp)) {
            AsyncImage(
                model = ImageRequest.Builder(context).data(manga.cover).crossfade(true).build(),
                imageLoader = loader,
                contentDescription = null,
                modifier = Modifier.size(95.dp, 135.dp).clip(RoundedCornerShape(10.dp)),
                contentScale = ContentScale.Crop
            )
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(manga.title, color = TextMain, fontWeight = FontWeight.Bold, fontSize = 17.sp, maxLines = 3)
                Spacer(Modifier.height(8.dp))
                Text(manga.latestChap, color = AccentColor, fontSize = 13.sp)
            }
        }

        Text(
            text = desc,
            color = TextSub,
            fontSize = 13.sp,
            maxLines = 3,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = 16.dp)
        )

        Spacer(Modifier.height(14.dp))
        Text(
            "DANH SÁCH CHƯƠNG (${chaps.size})",
            color = TextMain,
            fontWeight = FontWeight.Bold,
            fontSize = 14.sp,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
        )

        if (loading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = AccentColor)
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                items(chaps) { chap ->
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(CardBg)
                            .clickable { onRead(chap, chaps) }
                            .padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(chap.title, color = TextMain, fontSize = 14.sp, modifier = Modifier.weight(1f))
                        Text("Đọc ngay", color = AccentColor, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
fun ReaderView(
    manga: Manga,
    chapter: Chapter,
    allChapters: List<Chapter>,
    onBack: () -> Unit,
    onSelectChapter: (Chapter) -> Unit
) {
    val context = LocalContext.current
    var pages by remember { mutableStateOf<List<String>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    val loader = remember { buildCoilLoader(context) }

    val currentIndex = allChapters.indexOfFirst { it.link == chapter.link }
    val prevChapter = if (currentIndex != -1 && currentIndex < allChapters.size - 1) allChapters[currentIndex + 1] else null
    val nextChapter = if (currentIndex != -1 && currentIndex > 0) allChapters[currentIndex - 1] else null

    LaunchedEffect(chapter.link) {
        loading = true
        pages = Scraper.loadPages(chapter)
        loading = false
    }

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        if (loading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = AccentColor)
            }
        } else {
            LazyColumn(Modifier.fillMaxSize()) {
                items(pages) { url ->
                    AsyncImage(
                        model = ImageRequest.Builder(context)
                            .data(url)
                            .crossfade(true)
                            .build(),
                        imageLoader = loader,
                        contentDescription = null,
                        modifier = Modifier.fillMaxWidth().wrapContentHeight(),
                        contentScale = ContentScale.FillWidth
                    )
                }
            }
        }

        Column(
            Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .background(Color.Black.copy(alpha = 0.85f))
        ) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = Color.White)
                }
                Column(Modifier.weight(1f)) {
                    Text(manga.title, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                    Text(chapter.title, color = Color.LightGray, fontSize = 11.sp, maxLines = 1)
                }

                IconButton(
                    onClick = { if (prevChapter != null) onSelectChapter(prevChapter) },
                    enabled = prevChapter != null
                ) {
                    Icon(
                        Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                        contentDescription = "Chap trước",
                        tint = if (prevChapter != null) Color.White else Color.DarkGray
                    )
                }

                IconButton(
                    onClick = { if (nextChapter != null) onSelectChapter(nextChapter) },
                    enabled = nextChapter != null
                ) {
                    Icon(
                        Icons.AutoMirrored.Filled.KeyboardArrowRight,
                        contentDescription = "Chap sau",
                        tint = if (nextChapter != null) Color.White else Color.DarkGray
                    )
                }
            }
        }
    }
}
