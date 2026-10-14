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
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as LocalAuthentication from "expo-local-authentication";
import * as Notifications from "expo-notifications";
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
  dueAlertActions,
  rescheduleReminders,
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
import HomeLocal from "./src/screens/local/HomeLocal";
import CycleLocal from "./src/screens/local/CycleLocal";
import DiaryLocal from "./src/screens/local/DiaryLocal";
import MoodLocal from "./src/screens/local/MoodLocal";
import PairLocal from "./src/screens/local/PairLocal";
import SettingsLocal from "./src/screens/local/SettingsLocal";
import Home from "./src/screens/Home";
import Cycle from "./src/screens/Cycle";
import Diary from "./src/screens/Diary";
import Mood from "./src/screens/Mood";
import Settings from "./src/screens/Settings";
import { LinearGradient } from "expo-linear-gradient";
import { Button, Card, Note, Title, confirm } from "./src/components/UI";
const localTabs = [
  { id: "home", label: "Yêu nhau", icon: "♡" },
  { id: "cycle", label: "Chăm sóc", icon: "✿" },
  { id: "diary", label: "Nhật ký", icon: "▤" },
  { id: "mood", label: "Cảm xúc", icon: "☺" },
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
  const [lastError, setLastError] = useState("");
  const [selfTest, setSelfTest] = useState<
    { name: string; ok: boolean; detail: string }[]
  >([]);
  const readyRef = useRef(false);
  const authenticating = useRef(false);
  const stateRef = useRef<State | null>(null);
  const relayRef = useRef<RelayClient | null>(null);
  const publishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      void rescheduleReminders(next).catch(() => {});
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
  function update(action: Record<string, unknown>) {
    const current = stateRef.current;
    if (!current) return;
    const next = reduce(current, action) as State;
    stateRef.current = next;
    setState(next);
    void persistState(next)
      .then((warning) => {
        if (warning) setError(warning);
      })
      .catch(() => setError("Chưa ghi được dữ liệu vào bộ nhớ máy."));
    if (
      [
        "cycle.save",
        "cycle.clear",
        "settings.set",
        "anniversary.set",
        "partner.merge",
      ].includes(String(action.type))
    ) {
      void rescheduleReminders(next).catch(() => {});
    }
  }
  function replaceState(next: State) {
    stateRef.current = next;
    setState(next);
    void persistState(next).catch(() =>
      setError("Chưa ghi được dữ liệu vào bộ nhớ máy."),
    );
    void rescheduleReminders(next).catch(() => {});
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
    const payload = relayPayloadFor(current, deviceIdRef.current);
    const key = payloadKey(payload);
    if (!force && key === lastSentRef.current) return;
    if (client.publishState(payload, current.me.nickname))
      lastSentRef.current = key;
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
          update({ type: "partner.merge", state: payload });
          setError("");
        } catch (mergeError) {
          setError(
            mergeError instanceof Error
              ? mergeError.message
              : "Không gộp được dữ liệu nhận qua kết nối.",
          );
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
    );
  }
  if (lockEnabled && locked) {
    return (
      <View className="flex-1 bg-pink-50 justify-center px-8">
        <Text className="text-7xl text-center mb-7">🔐</Text>
        <Title>Không gian riêng của bạn</Title>
        <Note>Xác thực Face ID hoặc vân tay để xem dữ liệu trên máy này.</Note>
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
  }
  const unread = state.alerts.filter((alert) => !alert.readAt).length;
  const props = { state, update };
  return (
    <LinearGradient
      colors={["#fff5f8", "#ffe8f0", "#fff5f8"]}
      className="flex-1"
    >
      <KeyboardAvoidingView
        className="flex-1 bg-pink-50"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-row px-5 py-4 items-center justify-between">
          <View>
            <Text className="text-xl font-bold text-ink">
              Hai Trái Tim <Text className="text-love">♡</Text>
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
              <Text className="text-xs text-stone-500">
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
            className="px-3 py-2 rounded-full bg-white border border-pink-100"
          >
            <Text className="text-love">
              {alertPage ? "Đóng" : "Lời nhắc"}
              {unread ? " · " + unread : ""}
            </Text>
          </Pressable>
        </View>
        {error !== "" && (
          <View className="mx-4 mb-2 p-3 rounded-xl bg-amber-50">
            <Text className="text-xs text-amber-900">{error}</Text>
            <Pressable onPress={() => setError("")}>
              <Text className="text-sm text-love mt-1">Đã hiểu</Text>
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
            <HomeLocal {...props} openPair={() => setTab("pair")} />
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
          ) : tab === "mood" ? (
            <MoodLocal {...props} />
          ) : (
            <SettingsLocal
              {...props}
              replaceState={replaceState}
              clearAll={clearAll}
              locked={lockEnabled}
              onToggleLock={toggleLock}
              onSwitchMode={onSwitchMode}
              onOpenPair={() => setTab("pair")}
              lastError={lastError}
              onClearError={() => {
                setLastError("");
                void clearCrash();
              }}
            />
          )}
        </ScrollView>
        <View className="flex-row bg-white border-t border-pink-100 pt-2 pb-3">
          {localTabs.map((item) => (
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
                className={`text-2xl ${tab === item.id ? "text-love" : "text-stone-400"}`}
              >
                {item.icon}
              </Text>
              <Text
                className={`text-xs mt-1 ${tab === item.id ? "text-love font-bold" : "text-stone-500"}`}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
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
