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
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
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

object ApiClient {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    suspend fun getJson(url: String): String = withContext(Dispatchers.IO) {
        try {
            val req = Request.Builder().url(url).header("User-Agent", UA).build()
            val res = client.newCall(req).execute()
            if (res.isSuccessful) {
                return@withContext res.body?.string().orEmpty()
            }
        } catch (_: Exception) {}
        ""
    }
}

object Scraper {
    private const val API_BASE = "https://otruyenapi.com/v1/api"

    suspend fun loadManga(query: String = "", genreSlug: String = "", isRanking: Boolean = false): List<Manga> = withContext(Dispatchers.IO) {
        val list = mutableListOf<Manga>()
        try {
            val url = when {
                genreSlug.isNotBlank() -> "$API_BASE/the-loai/$genreSlug?page=1"
                query.isNotBlank() -> "$API_BASE/tim-kiem?keyword=${URLEncoder.encode(query, "UTF-8")}"
                isRanking -> "$API_BASE/danh-sach/truyen-hot?page=1"
                else -> "$API_BASE/danh-sach/truyen-moi?page=1"
            }

            val jsonStr = ApiClient.getJson(url)
            if (jsonStr.isBlank()) return@withContext emptyList()

            val json = JSONObject(jsonStr)
            val data = json.optJSONObject("data") ?: return@withContext emptyList()
            val items = data.optJSONArray("items") ?: data.optJSONArray("data") ?: JSONArray()
            val cdnImage = data.optString("APP_DOMAIN_CDN_IMAGE", "https://img.otruyenapi.com/uploads/comics")

            for (i in 0 until items.length()) {
                val item = items.optJSONObject(i) ?: continue
                val title = item.optString("name")
                val slug = item.optString("slug")
                val thumb = item.optString("thumb_url")
                val cover = if (thumb.startsWith("http")) thumb else "$cdnImage/$thumb"
                
                val chaptersArr = item.optJSONArray("chaptersLatest")
                val latestChap = if (chaptersArr != null && chaptersArr.length() > 0) {
                    chaptersArr.optJSONObject(0)?.optString("chapter_name", "Mới") ?: "Mới"
                } else "Mới"

                if (title.isNotBlank() && slug.isNotBlank()) {
                    list.add(Manga(title, slug, cover, "Chap $latestChap"))
                }
            }
        } catch (_: Exception) {}
        list
    }

    suspend fun loadGenres(): List<Genre> = withContext(Dispatchers.IO) {
        val genres = mutableListOf<Genre>()
        try {
            val jsonStr = ApiClient.getJson("$API_BASE/the-loai")
            if (jsonStr.isNotBlank()) {
                val json = JSONObject(jsonStr)
                val items = json.optJSONObject("data")?.optJSONArray("items") ?: JSONArray()
                for (i in 0 until items.length()) {
                    val item = items.optJSONObject(i) ?: continue
                    val name = item.optString("name")
                    val slug = item.optString("slug")
                    if (name.isNotBlank() && slug.isNotBlank()) {
                        genres.add(Genre(name, slug))
                    }
                }
            }
        } catch (_: Exception) {}

        if (genres.isEmpty()) {
            genres.add(Genre("Action", "action"))
            genres.add(Genre("Adventure", "adventure"))
            genres.add(Genre("Comedy", "comedy"))
            genres.add(Genre("Drama", "drama"))
            genres.add(Genre("Fantasy", "fantasy"))
            genres.add(Genre("Romance", "romance"))
        }
        genres
    }

    suspend fun loadDetails(manga: Manga): Pair<String, List<Chapter>> = withContext(Dispatchers.IO) {
        val chapters = mutableListOf<Chapter>()
        var desc = "Đang cập nhật giới thiệu..."
        try {
            val jsonStr = ApiClient.getJson("$API_BASE/truyen/${manga.link}")
            if (jsonStr.isBlank()) return@withContext Pair(desc, chapters)

            val json = JSONObject(jsonStr)
            val data = json.optJSONObject("data") ?: return@withContext Pair(desc, chapters)
            val item = data.optJSONObject("item") ?: data
            
            desc = item.optString("content", "Đang cập nhật giới thiệu...").replace(Regex("<[^>]*>"), "")
            
            val serverData = item.optJSONArray("item_chapters") ?: JSONArray()
            for (i in 0 until serverData.length()) {
                val server = serverData.optJSONObject(i) ?: continue
                val serverChapList = server.optJSONArray("server_data") ?: continue
                for (j in 0 until serverChapList.length()) {
                    val chap = serverChapList.optJSONObject(j) ?: continue
                    val name = chap.optString("chapter_name")
                    val apiServer = chap.optString("chapter_api_data")
                    if (name.isNotBlank() && apiServer.isNotBlank()) {
                        chapters.add(Chapter("Chap $name", apiServer))
                    }
                }
            }
        } catch (_: Exception) {}
        Pair(desc, chapters)
    }

    suspend fun loadPages(chapter: Chapter): List<String> = withContext(Dispatchers.IO) {
        val pages = mutableListOf<String>()
        try {
            val jsonStr = ApiClient.getJson(chapter.link)
            if (jsonStr.isBlank()) return@withContext emptyList()

            val json = JSONObject(jsonStr)
            val data = json.optJSONObject("data") ?: return@withContext emptyList()
            val domainCdn = data.optString("domain_cdn")
            val chapterPath = data.optString("chapter_path")
            val chapterImages = data.optJSONArray("chapter_image") ?: JSONArray()

            for (i in 0 until chapterImages.length()) {
                val img = chapterImages.optString(i)
                if (img.isNotBlank()) {
                    pages.add("$domainCdn/$chapterPath/$img")
                }
            }
        } catch (_: Exception) {}
        pages
    }
}

fun buildCoilLoader(context: Context): ImageLoader {
    return ImageLoader.Builder(context)
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

    MaterialTheme(colorScheme = darkColorScheme(background = DarkBg, surface = CardBg)) {
        Surface(Modifier.fillMaxSize(), color = DarkBg) {
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
    var loading by remember { mutableStateOf(false) }
    val loader = remember { buildCoilLoader(context) }

    LaunchedEffect(tab, selectedGenre, query) {
        loading = true
        if (tab == 2 && genres.isEmpty()) {
            genres = Scraper.loadGenres()
        }
        list = when {
            tab == 1 -> Scraper.loadManga(isRanking = true)
            tab == 2 && selectedGenre != null -> Scraper.loadManga(genreSlug = selectedGenre!!.url)
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

        Box(Modifier.fillMaxSize()) {
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

            if (loading) {
                Box(
                    Modifier.fillMaxSize().background(DarkBg.copy(alpha = 0.4f)),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = AccentColor)
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
