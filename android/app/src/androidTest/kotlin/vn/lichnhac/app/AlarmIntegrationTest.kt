package vn.lichnhac.app

import android.content.Context
import android.os.SystemClock
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.*
import org.junit.runner.RunWith

/** Kiểm tra AlarmManager → Receiver → foreground service → MediaPlayer trên Android thật (emulator). */
@RunWith(AndroidJUnit4::class)
class AlarmIntegrationTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context: Context get() = instrumentation.targetContext
    private fun main(action: () -> Unit) = instrumentation.runOnMainSync(action)
    private fun awaitPlaying(id: Int) {
        val until = SystemClock.elapsedRealtime() + 25000
        var playing = false
        while (!playing && SystemClock.elapsedRealtime() < until) {
            main { playing = AlarmService.instance?.let { it.current?.id == id && it.isSoundPlaying } == true }
            if (!playing) SystemClock.sleep(200)
        }
        assertTrue("Alarm $id phải có service và MediaPlayer đang phát", playing)
    }
    @Before fun prepare() {
        main { AlarmStore.clear(context) }
        assertTrue("Runner phải cấp SCHEDULE_EXACT_ALARM", AlarmStore.allowed(context))
    }
    @After fun cleanup() { main { AlarmStore.clear(context) } }

    @Test fun scheduledWhileBackgroundRingsSnoozesAndCancels() {
        val row = AlarmRecord(910001, "Kiểm thử tiếng Việt · chuông", System.currentTimeMillis() + 5000)
        main { assertTrue(AlarmStore.sync(context, listOf(row))) }
        // Tắt màn hình trước giờ hẹn; không dùng broadcast giả hoặc gọi service trực tiếp.
        instrumentation.uiAutomation.executeShellCommand("input keyevent 223").close()
        awaitPlaying(row.id)
        val before = System.currentTimeMillis()
        main { assertTrue(AlarmService.instance!!.snooze(row.id, 5)) }
        val snoozed = AlarmStore.read(context).single()
        assertTrue(snoozed.snoozed); assertFalse(snoozed.fired)
        assertTrue(snoozed.at in (before + 299000)..(System.currentTimeMillis() + 301000))
        main { AlarmStore.sync(context, listOf(row)); AlarmStore.restore(context) }
        assertEquals(snoozed.at, AlarmStore.read(context).single().at)
        main { AlarmStore.sync(context, emptyList()) }
        assertTrue(AlarmStore.read(context).isEmpty())
    }

    @Test fun simultaneousAlarmsQueueAndStopWithoutRestart() {
        val at = System.currentTimeMillis() + 5000
        val first = AlarmRecord(910002, "Chuông một", at)
        val second = AlarmRecord(910003, "Chuông hai", at)
        main { AlarmStore.sync(context, listOf(first, second)) }
        val until = SystemClock.elapsedRealtime() + 25000
        var id: Int? = null
        while (id == null && SystemClock.elapsedRealtime() < until) {
            main { if (AlarmService.instance?.isSoundPlaying == true) id = AlarmService.instance?.current?.id }
            if (id == null) SystemClock.sleep(200)
        }
        assertNotNull("Phải có chuông đầu", id)
        // Đợi receiver thứ hai xếp hàng; sau đó Dừng chuông đầu phải phát chuông còn lại.
        SystemClock.sleep(1500)
        main { AlarmService.instance!!.dismiss(id!!) }
        val other = if (id == first.id) second.id else first.id
        awaitPlaying(other)
        main { AlarmStore.sync(context, emptyList()) }
        main { assertNull(AlarmService.instance?.current) }
        assertTrue(AlarmStore.read(context).isEmpty())
    }
}
