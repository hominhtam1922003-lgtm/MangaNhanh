package vn.lichnhac.app

import org.junit.Assert.*
import org.junit.Test
import java.time.ZonedDateTime

class AlarmPolicyTest {
    private val task = AlarmRecord(1, "Học tiếng Việt", 100000L)
    @Test fun preserveSnoozeDuringAppSync() {
        val snoozed = task.copy(at = 900000L, snoozed = true)
        assertEquals(snoozed.copy(title = "Tiêu đề mới"), AlarmPolicy.merge(snoozed, task.copy(title = "Tiêu đề mới")))
    }
    @Test fun neverRetriggerFiredAlarmFromSync() {
        val fired = task.copy(fired = true)
        assertTrue(AlarmPolicy.merge(fired, task).fired)
    }
    @Test fun deadlineChangeResetsSnoozeAndFired() {
        val old = task.copy(snoozed = true, fired = true, at = 999999)
        val edited = task.copy(original = 800000, at = 800000)
        assertEquals(edited, AlarmPolicy.merge(old, edited))
    }
    @Test fun newAlarmUsesDesiredDate() { assertEquals(task, AlarmPolicy.merge(null, task)) }
    @Test fun timezoneKeepsLocalCalendarTime() {
        val vn = ZonedDateTime.parse("2026-10-13T18:00:00+07:00[Asia/Ho_Chi_Minh]").toInstant().toEpochMilli()
        val jp = ZonedDateTime.parse("2026-10-13T18:00:00+09:00[Asia/Tokyo]").toInstant().toEpochMilli()
        val r = AlarmPolicy.rebase(task.copy(original = vn, at = vn), "Asia/Ho_Chi_Minh", "Asia/Tokyo")
        assertEquals(jp, r.original); assertEquals(jp, r.at)
    }
    @Test fun timezoneDoesNotChangeSnoozeElapsedTime() {
        val old = task.copy(snoozed = true, at = 999999)
        assertEquals(old.at, AlarmPolicy.rebase(old, "Asia/Ho_Chi_Minh", "Asia/Tokyo").at)
    }
    @Test fun sameTimezoneLeavesRecordUnchanged() { assertEquals(task, AlarmPolicy.rebase(task, "UTC", "UTC")) }
}
