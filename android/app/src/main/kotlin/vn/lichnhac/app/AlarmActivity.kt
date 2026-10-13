package vn.lichnhac.app

import android.app.Activity
import android.content.*
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.*
import android.view.Gravity
import android.view.WindowManager
import android.widget.*

class AlarmActivity : Activity() {
    private lateinit var titleView: TextView
    private lateinit var clock: TextView
    private var alarmId = -1
    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(c: Context, i: Intent) { update() }
    }
    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true) }
        else { @Suppress("DEPRECATION") window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON) }
        fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
        val root = FrameLayout(this).apply {
            background = GradientDrawable(GradientDrawable.Orientation.TL_BR, intArrayOf(Color.rgb(30,44,80), Color.rgb(12,19,34)))
        }
        val scroll = ScrollView(this)
        val content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER; setPadding(dp(24), dp(40), dp(24), dp(40)) }
        fun text(value: String, size: Float) = TextView(this).apply { text = value; textSize = size; setTextColor(Color.WHITE); gravity = Gravity.CENTER; setPadding(0,dp(12),0,dp(12)) }
        content.addView(text("LỊCH NHẮC · BÁO THỨC", 16f))
        clock = text("", 56f); content.addView(clock)
        titleView = text("", 28f).apply { setTypeface(typeface, Typeface.BOLD) }; content.addView(titleView)
        content.addView(text("Chuông tự dừng sau 5 phút. Dừng chuông không tự đánh dấu công việc hoàn thành.", 15f))
        fun button(label: String, color: Int, click: () -> Unit) {
            val b = Button(this).apply {
                text = label; textSize = 18f; isAllCaps = false; setTextColor(Color.WHITE)
                background = GradientDrawable().apply { setColor(color); cornerRadius = dp(24).toFloat() }
                minHeight = dp(64); setOnClickListener { click() }
            }
            content.addView(b, LinearLayout.LayoutParams(-1, dp(64)).apply { topMargin = dp(16) })
        }
        button("Dừng chuông", Color.rgb(88,106,224)) { AlarmService.instance?.dismiss(alarmId); finish() }
        button("Hoãn 5 phút", Color.rgb(42,126,139)) {
            if (AlarmService.instance?.snooze(alarmId, 5) == true) finish()
            else Toast.makeText(this, "Chưa hoãn được. Kiểm tra quyền báo thức chính xác.", Toast.LENGTH_LONG).show()
        }
        button("Hoãn 10 phút", Color.rgb(46,62,87)) {
            if (AlarmService.instance?.snooze(alarmId, 10) == true) finish()
            else Toast.makeText(this, "Chưa hoãn được. Kiểm tra quyền báo thức chính xác.", Toast.LENGTH_LONG).show()
        }
        button("Mở công việc", Color.rgb(46,62,87)) {
            startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)); finish()
        }
        scroll.addView(content)
        root.addView(scroll, FrameLayout.LayoutParams(resources.displayMetrics.widthPixels.coerceAtMost(dp(560)), -1, Gravity.CENTER))
        setContentView(root)
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(receiver, IntentFilter("vn.lichnhac.ALARM_UPDATE"), Context.RECEIVER_NOT_EXPORTED)
            else { @Suppress("DEPRECATION") registerReceiver(receiver, IntentFilter("vn.lichnhac.ALARM_UPDATE")) }
        update()
    }
    private fun update() {
        val record = AlarmService.instance?.current
        if (record == null) { finish(); return }
        alarmId = record.id; titleView.text = record.title
        clock.text = java.text.SimpleDateFormat("HH:mm", java.util.Locale.getDefault()).format(java.util.Date())
    }
    override fun onDestroy() { unregisterReceiver(receiver); super.onDestroy() }
}
