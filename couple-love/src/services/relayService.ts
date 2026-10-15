/**
 * Duy trì kết nối ngầm (Persistent Connection) khi app ở chế độ nền / khoá màn hình.
 *
 * Cấu hình vòng đời kết nối MQTT / Supabase Realtime và WebRTC Signaling chạy
 * trong một Foreground Service (trên Android) kèm nhịp tim tự nối lại định kỳ,
 * để hệ thống không đóng băng socket khi người dùng tắt màn hình hoặc chuyển
 * sang ứng dụng khác.
 */
import { Platform } from "react-native";
import {
  loadNotifee,
  notifeeSupport,
  onForegroundHeartbeat,
  onNotifeeAction,
  useNotifeeService,
} from "./notifeeCore";

const CHANNEL = "giu-ket-noi";
const NOTIFICATION = "giu-ket-noi-dang-mo";
/** Người dùng bấm nút "Tắt" trên thông báo giữ kết nối. */
export const RELAY_SERVICE_STOP_ACTION = "tat-giu-ket-noi";

export function relayServiceSupport() {
  return notifeeSupport();
}

/**
 * Đăng ký hàm kiểm tra và hồi phục kết nối MQTT / Supabase Realtime định kỳ
 * bên trong Foreground Service ngay cả khi màn hình đã tắt.
 */
export function registerPersistentConnectionHeartbeat(
  handler: () => void | Promise<void>,
) {
  onForegroundHeartbeat(handler);
}

/** Bật dịch vụ giữ kết nối — gọi khi app đang mở hoặc có sự kiện nền. */
export async function startRelayService(partnerName?: string | null) {
  if (Platform.OS !== "android") return false;
  const mod = loadNotifee();
  const notifee = useNotifeeService();
  if (!notifee) return false;
  try {
    const channelId = await notifee.createChannel({
      id: CHANNEL,
      name: "Giữ kết nối nhận tin nhắn & cuộc gọi",
      importance: 2, // thấp: không kêu, chỉ để hệ thống giữ sống tiến trình nền
      visibility: mod?.AndroidVisibility?.PUBLIC ?? 1,
      sound: undefined,
    });
    await notifee.displayNotification({
      id: NOTIFICATION,
      title: "Đang giữ kết nối",
      body: partnerName
        ? `Tin nhắn & cuộc gọi của ${partnerName} sẽ nổi ngay cả khi tắt màn hình`
        : "Tin nhắn & cuộc gọi sẽ nổi ngay cả khi tắt màn hình",
      android: {
        channelId,
        asForegroundService: true,
        // Kiểu "dataSync": giữ kết nối MQTT / Supabase Realtime & WebRTC Signaling.
        // Khai trong plugins/with-call-foreground-service.js.
        foregroundServiceTypes: [
          mod?.AndroidForegroundServiceType
            ?.FOREGROUND_SERVICE_TYPE_DATA_SYNC ?? 1,
        ],
        ongoing: true,
        autoCancel: false,
        onlyAlertOnce: true,
        showTimestamp: false,
        smallIcon: "ic_launcher",
        pressAction: { id: "default", launchActivity: "default" },
        actions: [
          { title: "Tắt", pressAction: { id: RELAY_SERVICE_STOP_ACTION } },
        ],
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function stopRelayService() {
  if (Platform.OS !== "android") return;
  const notifee = useNotifeeService();
  if (!notifee) return;
  try {
    await notifee.stopForegroundService();
  } catch {}
  try {
    await notifee.cancelNotification(NOTIFICATION);
  } catch {}
}

/** Người dùng bấm nút "Tắt" trên thông báo giữ kết nối → app tắt công tắc. */
export function onRelayServiceStop(handler: () => void) {
  onNotifeeAction(({ actionId }) => {
    if (actionId === RELAY_SERVICE_STOP_ACTION) handler();
  });
}
