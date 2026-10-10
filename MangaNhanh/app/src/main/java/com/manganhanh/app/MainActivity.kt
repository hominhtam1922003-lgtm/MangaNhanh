package com.manganhanh.app

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
import androidx.compose.material.icons.filled.Update
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.work.*
import java.util.concurrent.TimeUnit

private val Bg = Color(0xFF101114)
private val Surface = Color(0xFF1B1D22)
private val Muted = Color(0xFF9A9DA6)
private val Accent = Color(0xFFE8E9ED)

 data class Chapter(val number: Int, val title: String = "Chương $number", val updated: String = "Chưa có dữ liệu nguồn")
 data class Manga(val id: Int, val title: String, val genre: String, val latest: Int, val description: String)

private val demoManga = listOf(
    Manga(1, "Thợ Săn Bóng Đêm", "Hành động · Fantasy", 128, "Một thợ săn trẻ khám phá sức mạnh bí ẩn và bước vào thế giới đầy quái vật."),
    Manga(2, "Ngày Mai Của Chúng Ta", "Tình cảm · Đời thường", 56, "Câu chuyện nhẹ nhàng về tình bạn, trưởng thành và những lựa chọn."),
    Manga(3, "Vương Quốc Cuối Cùng", "Phiêu lưu · Fantasy", 204, "Một hành trình tìm kiếm vùng đất cuối cùng trên bản đồ."),
    Manga(4, "Đường Đến Nhà Vô Địch", "Thể thao · Học đường", 73, "Một đội bóng nhỏ theo đuổi giấc mơ vô địch.")
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        scheduleChapterCheck()
        setContent { MangaApp() }
    }

    private fun scheduleChapterCheck() {
        val request = PeriodicWorkRequestBuilder<ChapterUpdateWorker>(6, TimeUnit.HOURS)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(this).enqueueUniquePeriodicWork("chapter-check", ExistingPeriodicWorkPolicy.KEEP, request)
    }
}

/** Placeholder worker. Connect a permitted website/API adapter here to make chapter checks real. */
class ChapterUpdateWorker(context: android.content.Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        // TODO: fetch latest chapter IDs from the user's chosen source, compare with local storage,
        // then save updates and post a notification when new chapters are found.
        return Result.success()
    }
}

@Composable
fun MangaApp() {
    var selected by remember { mutableStateOf<Manga?>(null) }
    var reading by remember { mutableStateOf<Manga?>(null) }
    var query by remember { mutableStateOf("") }
    var tab by remember { mutableStateOf(0) }
    var favorites by remember { mutableStateOf(setOf<Int>()) }
    var lastRead by remember { mutableStateOf(mapOf<Int, Int>()) }

    MaterialTheme(colorScheme = darkColorScheme(background = Bg, surface = Surface, primary = Accent)) {
        Surface(Modifier.fillMaxSize(), color = Bg) {
            when {
                reading != null -> ReaderScreen(manga = reading!!, chapter = lastRead[reading!!.id] ?: reading!!.latest,
                    onBack = { reading = null }, onChapter = { lastRead = lastRead + (reading!!.id to it) })
                selected != null -> DetailScreen(manga = selected!!, favorite = favorites.contains(selected!!.id),
                    lastRead = lastRead[selected!!.id], onBack = { selected = null },
                    onFavorite = { favorites = if (favorites.contains(selected!!.id)) favorites - selected!!.id else favorites + selected!!.id },
                    onRead = { chapter -> lastRead = lastRead + (selected!!.id to chapter); reading = selected })
                else -> HomeScreen(query = query, onQuery = { query = it }, tab = tab, onTab = { tab = it },
                    favorites = favorites, onOpen = { selected = it }, lastRead = lastRead)
            }
        }
    }
}

@Composable
fun HomeScreen(query: String, onQuery: (String) -> Unit, tab: Int, onTab: (Int) -> Unit,
               favorites: Set<Int>, onOpen: (Manga) -> Unit, lastRead: Map<Int, Int>) {
    val filtered = demoManga.filter { it.title.contains(query, true) && (tab != 1 || favorites.contains(it.id)) }
    Column(Modifier.fillMaxSize().statusBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 18.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("MANGA NHANH", fontSize = 20.sp, fontWeight = FontWeight.Black, color = Accent, letterSpacing = 1.2.sp)
                Text("Gọn nhẹ. Đọc liền mạch.", fontSize = 12.sp, color = Muted)
            }
            Icon(Icons.Default.Update, contentDescription = "Tự kiểm tra chap", tint = Muted)
        }
        OutlinedTextField(value = query, onValueChange = onQuery, modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            placeholder = { Text("Tìm truyện…", color = Muted) }, leadingIcon = { Icon(Icons.Default.Search, null, tint = Muted) },
            singleLine = true, shape = RoundedCornerShape(14.dp), colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Color(0xFF555963), unfocusedBorderColor = Color(0xFF303239), focusedTextColor = Accent, unfocusedTextColor = Accent))
        Row(Modifier.padding(horizontal = 20.dp, vertical = 16.dp), horizontalArrangement = Arrangement.spacedBy(20.dp)) {
            Text("Mới cập nhật", color = if (tab == 0) Accent else Muted, fontWeight = FontWeight.SemiBold,
                modifier = Modifier.clickable { onTab(0) })
            Text("Yêu thích", color = if (tab == 1) Accent else Muted, fontWeight = FontWeight.SemiBold,
                modifier = Modifier.clickable { onTab(1) })
        }
        LazyColumn(contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(filtered, key = { it.id }) { manga ->
                Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Surface).clickable { onOpen(manga) }.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(width = 76.dp, height = 100.dp).clip(RoundedCornerShape(10.dp)).background(Color(0xFF30333B)), contentAlignment = Alignment.Center) {
                        Text(manga.title.take(2), fontSize = 25.sp, fontWeight = FontWeight.Black, color = Color(0xFFD9DADE))
                    }
                    Column(Modifier.weight(1f).padding(start = 14.dp)) {
                        Text(manga.title, color = Accent, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Spacer(Modifier.height(5.dp))
                        Text(manga.genre, color = Muted, fontSize = 12.sp)
                        Spacer(Modifier.height(12.dp))
                        Text("Chap ${manga.latest} · ${if (lastRead[manga.id] != null) "Đọc tiếp chap ${lastRead[manga.id]}" else "Chưa đọc"}", color = Color(0xFFC5C7CE), fontSize = 12.sp)
                    }
                }
            }
            if (filtered.isEmpty()) item { Text("Không tìm thấy truyện.", color = Muted, modifier = Modifier.padding(20.dp)) }
        }
        Spacer(Modifier.weight(1f))
        Row(Modifier.fillMaxWidth().navigationBarsPadding().background(Color(0xFF15161A)).padding(vertical = 12.dp), horizontalArrangement = Arrangement.Center) {
            Icon(Icons.Default.Home, null, tint = Accent)
            Text("   Thư viện cá nhân", color = Muted, fontSize = 12.sp)
        }
    }
}

