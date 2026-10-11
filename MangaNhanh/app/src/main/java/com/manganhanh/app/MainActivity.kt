package com.manganhanh.app

import android.annotation.SuppressLint
import android.os.Bundle
import android.os.Message
import android.view.ViewGroup
import android.webkit.*
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView

private val DarkBg = Color(0xFF0F1015)
private val CardBg = Color(0xFF181A20)
private val AccentColor = Color(0xFFFF5252)
private val TextSub = Color(0xFF8A8F9E)

data class MangaSource(val name: String, val url: String)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = darkColorScheme(background = DarkBg, surface = CardBg)) {
                Surface(Modifier.fillMaxSize(), color = DarkBg) {
                    MangaAppView()
                }
            }
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun MangaAppView() {
    // 3 nguồn truyện chuẩn theo yêu cầu của bạn
    val sources = remember {
        listOf(
            MangaSource("TruyenQQ", "https://truyenqqko.com/doc-truyen"),
            MangaSource("NetTruyen", "https://nettruyenviet10.com/truyen-tranh-moi"),
            MangaSource("Góc Truyện Tranh", "https://goctruyentranhvui30.com/trang-chu")
        )
    }

    var selectedIndex by remember { mutableIntStateOf(0) }
    var webViewInstance by remember { mutableStateOf<WebView?>(null) }
    var canGoBack by remember { mutableStateOf(false) }
    var hasError by remember { mutableStateOf(false) }

    // Bấm nút Back trên điện thoại để quay lại trang web trước đó
    BackHandler(enabled = canGoBack) {
        webViewInstance?.goBack()
    }

    Column(Modifier.fillMaxSize().statusBarsPadding()) {
        // Tiêu đề ứng dụng
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "⚡ MANGA VIP",
                color = AccentColor,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 20.sp
            )
        }

        // Thanh chọn nguồn trượt ngang hiện đại
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(CardBg)
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            sources.forEachIndexed { index, source ->
                val isSelected = selectedIndex == index
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (isSelected) AccentColor else DarkBg)
                        .clickable {
                            selectedIndex = index
                            hasError = false
                            webViewInstance?.loadUrl(source.url)
                        }
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = source.name,
                        color = if (isSelected) Color.White else TextSub,
                        fontSize = 13.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                    )
                }
            }
        }

        // Khung WebView tải siêu tốc, vượt tường lửa và dọn rác quảng cáo
        Box(Modifier.fillMaxWidth().weight(1f)) {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { context ->
                    WebView(context).apply {
                        layoutParams = ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                        settings.apply {
                            javaScriptEnabled = true
                            domStorageEnabled = true
                            loadWithOverviewMode = true
                            useWideViewPort = true
                            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                            cacheMode = WebSettings.LOAD_DEFAULT // Sử dụng cache bộ nhớ giúp tải cực nhanh
                            setSupportZoom(true)
                            builtInZoomControls = true
                            displayZoomControls = false

                            // Chống popup mở tab quảng cáo rác
                            javaScriptCanOpenWindowsAutomatically = false
                            setSupportMultipleWindows(false)
                        }

                        webChromeClient = object : WebChromeClient() {
                            override fun onCreateWindow(
                                view: WebView?,
                                isDialog: Boolean,
                                isUserGesture: Boolean,
                                resultMsg: Message?
                            ): Boolean {
                                return false
                            }
                        }

                        webViewClient = object : WebViewClient() {
                            override fun onPageFinished(view: WebView?, url: String?) {
                                super.onPageFinished(view, url)
                                canGoBack = view?.canGoBack() ?: false

                                // Tiêm mã JavaScript ẩn bớt khung quảng cáo, banner rác giúp web load mượt và sạch
                                val cleanScript = """
                                    (function() {
                                        var ads = document.querySelectorAll('iframe[src*="ads"], div[class*="ads"], div[id*="ads"], div[class*="banner"], ins.adsbygoogle');
                                        ads.forEach(function(el) { el.remove(); });
                                    })();
                                """.trimIndent()
                                view?.evaluateJavascript(cleanScript, null)
                            }

                            override fun onReceivedError(
                                view: WebView?,
                                request: WebResourceRequest?,
                                error: WebResourceError?
                            ) {
                                super.onReceivedError(view, request, error)
                                if (request?.isForMainFrame == true) {
                                    hasError = true
                                }
                            }

                            override fun onReceivedSslError(
                                view: WebView?,
                                handler: SslErrorHandler?,
                                error: SslError?
                            ) {
                                handler?.proceed() // Tự động bỏ qua lỗi chứng chỉ SSL
                            }
                        }
                        loadUrl(sources[selectedIndex].url)
                        webViewInstance = this
                    }
                },
                update = { webView ->
                    webViewInstance = webView
                }
            )

            // Màn hình thông báo dự phòng nếu bị nhà mạng chặn kết nối
            if (hasError) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(DarkBg),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(24.dp)
                    ) {
                        Text(
                            text = "⚠️ Trang web có thể đang bị chặn!",
                            color = AccentColor,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            text = "Vui lòng bật ứng dụng 1.1.1.1 (Cloudflare WARP) trên điện thoại để vượt tường lửa nhà mạng và tiếp tục đọc truyện.",
                            color = TextSub,
                            fontSize = 13.sp,
                            modifier = Modifier.padding(bottom = 16.dp)
                        )
                        Button(
                            onClick = {
                                hasError = false
                                webViewInstance?.reload()
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = AccentColor)
                        ) {
                            Text("Thử lại", color = Color.White)
                        }
                    }
                }
            }
        }
    }
}
