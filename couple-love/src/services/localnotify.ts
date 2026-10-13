import * as Notifications from "expo-notifications";
import type { State } from "./localdb";
import {
  anniversaryEvents,
  cycleEvents,
  dueAlerts,
} from "../logic/localState.mjs";
import { dateOnly } from "../logic/time.mjs";
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
