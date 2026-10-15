/**
 * Một chỗ duy nhất giữ Notifee (thông báo + dịch vụ chạy nổi trên Android).
 *
 * Vì sao phải gom lại: Notifee chỉ có MỘT hàm xử lý sự kiện cho cả app. Nếu
 * cuộc gọi và phần "giữ kết nối nền" mỗi thứ tự đăng ký riêng thì cái sau đè
 * cái trước — bấm "Cúp máy" trên thông báo sẽ không còn tác dụng. Ở đây đăng ký
 * một lần (cả `onForegroundEvent` lẫn `onBackgroundEvent`) rồi chia sự kiện cho
 * từng người dùng, đồng thời chạy nhịp tim ngầm (`heartbeatHandlers`) giữ sống
 * kết nối MQTT / Supabase Realtime và WebRTC Signaling khi tắt màn hình.
 *
 * Nạp muộn (`require` trong try/catch): máy nào thiếu thư viện native thì app
 * vẫn chạy bình thường, chỉ mất phần chạy nền.
 */
import { Platform } from "react-native";

declare const require: (name: string) => unknown;

type Action = { actionId: string; notificationId?: string };
type Handler = (action: Action) => void;
type HeartbeatHandler = () => void | Promise<void>;

let notifeeModule: any = null;
let notifeeProblem = "";
let listenerReady = false;
let fgsTickTimer: ReturnType<typeof setInterval> | null = null;
const handlers: Handler[] = [];
const heartbeatHandlers: HeartbeatHandler[] = [];

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
    return { ok: false, detail: "iOS dùng chế độ chạy nền voip/audio" };
  const mod = loadNotifee();
  if (mod?.default) return { ok: true, detail: "có dịch vụ chạy nổi" };
  return { ok: false, detail: notifeeProblem || "máy này không có Notifee" };
}

function runHeartbeats() {
  for (const fn of heartbeatHandlers) {
    try {
      void fn();
    } catch {}
  }
}

function dispatchNotifeeEvent(mod: any, event: any) {
  const { type, detail } = event ?? {};
  const isActionPress = type === mod?.EventType?.ACTION_PRESS;
  const isBodyPress = type === mod?.EventType?.PRESS;
  if (!isActionPress && !isBodyPress) return;
  const actionId = String(
    detail?.pressAction?.id ?? (isBodyPress ? "default" : ""),
  );
  if (!actionId) return;
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
 * Đăng ký dịch vụ chạy nổi (gọi bao nhiêu lần cũng được). Thân dịch vụ giữ một
 * Promise không kết thúc kèm bộ đếm nhịp 12 giây giữ sống kết nối MQTT /
 * Supabase Realtime và WebRTC Signaling khi khoá màn hình.
 */
export function useNotifeeService(): any {
  const mod = loadNotifee();
  if (!mod?.default) return null;
  const notifee = mod.default;
  if (!listenerReady) {
    try {
      notifee.registerForegroundService(
        () =>
          new Promise(() => {
            if (fgsTickTimer) clearInterval(fgsTickTimer);
            fgsTickTimer = setInterval(runHeartbeats, 12000);
            runHeartbeats();
          }),
      );
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

/**
 * Đăng ký hàm giữ kết nối ngầm chạy định kỳ bên trong Foreground Service
 * (duy trì MQTT / Supabase Realtime không bị đóng băng khi khoá màn hình).
 */
export function onForegroundHeartbeat(handler: HeartbeatHandler) {
  if (!heartbeatHandlers.includes(handler)) {
    heartbeatHandlers.push(handler);
  }
  useNotifeeService();
}
