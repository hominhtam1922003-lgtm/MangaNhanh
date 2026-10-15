import * as Notifications from "expo-notifications";
import { Linking, Platform } from "react-native";
import type { State } from "./localdb";
import {
  anniversaryEvents,
  cycleEvents,
  dueAlerts,
} from "../logic/localState.mjs";
import { dateOnly } from "../logic/time.mjs";
import { loveLineFor, loveLineKey } from "../logic/lovelines.mjs";
import { loadNotifee, useNotifeeService } from "./notifeeCore";

// Thông báo phải nổi lên NGAY CẢ KHI app đang mở hoặc đang khoá màn hình (giống
// Messenger/Zalo): nếu không đặt handler này thì Android/iOS sẽ nuốt thông báo.
try {
  Notifications.setNotificationHandler?.({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch {}
/** Nhóm nút trên thông báo tin nhắn: Trả lời nhanh + Đã xem (như Messenger). */
export const CHAT_CATEGORY = "tin-nhan";

export async function ensureMessageCategory() {
  try {
    await Notifications.setNotificationCategoryAsync?.(CHAT_CATEGORY, [
      {
        identifier: "tra-loi",
        buttonTitle: "Trả lời",
        textInput: {
          submitButtonTitle: "Gửi",
          placeholder: "Nhắn cho người thương…",
        },
      },
      { identifier: "da-xem", buttonTitle: "Đã xem" },
    ]);
  } catch {}
}

export async function ensureChannel() {
  if (Notifications.getPermissionsAsync === undefined) return false;
  // Kênh tin nhắn: mức cao nhất (MAX) + hiển thị công khai trên màn hình khoá
  // (PUBLIC) để khi có tin nhắn mới, màn hình khoá sáng lên, rung và đổ chuông.
  await Notifications.setNotificationChannelAsync("love-messages", {
    name: "Tin nhắn của người thương",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
    enableVibrate: true,
    vibrationPattern: [0, 250, 150, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  await Notifications.setNotificationChannelAsync("love-reminders", {
    name: "Lời nhắc yêu thương",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  return true;
}
/** Trạng thái quyền thông báo: "granted" | "denied" | "unknown". */
export async function notificationPermission() {
  try {
    if (Notifications.getPermissionsAsync === undefined) return "unknown";
    const permission = await Notifications.getPermissionsAsync();
    if (permission.status === "granted") return "granted";
    return permission.status === "undetermined" ? "unknown" : "denied";
  } catch {
    return "unknown";
  }
}
/** Hỏi quyền ngay khi mở app (Android 13+ mặc định chặn nếu chưa hỏi). */
export async function askNotificationPermission() {
  await ensureChannel();
  const before = await notificationPermission();
  if (before === "granted") return "granted";
  if (before === "unknown") {
    const granted = await requestNotifications();
    return granted ? "granted" : "denied";
  }
  return "denied";
}
/** Đã từ chối thì chỉ bật lại được trong Cài đặt của điện thoại. */
export async function openNotificationSettings() {
  try {
    await Linking.openSettings();
    return true;
  } catch {
    return false;
  }
}
export async function requestNotifications() {
  await ensureChannel();
  await ensureMessageCategory();
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted")
    permission = await Notifications.requestPermissionsAsync();
  return permission.status === "granted";
}

async function displayNotifeeLockScreenBanner(
  title: string,
  body: string,
  chat: boolean,
) {
  if (Platform.OS !== "android") return false;
  const mod = loadNotifee();
  const notifee = useNotifeeService();
  if (!notifee) return false;
  try {
    const channelId = await notifee.createChannel({
      id: chat ? "tin-nhan-khan-cap" : "loi-nhac-khan-cap",
      name: chat ? "Tin nhắn màn hình khoá" : "Lời nhắc màn hình khoá",
      importance: mod?.AndroidImportance?.HIGH ?? 4,
      visibility: mod?.AndroidVisibility?.PUBLIC ?? 1,
      sound: "default",
      vibration: true,
      vibrationPattern: [200, 300, 150, 300],
    });
    await notifee.displayNotification({
      id: `msg-${Date.now()}`,
      title,
      body,
      android: {
        channelId,
        category: mod?.AndroidCategory?.MESSAGE ?? "msg",
        importance: mod?.AndroidImportance?.HIGH ?? 4,
        visibility: mod?.AndroidVisibility?.PUBLIC ?? 1,
        smallIcon: "ic_launcher",
        pressAction: { id: "default", launchActivity: "default" },
      },
    });
    return true;
  } catch {
    return false;
  }
}

/** Báo ngay lập tức (tin nhắn mới, cuộc gọi đến, nhật ký mới, cảm xúc mới) —
 * hiển thị ngay cả khi khoá màn hình hoặc đang ở app khác, kèm đổ chuông & rung. */
export async function notifyNow(
  title: string,
  body: string,
  chat = false,
  extra: Record<string, unknown> = {},
) {
  try {
    if (Notifications.getPermissionsAsync === undefined) return false;
    const permission = await Notifications.getPermissionsAsync();
    if (permission.status !== "granted") {
      void displayNotifeeLockScreenBanner(title, body, chat);
      return false;
    }
    await ensureChannel();
    if (chat) await ensureMessageCategory();
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: "default",
        // Tin nhắn: bấm vào là mở thẳng đoạn chat; kéo xuống có nút Trả lời.
        categoryIdentifier: chat ? CHAT_CATEGORY : undefined,
        data: {
          key: `now-${Date.now()}`,
          open: chat ? "chat" : "alerts",
          ...extra,
        },
      },
      trigger: chat
        ? { channelId: "love-messages" }
        : { channelId: "love-reminders" },
    });
    return true;
  } catch {
    return await displayNotifeeLockScreenBanner(title, body, chat);
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
