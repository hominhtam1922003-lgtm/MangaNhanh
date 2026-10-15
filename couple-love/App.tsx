// Phải nạp trước các thư viện khác: react-native-gesture-handler cần đăng ký
// native module trước khi cây giao diện được dựng.
import "react-native-gesture-handler";
import "./global.css";
import React, { useState, useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  AccessibilityInfo,
  ActivityIndicator,
  AppState,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as LocalAuthentication from "expo-local-authentication";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { secureStorage } from "./src/services/storage";
import CloudApp from "./src/screens/CloudApp";
import ModeChooser from "./src/screens/ModeChooser";
import LockScreen from "./src/components/LockScreen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { emptyState, reduce } from "./src/logic/localState.mjs";
import {
  clearLocalData,
  loadState,
  persistState,
} from "./src/services/localdb";
import type { State } from "./src/services/localdb";
import {
  askNotificationPermission,
  dueAlertActions,
  notifyNow,
  notificationPermission,
  openNotificationSettings,
  requestNotifications,
  rescheduleEverything,
} from "./src/services/localnotify";
import {
  RelayClient,
  payloadKey,
  relayPayloadFor,
  relaySelfTest,
  roomFromPair,
} from "./src/services/relay";
import {
  clearCrash,
  describe,
  readCrash,
  saveCrash,
} from "./src/services/crashlog";
import {
  PhotoAssembler,
  missingPhotoIds,
  missingVoiceIds,
  photoMessages,
  CHAT_PHOTO_LIMIT_BYTES,
  VOICE_LIMIT_BYTES,
  WALLPAPER_LIMIT_BYTES,
} from "./src/services/momentTransfer.mjs";
import ChatLocal from "./src/screens/local/ChatLocal";
import CallLocal from "./src/screens/local/CallLocal";
import {
  CALL_ALIVE_MS,
  callEvent,
  callTimedOut,
  newCall,
  ringTimedOut,
} from "./src/logic/callLogic.mjs";
import type { CallInfo } from "./src/logic/callLogic.mjs";
// Tiếng nói trong cuộc gọi: từng mảnh ngắn, nói liên tục không cần giữ nút.
import {
  CALL_CLOSE_MS,
  CALL_FRAME_MS,
  callLogText,
  frameUsable,
  newAudioQueue,
  pushFrame,
} from "./src/logic/callAudio.mjs";
import type { AudioFrame } from "./src/logic/callAudio.mjs";
import { AudioModule, setAudioModeAsync, useAudioRecorder } from "expo-audio";
import { RtcCall, rtcSupport } from "./src/services/rtcCall";
import {
  onCallServiceHangup,
  startCallService,
  stopCallService,
} from "./src/services/callService";
// Giữ kết nối khi app ở nền / tắt màn hình để tin nhắn vẫn nổi thông báo.
import {
  onRelayServiceStop,
  startRelayService,
  stopRelayService,
} from "./src/services/relayService";
// Lưu ảnh người thương gửi vào thư viện ảnh của máy.
import { savePhotoToDevice } from "./src/services/media";
import { TYPING_HOLD_MS, TYPING_SEND_MS } from "./src/logic/chatExtras.mjs";
/** Ảnh đại diện nhỏ nên cho hạn mức ảnh riêng khi gửi qua kênh ghép nối. */
import { AVATAR_LIMIT_BYTES } from "./src/services/momentTransfer.mjs";
import { RTC_RETRY_SIGNAL_MS, rtcStatusText } from "./src/logic/rtcSignal.mjs";
import type { RtcState } from "./src/logic/rtcSignal.mjs";
import * as DocumentPicker from "expo-document-picker";
import { dueLoveNote, waitingNotice } from "./src/logic/autoLove.mjs";
import { loveNoteFor } from "./src/logic/lovelines.mjs";
import { wallpaperFile } from "./src/logic/localState.mjs";
import {
  pairGate,
  gateReasonText,
  inviteSecretForCode,
} from "./src/logic/pairing.mjs";
import {
  acceptPartnerInvite,
  accountConfigured,
  currentSession,
  saveAccountProfile,
  uploadAvatar,
  ensureAccount,
  pairWithCode,
  signInWithAccount,
  signInAnonymously as signInAnonymous,
  signInWithProvider,
  signOut as signOutAccount,
  unpairAccount,
  watchAccount,
} from "./src/services/account";
import type {
  Account,
  AuthProvider,
  PairingWatcher,
} from "./src/services/account";
import { ThemeProvider, useTheme } from "./src/theme/ThemeContext";
import {
  imageBase64,
  imageExists,
  imageUri,
  saveImage,
  writeBase64,
} from "./src/services/localdb";
import * as Location from "expo-location";
import HomeLocal from "./src/screens/local/HomeLocal";
import CycleLocal from "./src/screens/local/CycleLocal";
import DiaryLocal from "./src/screens/local/DiaryLocal";
import PairLocal from "./src/screens/local/PairLocal";
import PairGate from "./src/screens/local/PairGate";
import SettingsLocal from "./src/screens/local/SettingsLocal";
import { LinearGradient } from "expo-linear-gradient";
import {
  Button,
  Card,
  Note,
  ThemeDeco,
  Title,
  confirm,
} from "./src/components/UI";
const localTabs = [
  { id: "home", label: "Yêu nhau", icon: "♡" },
  { id: "chat", label: "Tin nhắn", icon: "✉" },
  { id: "cycle", label: "Chăm sóc", icon: "✿" },
  { id: "diary", label: "Nhật ký", icon: "▤" },
  { id: "settings", label: "Cài đặt", icon: "⚙" },
];
function LocalApp({ onSwitchMode }: { onSwitchMode: () => void }) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("home");
  const [alertPage, setAlertPage] = useState(false);
  const [lockEnabled, setLockEnabled] = useState(false);
  const [locked, setLocked] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [relayStatus, setRelayStatus] = useState<{
    state: string;
    broker: string | null;
    partnerOnline: boolean;
    partnerName?: string | null;
    readyCount?: number;
    summary?: { host: string; state: string }[];
  }>({ state: "off", broker: null, partnerOnline: false });
  const [relayLog, setRelayLog] = useState<string[]>([]);
  const assemblerRef = useRef(new PhotoAssembler());
  const appStartRef = useRef(Date.now());
  // Mã ảnh/tin thoại đã xin gửi lại, kèm lúc xin: vẫn thiếu tệp thì xin lại sau
  // 45 giây (trước đây xin một lần rồi thôi nên tin thoại mất là mất luôn).
  const askedPhotosRef = useRef<Map<string, number>>(new Map());
  const shouldAsk = (id: string, waitMs = 45000) => {
    const askedAt = askedPhotosRef.current.get(id) ?? 0;
    return Date.now() - askedAt > waitMs;
  };
  const [partnerTyping, setPartnerTyping] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);
  const [notifyState, setNotifyState] = useState<
    "unknown" | "granted" | "denied"
  >("unknown");
  // Cuộc gọi: trạng thái thật nằm trong ref để tín hiệu qua kênh luôn đọc được
  // bản mới nhất, state chỉ để vẽ lại giao diện.
  const [call, setCall] = useState<CallInfo | null>(null);
  const callRef = useRef<CallInfo | null>(null);
  const applyCall = (next: CallInfo | null) => {
    callRef.current = next;
    setCall(next);
  };
  const [callTick, setCallTick] = useState(0);
  // Ghi âm cuộc gọi: mảnh 16 kHz mono, 24 kbit/s (nhẹ, đủ rõ tiếng nói).
  const callRecorder = useAudioRecorder({
    extension: ".m4a",
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 24000,
    android: { outputFormat: "mpeg4", audioEncoder: "aac" },
    ios: {
      outputFormat: "aac ",
      audioQuality: 32,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
    web: { mimeType: "audio/webm", bitsPerSecond: 24000 },
  });
  // Tiếng của người thương đang chờ phát lên loa (hàng đợi nhỏ, giữ độ trễ thấp).
  const callQueueRef = useRef<AudioFrame[]>(newAudioQueue());
  const callSeqRef = useRef(0);
  const callLoggedRef = useRef("");
  // Đang phát tiếng của người thương thì tạm không ghi âm: tránh vọng tiếng loa
  // vào mic (gây ù và làm câu chuyện đứt quãng).
  const callPlayingRef = useRef(false);
  const lastAliveSentRef = useRef(0);
  // Đường tiếng trực tiếp (WebRTC): tiếng đi thẳng máy-tới-máy nên không còn
  // cảnh cắt thành từng mảnh rồi ghép lại. Không nối được thì vẫn có đường
  // tiếng cũ qua kênh ghép nối.
  const rtcRef = useRef<RtcCall | null>(null);
  const rtcLiveRef = useRef(false);
  const [rtcLive, setRtcLive] = useState(false);
  // Số liệu thật của đường tiếng (byte vào/ra) để thấy ngay có tiếng hay không.
  // Số liệu thật của WebRTC: byte vào/ra + cường độ tiếng nói (0..1) — màn hình
  // gọi dùng mức này cho trái tim đập theo giọng người thương.
  const [rtcAudio, setRtcAudio] = useState({
    inBytes: 0,
    outBytes: 0,
    level: 0,
    levelSource: "",
  });
  // WebRTC chưa nối được (máy không có thư viện, mạng chặn, micro bận) thì mới
  // bật lại đường tiếng cũ — mic không thể chạy hai nơi cùng lúc.
  const [rtcFallback, setRtcFallback] = useState(false);
  const [rtcInfo, setRtcInfo] = useState<{ state: RtcState; detail: string }>({
    state: "off",
    detail: "",
  });
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistPending = useRef<State | null>(null);
  const lastLiteRef = useRef("");
  const lastSlowRef = useRef(0);
  const noticeRef = useRef<{ key: string; stage: string; at: number } | null>(
    null,
  );
  const momentQueueRef = useRef(false);
  const messageQueueRef = useRef(false);
  const [lastError, setLastError] = useState("");
  const [selfTest, setSelfTest] = useState<
    { name: string; ok: boolean; detail: string }[]
  >([]);
  const readyRef = useRef(false);
  const authenticating = useRef(false);
  const stateRef = useRef<State | null>(null);
  const relayRef = useRef<RelayClient | null>(null);
  const publishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bản app đang chạy, gửi kèm trong gói dữ liệu để máy kia biết có phải bản cũ.
  const appVersionRef = useRef(
    (() => {
      const version = Constants.expoConfig?.version ?? "?";
      const build = Constants.expoConfig?.android?.versionCode;
      return build ? `${version}/${build}` : version;
    })(),
  );
  const deviceIdRef = useRef(
    "d" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
  );
  const lastSentRef = useRef("");
  const sentRoomRef = useRef("");
  const joinedRef = useRef("");
  /**
   * Tài khoản ghép nối (Google/Facebook) + trạng thái kiểm tra với máy chủ. Từ
   * 1.18.0 app KHÔNG tin bộ nhớ máy: mỗi lần mở app đều hỏi máy chủ xem còn ghép
   * với ai không, rồi mới quyết định có kết nối hay dừng ở màn hình nhập mã.
   */
  const [account, setAccount] = useState<Account | null>(null);
  const [pairChecked, setPairChecked] = useState(false);
  const [pairError, setPairError] = useState("");
  const [pairBusy, setPairBusy] = useState(false);
  const [pairMessage, setPairMessage] = useState("");
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  /** Bản dựng này có cấu hình máy chủ ghép nối không (biết sau lần kiểm tra đầu). */
  const [accountReady, setAccountReady] = useState(false);
  /** Đang mở màn hình chuyển dữ liệu thủ công ngay trong màn chặn ghép nối. */
  const [gateManual, setGateManual] = useState(false);
  const pairWatcherRef = useRef<PairingWatcher | null>(null);
  const wrongPairRef = useRef(false);
  useEffect(() => {
    if (!wrongPairRef.current) return;
    wrongPairRef.current = false;
    setPairMessage(
      "Máy chủ cho biết tài khoản này chưa ghép nối (có thể máy kia đã ngắt kết nối), nên app đã ngừng kết nối tức thời để tránh vào phòng cũ.",
    );
  }, [account?.partnerId]);
  /**
   * Phòng kết nối: CHỈ suy ra từ tài khoản đã ghép nối trên máy chủ (pair_secret).
   * Cố ý KHÔNG đọc phòng cũ trong bộ nhớ máy (`state.relay`) nữa: đó chính là
   * đường "kết nối ảo" khiến máy tự chui vào phòng MQTT cũ sau khi khôi phục dữ
   * liệu/sao lưu. Không có tài khoản ghép nối → không có phòng → không thể kết nối.
   */
  const relayRoom = (() => {
    if (!account || !pairChecked) return null;
    if (!account.partnerId || !account.pairSecret) return null;
    try {
      return roomFromPair(account.pairSecret);
    } catch {
      return null;
    }
  })();
  const pairRoomKey = relayRoom ? `${relayRoom.id}|${relayRoom.key}` : "";
  // Bắt mọi lỗi JavaScript: ghi lại để hiển thị trong app thay vì văng im lặng.
  useEffect(() => {
    const utils = (
      globalThis as unknown as {
        ErrorUtils?: {
          setGlobalHandler: (
            handler: (error: unknown, isFatal?: boolean) => void,
          ) => void;
          getGlobalHandler?: () => (error: unknown, isFatal?: boolean) => void;
        };
      }
    ).ErrorUtils;
    if (!utils?.setGlobalHandler) return;
    utils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      const text = `${isFatal ? "Lỗi nghiêm trọng" : "Lỗi"}: ${describe(error)}`;
      void saveCrash(text);
      setLastError(text);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const [loaded, lock] = await Promise.all([
        loadState(),
        secureStorage.getItem("biometric-lock"),
      ]);
      if (!alive) return;
      setLockEnabled(lock === "yes");
      setLocked(lock === "yes");
      let next = loaded;
      for (const action of dueAlertActions(loaded))
        next = reduce(next, action) as State;
      stateRef.current = next;
      setState(next);
      if (next !== loaded) void persistState(next);
      // Hỏi quyền thông báo ngay từ lần mở đầu (Android 13+ chặn nếu chưa hỏi).
      void (async () => {
        const permission = await askNotificationPermission();
        if (!alive) return;
        setNotifyState(permission);
        if (permission === "granted")
          void rescheduleEverything(next).catch(() => {});
      })();
      void notificationPermission().then((permission) => {
        if (alive) setNotifyState(permission);
      });
      setSelfTest(relaySelfTest());
      const previous = await readCrash();
      if (previous) {
        setLastError(previous.split("\n")[0]);
        Alert.alert(
          "Lần mở trước app gặp lỗi",
          previous.split("\n").slice(0, 3).join("\n") +
            "\n\nXem đầy đủ ở Cài đặt → Lỗi gần nhất.",
        );
      }
    })().catch(() => {
      if (alive) setError("Không đọc được dữ liệu trên máy.");
      setState(null);
    });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    const change = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        const current = stateRef.current;
        if (current) {
          let next = current;
          for (const action of dueAlertActions(current))
            next = reduce(next, action) as State;
          if (next !== current) {
            stateRef.current = next;
            setState(next);
            void persistState(next);
          }
        }
      } else if (lockEnabled && !authenticating.current) setLocked(true);
    });
    return () => change.remove();
  }, [lockEnabled]);
  async function authenticate() {
    if (authenticating.current) return false;
    authenticating.current = true;
    setUnlocking(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Mở Mật Mã Yêu",
        cancelLabel: "Để sau",
        disableDeviceFallback: true,
      });
      return result.success && AppState.currentState === "active";
    } finally {
      authenticating.current = false;
      setUnlocking(false);
    }
  }
  /**
   * Ghi dữ liệu xuống máy nhưng gộp các thay đổi liên tiếp trong 400 ms: gửi tin
   * nhắn liên tục trước đây ghi cả tệp dữ liệu mỗi lần nên app bị khựng.
   */
  function persistSoon(next: State, delay = 400) {
    persistPending.current = next;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      const value = persistPending.current;
      persistPending.current = null;
      if (!value) return;
      void persistState(value)
        .then((warning) => {
          if (warning) setError(warning);
        })
        .catch(() => setError("Chưa ghi được dữ liệu vào bộ nhớ máy."));
    }, delay);
  }
  function update(action: Record<string, unknown>) {
    const current = stateRef.current;
    if (!current) return;
    const next = reduce(current, action) as State;
    stateRef.current = next;
    setState(next);
    persistSoon(next);
    if (
      [
        "cycle.save",
        "cycle.clear",
        "settings.set",
        "anniversary.set",
        "partner.merge",
      ].includes(String(action.type))
    ) {
      void rescheduleEverything(next).catch(() => {});
    }
    // Đọc tin của người thương thì báo cho họ biết (nếu cả hai không tắt).
    if (String(action.type) === "message.read") {
      const fresh = (current.messages ?? [])
        .filter(
          (message) =>
            message.authorId === "partner" && !message.readAt && message.id,
        )
        .map((message) => message.id)
        .slice(0, 20);
      if (fresh.length && next.settings?.readReceipts !== false) {
        // Gói mới {type:"read", lastMessageId} + gói cũ cho máy chưa cập nhật.
        relayRef.current?.publish({
          kind: "read",
          type: "read",
          lastMessageId: fresh[0],
          ids: fresh,
        });
        relayRef.current?.publish({ kind: "chatRead", ids: fresh });
      }
    }
  }

  // Chọn nhạc chuông riêng: lấy tệp nhạc trong máy, lưu lại và dùng cho cuộc gọi tới.
  async function pickRingtone() {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled || !picked.assets?.length) return;
      const asset = picked.assets[0];
      const extension = (
        asset.name?.match(/\.[a-z0-9]+$/i)?.[0] ?? ".mp3"
      ).toLowerCase();
      const file = saveImage(asset.uri, `ringtone-custom${extension}`);
      update({
        type: "settings.set",
        ringtone: file,
        ringtoneName: asset.name ?? "Nhạc trong máy",
      });
      Alert.alert(
        "Đã đặt nhạc chuông",
        `Cuộc gọi tới sẽ reo bằng “${asset.name ?? "nhạc trong máy"}”.`,
      );
    } catch (error) {
      Alert.alert(
        "Chưa chọn được nhạc",
        error instanceof Error
          ? error.message
          : "Máy chưa chọn được tệp nhạc này. Thử bài khác nhé.",
      );
    }
  }
  function resetRingtone() {
    update({ type: "settings.set", ringtone: "", ringtoneName: "" });
    Alert.alert(
      "Đã trở về nhạc mặc định",
      "Cuộc gọi tới sẽ reo bằng nhạc có sẵn trong app.",
    );
  }
  // ---------- Cuộc gọi ----------
  // Bấm Gọi: gửi tín hiệu đổ chuông sang máy người thương rồi hiện màn hình gọi.
  function startCall() {
    const current = stateRef.current;
    const client = relayRef.current;
    const name = current?.partner?.nickname || "Người thương";
    if (!current) return;
    if (!current.partner) {
      Alert.alert(
        "Chưa ghép nối",
        "Hai bạn cần ghép nối bằng mã 6 số trước khi gọi cho nhau.",
      );
      return;
    }
    if (!client || !client.connected) {
      Alert.alert(
        "Chưa nối được",
        "Hai máy cần cùng mở app và cùng có mạng mới gọi được. Kiểm tra mạng (máy ảo cũng phải bật mạng) rồi thử lại nhé.",
      );
      return;
    }
    const id = "c" + Date.now().toString(36);
    void AudioModule.requestRecordingPermissionsAsync().catch(() => {});
    closeRtc();
    setRtcInfo({ state: "off", detail: "" });
    setRtcFallback(false);
    setRtcAudio({ inBytes: 0, outBytes: 0, level: 0, levelSource: "" });
    const ringPacket = {
      kind: "call",
      event: "ring",
      callId: id,
      name: current.me.nickname,
    };
    const sent = client.publish(ringPacket);
    setTimeout(() => relayRef.current?.publish(ringPacket), 350);
    applyCall(newCall({ id, role: "caller", name }));
    setRelayLog((lines) =>
      [
        ...lines,
        sent ? `Đang gọi ${name}…` : "Chưa gửi được tín hiệu gọi, thử lại nhé.",
      ].slice(-12),
    );
  }
  // Mở (hoặc lấy lại) đường tiếng trực tiếp cho cuộc gọi đang mở. Tín hiệu
  // offer/answer/ICE đi qua kênh ghép nối, còn tiếng nói đi thẳng hai máy.
  function ensureRtc(active: CallInfo) {
    if (rtcRef.current) return rtcRef.current;
    const support = rtcSupport();
    if (!support.ok) {
      setRtcInfo({ state: "failed", detail: support.detail });
      return null;
    }
    const controller = new RtcCall({
      callId: active.id,
      role: active.role === "caller" ? "caller" : "callee",
      // Gửi lại tín hiệu quan trọng: kênh công cộng thỉnh thoảng mất gói, mất
      // lời mời là hai máy không nối được với nhau.
      send: (packet, retries = 0) => {
        relayRef.current?.publish(packet);
        for (let index = 0; index < retries; index += 1) {
          const delay = RTC_RETRY_SIGNAL_MS * (index + 1);
          setTimeout(() => relayRef.current?.publish(packet), delay);
        }
      },
      onStats: (info) => setRtcAudio(info),
      onState: (state, detail) => {
        setRtcInfo({ state, detail: detail || rtcStatusText(state) });
        const live = state === "live";
        rtcLiveRef.current = live;
        setRtcLive(live);
        setRtcFallback(state === "failed");
        if (live)
          setRelayLog((lines) =>
            [
              ...lines,
              "Đã nối tiếng trực tiếp: nói chuyện như gọi thường.",
            ].slice(-12),
          );
      },
    });
    rtcRef.current = controller;
    return controller;
  }
  // Người dùng bảo "nghe không được": chuyển ngay sang đường tiếng qua kênh
  // ghép nối. Máy kia cũng nhận tín hiệu để chuyển theo nên hai bên khớp nhau.
  function useLegacyAudio() {
    const controller = rtcRef.current;
    rtcRef.current = null;
    rtcLiveRef.current = false;
    setRtcLive(false);
    setRtcFallback(true);
    setRtcAudio({ inBytes: 0, outBytes: 0, level: 0, levelSource: "" });
    setRtcInfo({
      state: "failed",
      detail: "Đang dùng đường tiếng qua kênh ghép nối (bạn chọn).",
    });
    try {
      controller?.giveUp("Bạn đã chuyển sang đường tiếng qua kênh ghép nối.");
    } catch {}
  }
  function closeRtc() {
    const controller = rtcRef.current;
    rtcRef.current = null;
    rtcLiveRef.current = false;
    setRtcLive(false);
    try {
      controller?.close();
    } catch {}
  }
  // Nghe / Từ chối / Kết thúc / thu nhỏ / bật tắt mic.
  function callAction(event: { type: string; on?: boolean; min?: boolean }) {
    const active = callRef.current;
    if (!active) return;
    // Bấm “Đóng” trên màn hình đã kết thúc: dọn hẳn cửa sổ gọi.
    if (active.phase === "ended") {
      applyCall(null);
      return;
    }
    const client = relayRef.current;
    const name = stateRef.current?.me.nickname ?? "";
    if (
      event.type === "accept" ||
      event.type === "reject" ||
      event.type === "hangup"
    ) {
      const packet = {
        kind: "call",
        event: event.type,
        callId: active.id,
        name,
      };
      client?.publish(packet);
      // Tín hiệu nghe/từ chối/kết thúc gửi lại 3 lần cách nhau 250 ms: kênh công
      // cộng thỉnh thoảng mất gói, gửi lại để hai máy đồng bộ chắc chắn.
      [250, 500].forEach((delay) =>
        setTimeout(() => relayRef.current?.publish(packet), delay),
      );
      if (event.type === "accept") {
        lastAliveSentRef.current = Date.now();
        client?.publish({
          kind: "call",
          event: "alive",
          callId: active.id,
          name,
        });
      }
    }
    if (event.type === "mic") rtcRef.current?.setMic(Boolean(event.on));
    if (
      event.type === "hangup" &&
      !active.startedAt &&
      active.role === "callee"
    ) {
      // Từ chối cuộc gọi: không cần hiện màn hình "đã kết thúc".
      applyCall(null);
      return;
    }
    applyCall(callEvent(active, event));
  }
  /**
   * Báo cho máy kia biết mình đang gõ chữ. Gói tin siêu nhỏ đi qua kênh ghép nối
   * sẵn có; máy nhận tự tắt chấm "đang nhập…" sau TYPING_HOLD_MS nếu không thấy
   * gói mới (nên không bao giờ kẹt chữ "đang nhập…" mãi).
   */
  function sendTyping(active: boolean) {
    const client = relayRef.current;
    if (!client) return;
    const now = Date.now();
    if (active && now - lastTypingSentRef.current < TYPING_SEND_MS) return;
    lastTypingSentRef.current = now;
    client.publish({ kind: "typing", type: "typing", state: active });
    if (!active) lastTypingSentRef.current = 0;
  }
  /** Thả (hoặc bỏ) cảm xúc trên một tin nhắn — gửi ngay cho máy kia. */
  function reactToMessage(id: string, emoji: string | null) {
    const client = relayRef.current;
    try {
      update({ type: "message.setReact", id, side: "me", emoji });
    } catch {
      return;
    }
    if (!client) return;
    // Gói mới: {type:"reaction", messageId, emotion} — máy 1.17.0 đọc thẳng.
    // Gói cũ (chatReact) gửi kèm để máy còn ở bản 1.16 hiểu được.
    const packets = [
      {
        kind: "reaction",
        type: "reaction",
        messageId: id,
        id,
        emotion: emoji,
        emoji,
      },
      { kind: "chatReact", id, emoji },
    ];
    for (const packet of packets) client.publish(packet);
    // Gửi lại lần hai: gói QoS 0 có thể mất, gói sau vá lại tình trạng đúng.
    setTimeout(() => {
      for (const packet of packets) relayRef.current?.publish(packet);
    }, 420);
    // Gói dữ liệu đầy đủ cũng mang theo cảm xúc, để lần sau mở app vẫn còn.
    setTimeout(() => publishCurrent(true), 900);
  }
  /**
   * Thu hồi tin nhắn: xoá nội dung ở CẢ HAI máy (chữ, ảnh, tin thoại, vị trí).
   * Khác nút "Xóa ở máy này" chỉ xoá trên máy mình.
   */
  function recallMessage(id: string) {
    try {
      update({ type: "message.recall", id });
    } catch {
      return;
    }
    const packets = [
      { kind: "unsend", type: "unsend", messageId: id, id },
      { kind: "chatRecall", id },
    ];
    const send = () => {
      for (const packet of packets) relayRef.current?.publish(packet);
    };
    send();
    setTimeout(send, 400);
    setTimeout(send, 1200);
    setTimeout(() => publishCurrent(true), 900);
  }
  /** Lưu ảnh người thương gửi vào thư viện ảnh của máy. */
  /**
   * Gửi kèm TỆP ảnh đại diện của mình cho máy kia (gói ảnh vai "avatar").
   * Dùng khi vừa đổi ảnh đại diện và khi máy kia xin lại.
   */
  function sendAvatarFile(note = "") {
    const client = relayRef.current;
    const current = stateRef.current;
    const name = current?.me?.avatar;
    if (!client || !current || !name) return false;
    const base64 = imageBase64(name, AVATAR_LIMIT_BYTES);
    if (!base64) return false;
    void (async () => {
      try {
        for (const packet of photoMessages({
          id: name,
          base64,
          nickname: current.me.nickname,
          role: "avatar",
          avatarId: name,
        })) {
          client.publish(packet);
          await new Promise((resolve) => setTimeout(resolve, 60));
        }
        if (note) setRelayLog((lines) => [...lines, note].slice(-12));
      } catch {}
    })();
    return true;
  }
  function savePhoto(photo: string | null | undefined) {
    void (async () => {
      const result = await savePhotoToDevice(
        imageUri(photo),
        photo ?? undefined,
      );
      setRelayLog((lines) => [...lines, result.detail].slice(-12));
      Alert.alert(
        result.ok ? "Đã lưu ảnh" : "Chưa lưu được ảnh",
        result.detail,
      );
    })();
  }
  // Gửi ảnh trong đoạn chat (chụp hoặc chọn từ thư viện).
  function sendChatPhoto(uri: string, caption: string) {
    try {
      const id =
        "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      const file = saveImage(uri, `chatpix-${id}.jpg`);
      update({
        type: "message.add",
        id,
        kind: "photo",
        body: caption,
        photo: file,
      });
      setTimeout(() => flushMessages(), 120);
    } catch (error) {
      Alert.alert(
        "Chưa gửi được ảnh",
        error instanceof Error ? error.message : "Ảnh bị lỗi.",
      );
    }
  }
  // Gửi vị trí đang ở: lấy toạ độ GPS hiện tại rồi gửi kèm tin nhắn.
  async function sendLocation() {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Cần quyền vị trí",
          "Hãy cho phép lấy vị trí để gửi cho người thương biết bạn đang ở đâu.",
        );
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      update({
        type: "message.add",
        kind: "location",
        body: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        lat,
        lng,
      });
      setTimeout(() => flushMessages(), 120);
      setRelayLog((lines) => [...lines, "Đã gửi vị trí đang ở"].slice(-12));
    } catch (error) {
      Alert.alert(
        "Chưa lấy được vị trí",
        error instanceof Error
          ? error.message
          : "Máy chưa lấy được toạ độ. Thử bật GPS rồi lại nhé.",
      );
    }
  }
  function replaceState(next: State) {
    stateRef.current = next;
    setState(next);
    void persistState(next).catch(() =>
      setError("Chưa ghi được dữ liệu vào bộ nhớ máy."),
    );
    void rescheduleEverything(next).catch(() => {});
  }
  async function clearAll() {
    await clearLocalData();
    const fresh = emptyState() as State;
    stateRef.current = fresh;
    setState(fresh);
    await persistState(fresh);
    setLockEnabled(false);
    setLocked(false);
  }
  async function toggleLock(value: boolean) {
    if (
      value &&
      (!(await LocalAuthentication.hasHardwareAsync()) ||
        !(await LocalAuthentication.isEnrolledAsync()))
    )
      throw new Error("Máy cần hỗ trợ và đã đăng ký Face ID hoặc vân tay.");
    if (!(await authenticate()))
      throw new Error("Chưa xác thực sinh trắc học.");
    await secureStorage.setItem("biometric-lock", value ? "yes" : "no");
    setLockEnabled(value);
    setLocked(false);
  }
  // Gửi dữ liệu của mình cho người thương. Bỏ qua khi nội dung không đổi để
  // hai máy không gửi qua gửi lại mãi; ép gửi khi người thương vừa trực tuyến.
  function publishCurrent(force = false) {
    const current = stateRef.current;
    const client = relayRef.current;
    if (!current || !client) return;
    const payload = relayPayloadFor(
      current,
      deviceIdRef.current,
      appVersionRef.current,
    );
    const key = payloadKey(payload);
    if (!force && key === lastSentRef.current) return;
    // Tin nhắn đi bằng gói riêng ngay khi gửi; nếu CHỈ tin nhắn đổi thì không
    // đẩy lại cả gói dữ liệu lớn (trước đây mỗi tin nhắn/vị trí đều đẩy 60 KB
    // nên đoạn chat bị lag). Vẫn có nhịp an toàn 20 giây một lần để không mất dữ liệu.
    const lite = payloadKey({
      ...payload,
      messages: (payload.messages ?? []).map(
        (message: { id: string }) => message.id,
      ),
    });
    if (!force && lite === lastLiteRef.current) {
      const now = Date.now();
      if (now - lastSlowRef.current < 20000) return;
      lastSlowRef.current = now;
    }
    if (client.publishState(payload, current.me.nickname)) {
      lastSentRef.current = key;
      lastLiteRef.current = lite;
      // Ghi lại ngay trong nhật ký kết nối để cả hai máy đều nhìn thấy dữ liệu
      // nào đã đi: nhật ký, cảm xúc, tin nhắn.
      setRelayLog((lines) =>
        [
          ...lines,
          `Đã gửi sang máy kia: ${payload.diary.length} kỷ niệm · ${
            (payload.messages ?? []).length
          } tin nhắn · cảm xúc “${payload.from?.mood ?? "?"}”`,
        ].slice(-12),
      );
    }
  }
  // Gửi ảnh khoảnh khắc của mình cho người thương, mỗi lần một ảnh để không
  // làm nghẽn kênh; ảnh nào chưa gửi sẽ được gửi ở lần kết nối sau.
  function flushMoments() {
    const client = relayRef.current;
    const current = stateRef.current;
    if (!client || !current || momentQueueRef.current) return;
    const pending = (current.moments ?? []).filter(
      (moment: State["moments"][number]) =>
        moment.authorId !== "partner" && moment.file && !moment.sentAt,
    );
    if (!pending.length) return;
    const moment = pending[0];
    const base64 = imageBase64(moment.file, 200 * 1024);
    if (!base64) {
      update({ type: "moment.sent", id: moment.id });
      return;
    }
    momentQueueRef.current = true;
    void (async () => {
      try {
        const messages = photoMessages({
          id: moment.id,
          base64,
          caption: moment.caption,
          createdAt: moment.createdAt,
          nickname: current.me.nickname,
        });
        for (const message of messages) {
          client.publish(message);
          await new Promise((resolve) => setTimeout(resolve, 60));
        }
        update({ type: "moment.sent", id: moment.id });
        setRelayLog((lines) =>
          [...lines, `Đã gửi một khoảnh khắc (${messages.length} gói)`].slice(
            -12,
          ),
        );
      } catch (error) {
        setRelayLog((lines) =>
          [
            ...lines,
            `Chưa gửi được khoảnh khắc: ${
              error instanceof Error ? error.message : "lỗi không rõ"
            }`,
          ].slice(-12),
        );
      } finally {
        momentQueueRef.current = false;
        setTimeout(() => flushMoments(), 400);
      }
    })();
  }
  // Gửi tin nhắn của mình: chữ/emoji đi một gói, tin thoại kèm thêm các gói âm
  // thanh. Mỗi lần gửi một tin để không làm nghẽn kênh.
  function flushMessages() {
    const client = relayRef.current;
    const current = stateRef.current;
    if (!client || !current || messageQueueRef.current) return;
    const pending = (current.messages ?? []).filter(
      (message: State["messages"][number]) =>
        message.authorId !== "partner" && !message.sentAt,
    );
    if (!pending.length) return;
    const message = pending[0];
    messageQueueRef.current = true;
    void (async () => {
      try {
        // Chưa nối được trạm nào thì KHÔNG đánh dấu đã gửi: để tin nằm chờ và
        // gửi lại khi có kết nối (trước đây đánh dấu sớm nên tin bị mất).
        const published = client.publish({
          kind: "chat",
          message: {
            id: message.id,
            kind: message.kind,
            body: message.body,
            createdAt: message.createdAt,
            durationMs: message.durationMs,
            hasAudio: Boolean(message.audio),
            hasPhoto: Boolean(message.photo),
            lat: message.lat ?? null,
            lng: message.lng ?? null,
            place: message.place ?? "",
          },
          name: current.me.nickname,
        });
        if (!published) {
          setRelayLog((lines) =>
            [
              ...lines,
              "Chưa nối được trạm nên tin nhắn đang chờ, sẽ tự gửi lại.",
            ].slice(-12),
          );
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 60));
        if (message.kind === "voice" && message.audio) {
          const base64 = imageBase64(message.audio, VOICE_LIMIT_BYTES);
          if (base64) {
            for (const packet of photoMessages({
              id: message.id,
              base64,
              nickname: current.me.nickname,
              role: "voice",
              voiceId: message.id,
              durationMs: message.durationMs,
            })) {
              client.publish(packet);
              await new Promise((resolve) => setTimeout(resolve, 60));
            }
            setRelayLog((lines) =>
              [
                ...lines,
                `Đã gửi tin thoại ${message.durationMs / 1000}s`,
              ].slice(-12),
            );
          } else {
            setRelayLog((lines) =>
              [
                ...lines,
                "Tin thoại quá dài nên chưa gửi được tệp — hãy ghi ngắn hơn (dưới 25 giây).",
              ].slice(-12),
            );
          }
        }
        // Ảnh trong đoạn chat: gửi tệp bằng nhiều gói như ảnh khoảnh khắc.
        if (message.kind === "photo" && message.photo) {
          const base64 = imageBase64(message.photo, CHAT_PHOTO_LIMIT_BYTES);
          if (base64) {
            for (const packet of photoMessages({
              id: message.id,
              base64,
              caption: message.body,
              createdAt: message.createdAt,
              nickname: current.me.nickname,
              role: "chat",
              chatId: message.id,
            })) {
              client.publish(packet);
              await new Promise((resolve) => setTimeout(resolve, 60));
            }
            setRelayLog((lines) =>
              [...lines, "Đã gửi một ảnh trong đoạn chat"].slice(-12),
            );
          } else {
            setRelayLog((lines) =>
              [
                ...lines,
                "Ảnh hơi nặng nên chưa gửi được tệp — thử chọn ảnh khác nhỏ hơn nhé.",
              ].slice(-12),
            );
          }
        }
        update({ type: "message.sent", id: message.id });
      } catch (error) {
        setRelayLog((lines) =>
          [
            ...lines,
            `Chưa gửi được tin nhắn: ${
              error instanceof Error ? error.message : "lỗi không rõ"
            }`,
          ].slice(-12),
        );
      } finally {
        messageQueueRef.current = false;
        setTimeout(() => flushMessages(), 400);
      }
    })();
  }
  // Thông báo kiểu tin nhắn: hiện ngay khi người thương vừa nhắn / viết nhật
  // ký / đổi cảm xúc, kèm một dòng trong mục “Lời nhắc”.
  function noticeFromPartner(
    title: string,
    body: string,
    key: string,
    chat = true,
  ) {
    try {
      update({ type: "alerts.add", title, body, key, category: "love" });
    } catch {}
    // chat = true: dùng kênh mức cao nhất nên thông báo nổi như Messenger, kể
    // cả khi app đang mở.
    void notifyNow(title, body, chat);
  }
  // Ảnh nền dùng chung: máy đang có ảnh gửi lại khi máy kia xin.
  function sendWallpaper(id: string) {
    const client = relayRef.current;
    const current = stateRef.current;
    if (!client || !current) return;
    const file = current.appearance?.wallpaper;
    if (!file || current.appearance?.wallpaperId !== id) return;
    const base64 = imageBase64(file, WALLPAPER_LIMIT_BYTES);
    if (!base64) return;
    void (async () => {
      try {
        for (const message of photoMessages({
          id,
          base64,
          nickname: current.me.nickname,
          role: "wallpaper",
          wallpaperId: id,
        })) {
          client.publish(message);
          await new Promise((resolve) => setTimeout(resolve, 60));
        }
      } catch {}
    })();
  }
  // Xin gửi lại những ảnh của người thương mà máy này chưa có (kể cả ảnh nền).
  function askMissingPhotos() {
    const client = relayRef.current;
    const current = stateRef.current;
    if (!client || !current) return;
    const ids = missingPhotoIds(
      current.moments ?? [],
      (moment: State["moments"][number]) =>
        Boolean(moment.file && imageExists(moment.file)),
    ).filter((id: string) => shouldAsk(id));
    const wallpaperId = current.appearance?.wallpaperId;
    if (
      wallpaperId &&
      !imageExists(wallpaperFile(wallpaperId)) &&
      shouldAsk(wallpaperId)
    ) {
      askedPhotosRef.current.set(wallpaperId, Date.now());
      ids.push(wallpaperId);
    }
    for (const voiceId of missingVoiceIds(
      current.messages ?? [],
      (message: State["messages"][number]) =>
        Boolean(message.audio && imageExists(message.audio)),
    ))
      if (shouldAsk(String(voiceId))) {
        askedPhotosRef.current.set(String(voiceId), Date.now());
        ids.push(String(voiceId));
      }
    if (!ids.length) return;
    client.publish({ kind: "photoRequest", ids });
  }
  useEffect(() => {
    if (!relayRoom || !pairChecked || !state?.settings.relay) {
      // Chưa kiểm tra xong với máy chủ (hoặc chưa ghép nối) thì KHÔNG mở phòng:
      // đây là chốt chặn "kết nối ảo" của bản 1.18.0.
      relayRef.current?.stop();
      relayRef.current = null;
      readyRef.current = false;
      setRelayStatus({ state: "off", broker: null, partnerOnline: false });
      return;
    }
    readyRef.current = false;
    setRelayLog((lines) => (lines.length > 40 ? lines.slice(-20) : lines));
    const client = new RelayClient({
      room: relayRoom,
      deviceId: deviceIdRef.current,
      onPayload: (payload: Record<string, unknown>) => {
        try {
          const before = stateRef.current;
          update({ type: "partner.merge", state: payload });
          setError("");
          const after = stateRef.current;
          if (after)
            setRelayLog((lines) =>
              [
                ...lines,
                `Đã nhận từ ${after.partner?.nickname ?? "người thương"}: ${
                  after.diary.filter((entry) => entry.authorId === "partner")
                    .length
                } kỷ niệm · cảm xúc “${after.partner?.mood ?? "?"}”`,
              ].slice(-12),
            );
          if (before && after) {
            const fresh = after.diary.filter(
              (entry) =>
                entry.authorId === "partner" &&
                Date.parse(entry.createdAt) > appStartRef.current &&
                !before.diary.some((item) => item.id === entry.id),
            );
            if (fresh.length)
              noticeFromPartner(
                `${after.partner?.nickname ?? "Người thương"} vừa viết nhật ký 📖`,
                fresh[0].title,
                `diary-${fresh[0].id}`,
              );
            const moodChanged =
              before.partner?.mood !== after.partner?.mood ||
              before.partner?.moodNote !== after.partner?.moodNote;
            if (
              moodChanged &&
              after.partner &&
              Date.parse(after.partner.updatedAt) > appStartRef.current
            )
              noticeFromPartner(
                `${after.partner.nickname} vừa đổi cảm xúc 💗`,
                after.partner.moodNote || "Mở mục Cảm xúc để xem nhé.",
                `mood-${after.partner.updatedAt}`,
              );
            const newMoments = after.moments.filter(
              (moment) =>
                moment.authorId === "partner" &&
                Date.parse(moment.createdAt) > appStartRef.current &&
                !before.moments.some((item) => item.id === moment.id),
            );
            if (newMoments.length)
              noticeFromPartner(
                `${after.partner?.nickname ?? "Người thương"} vừa gửi khoảnh khắc 📸`,
                newMoments[0].caption || "Mở trang chủ để xem nhé.",
                `moment-${newMoments[0].id}`,
              );
          }
          const incomingAvatar = (payload as { from?: { avatar?: unknown } })
            ?.from?.avatar;
          if (
            typeof incomingAvatar === "string" &&
            incomingAvatar &&
            !imageExists(incomingAvatar) &&
            shouldAsk(incomingAvatar)
          ) {
            // Hồ sơ đã tới nhưng tệp ảnh đại diện chưa: xin gửi lại.
            askedPhotosRef.current.set(incomingAvatar, Date.now());
            relayRef.current?.publish({
              kind: "photoRequest",
              ids: [incomingAvatar],
            });
          }
          const incoming = payload?.appearance as
            { wallpaperId?: string | null; updatedAt?: string } | undefined;
          const wanted = incoming?.wallpaperId;
          if (
            wanted &&
            !imageExists(wallpaperFile(wanted)) &&
            shouldAsk(wanted)
          ) {
            askedPhotosRef.current.set(wanted, Date.now());
            relayRef.current?.publish({ kind: "photoRequest", ids: [wanted] });
          }
        } catch (mergeError) {
          setError(
            mergeError instanceof Error
              ? mergeError.message
              : "Không gộp được dữ liệu nhận qua kết nối.",
          );
        }
      },
      onMessage: (message: Record<string, unknown>) => {
        const kind = String(message.kind ?? "");
        if (kind === "chat") {
          const incoming = message.message as
            | {
                id?: string;
                kind?: string;
                body?: string;
                createdAt?: string;
                durationMs?: number;
                hasPhoto?: boolean;
                lat?: number | null;
                lng?: number | null;
                place?: string;
              }
            | undefined;
          if (incoming?.id) {
            const isNew = !(stateRef.current?.messages ?? []).some(
              (item) => item.id === incoming.id,
            );
            update({
              type: "message.received",
              id: incoming.id,
              kind: incoming.kind,
              body: incoming.body,
              createdAt: incoming.createdAt,
              durationMs: incoming.durationMs,
              lat: incoming.lat,
              lng: incoming.lng,
              place: incoming.place,
            });
            if (isNew) {
              const nickname =
                (message.name as string) ||
                stateRef.current?.partner?.nickname ||
                "Người thương";
              const label =
                incoming.kind === "voice"
                  ? "đã gửi một tin thoại 🎙"
                  : incoming.kind === "photo"
                    ? "đã gửi một tấm ảnh 📷"
                    : incoming.kind === "sticker"
                      ? "đã gửi một sticker"
                      : incoming.kind === "location"
                        ? "đã chia sẻ vị trí 📍"
                        : String(incoming.body ?? "");
              noticeFromPartner(`${nickname} 💌`, label, `chat-${incoming.id}`);
            }
            // Ảnh của tin này chưa có trên máy thì xin gửi lại.
            if (
              incoming.hasPhoto &&
              incoming.kind === "photo" &&
              shouldAsk(String(incoming.id))
            ) {
              const have = (stateRef.current?.messages ?? []).some(
                (item) => item.id === incoming.id && item.photo,
              );
              if (!have) {
                askedPhotosRef.current.set(String(incoming.id), Date.now());
                relayRef.current?.publish({
                  kind: "photoRequest",
                  ids: [String(incoming.id)],
                });
              }
            }
            // Xác nhận cho máy kia biết tin đã tới nơi (hiện "đã tới máy kia").
            relayRef.current?.publish({
              kind: "chatAck",
              ids: [incoming.id],
            });
          }
          return;
        }
        if (kind === "read") {
          // Gói mới {type:"read", lastMessageId}: hiểu như chatRead.
          const ids = Array.isArray(message.ids)
            ? (message.ids as unknown[]).map((id) => String(id)).slice(0, 20)
            : message.lastMessageId
              ? [String(message.lastMessageId)]
              : [];
          if (ids.length) update({ type: "message.seen", ids });
          return;
        }
        if (kind === "chatRead") {
          // Người thương báo đã xem tin của mình (chỉ khi họ bật “cho biết đã xem”).
          const ids = Array.isArray(message.ids)
            ? (message.ids as unknown[]).map((id) => String(id)).slice(0, 20)
            : [];
          if (ids.length) update({ type: "message.seen", ids });
          return;
        }
        if (kind === "call") {
          const event = String(message.event ?? "");
          const callId = String(message.callId ?? "");
          if (!callId) return;
          const who =
            String(message.name ?? "") ||
            stateRef.current?.partner?.nickname ||
            "Người thương";
          if (event === "ring") {
            // Gói "ring" gửi nhắc (sau 350 ms hoặc qua nhiều trạm MQTT) của
            // CHÍNH cuộc gọi đang mở: bỏ qua ngay, tuyệt đối không gửi "reject"
            // ngược lại làm máy gọi tự ngắt ("người thương đang bận") rồi máy
            // nghe tự ngắt sau vài giây vì mất nhịp sống.
            if (callRef.current && callRef.current.id === callId) {
              return;
            }
            closeRtc();
            void AudioModule.requestRecordingPermissionsAsync().catch(() => {});
            setRtcInfo({ state: "off", detail: "" });
            setRtcFallback(false);
            setRtcAudio({ inBytes: 0, outBytes: 0, level: 0, levelSource: "" });
            applyCall(newCall({ id: callId, role: "callee", name: who }));
            void notifyNow(
              `${who} đang gọi cho bạn 📞`,
              "Mở app để nghe máy.",
              true,
            );
            return;
          }
          const active = callRef.current;
          if (!active || active.id !== callId) return;
          if (event === "rtc") {
            // Tín hiệu nối tiếng trực tiếp (mã máy PeerJS, offer/answer/ICE) của
            // người thương. Cuộc gọi đã kết thúc thì bỏ qua: không mở micro trở lại.
            if (active.phase === "ended") return;
            if (active.phase === "ringing" && active.role === "caller") {
              applyCall(callEvent(active, { type: "accept" }));
            } else if (active.phase === "active") {
              applyCall(callEvent(active, { type: "alive" }));
            }
            const currentCall = callRef.current ?? active;
            const controller = rtcRef.current ?? ensureRtc(currentCall);
            void controller?.handle(message);
            return;
          }
          if (event === "audio") {
            // Tiếng nói của người thương: lưu ra tệp rồi xếp hàng cho loa phát.
            if (active.phase !== "active") return;
            applyCall(callEvent(active, { type: "alive" }));
            const data = String(message.data ?? "");
            const seq = Number(message.seq);
            if (!data || !Number.isFinite(seq)) return;
            try {
              const name = `callin-${callId}-${seq % 4}.m4a`;
              writeBase64(name, data);
              callQueueRef.current = pushFrame(callQueueRef.current, {
                seq,
                uri: imageUri(name) ?? undefined,
                bytes: Number(message.bytes) || data.length,
                at: Date.now(),
              });
            } catch {}
            return;
          }
          if (event === "alive") {
            // Người thương còn trong cuộc gọi: ghi lại mốc để biết đường mà dừng.
            if (active.phase === "active")
              applyCall(callEvent(active, { type: "alive" }));
            return;
          }
          if (event === "accept") {
            applyCall(callEvent(active, { type: "accept" }));
            lastAliveSentRef.current = Date.now();
            relayRef.current?.publish({
              kind: "call",
              event: "alive",
              callId: active.id,
              name: stateRef.current?.me.nickname ?? "",
            });
          } else if (event === "reject")
            applyCall(callEvent(active, { type: "reject" }));
          else if (event === "hangup")
            applyCall(callEvent(active, { type: "hangup" }));
          return;
        }
        if (kind === "chatAck") {
          const ids = Array.isArray(message.ids)
            ? (message.ids as unknown[]).map((id) => String(id)).slice(0, 20)
            : [];
          if (ids.length) update({ type: "message.delivered", ids });
          return;
        }
        if (kind === "typing") {
          // Người thương đang gõ chữ: hiện ba chấm, tự tắt sau ít giây.
          const active = message.state === true;
          setPartnerTyping(active);
          if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
          if (active)
            typingTimerRef.current = setTimeout(
              () => setPartnerTyping(false),
              TYPING_HOLD_MS,
            );
          return;
        }
        if (kind === "reaction") {
          // Gói mới {type:"reaction", messageId, emotion} — hiểu như chatReact.
          const id = String(message.messageId ?? message.id ?? "");
          if (!id) return;
          const emoji =
            typeof message.emotion === "string"
              ? message.emotion
              : typeof message.emoji === "string"
                ? message.emoji
                : null;
          try {
            update({ type: "message.setReact", id, side: "them", emoji });
          } catch {}
          return;
        }
        if (kind === "chatReact") {
          // Người thương thả cảm xúc vào một tin (của mình hoặc của họ).
          const id = String(message.id ?? "");
          if (!id) return;
          const emoji =
            typeof message.emoji === "string" ? message.emoji : null;
          try {
            update({ type: "message.setReact", id, side: "them", emoji });
          } catch {}
          return;
        }
        if (kind === "unsend") {
          // Gói mới {type:"unsend", messageId} — thu hồi cả hai bên.
          const id = String(message.messageId ?? message.id ?? "");
          if (!id) return;
          try {
            update({ type: "message.recall", id });
            noticeFromPartner(
              `${stateRef.current?.partner?.nickname ?? "Người thương"} 💌`,
              "đã thu hồi một tin nhắn",
              `recall-${id}`,
            );
          } catch {}
          return;
        }
        if (kind === "profile") {
          // Đổi ảnh đại diện/tên: máy kia cập nhật giao diện ngay, không đợi gói
          // dữ liệu định kỳ. Ảnh thiếu thì xin gửi lại (gói ảnh đi kèm gói này).
          const avatar =
            typeof message.avatar === "string" && message.avatar
              ? message.avatar.slice(0, 90)
              : null;
          const nickname =
            typeof message.nickname === "string"
              ? message.nickname.slice(0, 40)
              : "";
          try {
            update({
              type: "partner.merge",
              state: { from: { id: "me", nickname, avatar }, messages: [] },
            });
          } catch {}
          if (avatar && !imageExists(avatar) && shouldAsk(avatar, 20000))
            relayRef.current?.publish({ kind: "photoRequest", ids: [avatar] });
          return;
        }
        if (kind === "pair.unpair") {
          void unpairAccount().then(() => {
            if (stateRef.current?.relay) update({ type: "pairing.clear" });
            void refreshAccount(
              "Người thương đã ngắt kết nối — hai máy đã rời khỏi phòng chung.",
            );
          });
          return;
        }
        if (kind === "chatRecall") {
          // Người thương thu hồi một tin: xoá nội dung ở máy này luôn.
          const id = String(message.id ?? "");
          if (!id) return;
          try {
            update({ type: "message.recall", id });
            noticeFromPartner(
              `${stateRef.current?.partner?.nickname ?? "Người thương"} 💌`,
              "đã thu hồi một tin nhắn",
              `recall-${id}`,
            );
          } catch {}
          return;
        }
        if (kind === "photo") {
          const photo = assemblerRef.current.add(message);
          if (photo && photo.meta?.role === "voice") {
            try {
              const id = String(photo.meta?.voiceId || photo.id);
              const name = `voice-${id}.m4a`;
              writeBase64(name, photo.base64);
              update({ type: "message.audio", id, file: name });
              setRelayLog((lines) =>
                [...lines, "Đã nhận một tin thoại"].slice(-12),
              );
            } catch (error) {
              setRelayLog((lines) =>
                [
                  ...lines,
                  `Nhận tin thoại nhưng chưa lưu được: ${
                    error instanceof Error ? error.message : "lỗi không rõ"
                  }`,
                ].slice(-12),
              );
            }
            return;
          }
          if (photo && photo.meta?.role === "chat") {
            try {
              const id = String(photo.meta?.chatId || photo.id);
              const name = `chatpix-${id}.jpg`;
              writeBase64(name, photo.base64);
              update({ type: "message.photo", id, file: name });
              setRelayLog((lines) =>
                [...lines, "Đã nhận một ảnh trong đoạn chat"].slice(-12),
              );
              noticeFromPartner(
                `${stateRef.current?.partner?.nickname ?? "Người thương"} 💌`,
                "đã gửi một tấm ảnh 📷",
                `chatphoto-${id}`,
              );
            } catch (error) {
              setRelayLog((lines) =>
                [
                  ...lines,
                  `Nhận ảnh nhưng chưa lưu được: ${
                    error instanceof Error ? error.message : "lỗi không rõ"
                  }`,
                ].slice(-12),
              );
            }
            return;
          }
          if (photo && photo.meta?.role === "avatar") {
            try {
              const name = String(photo.meta?.avatarId || photo.id);
              writeBase64(name, photo.base64);
              update({ type: "partner.avatar", file: name });
              setRelayLog((lines) =>
                [...lines, "Đã nhận ảnh đại diện mới của người thương"].slice(
                  -12,
                ),
              );
            } catch (error) {
              setRelayLog((lines) =>
                [
                  ...lines,
                  `Nhận ảnh đại diện nhưng chưa lưu được: ${
                    error instanceof Error ? error.message : "lỗi không rõ"
                  }`,
                ].slice(-12),
              );
            }
            return;
          }
          if (photo && photo.meta?.role === "wallpaper") {
            try {
              const id = String(photo.meta?.wallpaperId || photo.id);
              const name = wallpaperFile(id) ?? `wallpaper-${id}.jpg`;
              writeBase64(name, photo.base64);
              update({ type: "appearance.wallpaper", id, file: name });
              setRelayLog((lines) =>
                [...lines, "Đã nhận ảnh nền dùng chung"].slice(-12),
              );
            } catch (error) {
              setRelayLog((lines) =>
                [
                  ...lines,
                  `Nhận ảnh nền nhưng chưa lưu được: ${
                    error instanceof Error ? error.message : "lỗi không rõ"
                  }`,
                ].slice(-12),
              );
            }
            return;
          }
          if (photo) {
            try {
              const name = `moment-${photo.id}.jpg`;
              writeBase64(name, photo.base64);
              update({
                type: "moment.received",
                id: photo.id,
                file: name,
                caption: photo.meta?.caption ?? "",
                createdAt: photo.meta?.createdAt ?? new Date().toISOString(),
              });
              setRelayLog((lines) =>
                [...lines, "Đã nhận một khoảnh khắc mới"].slice(-12),
              );
            } catch (error) {
              setRelayLog((lines) =>
                [
                  ...lines,
                  `Nhận ảnh nhưng chưa lưu được: ${
                    error instanceof Error ? error.message : "lỗi không rõ"
                  }`,
                ].slice(-12),
              );
            }
          }
          return;
        }
        if (kind === "photoRequest") {
          const ids = Array.isArray(message.ids)
            ? (message.ids as string[])
            : [];
          const current = stateRef.current;
          const client = relayRef.current;
          if (!current || !client) return;
          for (const id of ids) {
            if (current.appearance?.wallpaperId === String(id)) {
              sendWallpaper(String(id));
              continue;
            }
            // Ảnh đại diện của mình: gửi lại nguyên tệp để máy kia hiện được.
            if (current.me?.avatar && current.me.avatar === String(id)) {
              const avatarBase64 = imageBase64(
                current.me.avatar,
                AVATAR_LIMIT_BYTES,
              );
              if (avatarBase64) {
                void (async () => {
                  try {
                    for (const packet of photoMessages({
                      id: String(id),
                      base64: avatarBase64,
                      nickname: current.me.nickname,
                      role: "avatar",
                      avatarId: current.me.avatar ?? undefined,
                    })) {
                      client.publish(packet);
                      await new Promise((resolve) => setTimeout(resolve, 60));
                    }
                    setRelayLog((lines) =>
                      [...lines, "Đã gửi lại ảnh đại diện"].slice(-12),
                    );
                  } catch {}
                })();
              }
              continue;
            }
            const chatPhoto = (current.messages ?? []).find(
              (message: State["messages"][number]) =>
                message.id === String(id) &&
                message.authorId !== "partner" &&
                message.kind === "photo" &&
                message.photo,
            );
            if (chatPhoto?.photo) {
              const base64 = imageBase64(
                chatPhoto.photo,
                CHAT_PHOTO_LIMIT_BYTES,
              );
              if (base64) {
                void (async () => {
                  try {
                    for (const packet of photoMessages({
                      id: chatPhoto.id,
                      base64,
                      caption: chatPhoto.body,
                      createdAt: chatPhoto.createdAt,
                      nickname: current.me.nickname,
                      role: "chat",
                      chatId: chatPhoto.id,
                    })) {
                      client.publish(packet);
                      await new Promise((resolve) => setTimeout(resolve, 60));
                    }
                    setRelayLog((lines) =>
                      [...lines, "Đã gửi lại ảnh trong đoạn chat"].slice(-12),
                    );
                  } catch {}
                })();
              }
              continue;
            }
            const voiceMessage = (current.messages ?? []).find(
              (message: State["messages"][number]) =>
                message.id === String(id) &&
                message.authorId !== "partner" &&
                message.kind === "voice" &&
                message.audio,
            );
            if (voiceMessage) {
              const base64 = imageBase64(
                voiceMessage.audio as string,
                VOICE_LIMIT_BYTES,
              );
              if (base64) {
                void (async () => {
                  try {
                    for (const packet of photoMessages({
                      id: voiceMessage.id,
                      base64,
                      nickname: current.me.nickname,
                      role: "voice",
                      voiceId: voiceMessage.id,
                      durationMs: voiceMessage.durationMs,
                    })) {
                      client.publish(packet);
                      await new Promise((resolve) => setTimeout(resolve, 60));
                    }
                  } catch {}
                })();
              }
              continue;
            }
            const moment = (current.moments ?? []).find(
              (item: State["moments"][number]) =>
                item.id === String(id) && item.authorId !== "partner",
            );
            if (!moment?.file) continue;
            const base64 = imageBase64(moment.file, 200 * 1024);
            if (!base64) continue;
            void (async () => {
              try {
                for (const message of photoMessages({
                  id: moment.id,
                  base64,
                  caption: moment.caption,
                  createdAt: moment.createdAt,
                  nickname: current.me.nickname,
                })) {
                  client.publish(message);
                  await new Promise((resolve) => setTimeout(resolve, 60));
                }
              } catch {}
            })();
          }
        }
      },
      onStatus: (status: {
        state: string;
        broker: string | null;
        partnerOnline: boolean;
        partnerName?: string | null;
        readyCount?: number;
        summary?: { host: string; state: string }[];
      }) => setRelayStatus(status),
      // Log ngắn bằng tiếng Việt để người dùng thấy ngay máy đang tắc ở đâu.
      onLog: (entry: { time: string; text: string }) =>
        setRelayLog((lines) =>
          [...lines, `${entry.time} · ${entry.text}`].slice(-12),
        ),
      onReady: () => {
        readyRef.current = true;
        publishCurrent(true);
        flushMoments();
        flushMessages();
        askMissingPhotos();
      },
    });
    relayRef.current = client;
    client.start();
    return () => {
      client.stop();
      relayRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relayRoom?.id, relayRoom?.key, state?.settings.relay, pairChecked]);
  // Chế độ âm thanh trong suốt cuộc gọi:
  // - `shouldPlayInBackground: true`: iOS/Android vẫn cho thu/phát tiếng khi app
  //   xuống chạy nền hoặc tắt màn hình (cùng với dịch vụ chạy nổi ở Android).
  // - Android đẩy tiếng ra LOA NGOÀI (như bật loa Zalo): WebRTC mặc định đưa vào
  //   loa trong nên máy ảo/nhiều máy không nghe thấy gì.
  // Nhắc lại vài giây một lần vì trình quản lý âm thanh của máy có thể đổi lại.
  useEffect(() => {
    if (call?.phase !== "active") return;
    const android = Platform.OS === "android";
    const route = () => {
      void setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        ...(android ? { shouldRouteThroughEarpiece: false } : {}),
      }).catch(() => {});
    };
    route();
    const timer = setInterval(route, 3000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call?.phase, call?.id, rtcLive]);
  // Giữ cuộc gọi sống khi tắt màn hình: Android cần dịch vụ chạy nổi kèm thông
  // báo "Cuộc gọi đang diễn ra…" (có nút Cúp máy); cuộc gọi kết thúc là tắt ngay
  // để không hao pin. iOS chỉ cần chế độ chạy nền khai trong app.config.js.
  useEffect(() => {
    if (call?.phase !== "active") return;
    void startCallService(call.name ?? "");
    return () => {
      void stopCallService();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call?.phase, call?.id]);
  // Nút "Cúp máy" trên thông báo làm y như nút trên màn hình cuộc gọi.
  useEffect(() => {
    onCallServiceHangup(() => callAction({ type: "hangup" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Cuộc gọi vừa được nghe máy: mở ngay đường tiếng trực tiếp. Bên gọi mời
  // trước, bên nghe trả lời; chưa nối được trong vài giây thì vẫn gọi bình
  // thường bằng đường tiếng qua kênh ghép nối.
  useEffect(() => {
    if (call?.phase !== "active") return;
    ensureRtc(call);
    if (!rtcSupport().ok)
      setRelayLog((lines) =>
        [...lines, "Máy này chưa có WebRTC, tiếng đi qua kênh ghép nối."].slice(
          -12,
        ),
      );
    return () => {
      closeRtc();
      setRtcInfo((info) =>
        info.state === "off" ? info : { state: "off", detail: "" },
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call?.phase, call?.id]);
  // Nhịp 1 giây cho màn hình gọi + tự kết thúc khi chuông reo quá lâu.
  // Không có cuộc gọi thì không chạy nhịp nào: trước đây app tự vẽ lại toàn bộ
  // giao diện mỗi giây nên máy yếu bị giật, có lúc đơ dính cả màn hình.
  useEffect(() => {
    if (!call) return;
    const timer = setInterval(() => {
      setCallTick((value) => value + 1);
      const active = callRef.current;
      if (!active) return;
      if (active.phase === "active") {
        // Nhịp "còn đây": máy nào tắt app/mất mạng thì máy kia tự kết thúc sau
        // 5 giây, không còn cảnh một bên đã tắt mà bên này vẫn hiện đang gọi.
        const now = Date.now();
        if (now - lastAliveSentRef.current >= CALL_ALIVE_MS) {
          lastAliveSentRef.current = now;
          relayRef.current?.publish({
            kind: "call",
            event: "alive",
            callId: active.id,
            name: stateRef.current?.me.nickname ?? "",
          });
        }
        if (
          rtcLiveRef.current ||
          (rtcRef.current?.currentState() === "trying" &&
            now - (active.startedAt || active.at) < 10000)
        ) {
          // WebRTC cho biết máy kia còn sống qua chính luồng tiếng (hoặc đang
          // bắt tay TURN trong 10 giây đầu); không chờ nhịp qua kênh ghép nối
          // nữa (kênh mất gói là mình tưởng máy kia tắt).
          applyCall(callEvent(active, { type: "alive" }, now));
        } else if (callTimedOut(active, now)) {
          applyCall(callEvent(active, { type: "lost" }, now));
          return;
        }
      }
      if (ringTimedOut(active)) {
        if (active.role === "caller")
          relayRef.current?.publish({
            kind: "call",
            event: "hangup",
            callId: active.id,
            name: stateRef.current?.me.nickname ?? "",
          });
        applyCall(callEvent(active, { type: "timeout" }));
      }
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call?.id]);
  // Nói chuyện liên tục: ghi âm thành từng mảnh ngắn rồi gửi ngay, không cần
  // giữ nút. Mảnh nhỏ nên vẫn nhẹ kênh; mic tắt thì tạm dừng gửi tiếng.
  useEffect(() => {
    const active = call?.phase === "active";
    // Đang nói bằng WebRTC thì không ghi âm từng mảnh nữa: tiếng đã đi trực tiếp.
    // Chưa nối xong (hoặc chưa bỏ cuộc) thì cũng chưa ghi: micro chỉ phục vụ một
    // đường tiếng, mở hai nơi cùng lúc là cả hai cùng hỏng.
    if (!active || rtcLive || !rtcFallback) return;
    const callId = call!.id;
    let alive = true;
    void (async () => {
      try {
        const permission = await AudioModule.requestRecordingPermissionsAsync();
        if (!permission.granted) return;
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
      } catch {
        return;
      }
      while (alive) {
        const current = callRef.current;
        if (!current || current.id !== callId || current.phase !== "active")
          break;
        // Mic tắt, hoặc đang nghe tiếng người thương: chờ một nhịp ngắn rồi thử lại.
        if (!current.micOn || callPlayingRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 120));
          continue;
        }
        try {
          await callRecorder.prepareToRecordAsync();
          callRecorder.record();
          await new Promise((resolve) => setTimeout(resolve, CALL_FRAME_MS));
          await callRecorder.stop();
          const uri = callRecorder.uri;
          const seq = callSeqRef.current + 1;
          callSeqRef.current = seq;
          if (!uri) continue;
          // Xoay vòng 6 tệp: máy kia phát xong mảnh cũ trước khi tệp bị ghi đè.
          const name = `callout-${callId}-${seq % 6}.m4a`;
          saveImage(uri, name);
          const base64 = imageBase64(name, 160 * 1024);
          if (base64 && frameUsable(base64.length, true)) {
            // KHÔNG chờ gửi xong: vòng lặp quay lại ghi mảnh kế ngay nên câu
            // chuyện liền mạch hơn hẳn (trước đây mỗi mảnh phải chờ gửi).
            relayRef.current?.publish({
              kind: "call",
              event: "audio",
              callId,
              seq,
              ms: CALL_FRAME_MS,
              data: base64,
              bytes: base64.length,
              name: stateRef.current?.me.nickname ?? "",
            });
          }
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
    })();
    return () => {
      alive = false;
      try {
        callRecorder.stop();
      } catch {}
      // Đang nói bằng WebRTC thì đừng đụng vào chế độ âm thanh của máy, kẻo
      // phiên âm thanh của WebRTC bị đổi giữa cuộc gọi.
      setTimeout(() => {
        if (rtcLiveRef.current) return;
        void setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
        }).catch(() => {});
      }, 400);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call?.phase, call?.id, rtcLive, rtcFallback]);
  useEffect(() => {
    if (!call || call.phase !== "ended") return;
    closeRtc();
    // Cuộc gọi đã hết: tắt dịch vụ chạy nổi + xoá thông báo ngay.
    void stopCallService();
    // Ghi nhật ký cuộc gọi vào đoạn chat (một lần cho mỗi cuộc gọi).
    if (callLoggedRef.current !== call.id) {
      callLoggedRef.current = call.id;
      const body = callLogText(call, Date.now());
      if (body) update({ type: "message.add", kind: "call", body });
    }
    // Cửa sổ cuộc gọi tự đóng, không phải bấm gì.
    const timer = setTimeout(() => applyCall(null), CALL_CLOSE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call?.id, call?.phase]);
  // Trong cuộc gọi: tiếng của người thương tới thì lưu thành tệp và xếp hàng phát.
  useEffect(() => {
    if (call?.phase !== "active") callQueueRef.current = newAudioQueue();
  }, [call?.phase]);
  // Lời yêu tự động mỗi 2 tiếng + nhắc khi mình chưa trả lời người thương.
  useEffect(() => {
    const timer = setInterval(() => {
      const current = stateRef.current;
      if (!current) return;
      const now = Date.now();
      const canSend =
        current.settings?.autoLove !== false &&
        Boolean(current.partner) &&
        Boolean(relayRef.current?.connected);
      if (current.settings?.autoLove !== false && !current.autoLoveAt) {
        update({ type: "autoLove.sent", at: now });
      } else if (
        canSend &&
        dueLoveNote({ now, lastAt: current.autoLoveAt ?? 0 })
      ) {
        const note = loveNoteFor(new Date(now));
        update({
          type: "message.add",
          kind: "text",
          body: `${note.emoji} ${note.text}`,
        });
        update({ type: "autoLove.sent", at: now });
        setRelayLog((lines) =>
          [...lines, "Đã tự gửi một lời yêu cho người thương"].slice(-12),
        );
        setTimeout(() => flushMessages(), 300);
      }
      const notice = waitingNotice({
        messages: current.messages ?? [],
        now,
        lastNotice: noticeRef.current,
        enabled: current.settings?.replyNudge !== false,
      });
      if (notice) {
        noticeRef.current = { key: notice.key, stage: notice.stage, at: now };
        noticeFromPartner(
          notice.title,
          notice.body,
          `wait-${notice.key}-${notice.stage}`,
          false,
        );
      }
    }, 30000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (
      state?.messages?.some(
        (message) => message.authorId !== "partner" && !message.sentAt,
      )
    )
      flushMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.messages]);
  useEffect(() => {
    if (
      state?.moments?.some(
        (moment) => moment.authorId !== "partner" && !moment.sentAt,
      )
    )
      flushMoments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.moments]);
  useEffect(() => {
    if (!state || !relayRef.current) return;
    if (sentRoomRef.current !== pairRoomKey) {
      sentRoomRef.current = pairRoomKey;
      lastSentRef.current = "";
    }
    if (publishTimer.current) clearTimeout(publishTimer.current);
    publishTimer.current = setTimeout(() => publishCurrent(false), 700);
    return () => {
      if (publishTimer.current) clearTimeout(publishTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, pairRoomKey]);
  /** Hỏi máy chủ trạng thái ghép nối thật (không tin bộ nhớ máy). */
  async function refreshAccount(reason?: string) {
    const configured = await accountConfigured();
    if (!configured) return;
    const session = await currentSession();
    setAccountEmail(session.email);
    if (!session.signedIn) {
      if (stateRef.current?.relay || (stateRef.current?.links?.length ?? 0) > 0)
        update({ type: "pairing.clear" });
      setAccount(null);
      setPairChecked(true);
      return;
    }
    const result = await ensureAccount();
    if (!result.ok) {
      setPairError(result.message);
      // Đã xác nhận ghép nối trong phiên này rồi thì một lần mạng chập chờn không
      // được làm văng bạn ra khỏi app; còn máy mới mở mà chưa kiểm tra được thì
      // vẫn phải dừng ở màn ghép nối cho an toàn.
      if (!accountRef.current?.partnerId) setPairChecked(false);
      return;
    }
    const fresh = result.account!;
    const previous = accountRef.current;
    if (previous && previous.partnerId && !fresh.partnerId) {
      wrongPairRef.current = true;
      if (stateRef.current?.relay) update({ type: "pairing.clear" });
    }
    setPairError("");
    setPairChecked(true);
    setAccount(fresh);
    if (fresh.partnerId) {
      update({
        type: "partner.account",
        uid: fresh.partnerId,
        nickname: fresh.partnerName || fresh.partnerCode || "Người thương",
        avatar: fresh.partnerAvatar ?? undefined,
      });
      // Ghi phòng kết nối vào dữ liệu máy — KHÔNG phải để tin bộ nhớ máy, mà để
      // các phần khác (giữ kết nối khi tắt màn hình, Chi tiết kết nối) hoạt động.
      try {
        const room = roomFromPair(fresh.pairSecret ?? "");
        const current = stateRef.current?.relay;
        if (
          !current ||
          current.id !== room.id ||
          current.key !== room.key ||
          current.mode !== "pair"
        )
          update({
            type: "relay.set",
            room: { ...room, code: fresh.shortCode ?? "", role: "host" },
          });
      } catch {}
    }
    if (reason) setPairMessage(reason);
  }
  const accountRef = useRef<Account | null>(null);
  accountRef.current = account;
  const gate = pairGate({
    hasConfig: Boolean(account || accountEmail || pairChecked || !pairError),
    session: Boolean(account || accountEmail),
    checked: pairChecked,
    partnerId: account?.partnerId ?? null,
    secret: account?.pairSecret ?? null,
    error: pairError,
  });
  useEffect(() => {
    let alive = true;
    void (async () => {
      const configured = await accountConfigured();
      if (!alive) return;
      setAccountReady(configured);
      if (!configured) {
        setPairChecked(false);
        setPairError("");
        return;
      }
      await refreshAccount();
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Máy kia bấm "Ngắt kết nối" → máy này biết trong vài giây và văng về màn nhập mã.
  useEffect(() => {
    if (!account?.uid) return;
    let watcher: PairingWatcher | null = null;
    let alive = true;
    void (async () => {
      const created = await watchAccount(account.uid, () => {
        void refreshAccount();
      });
      if (alive) {
        watcher = created;
        pairWatcherRef.current = created;
      } else created.stop();
    })();
    return () => {
      alive = false;
      watcher?.stop();
      pairWatcherRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.uid]);
  const inviteInRef = useRef<RelayClient | null>(null);
  const inviteOutRef = useRef<RelayClient | null>(null);
  // Kênh đón lời mời theo mã cố định của mình: khi máy kia nhập mã 6 ký tự của
  // mình thì tự động nhận đôi ngay (chỉ cần MỘT máy nhập mã).
  useEffect(() => {
    const myCode = account?.shortCode ?? "";
    if (!myCode || state?.settings.relay === false) {
      inviteInRef.current?.stop();
      inviteInRef.current = null;
      return;
    }
    let client: RelayClient | null = null;
    try {
      const room = roomFromPair(inviteSecretForCode(myCode));
      client = new RelayClient({
        room,
        deviceId: deviceIdRef.current + "-in",
        onMessage: (message: Record<string, unknown>) => {
          const kind = String(message.kind ?? "");
          if (kind === "pair.invite") {
            const target = String(message.targetCode ?? "");
            const fromCode = String(message.fromCode ?? "");
            if (!fromCode || (target && target !== myCode)) return;
            void acceptPartnerInvite({
              fromUid: String(message.fromUid ?? ""),
              fromCode,
              fromName: String(message.fromName ?? ""),
            }).then((accepted) => {
              if (accepted)
                void refreshAccount(
                  `Đã ghép nối với ${accepted.partnerName || "người thương"}!`,
                );
            });
            return;
          }
          if (kind === "pair.unpair") {
            void unpairAccount().then(() => {
              if (stateRef.current?.relay) update({ type: "pairing.clear" });
              void refreshAccount(
                "Người thương đã ngắt kết nối — hai máy đã rời khỏi phòng chung.",
              );
            });
          }
        },
      });
      inviteInRef.current = client;
      client.start();
    } catch {}
    return () => {
      client?.stop();
      inviteInRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.shortCode, state?.settings.relay]);

  // Khi mình vừa nhập mã cố định của người thương: bắn lời mời sang kênh đón của
  // mã đó để máy người thương tự ghép đôi mà không bắt họ phải nhập lại mã.
  useEffect(() => {
    const partnerCode = account?.partnerCode ?? "";
    const myCode = account?.shortCode ?? "";
    if (
      !partnerCode ||
      !myCode ||
      !account?.pairSecret ||
      relayStatus.partnerOnline ||
      state?.settings.relay === false
    ) {
      inviteOutRef.current?.stop();
      inviteOutRef.current = null;
      return;
    }
    let client: RelayClient | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    try {
      const room = roomFromPair(inviteSecretForCode(partnerCode));
      const sendInvite = () => {
        client?.publish({
          kind: "pair.invite",
          targetCode: partnerCode,
          fromUid: account?.uid ?? "",
          fromCode: myCode,
          fromName:
            stateRef.current?.me?.nickname ||
            account?.displayName ||
            "Người thương",
        });
      };
      client = new RelayClient({
        room,
        deviceId: deviceIdRef.current + "-out",
        onReady: sendInvite,
      });
      inviteOutRef.current = client;
      client.start();
      timer = setInterval(sendInvite, 4500);
    } catch {}
    return () => {
      if (timer) clearInterval(timer);
      client?.stop();
      inviteOutRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    account?.partnerCode,
    account?.shortCode,
    account?.pairSecret,
    relayStatus.partnerOnline,
    state?.settings.relay,
  ]);

  /** Bảng điều khiển tài khoản dùng ở màn hình ghép nối. */
  const pairActions = {
    onSignIn: (provider: AuthProvider) =>
      void (async () => {
        setPairBusy(true);
        setPairMessage("");
        const result = await signInWithProvider(provider);
        setPairMessage(result.message);
        if (result.ok) {
          setAccountEmail((await currentSession()).email);
          await refreshAccount();
        }
        setPairBusy(false);
      })(),
    onSignInAccount: (
      identifier: string,
      password: string,
      displayName: string,
    ) =>
      void (async () => {
        setPairBusy(true);
        setPairMessage("");
        const result = await signInWithAccount(
          identifier,
          password,
          displayName,
        );
        setPairMessage(result.message);
        if (result.ok) {
          if (displayName.trim() && stateRef.current) {
            try {
              update({
                type: "profile.set",
                nickname: displayName.trim(),
                mood: stateRef.current.me.mood,
                moodNote: stateRef.current.me.moodNote,
              });
            } catch {}
          }
          setAccountEmail((await currentSession()).email);
          await refreshAccount(result.message);
        }
        setPairBusy(false);
      })(),
    onSignInAnonymous: () =>
      void (async () => {
        setPairBusy(true);
        setPairMessage("");
        const result = await signInAnonymous();
        setPairMessage(result.message);
        if (result.ok) {
          setAccountEmail((await currentSession()).email);
          await refreshAccount(result.message);
        }
        setPairBusy(false);
      })(),
    onSignOut: () =>
      void (async () => {
        setPairBusy(true);
        await signOutAccount();
        if (stateRef.current?.relay) update({ type: "pairing.clear" });
        setAccount(null);
        setAccountEmail(null);
        setPairChecked(true);
        setPairMessage("Đã đăng xuất tài khoản ghép nối.");
        setPairBusy(false);
      })(),
    onPair: (code: string) =>
      void (async () => {
        setPairBusy(true);
        setPairMessage("");
        const result = await pairWithCode(code);
        setPairMessage(result.message);
        if (result.ok)
          await refreshAccount(
            "Ghép nối xong. Hai máy đang nói chuyện với nhau.",
          );
        setPairBusy(false);
      })(),
    onUnpair: () =>
      void (async () => {
        setPairBusy(true);
        setPairMessage("");
        try {
          relayRef.current?.publish({
            kind: "pair.unpair",
            fromUid: accountRef.current?.uid ?? "",
            fromCode: accountRef.current?.shortCode ?? "",
          });
          inviteOutRef.current?.publish({
            kind: "pair.unpair",
            fromUid: accountRef.current?.uid ?? "",
            fromCode: accountRef.current?.shortCode ?? "",
          });
        } catch {}
        const result = await unpairAccount();
        if (stateRef.current?.relay) update({ type: "pairing.clear" });
        setPairMessage(
          result.ok
            ? "Đã ngắt kết nối ở cả hai máy. Hai máy đã rời khỏi phòng cũ."
            : result.message,
        );
        await refreshAccount();
        setPairBusy(false);
      })(),
    onRetry: () =>
      void (async () => {
        setPairBusy(true);
        await refreshAccount();
        setPairBusy(false);
      })(),
    onManual: () => setGateManual(true),
  };
  /**
   * Giữ kết nối khi app ở chế độ nền (công tắc trong Cài đặt): Android mở một
   * dịch vụ chạy nổi nên kết nối MQTT sống tiếp và tin nhắn vẫn nổi thông báo dù
   * màn hình đã tắt. Tắt công tắc là dịch vụ dừng ngay, không hao pin.
   */
  useEffect(() => {
    const wanted =
      state?.settings?.keepAlive === true &&
      state?.settings?.relay !== false &&
      Boolean(state?.relay?.id);
    if (wanted) void startRelayService(state?.partner?.nickname ?? null);
    else void stopRelayService();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state?.settings?.keepAlive,
    state?.settings?.relay,
    state?.relay?.id,
    state?.partner?.nickname,
  ]);
  /** Nút "Tắt" trên thông báo giữ kết nối → tắt công tắc trong Cài đặt. */
  const stopKeepAliveRef = useRef<() => void>(() => {});
  stopKeepAliveRef.current = () =>
    update({ type: "settings.set", keepAlive: false });
  useEffect(() => {
    onRelayServiceStop(() => stopKeepAliveRef.current());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /**
   * Thông báo tin nhắn: bấm vào là vào thẳng đoạn chat, kéo xuống có nút **Trả
   * lời** (nhắn ngay từ màn hình khoá, không cần mở app) và **Đã xem**.
   */
  const notificationReplyRef = useRef<(response: unknown) => void>(() => {});
  notificationReplyRef.current = (response: unknown) => {
    const value = (response ?? {}) as {
      actionIdentifier?: string;
      userText?: string;
      notification?: { date?: number; request?: { content?: { data?: any } } };
    };
    const data = (value.notification?.request?.content?.data ?? {}) as {
      open?: string;
      key?: string;
    };
    const action = String(value.actionIdentifier ?? "");
    const quick = String(value.userText ?? "").trim();
    if (action === "tra-loi" && quick) {
      try {
        update({ type: "message.add", kind: "text", body: quick });
        setTimeout(() => flushMessages(), 160);
        setTab("chat");
        setRelayLog((lines) =>
          [...lines, `Đã trả lời nhanh từ thông báo: ${quick}`].slice(-12),
        );
      } catch {}
      return;
    }
    if (action === "da-xem") {
      update({ type: "message.read" });
      setTab("chat");
      return;
    }
    if (data.open === "chat" || String(data.key ?? "").startsWith("chat-"))
      setTab("chat");
    else if (data.open === "alerts") setAlertPage(true);
  };
  useEffect(() => {
    const feed = (response: unknown) => notificationReplyRef.current(response);
    const subscription =
      Notifications.addNotificationResponseReceivedListener?.(feed);
    // App mở từ thông báo (kể cả khi bị hệ thống tắt): chỉ xử lý thông báo vừa
    // bấm trong vòng 2 phút, tránh gửi lại tin cũ mỗi lần mở app.
    void Notifications.getLastNotificationResponseAsync?.().then((response) => {
      if (!response) return;
      const at = Number(response.notification?.date ?? 0);
      if (!at || Date.now() - at < 120000) feed(response);
    });
    return () => subscription?.remove?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /**
   * Đổi tên hoặc ảnh đại diện → lưu lên Supabase (hồ sơ theo tài khoản), để lần
   * sau mở app trên máy nào cũng thấy đúng tên/ảnh. Chỉ gọi khi ĐÃ đăng nhập và
   * có thay đổi thật; lỗi mạng thì bỏ qua im lặng (dữ liệu vẫn nằm ở máy).
   */
  const syncedProfileRef = useRef<{
    name: string;
    avatar: string | null;
  } | null>(null);
  useEffect(() => {
    if (!state) return;
    if (!account?.uid) return;
    const name = state.me?.nickname ?? "";
    const avatar = state.me?.avatar ?? null;
    const previous = syncedProfileRef.current;
    if (!previous) {
      // Lần đầu trong phiên: ghi nhận để không đẩy lên máy chủ một cách vô ích,
      // nhưng nếu máy chủ còn trống tên thì điền luôn.
      syncedProfileRef.current = { name, avatar };
      if (name && !account.displayName)
        void saveAccountProfile({ displayName: name });
      return;
    }
    if (previous.name === name && previous.avatar === avatar) return;
    syncedProfileRef.current = { name, avatar };
    void (async () => {
      if (previous.name !== name && name)
        await saveAccountProfile({ displayName: name });
      if (previous.avatar !== avatar && avatar) {
        const base64 = imageBase64(avatar, AVATAR_LIMIT_BYTES);
        if (base64) {
          const saved = await uploadAvatar(account.uid, base64);
          if (saved.ok) return;
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.me?.nickname, state?.me?.avatar, account?.uid]);

  /**
   * Đổi ảnh đại diện: báo máy kia NGAY bằng một gói hồ sơ nhỏ rồi gửi kèm tệp
   * ảnh (tối đa 120 KB) — máy kia đổi giao diện trong tích tắc, không phải đợi
   * gói dữ liệu định kỳ. Lần mở đầu tiên thì bỏ qua: lúc đó gói dữ liệu và phần
   * "xin gửi lại ảnh" đã lo việc này.
   */
  const pushedAvatarRef = useRef<string | null>(null);
  useEffect(() => {
    const avatar = state?.me?.avatar ?? null;
    if (!avatar) return;
    if (pushedAvatarRef.current === avatar) return;
    const firstRun = pushedAvatarRef.current === null;
    pushedAvatarRef.current = avatar;
    if (firstRun) return;
    const client = relayRef.current;
    if (!client) return;
    client.publish({
      kind: "profile",
      type: "profile",
      avatar,
      nickname: state?.me?.nickname ?? "",
    });
    setTimeout(
      () => sendAvatarFile("Đã gửi ảnh đại diện mới cho người thương"),
      120,
    );
    setTimeout(() => publishCurrent(true), 600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.me?.avatar]);

  // Người thương vừa mở app: gửi ngay toàn bộ dữ liệu của mình cho họ và báo
  // cho chính mình biết là hai máy đã ghép nối (cả hai bên đều nhận như nhau).
  useEffect(() => {
    if (!relayStatus.partnerOnline) return;
    publishCurrent(true);
    flushMoments();
    flushMessages();
    askMissingPhotos();
    const name = relayStatus.partnerName || stateRef.current?.partner?.nickname;
    if (!name || joinedRef.current === name) return;
    joinedRef.current = name;
    Alert.alert(
      "Đã ghép nối với " + name,
      "Hai máy đã chung dữ liệu và tự cập nhật cho nhau khi cùng mở app.",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relayStatus.partnerOnline, relayStatus.partnerName]);

  // Không còn chặn toàn màn hình trước LocalShell: thanh 5 tab (Yêu nhau, Tin nhắn,
  // Chăm sóc, Nhật ký, Cài đặt) và Theme luôn hiển thị đầy đủ; phần đăng nhập /
  // nhập mã 6 ký tự nằm ngay trong mục Ghép nối (tab === "pair"), còn kênh MQTT
  // vẫn chỉ mở khi đã ghép nối (gate.screen !== "paired" thì relayRoom = null).
  const hasCfg = accountReady;
  void hasCfg;

  if (!state) {
    return (
      <ThemeProvider themeId="hong">
        <View className="flex-1 bg-pink-50 items-center justify-center">
          {error ? (
            <Text className="text-ink px-8 text-center">{error}</Text>
          ) : (
            <>
              <ActivityIndicator color="#e64980" />
              <Text className="text-love mt-4">Đang mở góc yêu thương…</Text>
            </>
          )}
        </View>
      </ThemeProvider>
    );
  }
  if (lockEnabled && locked) {
    return (
      <ThemeProvider themeId={state.appearance?.theme ?? "hong"}>
        <LockScreen
          unlocking={unlocking}
          onUnlock={() =>
            void authenticate()
              .then((ok) => {
                if (ok) setLocked(false);
                else
                  Alert.alert(
                    "Chưa mở khóa",
                    "Xác thực chưa thành công. Bạn có thể thử lại.",
                  );
              })
              .catch(() =>
                Alert.alert(
                  "Chưa mở khóa",
                  "Không dùng được sinh trắc học lúc này.",
                ),
              )
          }
        />
      </ThemeProvider>
    );
  }
  const unread = state.alerts.filter((alert) => !alert.readAt).length;
  const props = { state, update };
  const storedWallpaper =
    state.appearance?.wallpaper ??
    wallpaperFile(state.appearance?.wallpaperId ?? null);
  const hasWallpaper = Boolean(storedWallpaper && imageExists(storedWallpaper));
  return (
    // Mọi màn hình lấy màu từ một chủ đề duy nhất, nên thẻ, nút và nền luôn
    // hài hoà với nhau; hai máy đang ghép nối thì dùng chung chủ đề đó.
    <ThemeProvider
      themeId={state.appearance?.theme ?? state.settings.theme ?? "hong"}
      wallpaper={hasWallpaper}
      wallpaperTint={state.settings.wallpaperTint ?? 0.5}
    >
      <LocalShell
        state={state}
        update={update}
        props={props}
        unread={unread}
        alertPage={alertPage}
        setAlertPage={setAlertPage}
        relayStatus={relayStatus}
        relayLog={relayLog}
        selfTest={selfTest}
        setSelfTest={setSelfTest}
        lastError={lastError}
        setLastError={setLastError}
        clearCrash={clearCrash}
        error={error}
        setError={setError}
        lockEnabled={lockEnabled}
        toggleLock={toggleLock}
        onSwitchMode={() => {
          setGateManual(false);
          setTab("pair");
          void onSwitchMode;
        }}
        replaceState={replaceState}
        clearAll={clearAll}
        flushMoments={flushMoments}
        flushMessages={flushMessages}
        publishCurrent={publishCurrent}
        relayRef={relayRef}
        tab={tab}
        setTab={setTab}
        wallpaperUri={hasWallpaper ? imageUri(storedWallpaper) : null}
        account={account}
        gate={gate}
        accountEmail={accountEmail}
        pairBusy={pairBusy}
        pairActions={pairActions}
        gateManual={gateManual}
        setGateManual={setGateManual}
        pairMessage={pairMessage}
        onUnpair={pairActions.onUnpair}
        onSignOutAccount={pairActions.onSignOut}
        call={call}
        // Chỉ để màn hình gọi vẽ lại mỗi giây khi đang gọi (không đọc giá trị).
        callTick={callTick}
        onStartCall={startCall}
        onPickRingtone={pickRingtone}
        onResetRingtone={resetRingtone}
        callQueueRef={callQueueRef}
        callPlayingRef={callPlayingRef}
        rtcInfo={rtcInfo}
        rtcLive={rtcLive}
        rtcAudio={rtcAudio}
        onUseLegacyAudio={useLegacyAudio}
        onSendPhoto={sendChatPhoto}
        partnerTyping={partnerTyping}
        onTyping={sendTyping}
        onReact={reactToMessage}
        onRecall={recallMessage}
        onSavePhoto={savePhoto}
        onSendLocation={() => void sendLocation()}
        callAction={callAction}
        callRef={callRef}
        notifyState={notifyState}
        onEnableNotifications={() =>
          void (async () => {
            const granted = await requestNotifications();
            setNotifyState(granted ? "granted" : "denied");
            if (granted && stateRef.current)
              void rescheduleEverything(stateRef.current).catch(() => {});
            if (!granted) await openNotificationSettings();
          })()
        }
      />
    </ThemeProvider>
  );
}
function LocalShell({
  state,
  update,
  props,
  unread,
  alertPage,
  setAlertPage,
  relayStatus,
  relayLog,
  selfTest,
  setSelfTest,
  lastError,
  setLastError,
  clearCrash,
  error,
  setError,
  lockEnabled,
  toggleLock,
  onSwitchMode,
  replaceState,
  clearAll,
  flushMoments,
  flushMessages,
  publishCurrent,
  relayRef,
  tab,
  setTab,
  wallpaperUri,
  account,
  gate,
  accountEmail,
  pairBusy,
  pairActions,
  gateManual,
  setGateManual,
  pairMessage,
  onUnpair,
  onSignOutAccount,
  notifyState,
  onEnableNotifications,
  call,
  callTick,
  callQueueRef,
  callPlayingRef,
  rtcInfo,
  rtcLive,
  rtcAudio,
  onUseLegacyAudio,
  onPickRingtone,
  onResetRingtone,
  onStartCall,
  onSendPhoto,
  onSendLocation,
  partnerTyping,
  onTyping,
  onReact,
  onRecall,
  onSavePhoto,
  callAction,
  callRef,
}: {
  state: State;
  update: (action: Record<string, unknown>) => void;
  props: { state: State; update: (action: Record<string, unknown>) => void };
  unread: number;
  alertPage: boolean;
  setAlertPage: (value: boolean) => void;
  relayStatus: {
    state: string;
    broker: string | null;
    partnerOnline: boolean;
    partnerName?: string | null;
    readyCount?: number;
    summary?: { host: string; state: string }[];
  };
  relayLog: string[];
  selfTest: { name: string; ok: boolean; detail: string }[];
  setSelfTest: (value: { name: string; ok: boolean; detail: string }[]) => void;
  lastError: string;
  setLastError: (value: string) => void;
  clearCrash: () => Promise<void>;
  error: string;
  setError: (value: string) => void;
  lockEnabled: boolean;
  toggleLock: (value: boolean) => Promise<void>;
  onSwitchMode: () => void;
  replaceState: (next: State) => void;
  clearAll: () => Promise<void>;
  flushMoments: () => void;
  flushMessages: () => void;
  publishCurrent: (force?: boolean) => void;
  relayRef: React.MutableRefObject<RelayClient | null>;
  tab: string;
  setTab: (value: string) => void;
  wallpaperUri: string | null;
  /** Tài khoản ghép nối trên máy chủ (null nếu bản dựng không có cấu hình). */
  account: Account | null;
  gate: ReturnType<typeof pairGate>;
  accountEmail: string | null;
  pairBusy: boolean;
  pairActions: {
    onSignIn: (provider: AuthProvider) => void;
    onSignInAccount: (
      identifier: string,
      password: string,
      displayName: string,
    ) => void;
    onSignInAnonymous: () => void;
    onSignOut: () => void;
    onPair: (code: string) => void;
    onUnpair: () => void;
    onRetry: () => void;
    onManual: () => void;
  };
  gateManual: boolean;
  setGateManual: (value: boolean) => void;
  pairMessage: string;
  onUnpair: () => void;
  onSignOutAccount: () => void;
  notifyState: "unknown" | "granted" | "denied";
  onEnableNotifications: () => void;
  call: CallInfo | null;
  /** Nhịp 1 giây: chỉ để màn hình gọi vẽ lại, giá trị không được đọc. */
  callTick: number;
  callQueueRef: React.MutableRefObject<AudioFrame[]>;
  callPlayingRef: React.MutableRefObject<boolean>;
  /** Trạng thái đường tiếng trực tiếp (WebRTC) của cuộc gọi đang mở. */
  rtcInfo: { state: string; detail: string };
  rtcLive: boolean;
  /** Số byte tiếng thật đang vào/ra + cường độ tiếng nói (0..1). */
  rtcAudio: {
    inBytes: number;
    outBytes: number;
    level: number;
    levelSource: string;
  };
  /** Người dùng bấm "nghe không được" → chuyển về đường tiếng qua kênh ghép nối. */
  onUseLegacyAudio: () => void;
  onPickRingtone: () => void;
  onResetRingtone: () => void;
  onStartCall: () => void;
  onSendPhoto: (uri: string, caption: string) => void;
  onSendLocation: () => void;
  /** Người thương đang gõ chữ (ba chấm nhảy ở đầu khung chat). */
  partnerTyping: boolean;
  /** Báo máy kia biết mình đang gõ / ngừng gõ. */
  onTyping: (typing: boolean) => void;
  /** Thả cảm xúc vào một tin nhắn (null = bỏ cảm xúc). */
  onReact: (id: string, emoji: string | null) => void;
  /** Thu hồi tin nhắn ở CẢ HAI máy. */
  onRecall: (id: string) => void;
  /** Lưu ảnh người thương gửi vào thư viện ảnh của máy. */
  onSavePhoto: (photo: string | null | undefined) => void;
  callAction: (event: { type: string; on?: boolean; min?: boolean }) => void;
  callRef: React.MutableRefObject<CallInfo | null>;
}) {
  // Máy yếu hoặc người dùng bật "giảm chuyển động": màn hình gọi không mở
  // WebGL, dùng tim vẽ sẵn cho nhẹ máy.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => subscription?.remove?.();
  }, []);
  const { theme } = useTheme();
  const unreadMessages = state.messages.filter(
    (message) => message.authorId === "partner" && !message.readAt,
  ).length;
  return (
    <View className="flex-1">
      <LinearGradient colors={theme.bg} style={StyleSheet.absoluteFill} />
      {wallpaperUri ? (
        <>
          <Image
            source={{ uri: wallpaperUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: theme.veil }]}
          />
        </>
      ) : null}
      <ThemeDeco dim={Boolean(wallpaperUri)} />
      <KeyboardAvoidingView
        className="flex-1"
        style={{ backgroundColor: "transparent" }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          className="flex-row px-5 py-4 items-center justify-between"
          style={{
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
            backgroundColor: theme.glass,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Trạng thái kết nối — bấm để mở Ghép nối"
            onPress={() => {
              setGateManual(false);
              setTab("pair");
              setAlertPage(false);
            }}
            style={{ flex: 1, marginRight: 8 }}
          >
            <Text className="text-xl font-bold" style={{ color: theme.ink }}>
              Mật Mã Yêu <Text style={{ color: theme.deep[0] }}>♡</Text>
            </Text>
            <View className="flex-row items-center mt-1">
              <View
                className={`w-2 h-2 rounded-full mr-2 ${
                  relayStatus.state === "online"
                    ? "bg-emerald-500"
                    : relayStatus.state === "alone"
                      ? "bg-amber-400"
                      : relayStatus.state === "connecting"
                        ? "bg-sky-400"
                        : "bg-stone-300"
                }`}
              />
              <Text
                className="text-xs"
                style={{ color: theme.sub }}
                numberOfLines={1}
              >
                {relayStatus.state === "online"
                  ? `Đã kết nối · ${relayStatus.partnerName ?? "người thương"} đang trực tuyến`
                  : relayStatus.state === "alone"
                    ? `Đã vào phòng qua ${relayStatus.readyCount ?? 0} trạm · chờ người thương`
                    : relayStatus.state === "connecting"
                      ? "Đang kết nối tức thời…"
                      : gate.screen !== "paired"
                        ? "Chưa ghép nối · chạm để lấy mã 6 ký tự"
                        : "Chạy trên máy · không cần máy chủ"}
              </Text>
            </View>
          </Pressable>
          {tab === "pair" ? (
            <Pressable
              accessibilityLabel="Về trang trước"
              onPress={() => setTab("home")}
              className="px-3 py-2 mr-2 rounded-full bg-white border border-pink-100"
            >
              <Text className="text-love">‹ Về</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mở màn hình Ghép nối"
              onPress={() => {
                setGateManual(false);
                setTab("pair");
                setAlertPage(false);
              }}
              className="px-3 py-2 mr-2 rounded-full"
              style={{
                backgroundColor:
                  gate.screen === "paired" ? theme.glass : theme.deep[0],
                borderWidth: 1,
                borderColor: theme.border,
              }}
            >
              <Text
                style={{
                  color: gate.screen === "paired" ? theme.text : theme.onDeep,
                  fontWeight: "700",
                  fontSize: 12,
                }}
              >
                {gate.screen === "paired" ? "💞 Đã ghép" : "🔗 Ghép nối"}
              </Text>
            </Pressable>
          )}
          <Pressable
            accessibilityLabel="Lời nhắc"
            onPress={() => setAlertPage(!alertPage)}
            className="px-3 py-2 rounded-full"
            style={{
              backgroundColor: theme.glass,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <Text style={{ color: theme.text }}>
              {alertPage ? "Đóng" : "Lời nhắc"}
              {unread ? " · " + unread : ""}
            </Text>
          </Pressable>
        </View>
        {notifyState === "denied" && !alertPage ? (
          <View
            className="mx-4 mb-2 p-3 rounded-xl flex-row items-center"
            style={{
              backgroundColor: theme.soft,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <Text className="text-xs flex-1" style={{ color: theme.ink }}>
              Thông báo đang bị tắt nên tin nhắn của người thương không nổi lên
              được. Bấm “Bật thông báo” rồi chọn Cho phép.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Bật thông báo"
              onPress={onEnableNotifications}
              className="ml-2 px-3 py-2 rounded-full"
              style={{ backgroundColor: theme.deep[0] }}
            >
              <Text
                className="text-xs font-bold"
                style={{ color: theme.onDeep }}
              >
                Bật thông báo
              </Text>
            </Pressable>
          </View>
        ) : null}
        {error !== "" && (
          <View
            className="mx-4 mb-2 p-3 rounded-xl"
            style={{
              backgroundColor: theme.soft,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <Text className="text-xs" style={{ color: theme.ink }}>
              {error}
            </Text>
            <Pressable onPress={() => setError("")}>
              <Text
                className="text-sm mt-1 font-semibold"
                style={{ color: theme.text }}
              >
                Đã hiểu
              </Text>
            </Pressable>
          </View>
        )}
        {/* Tin nhắn: khung riêng chiếm hết chiều cao nên ô nhắn tin luôn đứng
            yên dưới đáy, tin nhắn nhiều tới đâu cũng chỉ phần tin cuộn lên. */}
        {!alertPage && tab === "chat" ? (
          <View
            key="chat"
            collapsable={false}
            style={{
              flex: 1,
              minHeight: 240,
              paddingHorizontal: 18,
              paddingTop: 10,
            }}
          >
            <ChatLocal
              {...props}
              relayStatus={relayStatus}
              onSendMessage={flushMessages}
              onStartCall={onStartCall}
              onSendPhoto={onSendPhoto}
              partnerTyping={partnerTyping}
              onTyping={onTyping}
              onReact={onReact}
              onRecall={onRecall}
              onSavePhoto={onSavePhoto}
              onSendLocation={onSendLocation}
              onOpenPair={() => {
                setGateManual(false);
                setTab("pair");
              }}
            />
          </View>
        ) : null}
        {/* Chỉ một trong hai khối được dựng: màn hình Tin nhắn chiếm trọn chiều
            cao, các mục khác nằm trong khung cuộn. Trước đây hai khối cùng co
            giãn nên màn hình cũ dính lại, bấm Tin nhắn không mở được. */}
        {!alertPage && tab === "chat" ? null : (
          <ScrollView
            key={alertPage ? "alerts" : tab}
            keyboardShouldPersistTaps="handled"
            style={{ flexGrow: 1, flexShrink: 1 }}
            contentContainerStyle={{ padding: 18, paddingBottom: 32 }}
          >
            {alertPage ? (
              <>
                <Title>Lời nhắc yêu thương</Title>
                {state.alerts.length === 0 && (
                  <Card>
                    <Note>
                      Chưa có lời nhắc. Lời nhắc xuất hiện khi tới mốc kỷ niệm
                      hoặc mốc chu kỳ ước tính.
                    </Note>
                  </Card>
                )}
                {state.alerts.map((alert) => (
                  <Card key={alert.id}>
                    <Title small>{alert.title}</Title>
                    <Note>{alert.body}</Note>
                    <Text className="text-xs text-stone-400 mt-2">
                      {new Date(alert.createdAt).toLocaleString("vi-VN")}
                    </Text>
                    {!alert.readAt && (
                      <Button
                        label="Đã đọc"
                        secondary
                        onPress={() =>
                          update({ type: "alerts.read", id: alert.id })
                        }
                      />
                    )}
                  </Card>
                ))}
                {state.alerts.length > 0 && (
                  <Button
                    label="Xóa hết lời nhắc"
                    secondary
                    onPress={() =>
                      void (async () => {
                        if (
                          !(await confirm(
                            "Xóa hết lời nhắc?",
                            "Danh sách lời nhắc trên máy sẽ bị xóa. Lịch nhắc vẫn được giữ.",
                          ))
                        )
                          return;
                        update({ type: "alerts.clear" });
                      })()
                    }
                  />
                )}
              </>
            ) : tab === "home" ? (
              <HomeLocal
                {...props}
                openPair={() => setTab("pair")}
                relayStatus={relayStatus}
                onSendMoment={flushMoments}
                onQuickNote={(text) => {
                  try {
                    update({ type: "message.add", kind: "nudge", body: text });
                    flushMessages();
                  } catch (error) {
                    setError(
                      error instanceof Error
                        ? error.message
                        : "Không gửi được lời nhắn.",
                    );
                  }
                }}
              />
            ) : tab === "pair" ? (
              (() => {
                if (gateManual && state)
                  return (
                    <>
                      <Card>
                        <Title small>
                          Chi tiết trạm kết nối & chuyển dữ liệu thủ công
                        </Title>
                        <Note>{gateReasonText(gate)}</Note>
                        <View className="mt-2">
                          <Button
                            label="Quay lại ghép nối theo tài khoản"
                            secondary
                            onPress={() => setGateManual(false)}
                          />
                        </View>
                      </Card>
                      <PairLocal
                        {...props}
                        pairCode={account?.shortCode ?? ""}
                        initialCode={state.links.length > 0 ? "1" : ""}
                        relayStatus={relayStatus}
                        relayLog={relayLog}
                        selfTest={selfTest}
                        onRunSelfTest={() => setSelfTest(relaySelfTest())}
                        lastError={lastError}
                        onRetryRelay={() => {
                          const client = relayRef.current;
                          if (!client) return;
                          for (const slot of client.slots) {
                            clearTimeout(slot.timer);
                            slot.retry = 0;
                            if (!slot.subscribed) client.connect(slot);
                          }
                          client.emitStatus();
                        }}
                        syncNow={() => publishCurrent(true)}
                      />
                    </>
                  );
                return (
                  <PairGate
                    gate={gate}
                    account={account}
                    email={accountEmail}
                    defaultName={state.me?.nickname ?? ""}
                    busy={pairBusy}
                    message={pairMessage}
                    relayConnected={relayStatus.state === "online"}
                    onOpenChat={() => setTab("chat")}
                    {...pairActions}
                  />
                );
              })()
            ) : tab === "cycle" ? (
              <CycleLocal {...props} />
            ) : tab === "diary" ? (
              <DiaryLocal {...props} />
            ) : (
              <SettingsLocal
                {...props}
                account={account}
                pairMessage={pairMessage}
                onUnpair={onUnpair}
                onSignOutAccount={onSignOutAccount}
                onPickRingtone={onPickRingtone}
                onResetRingtone={onResetRingtone}
                replaceState={replaceState}
                clearAll={clearAll}
                locked={lockEnabled}
                onToggleLock={toggleLock}
                onSwitchMode={onSwitchMode}
                onOpenPair={() => setTab("pair")}
                onOpenHome={() => setTab("home")}
                lastError={lastError}
                onClearError={() => {
                  setLastError("");
                  void clearCrash();
                }}
              />
            )}
          </ScrollView>
        )}
        {call ? (
          <CallLocal
            call={call}
            micOn={call.micOn}
            partnerName={call.name}
            partnerAvatar={state.partner?.avatar ?? null}
            ringtoneUri={
              state.settings?.ringtone
                ? imageUri(state.settings.ringtone)
                : null
            }
            queueRef={callQueueRef}
            playingRef={callPlayingRef}
            rtcInfo={rtcInfo}
            rtcLive={rtcLive}
            reduced={reduceMotion}
            rtcAudio={rtcAudio}
            onUseLegacyAudio={onUseLegacyAudio}
            onToggleMic={() =>
              callAction({ type: "mic", on: !callRef.current?.micOn })
            }
            onMinimize={() => callAction({ type: "minimize", min: true })}
            onRestore={() => callAction({ type: "minimize", min: false })}
            onAccept={() => callAction({ type: "accept" })}
            onReject={() => callAction({ type: "hangup" })}
            onHangUp={() => callAction({ type: "hangup" })}
          />
        ) : null}
        <View
          className="flex-row pt-2 pb-3"
          style={{
            backgroundColor: theme.glass,
            borderTopWidth: 1,
            borderTopColor: theme.border,
          }}
        >
          {localTabs.map((item) => (
            // (huy hiệu tin chưa đọc nằm ngay trên biểu tượng tab Tin nhắn)
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === item.id && !alertPage }}
              accessibilityLabel={item.label}
              onPress={() => {
                setTab(item.id);
                setAlertPage(false);
              }}
              className="flex-1 items-center py-2"
            >
              <Text
                className="text-2xl"
                style={{ color: tab === item.id ? theme.deep[0] : theme.sub }}
              >
                {item.icon}
                {item.id === "chat" && unreadMessages > 0
                  ? `·${unreadMessages > 9 ? "9+" : unreadMessages}`
                  : ""}
              </Text>
              <Text
                className={`text-xs mt-1 ${tab === item.id ? "font-bold" : ""}`}
                style={{ color: tab === item.id ? theme.deep[0] : theme.sub }}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
function Root() {
  const [mode, setMode] = useState<"loading" | "choose" | "local" | "cloud">(
    "local",
  );
  useEffect(() => {
    let alive = true;
    void (async () => {
      const stored = await AsyncStorage.getItem("love-mode-v2");
      if (!alive) return;
      // Mặc định luôn mở bản đầy đủ (LocalApp: Yêu nhau, Tin nhắn, Chăm sóc,
      // Nhật ký, Cài đặt & Theme) — không bao giờ tự đẩy sang CloudApp 1.0 cũ.
      if (stored === "cloud") setMode("cloud");
      else setMode("local");
    })();
    return () => {
      alive = false;
    };
  }, []);
  function pick(value: "local" | "cloud") {
    void AsyncStorage.setItem("love-mode-v2", value);
    setMode(value);
  }
  if (mode === "loading") {
    return (
      <View className="flex-1 bg-pink-50 items-center justify-center">
        <ActivityIndicator color="#e64980" />
      </View>
    );
  }
  if (mode === "choose") return <ModeChooser onPick={pick} />;
  if (mode === "local") return <LocalApp onSwitchMode={() => pick("cloud")} />;
  return <CloudApp onSwitchMode={() => pick("local")} />;
}
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { message: string }
> {
  state = { message: "" };
  static getDerivedStateFromError(error: unknown) {
    return { message: describe(error) };
  }
  componentDidCatch(error: unknown) {
    void saveCrash("Màn hình hiển thị: " + describe(error));
  }
  render() {
    if (this.state.message)
      return (
        <View className="flex-1 bg-pink-50 justify-center px-8">
          <Text className="text-6xl text-center mb-4">💔</Text>
          <Title>Màn hình này gặp lỗi</Title>
          <Note>{this.state.message}</Note>
          <Note>
            Chụp màn hình này gửi cho tôi là tôi sửa được ngay. Dữ liệu của bạn
            vẫn còn nguyên trên máy.
          </Note>
          <Button
            label="Mở lại màn hình"
            onPress={() => this.setState({ message: "" })}
          />
        </View>
      );
    return this.props.children as React.ReactElement;
  }
}
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <SafeAreaView
            style={{ flex: 1, backgroundColor: "#fff1f2" }}
            edges={["top", "bottom"]}
          >
            <StatusBar style="dark" />
            <Root />
          </SafeAreaView>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
