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
 * Thư viện dùng: @notifee/react-native (miễn phí, mã nguồn mở), gọi qua `require`
 * muộn và bọc trong try/catch: máy nào không nạp được thì cuộc gọi vẫn chạy như
 * cũ, chỉ là tắt màn hình có thể bị hệ điều hành tạm dừng.
 *
 * iOS không có dịch vụ chạy nổi: chỉ cần khai báo `UIBackgroundModes` gồm `audio`
 * và `voip` trong app.config.js, cộng với `setAudioModeAsync({ shouldPlayInBackground: true })`,
 * là hệ thống cho phép tiếp tục thu/phát tiếng khi ở chế độ nền.
 */
import { Platform } from "react-native";

// Nạp muộn để app vẫn chạy khi thiếu thư viện native.
declare const require: (name: string) => unknown;

let notifeeModule: any = null;
let notifeeProblem = "";
let serviceReady = false;
let hangupHandler: (() => void) | null = null;

/** Mã kênh thông báo và mã thông báo của cuộc gọi (một cuộc gọi mỗi lúc). */
const CALL_CHANNEL = "cuoc-goi";
const CALL_NOTIFICATION = "cuoc-goi-dang-mo";

function loadNotifee(): any {
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

/** Máy này có mở được dịch vụ chạy nổi không (để Cài đặt báo cho đúng). */
export function callServiceSupport() {
  if (Platform.OS !== "android")
    return { ok: false, detail: "iOS không cần dịch vụ chạy nổi" };
  const mod = loadNotifee();
  if (mod?.default) return { ok: true, detail: "có dịch vụ chạy nổi" };
  return { ok: false, detail: notifeeProblem || "máy này không có Notifee" };
}

/**
 * Nút "Cúp máy" trên thông báo sẽ gọi hàm này. App truyền vào việc kết thúc cuộc
 * gọi — nên nút trên thông báo và nút trên màn hình làm y như nhau.
 */
export function onCallServiceHangup(handler: () => void) {
  hangupHandler = handler;
}

/**
 * Mở dịch vụ chạy nổi + thông báo "Cuộc gọi đang diễn ra…". Gọi khi cuộc gọi đã
 * được nghe máy (còn ở màn hình chuông thì chưa cần, và Android cũng chỉ cho mở
 * dịch vụ thuộc loại micro khi app đang ở tiền cảnh).
 */
export async function startCallService(partnerName: string) {
  if (Platform.OS !== "android") return false;
  const mod = loadNotifee();
  if (!mod?.default) return false;
  const notifee = mod.default;
  try {
    if (!serviceReady) {
      // Dịch vụ chỉ đăng ký một lần cho cả vòng đời app; Notifee giữ dịch vụ sống
      // cho tới khi ta gọi stopForegroundService.
      notifee.registerForegroundService(() => new Promise(() => {}));
      notifee.onForegroundEvent(({ type, detail }: any) => {
        const action = detail?.pressAction?.id;
        if (type === mod.EventType.ACTION_PRESS && action === "cup-may")
          hangupHandler?.();
      });
      serviceReady = true;
    }
    const channelId = await notifee.createChannel({
      id: CALL_CHANNEL,
      name: "Cuộc gọi",
      importance: mod.AndroidImportance.LOW,
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
          mod.AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_MICROPHONE,
        ],
        ongoing: true,
        autoCancel: false,
        onlyAlertOnce: true,
        showTimestamp: false,
        smallIcon: "ic_launcher",
        pressAction: { id: "mo-app" },
        actions: [{ title: "Cúp máy", pressAction: { id: "cup-may" } }],
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
  const mod = loadNotifee();
  if (!mod?.default) return;
  const notifee = mod.default;
  try {
    await notifee.stopForegroundService();
  } catch {}
  try {
    await notifee.cancelNotification(CALL_NOTIFICATION);
  } catch {}
}
