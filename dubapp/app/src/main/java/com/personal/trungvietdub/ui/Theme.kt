package com.personal.trungvietdub.ui

import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.shape.RoundedCornerShape

/** Bảng màu tối ấm, dễ nhìn khi xem video lâu. */
private val DubColors: ColorScheme = darkColorScheme(
    primary = Color(0xFFFFB86B),
    onPrimary = Color(0xFF3B2000),
    primaryContainer = Color(0xFF5A3A10),
    onPrimaryContainer = Color(0xFFFFDDB8),
    secondary = Color(0xFF9ECBFF),
    onSecondary = Color(0xFF00305A),
    tertiary = Color(0xFFFF8A80),
    background = Color(0xFF111115),
    onBackground = Color(0xFFEDEDF2),
    surface = Color(0xFF17171D),
    onSurface = Color(0xFFEDEDF2),
    surfaceVariant = Color(0xFF25252E),
    onSurfaceVariant = Color(0xFFB9B9C6),
    error = Color(0xFFFF8A80),
    outline = Color(0xFF4A4A56),
)

@Composable
fun DubTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = DubColors, content = content)
}

/** Thẻ bo góc đồng nhất cho mọi khối nội dung. */
@Composable
fun SectionCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        content = content,
    )
}
