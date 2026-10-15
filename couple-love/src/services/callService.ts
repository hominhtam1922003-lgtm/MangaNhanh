/**
 * Quản lý dịch vụ chạy nổi (Foreground Service) cho cuộc gọi & định tuyến âm
 * thanh Loa ngoài (Speakerphone) / Loa thoại trong (Earpiece).
 *
 * 1. Tách biệt hoàn toàn hai luồng âm thanh (`applyCallAudioRoute`):
 *    - Khi tắt loa ngoài (`speakerOn === false`): chuyển âm thanh qua Loa thoại
 *      trong (Earpiece - áp tai, `shouldRouteThroughEarpiece: true`).
 *    - Khi bật loa ngoài (`speakerOn === true`): ép luồng âm thanh phát ra Loa
 *      ngoài (Speaker - âm lượng lớn, `shouldRouteThroughEarpiece: false`).
 * 2. Khi có cuộc gọi đến lúc tắt/khoá màn hình (`startIncomingCallService`):
 *    Mở thông báo ưu tiên cực đại kèm `fullScreenAction` đánh thức màn hình,
 *    đổ chuông/rung và hiển thị hai nút Nghe máy / Từ chối.
 */
import { Platform } from "react-native";
import { AudioModule, setAudioModeAsync } from "expo-audio";
import {
  notifeeSupport,
  onNotifeeAction,
  useNotifeeService,
} from "./notifeeCore";

declare const require: (name: string) => unknown;

let hangupHandler: (() => void) | null = null;
let acceptHandler: (() => void) | null = null;
let rejectHandler: (() => void) | null = null;
let actionReady = false;

/** Mã kênh thông báo, mã thông báo và mã các nút hành động. */
const CALL_CHANNEL = "cuoc-goi";
const INCOMING_CALL_CHANNEL = "cuoc-goi-den-khan";
const CALL_NOTIFICATION = "cuoc-goi-dang-mo";
const CALL_HANGUP_ACTION = "cup-may";
const CALL_ACCEPT_ACTION = "nghe-may";
const CALL_REJECT_ACTION = "tu-choi-cuoc-goi";

function loadInCallManager(): any {
  try {
    const mod = require("react-native-incall-manager") as any;
    return mod?.default ?? mod ?? null;
  } catch {
    return null;
  }
}

/**
 * Chuyển đổi dứt điểm luồng âm thanh giữa Loa ngoài (Speaker) và Loa thoại trong
 * (Earpiece) trên cả Android lẫn iOS.
 */
export async function applyCallAudioRoute(
  speakerOn: boolean,
): Promise<boolean> {
  const playThroughEarpiece = !speakerOn;
  try {
    const inCall = loadInCallManager();
    if (inCall) {
      inCall.setForceSpeakerphoneOn?.(speakerOn);
      inCall.setSpeakerphoneOn?.(speakerOn);
    }
  } catch {}

  try {
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
      interruptionModeAndroid: "doNotMix",
      shouldRouteThroughEarpiece: playThroughEarpiece,
    });
  } catch {}

  if (Platform.OS === "ios") {
    try {
      await (AudioModule as any)?.setAudioModeAsync?.({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: "doNotMix",
        shouldRouteThroughEarpiece: playThroughEarpiece,
      });
    } catch {}
  }

  return speakerOn;
}

/** Máy này có mở được dịch vụ chạy nổi không (để Cài đặt báo cho đúng). */
export function callServiceSupport() {
  return notifeeSupport();
}

function ensureActionListener() {
  if (actionReady) return;
  onNotifeeAction(({ actionId }) => {
    if (actionId === CALL_HANGUP_ACTION) hangupHandler?.();
    else if (actionId === CALL_ACCEPT_ACTION) acceptHandler?.();
    else if (actionId === CALL_REJECT_ACTION) rejectHandler?.();
  });
  actionReady = true;
}

/**
 * Nút "Cúp máy" trên thông báo sẽ gọi hàm này.
 */
export function onCallServiceHangup(handler: () => void) {
  hangupHandler = handler;
  ensureActionListener();
}

/**
 * Nút "Nghe máy" / "Từ chối" trên thông báo cuộc gọi đến lúc khoá màn hình.
 */
export function onCallServiceAnswer(
  onAccept: () => void,
  onReject: () => void,
) {
  acceptHandler = onAccept;
  rejectHandler = onReject;
  ensureActionListener();
}

/**
 * Đánh thức thiết bị và hiển thị thông báo cuộc gọi đến toàn màn hình
 * (`fullScreenAction`) kèm rung và chuông khi có cuộc gọi đến lúc tắt màn hình.
 */
export async function startIncomingCallService(
  partnerName: string,
  isVideo = false,
) {
  if (Platform.OS !== "android") return false;
  const notifee = useNotifeeService();
  if (!notifee) return false;
  ensureActionListener();
  try {
    const channelId = await notifee.createChannel({
      id: INCOMING_CALL_CHANNEL,
      name: "Cuộc gọi đến",
      importance: notifee.AndroidImportance?.HIGH ?? 4,
      sound: "default",
      vibration: true,
      vibrationPattern: [300, 600, 400, 600],
    });
    await notifee.displayNotification({
      id: CALL_NOTIFICATION,
      title: `${partnerName || "Người thương"} đang gọi ${isVideo ? "Video " : ""}cho bạn 📞`,
      body: "Chạm để mở màn hình cuộc gọi hoặc bấm Nghe máy ngay",
      android: {
        channelId,
        category: notifee.AndroidCategory?.CALL ?? "call",
        importance: notifee.AndroidImportance?.HIGH ?? 4,
        ongoing: true,
        autoCancel: false,
        smallIcon: "ic_launcher",
        fullScreenAction: {
          id: "default",
          launchActivity: "default",
        },
        pressAction: {
          id: "default",
          launchActivity: "default",
        },
        actions: [
          {
            title: "Từ chối",
            pressAction: { id: CALL_REJECT_ACTION, launchActivity: "default" },
          },
          {
            title: "Nghe máy",
            pressAction: { id: CALL_ACCEPT_ACTION, launchActivity: "default" },
          },
        ],
      },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Mở dịch vụ chạy nổi + thông báo "Cuộc gọi đang diễn ra…". Gọi khi cuộc gọi đã
 * được nghe máy.
 */
export async function startCallService(partnerName: string) {
  if (Platform.OS !== "android") return false;
  const notifee = useNotifeeService();
  if (!notifee) return false;
  ensureActionListener();
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
 * Kết thúc cuộc gọi thì phải tắt dịch vụ + xoá thông báo ngay.
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
