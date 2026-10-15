/**
 * Một chỗ duy nhất giữ Notifee (thông báo + dịch vụ chạy nổi trên Android).
 *
 * Vì sao phải gom lại: Notifee chỉ có MỘT hàm xử lý sự kiện cho cả app. Nếu
 * cuộc gọi và phần "giữ kết nối nền" mỗi thứ tự đăng ký riêng thì cái sau đè
 * cái trước — bấm "Cúp máy" trên thông báo sẽ không còn tác dụng. Ở đây đăng ký
 * một lần (cả `onForegroundEvent` lẫn `onBackgroundEvent`) rồi chia sự kiện cho
 * từng người dùng.
 *
 * Nạp muộn (`require` trong try/catch): máy nào thiếu thư viện native thì app
 * vẫn chạy bình thường, chỉ mất phần chạy nền.
 */
import { Platform } from "react-native";

declare const require: (name: string) => unknown;

type Action = { actionId: string; notificationId?: string };
type Handler = (action: Action) => void;

let notifeeModule: any = null;
let notifeeProblem = "";
let listenerReady = false;
const handlers: Handler[] = [];

export function loadNotifee(): any {
  if (notifeeModule) return notifeeModule;
  if (notifeeProblem) return null;
  try {
    notifeeModule = require("@notifee/react-native");
    return notifeeModule;
  } catch (error) {
    notifeeProblem =
      error instanceof Error ? error.message : "Không nạp được Notifee.";
    return null;
  }
}

/** Máy này có dùng được Notifee không (để Cài đặt báo cho đúng). */
export function notifeeSupport(): { ok: boolean; detail: string } {
  if (Platform.OS !== "android")
    return { ok: false, detail: "iOS không cần dịch vụ chạy nổi" };
  const mod = loadNotifee();
  if (mod?.default) return { ok: true, detail: "có dịch vụ chạy nổi" };
  return { ok: false, detail: notifeeProblem || "máy này không có Notifee" };
}

function dispatchNotifeeEvent(mod: any, event: any) {
  const { type, detail } = event ?? {};
  if (type !== mod?.EventType?.ACTION_PRESS) return;
  const actionId = String(detail?.pressAction?.id ?? "");
  const notificationId = detail?.notification?.id
    ? String(detail.notification.id)
    : undefined;
  for (const handler of handlers) {
    try {
      handler({ actionId, notificationId });
    } catch {}
  }
}

/**
 * Đăng ký dịch vụ chạy nổi (gọi bao nhiêu lần cũng được). Thân dịch vụ chỉ cần
 * một Promise không bao giờ kết thúc: hệ thống giữ app sống cho tới khi ta gọi
 * `stopForegroundService()`.
 */
export function useNotifeeService(): any {
  const mod = loadNotifee();
  if (!mod?.default) return null;
  const notifee = mod.default;
  if (!listenerReady) {
    try {
      notifee.registerForegroundService(() => new Promise(() => {}));
    } catch {}
    try {
      notifee.onForegroundEvent((event: any) => {
        dispatchNotifeeEvent(mod, event);
      });
    } catch {}
    try {
      notifee.onBackgroundEvent(async (event: any) => {
        dispatchNotifeeEvent(mod, event);
      });
    } catch {}
    listenerReady = true;
  }
  return notifee;
}

/** Đăng ký nhận sự kiện bấm nút trên thông báo của Notifee. */
export function onNotifeeAction(handler: Handler) {
  handlers.push(handler);
  useNotifeeService();
}
