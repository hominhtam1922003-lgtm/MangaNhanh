package vn.lichnhac.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject

data class AlarmRecord(val id: Int, val title: String, val original: Long,
                       val at: Long = original, val snoozed: Boolean = false, val fired: Boolean = false) {
    fun json() = JSONObject().put("id", id).put("title", title).put("original", original)
        .put("at", at).put("snoozed", snoozed).put("fired", fired)
    companion object {
        fun from(j: JSONObject) = AlarmRecord(j.getInt("id"), j.getString("title"), j.getLong("original"),
            j.getLong("at"), j.optBoolean("snoozed"), j.optBoolean("fired"))
    }
}

object AlarmStore {
    private fun prefs(c: Context) = c.getSharedPreferences("lich_nhac_alarms", Context.MODE_PRIVATE)
    fun allowed(c: Context): Boolean = Build.VERSION.SDK_INT < 31 ||
        c.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()
    @Synchronized fun read(c: Context): List<AlarmRecord> {
        return try {
            val a = JSONArray(prefs(c).getString("records", "[]"))
            (0 until a.length()).map { AlarmRecord.from(a.getJSONObject(it)) }
        } catch (_: Exception) { emptyList() }
    }
    @Synchronized private fun write(c: Context, rows: List<AlarmRecord>) {
        val a = JSONArray(); rows.forEach { a.put(it.json()) }
        prefs(c).edit().putString("records", a.toString()).apply()
    }
    private fun pending(c: Context, id: Int): PendingIntent = PendingIntent.getBroadcast(c, id,
        Intent(c, AlarmReceiver::class.java).setAction("vn.lichnhac.ALARM").putExtra("id", id),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    fun cancel(c: Context, id: Int) { c.getSystemService(AlarmManager::class.java).cancel(pending(c, id)) }
    private fun schedule(c: Context, r: AlarmRecord) {
        val show = PendingIntent.getActivity(c, r.id, Intent(c, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        c.getSystemService(AlarmManager::class.java).setAlarmClock(AlarmManager.AlarmClockInfo(r.at, show), pending(c, r.id))
    }
    @Synchronized fun sync(c: Context, desired: List<AlarmRecord>): Boolean {
        val zone = java.util.TimeZone.getDefault().id
        val oldZone = prefs(c).getString("zone", zone) ?: zone
        val existing = read(c).map { AlarmPolicy.rebase(it, oldZone, zone) }.associateBy { it.id }
        val ids = desired.map { it.id }.toSet()
        existing.values.filter { it.id !in ids }.forEach { cancel(c, it.id) }
        AlarmService.instance?.prune(desired.associate { it.id to it.original })
        val can = allowed(c)
        val next = mutableListOf<AlarmRecord>()
        desired.forEach { row ->
            val old = existing[row.id]
            val record = AlarmPolicy.merge(old, row)
            if (record.fired && old?.original == row.original) {
                next.add(record)
            } else if (record.at > System.currentTimeMillis() && can) {
                schedule(c, record) // Khôi phục cả sau khi người dùng buộc dừng rồi mở lại.
                next.add(record)
            } else {
                cancel(c, row.id)
            }
        }
        write(c, next)
        prefs(c).edit().putString("zone", java.util.TimeZone.getDefault().id).apply()
        return can
    }
    @Synchronized fun fired(c: Context, id: Int): AlarmRecord? {
        val rows = read(c)
        val r = rows.firstOrNull { it.id == id } ?: return null
        write(c, rows.map { if (it.id == id) it.copy(fired = true) else it })
        return r
    }
    @Synchronized fun remove(c: Context, id: Int) { cancel(c, id); write(c, read(c).filter { it.id != id }) }
    @Synchronized fun snooze(c: Context, r: AlarmRecord, minutes: Int): Boolean {
        if (!allowed(c)) return false
        val n = r.copy(at = System.currentTimeMillis() + minutes * 60000L, snoozed = true, fired = false)
        return try {
            schedule(c, n); write(c, read(c).filter { it.id != r.id } + n); true
        } catch (_: Exception) { false }
    }
    @Synchronized fun restore(c: Context) {
        if (!allowed(c)) return
        val zone = java.util.TimeZone.getDefault().id
        val oldZone = prefs(c).getString("zone", zone) ?: zone
        val rows = read(c).map { AlarmPolicy.rebase(it, oldZone, zone) }
        write(c, rows)
        prefs(c).edit().putString("zone", zone).apply()
        rows.filter { !it.fired && it.at > System.currentTimeMillis() }.forEach {
            try { schedule(c, it) } catch (_: Exception) { }
        }
    }
    @Synchronized fun clear(c: Context) {
        read(c).forEach { cancel(c, it.id) }; write(c, emptyList())
        AlarmService.instance?.stopAll()
    }
}
