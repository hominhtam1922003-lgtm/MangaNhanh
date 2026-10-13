package vn.lichnhac.app

import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.os.LocaleList
import android.text.InputType
import android.view.WindowManager
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import java.util.Locale
import io.flutter.plugin.common.MethodChannel

/** Ô Android nguyên bản để tránh đường composing Flutter nếu Gboard/giả lập gặp lỗi. */
object VietnameseEditor {
    fun createEditor(context: Context, initial: String): EditText = EditText(context).apply {
        inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
        imeHintLocales = LocaleList(Locale("vi", "VN"))
        minLines = 3; maxLines = 8; textSize = 18f
        setText(initial); setSelection(text.length)
    }
    fun show(activity: Activity, initial: String, result: MethodChannel.Result) {
        var answered = false
        fun answer(value: String?) { if (!answered) { answered = true; result.success(value) } }
        val editor = createEditor(activity, initial)
        val info = TextView(activity).apply { text = "Chọn Tiếng Việt / Telex trong Gboard. Dấu được xử lý trực tiếp bởi ô nhập Android. Tối đa 4.000 ký tự; không cắt lúc ghép dấu." }
        val box = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            val padding = (20 * resources.displayMetrics.density).toInt()
            setPadding(padding, padding, padding, padding)
            addView(info); addView(editor)
        }
        val dialog = AlertDialog.Builder(activity).setTitle("Nhập tiếng Việt · Android")
            .setView(box).setNegativeButton("Hủy") { _, _ -> answer(null) }
            .setPositiveButton("Dùng nội dung", null).create()
        dialog.setOnCancelListener { answer(null) }
        dialog.setOnDismissListener { answer(null) }
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                if (editor.text.length > 4000) editor.error = "Nội dung vượt 4.000 ký tự. Hãy rút ngắn, app không tự cắt dấu."
                else { answer(editor.text.toString()); dialog.dismiss() }
            }
            editor.requestFocus()
            dialog.window?.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE or WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE)
        }
        dialog.show()
    }
}
