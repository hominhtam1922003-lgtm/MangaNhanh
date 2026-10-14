import * as Notifications from "expo-notifications";
import type { State } from "./localdb";
import {
  anniversaryEvents,
  cycleEvents,
  dueAlerts,
} from "../logic/localState.mjs";
import { dateOnly } from "../logic/time.mjs";
import { loveLineFor, loveLineKey } from "../logic/lovelines.mjs";
export async function ensureChannel() {
  if (Notifications.getPermissionsAsync === undefined) return false;
  await Notifications.setNotificationChannelAsync("love-reminders", {
    name: "Lời nhắc yêu thương",
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
  return true;
}
export async function requestNotifications() {
  await ensureChannel();
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted")
    permission = await Notifications.requestPermissionsAsync();
  return permission.status === "granted";
}
/** Báo ngay lập tức (tin nhắn mới, nhật ký mới, cảm xúc mới) — kiểu thông báo
 * tin nhắn: hiện ngay cả khi app đang mở ở màn hình khác. Chưa cấp quyền thì bỏ
 * qua, người dùng vẫn thấy trong mục “Lời nhắc”. */
export async function notifyNow(title: string, body: string) {
  try {
    if (Notifications.getPermissionsAsync === undefined) return false;
    const permission = await Notifications.getPermissionsAsync();
    if (permission.status !== "granted") return false;
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: "default",
        data: { key: `now-${Date.now()}` },
      },
      trigger: null,
    });
    return true;
  } catch {
    return false;
  }
}
function atEight(day: string) {
  const date = new Date(`${day}T08:00:00`);
  return Number.isFinite(date.getTime()) ? date : null;
}
export function upcomingEvents(state: State, today: string) {
  return [
    ...cycleEvents(state.cycle, today),
    ...anniversaryEvents(state, today),
  ]
    .filter((event) => event.day >= today)
    .sort((a, b) => (a.day < b.day ? -1 : 1))
    .slice(0, 40);
}
export async function rescheduleReminders(
  state: State,
  today = dateOnly(new Date(), state.timezone),
) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!state.settings.notify) return 0;
  let scheduled = 0;
  for (const event of upcomingEvents(state, today)) {
    const date = atEight(event.day);
    if (!date || date.getTime() <= Date.now()) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: event.title,
        body: event.body,
        sound: "default",
        data: { key: event.key },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: "love-reminders",
      },
    });
    scheduled += 1;
  }
  return scheduled;
}
/** Lời yêu thương định kỳ: 09:00 và 21:00 mỗi ngày, câu chọn theo NGÀY nên hai máy cùng câu. */
export async function scheduleLoveNotes(
  state: State,
  today = dateOnly(new Date(), state.timezone),
) {
  if (!state.settings.loveNotes) return 0;
  const allowed = await Notifications.getPermissionsAsync();
  if (allowed.status !== "granted") return 0;
  const base = new Date(`${today}T00:00:00`);
  if (!Number.isFinite(base.getTime())) return 0;
  const nickname = state.partner?.nickname || state.me.nickname;
  let scheduled = 0;
  for (let offset = 0; offset < 8; offset++) {
    const day = new Date(base);
    day.setDate(day.getDate() + offset);
    const dayKey = dateOnly(day, state.timezone);
    const line = loveLineFor(dayKey);
    for (const hour of [9, 21]) {
      const when = new Date(day);
      when.setHours(hour, 0, 0, 0);
      if (when.getTime() <= Date.now()) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: `${loveLineKey(dayKey)}-${hour}`,
        content: {
          title: `${line.emoji} Lời yêu thương`,
          body: `${line.text} — gửi ${nickname} nhé.`,
          sound: "default",
          data: { key: loveLineKey(dayKey) },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: when,
          channelId: "love-reminders",
        },
      });
      scheduled += 1;
    }
  }
  return scheduled;
}
/** Sắp lịch lại cả lời nhắc lẫn lời yêu thương (gọi khi mở app hoặc đổi cài đặt). */
export async function rescheduleEverything(
  state: State,
  today = dateOnly(new Date(), state.timezone),
) {
  const reminders = await rescheduleReminders(state, today);
  const notes = await scheduleLoveNotes(state, today);
  return { reminders, notes };
}
export function dueAlertActions(
  state: State,
  today = dateOnly(new Date(), state.timezone),
) {
  return dueAlerts(state, today).map((event) => ({
    type: "alerts.add",
    key: event.key,
    title: event.title,
    body: event.body,
    category: event.category,
  }));
}
