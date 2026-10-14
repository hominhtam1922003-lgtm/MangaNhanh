/**
 * Giữ cuộc gọi sống khi tắt màn hình hoặc đưa app xuống chạy nền.
 *
 * Vì sao cần: từ Android 9, app ở chế độ nền bị cấm thu micro; từ Android 10–14
 * hệ điều hành còn mạnh tay giết app đang chạy nền để tiết kiệm pin — đó là lý do
 * cuộc gọi "mất tiếng" khi máy tắt màn hình. Cách đúng của Android là mở một
 * DỊCH VỤ CHẠY NỔI (foreground service) ngay khi cuộc gọi bắt đầu: hệ thống thấy
 * có thông báo "Cuộc gọi đang diễn ra…" nên không giết app, micro vẫn thu được,
 * và trên thông báo có luôn nút **Cúp máy** để kết thúc khi app đang ẩn.
 *
 * Thư viện dùng: @notifee/react-native (miễn phí, mã nguồn mở) qua
 * `services/notifeeCore` — một chỗ duy nhất giữ thông báo + dịch vụ chạy nổi cho
 * cả cuộc gọi lẫn phần "giữ kết nối nền" (nếu mỗi thứ tự đăng ký riêng thì cái
 * sau đè cái trước và nút Cúp máy sẽ mất tác dụng).
 *
 * iOS không có dịch vụ chạy nổi: chỉ cần khai báo `UIBackgroundModes` gồm `audio`
 * và `voip` trong app.config.js, cộng với `setAudioModeAsync({ shouldPlayInBackground: true })`,
 * là hệ thống cho phép tiếp tục thu/phát tiếng khi ở chế độ nền.
 */
import { Platform } from "react-native";
import {
  notifeeSupport,
  onNotifeeAction,
  useNotifeeService,
} from "./notifeeCore";

let hangupHandler: (() => void) | null = null;
let actionReady = false;

/** Mã kênh thông báo, mã thông báo và mã nút Cúp máy. */
const CALL_CHANNEL = "cuoc-goi";
const CALL_NOTIFICATION = "cuoc-goi-dang-mo";
const CALL_HANGUP_ACTION = "cup-may";

/** Máy này có mở được dịch vụ chạy nổi không (để Cài đặt báo cho đúng). */
export function callServiceSupport() {
  return notifeeSupport();
}

/**
 * Nút "Cúp máy" trên thông báo sẽ gọi hàm này. App truyền vào việc kết thúc cuộc
 * gọi — nên nút trên thông báo và nút trên màn hình làm y như nhau.
 */
export function onCallServiceHangup(handler: () => void) {
  hangupHandler = handler;
  if (actionReady) return;
  onNotifeeAction(({ actionId }) => {
    if (actionId === CALL_HANGUP_ACTION) hangupHandler?.();
  });
  actionReady = true;
}

/**
 * Mở dịch vụ chạy nổi + thông báo "Cuộc gọi đang diễn ra…". Gọi khi cuộc gọi đã
 * được nghe máy (còn ở màn hình chuông thì chưa cần, và Android cũng chỉ cho mở
 * dịch vụ thuộc loại micro khi app đang ở tiền cảnh).
 */
export async function startCallService(partnerName: string) {
  if (Platform.OS !== "android") return false;
  const notifee = useNotifeeService();
  if (!notifee) return false;
  if (!actionReady) onCallServiceHangup(() => {});
  try {
    const channelId = await notifee.createChannel({
      id: CALL_CHANNEL,
      name: "Cuộc gọi",
      importance: notifee.AndroidImportance?.LOW ?? 2,
    });
    await notifee.displayNotification({
      id: CALL_NOTIFICATION,
      title: "Cuộc gọi đang diễn ra…",
      body: partnerName
        ? `Đang nói chuyện với ${partnerName}`
        : "Đang nói chuyện với người thương",
      android: {
        channelId,
        asForegroundService: true,
        // Kiểu "microphone": Android 14 bắt buộc khai đúng kiểu này mới cho thu
        // micro khi app ở chế độ nền (xem plugins/with-call-foreground-service.js).
        foregroundServiceTypes: [
          notifee.AndroidForegroundServiceType
            ?.FOREGROUND_SERVICE_TYPE_MICROPHONE ?? 128,
        ],
        ongoing: true,
        autoCancel: false,
        onlyAlertOnce: true,
        showTimestamp: false,
        smallIcon: "ic_launcher",
        // Bấm vào thân thông báo là mở app (Notifee chỉ mở app với id "default").
        pressAction: { id: "default" },
        actions: [
          { title: "Cúp máy", pressAction: { id: CALL_HANGUP_ACTION } },
        ],
      },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Kết thúc cuộc gọi thì phải tắt dịch vụ + xoá thông báo ngay, nếu không hệ thống
 * vẫn giữ app chạy nền và hao pin vô ích.
 */
export async function stopCallService() {
  if (Platform.OS !== "android") return;
  const notifee = useNotifeeService();
  if (!notifee) return;
  try {
    await notifee.stopForegroundService();
  } catch {}
  try {
    await notifee.cancelNotification(CALL_NOTIFICATION);
  } catch {}
}
