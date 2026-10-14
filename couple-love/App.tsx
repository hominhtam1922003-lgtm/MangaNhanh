import "./global.css";
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
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
import { SupabaseClient, Session } from "@supabase/supabase-js";
import {
  Config,
  readConfig,
  makeBackend,
  explain,
} from "./src/services/backend";
import { secureStorage } from "./src/services/storage";
import { Snapshot, SyncService, emptySnapshot } from "./src/services/sync";
import { Setup, Login } from "./src/screens/Setup";
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
  roomFromState,
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
  CALL_PREBUFFER,
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
import { RTC_RETRY_SIGNAL_MS, rtcStatusText } from "./src/logic/rtcSignal.mjs";
import type { RtcState } from "./src/logic/rtcSignal.mjs";
import * as DocumentPicker from "expo-document-picker";
import { dueLoveNote, waitingNotice } from "./src/logic/autoLove.mjs";
import { loveNoteFor } from "./src/logic/lovelines.mjs";
import { wallpaperFile } from "./src/logic/localState.mjs";
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
import SettingsLocal from "./src/screens/local/SettingsLocal";
import Home from "./src/screens/Home";
import Cycle from "./src/screens/Cycle";
import Diary from "./src/screens/Diary";
import Mood from "./src/screens/Mood";
import Settings from "./src/screens/Settings";
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
const tabs = [
  { id: "home", label: "Bên nhau", icon: "♡" },
  { id: "cycle", label: "Chăm sóc", icon: "✿" },
  { id: "diary", label: "Nhật ký", icon: "▤" },
  { id: "mood", label: "Cảm xúc", icon: "☺" },
  { id: "settings", label: "Cài đặt", icon: "⚙" },
];
function CloudApp({ onSwitchMode }: { onSwitchMode: () => void }) {
  const [config, setConfig] = useState<Config | null>(null),
    [db, setDb] = useState<SupabaseClient | null>(null),
    [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true),
    [data, setData] = useState<Snapshot>(emptySnapshot),
    [error, setError] = useState(""),
    [tab, setTab] = useState("home"),
    [alertPage, setAlertPage] = useState(false),
    [lockEnabled, setLockEnabled] = useState(false),
    [locked, setLocked] = useState(true),
    [unlocking, setUnlocking] = useState(false);
  const sync = useRef<SyncService | null>(null);
  const authenticating = useRef(false);
  useEffect(() => {
    let alive = true;
    Promise.all([readConfig(), secureStorage.getItem("biometric-lock")])
      .then(([c, l]) => {
        if (alive) {
          setConfig(c);
          setLockEnabled(l === "yes");
          setLocked(l === "yes");
        }
      })
      .catch(() => setError("Không đọc được cấu hình lưu trên máy."))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!config) {
      setDb(null);
      setSession(null);
      return;
    }
    const client = makeBackend(config);
    setDb(client);
    let alive = true;
    void client.auth.getSession().then(({ data, error }) => {
      if (alive) {
        setSession(data.session);
        if (error) setError(explain(error));
      }
    });
    const { data: listener } = client.auth.onAuthStateChange((_event, s) => {
      if (alive) setSession(s);
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
      client.auth.stopAutoRefresh();
      void client.removeAllChannels();
    };
  }, [config]);
  useEffect(() => {
    setData(emptySnapshot);
    setError("");
    if (!db || !session) return;
    const service = new SyncService(
      db,
      session.user.id,
      (s) => {
        setData(s);
        setError("");
      },
      (e) => {
        setData((s) => ({ ...s, online: false }));
        setError(explain(e));
      },
    );
    sync.current = service;
    service.start();
    return () => {
      service.stop();
      sync.current = null;
    };
  }, [db, session?.user.id]);
  useEffect(() => {
    if (!db) return;
    const change = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        db.auth.startAutoRefresh();
        void sync.current?.load();
      } else {
        db.auth.stopAutoRefresh();
        if (lockEnabled && (state === "background" || !authenticating.current))
          setLocked(true);
      }
    });
    if (AppState.currentState === "active") db.auth.startAutoRefresh();
    return () => change.remove();
  }, [db, lockEnabled]);
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      setAlertPage(true);
      void sync.current?.load();
    });
    void Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r) setAlertPage(true);
    });
    return () => sub.remove();
  }, []);
  async function authenticate() {
    if (authenticating.current) return false;
    authenticating.current = true;
    setUnlocking(true);
    try {
      const r = await LocalAuthentication.authenticateAsync({
        promptMessage: "Mở Hai Trái Tim",
        cancelLabel: "Để sau",
        disableDeviceFallback: true,
        biometricsSecurityLevel: "strong",
        fallbackLabel: "",
      });
      return r.success && AppState.currentState === "active";
    } finally {
      authenticating.current = false;
      setUnlocking(false);
    }
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
  const refresh = () => void sync.current?.load();
  if (loading)
    return (
      <View className="flex-1 bg-pink-50 items-center justify-center">
        <ActivityIndicator color="#e64980" />
        <Text className="text-love mt-4">Đang mở góc yêu thương…</Text>
      </View>
    );
  if (lockEnabled && locked)
    return (
      <View className="flex-1 bg-pink-50 justify-center px-8">
        <Text className="text-7xl text-center mb-7">🔐</Text>
        <Title>Không gian riêng của bạn</Title>
        <Note>
          Xác thực Face ID hoặc vân tay để xem dữ liệu. Nếu cảm biến không hoạt
          động, hãy khôi phục sinh trắc học trong cài đặt hệ thống.
        </Note>
        <Button
          label="Mở bằng sinh trắc học"
          busy={unlocking}
          onPress={() =>
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
      </View>
    );
  if (!config) return <Setup onReady={setConfig} />;
  if (!db) return <ActivityIndicator color="#e64980" />;
  if (!session)
    return (
      <Login
        db={db}
        onReset={() =>
          void secureStorage
            .removeItem("backend-config")
            .then(() => setConfig(null))
        }
      />
    );
  const props = { db, data, uid: session.user.id, refresh };
  const unread = data.alerts.filter((a) => !a.read_at).length;
  return (
    <KeyboardAvoidingView
      className="flex-1 bg-pink-50"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View className="flex-row px-5 py-4 items-center justify-between">
        <View>
          <Text className="text-xl font-bold text-ink">
            Hai Trái Tim <Text className="text-love">♡</Text>
          </Text>
          <Text className="text-xs text-stone-500 mt-1">
            {data.online
              ? "Đã kết nối không gian của hai bạn"
              : "Đang nối lại máy chủ…"}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Lời nhắc"
          onPress={() => setAlertPage(!alertPage)}
          className="px-3 py-2 rounded-full bg-white border border-pink-100"
        >
          <Text className="text-love">
            {alertPage ? "Đóng" : "Lời nhắc"}
            {unread ? " · " + unread : ""}
          </Text>
        </Pressable>
      </View>
      {error && (
        <View className="mx-4 mb-2 p-3 rounded-xl bg-amber-50">
          <Text className="text-xs text-amber-900">{error}</Text>
          <Pressable onPress={refresh}>
            <Text className="text-sm text-love mt-1">Thử đồng bộ lại</Text>
          </Pressable>
        </View>
      )}
      <ScrollView
        key={alertPage ? "alerts" : tab}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 18, paddingBottom: 32 }}
      >
        {alertPage ? (
          <>
            <Title>Lời nhắc yêu thương</Title>
            {data.alerts.length === 0 && (
              <Card>
                <Note>
                  Chưa có lời nhắc. Các lời nhắc được lưu cả khi chưa bật thông
                  báo đẩy.
                </Note>
              </Card>
            )}
            {data.alerts.map((a) => (
              <Card key={a.id}>
                <Title small>{a.title}</Title>
                <Note>{a.body}</Note>
                <Text className="text-xs text-stone-400 mt-2">
                  {new Date(a.created_at).toLocaleString("vi-VN")}
                </Text>
                {!a.read_at && (
                  <Button
                    label="Đã đọc"
                    secondary
                    onPress={() =>
                      void db
                        .from("alerts")
                        .update({ read_at: new Date().toISOString() })
                        .eq("id", a.id)
                        .then((r) => {
                          if (r.error)
                            Alert.alert("Chưa cập nhật", explain(r.error));
                          else refresh();
                        })
                    }
                  />
                )}
              </Card>
            ))}
          </>
        ) : tab === "home" ? (
          <Home {...props} />
        ) : tab === "cycle" ? (
          <Cycle {...props} />
        ) : tab === "diary" ? (
          <Diary {...props} />
        ) : tab === "mood" ? (
          <Mood {...props} />
        ) : (
          <Settings
            {...props}
            user={session.user}
            config={config}
            locked={lockEnabled}
            onSwitchMode={onSwitchMode}
            onToggleLock={toggleLock}
          />
        )}
      </ScrollView>
      <View className="flex-row bg-white border-t border-pink-100 pt-2 pb-3">
        {tabs.map((t) => (
          <Pressable
            key={t.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.id && !alertPage }}
            accessibilityLabel={t.label}
            onPress={() => {
              setTab(t.id);
              setAlertPage(false);
            }}
            className="flex-1 items-center py-2"
          >
            <Text
              className={`text-2xl ${tab === t.id ? "text-love" : "text-stone-400"}`}
            >
              {t.icon}
            </Text>
            <Text
              className={`text-xs mt-1 ${tab === t.id ? "text-love font-bold" : "text-stone-500"}`}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </KeyboardAvoidingView>
  );
}
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
  const [rtcAudio, setRtcAudio] = useState({ inBytes: 0, outBytes: 0 });
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
  const relayRoom = state ? roomFromState(state) : null;
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
        promptMessage: "Mở Hai Trái Tim",
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
      if (fresh.length && next.settings?.readReceipts !== false)
        relayRef.current?.publish({ kind: "chatRead", ids: fresh });
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
    closeRtc();
    setRtcInfo({ state: "off", detail: "" });
    setRtcFallback(false);
    setRtcAudio({ inBytes: 0, outBytes: 0 });
    const sent = client.publish({
      kind: "call",
      event: "ring",
      callId: id,
      name: current.me.nickname,
    });
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
    setRtcAudio({ inBytes: 0, outBytes: 0 });
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
      // cộng thỉnh thoảng mất gói, gửi lại để máy kia tắt cuộc gọi chắc chắn.
      if (event.type !== "accept") {
        [250, 500].forEach((delay) =>
          setTimeout(() => relayRef.current?.publish(packet), delay),
        );
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
    if (!relayRoom || !state?.settings.relay) {
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
            const busy = callRef.current && callRef.current.phase !== "ended";
            if (busy) {
              relayRef.current?.publish({
                kind: "call",
                event: "reject",
                callId,
                name: stateRef.current?.me.nickname ?? "",
              });
              return;
            }
            closeRtc();
            setRtcInfo({ state: "off", detail: "" });
            setRtcFallback(false);
            setRtcAudio({ inBytes: 0, outBytes: 0 });
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
            const controller = rtcRef.current ?? ensureRtc(active);
            void controller?.handle(message);
            return;
          }
          if (event === "audio") {
            // Tiếng nói của người thương: lưu ra tệp rồi xếp hàng cho loa phát.
            if (active.phase !== "active") return;
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
          if (event === "accept")
            applyCall(callEvent(active, { type: "accept" }));
          else if (event === "reject")
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
  }, [relayRoom?.id, relayRoom?.key, state?.settings.relay]);
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
        if (rtcLiveRef.current) {
          // WebRTC cho biết máy kia còn sống qua chính luồng tiếng; không chờ
          // nhịp qua kênh ghép nối nữa (kênh mất gói là mình tưởng máy kia tắt).
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
    if (sentRoomRef.current !== (relayRoom?.id ?? "")) {
      sentRoomRef.current = relayRoom?.id ?? "";
      lastSentRef.current = "";
    }
    if (publishTimer.current) clearTimeout(publishTimer.current);
    publishTimer.current = setTimeout(() => publishCurrent(false), 700);
    return () => {
      if (publishTimer.current) clearTimeout(publishTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, relayRoom?.id]);
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
        onSwitchMode={onSwitchMode}
        replaceState={replaceState}
        clearAll={clearAll}
        flushMoments={flushMoments}
        flushMessages={flushMessages}
        publishCurrent={publishCurrent}
        relayRef={relayRef}
        tab={tab}
        setTab={setTab}
        wallpaperUri={hasWallpaper ? imageUri(storedWallpaper) : null}
        call={call}
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
function LockScreen({
  unlocking,
  onUnlock,
}: {
  unlocking: boolean;
  onUnlock: () => void;
}) {
  const { theme } = useTheme();
  return (
    <View className="flex-1 justify-center px-8">
      <LinearGradient colors={theme.bg} style={StyleSheet.absoluteFill} />
      <Text className="text-7xl text-center mb-7">🔐</Text>
      <Title>Không gian riêng của bạn</Title>
      <Note>Xác thực Face ID hoặc vân tay để xem dữ liệu trên máy này.</Note>
      <Button
        label="Mở bằng sinh trắc học"
        busy={unlocking}
        onPress={onUnlock}
      />
    </View>
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
  notifyState: "unknown" | "granted" | "denied";
  onEnableNotifications: () => void;
  call: CallInfo | null;
  callTick: number;
  callQueueRef: React.MutableRefObject<AudioFrame[]>;
  callPlayingRef: React.MutableRefObject<boolean>;
  /** Trạng thái đường tiếng trực tiếp (WebRTC) của cuộc gọi đang mở. */
  rtcInfo: { state: string; detail: string };
  rtcLive: boolean;
  /** Số byte tiếng thật đang vào/ra của WebRTC. */
  rtcAudio: { inBytes: number; outBytes: number };
  /** Người dùng bấm "nghe không được" → chuyển về đường tiếng qua kênh ghép nối. */
  onUseLegacyAudio: () => void;
  onPickRingtone: () => void;
  onResetRingtone: () => void;
  onStartCall: () => void;
  onSendPhoto: (uri: string, caption: string) => void;
  onSendLocation: () => void;
  callAction: (event: { type: string; on?: boolean; min?: boolean }) => void;
  callRef: React.MutableRefObject<CallInfo | null>;
}) {
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
          <View>
            <Text className="text-xl font-bold" style={{ color: theme.ink }}>
              Hai Trái Tim <Text style={{ color: theme.deep[0] }}>♡</Text>
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
              <Text className="text-xs" style={{ color: theme.sub }}>
                {relayStatus.state === "online"
                  ? `Đã kết nối · ${relayStatus.partnerName ?? "người thương"} đang trực tuyến`
                  : relayStatus.state === "alone"
                    ? `Đã vào phòng qua ${relayStatus.readyCount ?? 0} trạm · chờ người thương`
                    : relayStatus.state === "connecting"
                      ? "Đang kết nối tức thời…"
                      : "Chạy trên máy · không cần máy chủ"}
              </Text>
            </View>
          </View>
          {tab === "pair" && (
            <Pressable
              accessibilityLabel="Về trang trước"
              onPress={() => setTab("home")}
              className="px-3 py-2 mr-2 rounded-full bg-white border border-pink-100"
            >
              <Text className="text-love">‹ Về</Text>
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
              onSendLocation={onSendLocation}
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
              <PairLocal
                {...props}
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
            ) : tab === "cycle" ? (
              <CycleLocal {...props} />
            ) : tab === "diary" ? (
              <DiaryLocal {...props} />
            ) : (
              <SettingsLocal
                {...props}
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
function ModeChooser({
  onPick,
}: {
  onPick: (mode: "local" | "cloud") => void;
}) {
  return (
    <ScrollView
      className="flex-1 bg-pink-50"
      contentContainerStyle={{ padding: 24, paddingTop: 60 }}
    >
      <Text className="text-5xl mb-6">💕</Text>
      <Title>Hai Trái Tim</Title>
      <Note>
        Một góc riêng để hai bạn giữ những ngày yêu thương. Chọn cách chạy phù
        hợp — có thể đổi lại trong Cài đặt.
      </Note>
      <View className="h-6" />
      <Card>
        <Title small>Trên máy này · không cần máy chủ</Title>
        <Note>
          Đếm ngày yêu, trái tim 3D, chu kỳ, nhật ký, cảm xúc và lời nhắc đều
          chạy trên máy. Hai bạn nối nhau bằng mã QR hoặc tệp dữ liệu. Không cần
          tài khoản, không cần Internet, nhưng không có cập nhật tức thời giữa
          hai máy và không nhắc hộ được người thương.
        </Note>
        <Button label="Dùng trên máy này" onPress={() => onPick("local")} />
      </Card>
      <Card>
        <Title small>Đồng bộ hai máy · cần dự án Supabase</Title>
        <Note>
          Dữ liệu cập nhật tức thời giữa Android và iPhone và có thể nhắc hộ
          người thương, nhưng bạn phải tự tạo một dự án Supabase miễn phí rồi
          nhập URL và khóa công khai.
        </Note>
        <Button
          label="Dùng chế độ đồng bộ"
          secondary
          onPress={() => onPick("cloud")}
        />
      </Card>
      <Note>
        Tôi không thể tạo tài khoản hay máy chủ thay bạn vì việc đó cần email
        của bạn. Chế độ trên máy là cách chạy đầy đủ mà không cần đăng ký gì.
      </Note>
    </ScrollView>
  );
}
function Root() {
  const [mode, setMode] = useState<"loading" | "choose" | "local" | "cloud">(
    "loading",
  );
  useEffect(() => {
    let alive = true;
    void (async () => {
      const stored = await AsyncStorage.getItem("love-mode");
      const config = stored === "local" ? null : await readConfig();
      if (!alive) return;
      if (stored === "local") setMode("local");
      else setMode(config ? "cloud" : "choose");
    })();
    return () => {
      alive = false;
    };
  }, []);
  function pick(value: "local" | "cloud") {
    void AsyncStorage.setItem("love-mode", value);
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
  );
}
