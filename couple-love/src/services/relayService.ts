/**
 * Giữ kết nối khi app ở chế độ nền / tắt màn hình.
 *
 * Vì sao cần: tin nhắn của hai bạn đi bằng MQTT ngay trong app (không máy chủ).
 * Khi màn hình tắt, Android sẽ đưa app vào chế độ ngủ và cắt kết nối — máy kia
 * nhắn mà máy này không nổi thông báo cho tới khi mở app. Bật dịch vụ chạy nổi
 * kiểu `dataSync` (kèm một thông báo thường trực, có nút **Tắt**) là cách đúng
 * của Android để giữ kết nối sống, và bản 1.16.0 có công tắc trong Cài đặt.
 *
 * Điều app KHÔNG làm được (nói thẳng để bạn biết): nếu người dùng vào Cài đặt
 * của điện thoại và **Buộc dừng** app, hoặc gạt app khỏi danh sách gần đây, thì
 * mọi kết nối trong app đều tắt. Muốn có thông báo trong trường hợp đó thì phải
 * dùng dịch vụ đẩy (FCM/APNs) kèm máy chủ riêng — trái với cách app đang chạy
 * (cài là dùng, không tài khoản, không máy chủ).
 */
import { Platform } from "react-native";
import {
  loadNotifee,
  notifeeSupport,
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

/** Bật dịch vụ giữ kết nối — gọi khi app đang ở tiền cảnh (Android bắt buộc). */
export async function startRelayService(partnerName?: string | null) {
  if (Platform.OS !== "android") return false;
  const notifee = useNotifeeService();
  if (!notifee) return false;
  try {
    const channelId = await notifee.createChannel({
      id: CHANNEL,
      name: "Giữ kết nối nhận tin nhắn",
      importance: 2, // thấp: không kêu, chỉ để hệ thống biết app đang chạy nền
      sound: undefined,
    });
    await notifee.displayNotification({
      id: NOTIFICATION,
      title: "Đang giữ kết nối",
      body: partnerName
        ? `Tin nhắn của ${partnerName} sẽ nổi ngay cả khi tắt màn hình`
        : "Tin nhắn sẽ nổi ngay cả khi tắt màn hình",
      android: {
        channelId,
        asForegroundService: true,
        // Kiểu "dataSync": đúng loại công việc là giữ kết nối để nhận dữ liệu.
        // Khai trong plugins/with-call-foreground-service.js.
        foregroundServiceTypes: [
          loadNotifee()?.AndroidForegroundServiceType
            ?.FOREGROUND_SERVICE_TYPE_DATA_SYNC ?? 1,
        ],
        ongoing: true,
        autoCancel: false,
        onlyAlertOnce: true,
        showTimestamp: false,
        smallIcon: "ic_launcher",
        pressAction: { id: "default" },
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

export function relayServiceNotificationId() {
  return NOTIFICATION;
}

/** Người dùng bấm nút "Tắt" trên thông báo giữ kết nối → app tắt công tắc. */
export function onRelayServiceStop(handler: () => void) {
  onNotifeeAction(({ actionId }) => {
    if (actionId === RELAY_SERVICE_STOP_ACTION) handler();
  });
}