@Composable
fun DetailScreen(manga: Manga, favorite: Boolean, lastRead: Int?, onBack: () -> Unit, onFavorite: () -> Unit, onRead: (Int) -> Unit) {
    Column(Modifier.fillMaxSize().statusBarsPadding().padding(18.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, "Quay lại", tint = Accent) }
            Text("Chi tiết truyện", color = Accent, fontWeight = FontWeight.Bold, fontSize = 18.sp)
        }
        Spacer(Modifier.height(18.dp))
        Box(Modifier.fillMaxWidth().height(160.dp).clip(RoundedCornerShape(18.dp)).background(Surface), contentAlignment = Alignment.Center) {
            Text(manga.title.take(2), color = Accent, fontSize = 48.sp, fontWeight = FontWeight.Black)
        }
        Spacer(Modifier.height(18.dp))
        Text(manga.title, color = Accent, fontSize = 24.sp, fontWeight = FontWeight.Bold)
        Text(manga.genre, color = Muted, modifier = Modifier.padding(top = 6.dp))
        Text(manga.description, color = Color(0xFFC8CAD0), modifier = Modifier.padding(top = 14.dp), lineHeight = 22.sp)
        Spacer(Modifier.height(20.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Button(onClick = { onRead(lastRead ?: manga.latest) }, modifier = Modifier.weight(1f), colors = ButtonDefaults.buttonColors(containerColor = Accent, contentColor = Bg)) {
                Text(if (lastRead == null) "Đọc ngay" else "Đọc tiếp")
            }
            OutlinedButton(onClick = onFavorite) { Icon(Icons.Default.Bookmark, null); Spacer(Modifier.width(6.dp)); Text(if (favorite) "Đã lưu" else "Lưu truyện") }
        }
        Spacer(Modifier.height(24.dp))
        Text("DANH SÁCH CHƯƠNG", color = Muted, fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
        Spacer(Modifier.height(8.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items((1..minOf(manga.latest, 30)).reversed()) { n ->
                Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(Surface).clickable { onRead(n) }.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("Chương $n", color = Accent, modifier = Modifier.weight(1f))
                    Text(if (n == lastRead) "Đang đọc" else "Đọc", color = Muted, fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
fun ReaderScreen(manga: Manga, chapter: Int, onBack: () -> Unit, onChapter: (Int) -> Unit) {
    Column(Modifier.fillMaxSize().statusBarsPadding()) {
        Row(Modifier.fillMaxWidth().background(Color(0xFF15161A)).padding(horizontal = 8.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, null, tint = Accent) }
            Column(Modifier.weight(1f)) {
                Text(manga.title, color = Accent, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                Text("Chương $chapter", color = Muted, fontSize = 12.sp)
            }
            TextButton(onClick = { onChapter((chapter - 1).coerceAtLeast(1)) }) { Text("Trước", color = Accent) }
            TextButton(onClick = { onChapter((chapter + 1).coerceAtMost(manga.latest)) }) { Text("Sau", color = Accent) }
        }
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 32.dp)) {
            item {
                Column(Modifier.fillMaxWidth().padding(18.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("${manga.title} — Chương $chapter", color = Accent, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    Text("Khu vực hiển thị trang truyện", color = Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp, bottom = 16.dp))
                    repeat(8) { i ->
                        Box(Modifier.fillMaxWidth().height(if (i % 3 == 0) 240.dp else 190.dp).padding(bottom = 5.dp).clip(RoundedCornerShape(4.dp)).background(if (i % 2 == 0) Color(0xFF24262C) else Color(0xFF1B1D22)), contentAlignment = Alignment.Center) {
                            Text("Ảnh truyện sẽ hiển thị tại đây", color = Color(0xFF666A74), fontSize = 12.sp)
                        }
                    }
                    Text("Đây là bản khung giao diện. Cần kết nối nguồn truyện hợp lệ để tải ảnh và chap thật.", color = Muted, fontSize = 12.sp, lineHeight = 18.sp)
                }
            }
        }
    }
}
