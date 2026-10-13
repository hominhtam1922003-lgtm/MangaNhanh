package vn.lichnhac.app

import java.util.Calendar
import java.util.TimeZone

/** Chính sách thuần Kotlin để kiểm thử độc lập với dịch vụ Android. */
object AlarmPolicy {
    fun merge(old: AlarmRecord?, desired: AlarmRecord): AlarmRecord =
        if (old != null && old.original == desired.original && (old.snoozed || old.fired))
            old.copy(title = desired.title) else desired

    /** Giữ giờ lịch địa phương khi đổi múi giờ; thời gian hoãn vẫn là phút thực. */
    fun rebase(row: AlarmRecord, oldZone: String, newZone: String): AlarmRecord {
        if (oldZone == newZone) return row
        val old = Calendar.getInstance(TimeZone.getTimeZone(oldZone)).apply { timeInMillis = row.original }
        val local = Calendar.getInstance(TimeZone.getTimeZone(newZone)).apply {
            clear()
            set(old.get(Calendar.YEAR), old.get(Calendar.MONTH), old.get(Calendar.DAY_OF_MONTH),
                old.get(Calendar.HOUR_OF_DAY), old.get(Calendar.MINUTE), old.get(Calendar.SECOND))
            set(Calendar.MILLISECOND, old.get(Calendar.MILLISECOND))
        }.timeInMillis
        return row.copy(original = local, at = if (row.snoozed) row.at else local)
    }
}
