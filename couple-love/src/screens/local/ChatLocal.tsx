import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
} from "expo-audio";
import {
  Button,
  Card,
  Chip,
  LocalAvatar,
  Note,
  confirm,
} from "../../components/UI";
import { useTheme } from "../../theme/ThemeContext";
import { imageUri, saveImage } from "../../services/localdb";
import { requestNotifications } from "../../services/localnotify";
import type { State } from "../../services/localdb";
/** Lời nhắn nhanh: bấm một cái là máy người thương nổi thông báo như tin nhắn. */
const NUDGES = [
  {
    emoji: "💌",
    label: "Nhớ người thương",
    text: "Nhớ người thương nhiều lắm 💌",
  },
  { emoji: "🥰", label: "Thương lắm", text: "Thương người thương lắm 🥰" },
  { emoji: "🌙", label: "Ngủ ngon nhé", text: "Ngủ ngon nhé, mơ đẹp 🌙" },
  { emoji: "🍚", label: "Ăn cơm chưa", text: "Ăn cơm chưa đó? 🍚" },
  {
    emoji: "☎️",
    label: "Gọi cho mình nhé",
    text: "Rảnh thì gọi cho mình nhé ☎️",
  },
  { emoji: "💪", label: "Cố lên nhé", text: "Cố lên nhé, mình luôn ở đây 💪" },
];
/** Bộ emoji: bấm là chèn vào ô viết, giống bàn phím cảm xúc của Messenger. */
const EMOJIS = [
  "🥰",
  "😍",
  "😘",
  "🤗",
  "😊",
  "😁",
  "😅",
  "🥲",
  "😴",
  "😜",
  "😇",
  "🤭",
  "😢",
  "😡",
  "🤔",
  "🤩",
  "💗",
  "💖",
  "💘",
  "💌",
  "❤️",
  "💔",
  "🌹",
  "🌸",
  "🏵️",
  "✨",
  "⭐",
  "🌙",
  "🌈",
  "🔥",
  "🎉",
  "🎁",
  "🐻",
  "🐰",
  "🐱",
  "🐶",
  "🦊",
  "🐼",
  "🐨",
  "🐧",
  "🍓",
  "🧋",
  "🍰",
  "🍜",
  "🍕",
  "🎶",
  "🎂",
  "🫶",
];
/** Sticker: gửi nguyên một hình lớn như Messenger, không nằm trong bong bóng. */
const STICKER_PACKS: { name: string; items: string[] }[] = [
  {
    name: "Cặp đôi",
    items: [
      "💑",
      "👩‍❤️‍👨",
      "💏",
      "👰",
      "🤵",
      "💐",
      "💍",
      "🏩",
      "😘",
      "🥰",
      "🫂",
      "💞",
    ],
  },
  {
    name: "Thú cưng",
    items: [
      "🐻",
      "🐼",
      "🐨",
      "🐰",
      "🐱",
      "🐶",
      "🦊",
      "🐯",
      "🦁",
      "🐸",
      "🐵",
      "🐧",
    ],
  },
  {
    name: "Nhớ nhung",
    items: [
      "💌",
      "🌙",
      "⭐",
      "💤",
      "🛌",
      "☕",
      "🍚",
      "🌧️",
      "☂️",
      "📞",
      "🎈",
      "🕯️",
    ],
  },
  {
    name: "Vui vẻ",
    items: [
      "🎉",
      "🎊",
      "🎁",
      "🎂",
      "🍰",
      "🧋",
      "🍓",
      "🎶",
      "🥳",
      "😹",
      "🤗",
      "🫶",
    ],
  },
];
const MAX_VOICE_MS = 25000;
const clockOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
const dayOf = (iso: string) => new Date(iso).toLocaleDateString("vi-VN");
const secondsOf = (ms: number) => `${Math.max(1, Math.round(ms / 1000))}″`;
/** Bản app của máy kia có hiểu tin nhắn không (từ 1.8.0 trở lên). */
function versionOk(version?: string) {
  if (!version) return false;
  const match = /^(\d+)\.(\d+)/.exec(version.trim());
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major > 1 || (major === 1 && minor >= 8);
}
/** Bong bóng ở đúng giữa khung nhìn mỗi khi hiện (thay cho Modal). */
function PhotoViewer({ uri, onClose }: { uri: string; onClose: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Đóng ảnh"
      onPress={onClose}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: "#000000dd",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Image
        source={{ uri }}
        style={{ width: 300, height: 380, borderRadius: 20 }}
        resizeMode="contain"
      />
      <Text className="text-white mt-3">Chạm để đóng</Text>
    </Pressable>
  );
}
/** Một tin thoại: có nút nghe, hiện độ dài, thanh chạy theo chủ đề. */
function VoiceBubble({
  uri,
  mine,
  durationMs,
}: {
  uri: string | null;
  mine: boolean;
  durationMs: number;
}) {
  const { theme } = useTheme();
  const player = useAudioPlayer(uri ? { uri } : undefined);
  const status = useAudioPlayerStatus(player);
  const [error, setError] = useState("");
  const ratio =
    status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;
  const tone = mine ? theme.onDeep : theme.ink;
  const track = mine ? theme.deep[0] : theme.border;
  const fill = mine ? theme.onDeep : theme.deep[1];
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          mine ? "Nghe lại tin thoại của bạn" : "Nghe tin thoại"
        }
        onPress={() => {
          try {
            if (status.playing) player.pause();
            else {
              void player.seekTo(0);
              player.play();
            }
          } catch {
            setError("Máy này chưa nghe được tin thoại này.");
          }
        }}
        className="flex-row items-center"
      >
        <Text className="text-xl mr-2" style={{ color: tone }}>
          {!uri ? "⏳" : status.playing ? "⏸" : "▶"}
        </Text>
        <View
          style={{
            height: 6,
            width: 110,
            borderRadius: 3,
            backgroundColor: track,
            overflow: "hidden",
          }}
        >
          <View
            style={{ height: 6, width: 110 * ratio, backgroundColor: fill }}
          />
        </View>
        <Text className="ml-2 text-xs" style={{ color: tone }}>
          {secondsOf(status.duration > 0 ? status.duration * 1000 : durationMs)}
        </Text>
      </Pressable>
      {!uri ? (
        <Text className="text-xs mt-1" style={{ color: tone }}>
          Tin thoại đang trên đường sang máy bạn…
        </Text>
      ) : null}
      {error ? (
        <Text className="text-xs mt-1" style={{ color: tone }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
/**
 * Một dòng tin nhắn. Tách riêng và nhớ sẵn (React.memo) để khi bạn đang gõ chữ
 * trong ô nhắn, cả bảng tin không phải vẽ lại từng dòng — app mượt hơn hẳn.
 */
const MessageRow = React.memo(function MessageRow({
  message,
  previousAt,
  theme,
  mine,
  partnerName,
  readReceipts,
  onOpenPhoto,
  onDelete,
}: {
  message: State["messages"][number];
  previousAt: string | null;
  theme: ReturnType<typeof useTheme>["theme"];
  mine: boolean;
  partnerName: string;
  readReceipts: boolean;
  onOpenPhoto: (photo: string | null | undefined) => void;
  onDelete: (id: string) => void;
}) {
  const showDay = !previousAt || dayOf(previousAt) !== dayOf(message.createdAt);
  const status = mine
    ? !message.sentAt
      ? "đang chờ gửi"
      : readReceipts && message.readAt
        ? "đã xem"
        : message.deliveredAt
          ? "đã tới máy kia"
          : "đã gửi"
    : readReceipts
      ? message.readAt
        ? "đã xem"
        : "mới nhận"
      : "";
  const timeLabel = `${clockOf(message.createdAt)}${status ? ` · ${status}` : ""}`;
  const mineGradient = (
    <LinearGradient
      colors={theme.deep}
      style={{
        borderRadius: 20,
        borderBottomRightRadius: 6,
        paddingHorizontal: 14,
        paddingVertical: 10,
      }}
    >
      <Text style={{ color: theme.onDeep }}>{message.body}</Text>
    </LinearGradient>
  );
  const theirBubble = (
    <View
      style={{
        backgroundColor: theme.soft,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 20,
        borderBottomLeftRadius: 6,
        paddingHorizontal: 14,
        paddingVertical: 10,
      }}
    >
      <Text style={{ color: theme.ink }}>{message.body}</Text>
    </View>
  );
  // Nhật ký cuộc gọi: một dòng giữa khung, không phải bong bóng tin nhắn.
  if (message.kind === "call")
    return (
      <View>
        {showDay ? (
          <Text
            className="text-xs text-center my-2"
            style={{ color: theme.sub }}
          >
            {dayOf(message.createdAt)}
          </Text>
        ) : null}
        <View className="items-center mb-2">
          <View
            style={{
              backgroundColor: theme.glass,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 16,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Text className="text-xs" style={{ color: theme.ink }}>
              📞 {message.body} · {clockOf(message.createdAt)}
            </Text>
          </View>
        </View>
      </View>
    );
  return (
    <View>
      {showDay ? (
        <Text className="text-xs text-center my-2" style={{ color: theme.sub }}>
          {dayOf(message.createdAt)}
        </Text>
      ) : null}
      <View
        className={`mb-2 ${mine ? "items-end" : "items-start"}`}
        style={{ maxWidth: "92%" }}
      >
        {message.kind === "sticker" ? (
          // Sticker: hình lớn, không bọc trong bong bóng.
          <Text style={{ fontSize: 68, lineHeight: 78 }}>{message.body}</Text>
        ) : message.kind === "photo" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mở ảnh"
            onPress={() => onOpenPhoto(message.photo)}
          >
            <LinearGradient
              colors={mine ? theme.deep : [theme.soft, theme.soft]}
              style={{ borderRadius: 20, padding: 3 }}
            >
              {message.photo ? (
                <Image
                  source={{ uri: imageUri(message.photo) ?? "" }}
                  style={{
                    width: 196,
                    height: 196,
                    borderRadius: 17,
                  }}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={{
                    width: 196,
                    height: 196,
                    borderRadius: 17,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text className="text-3xl">🖼</Text>
                  <Text className="text-xs mt-2" style={{ color: theme.ink }}>
                    Đang tải ảnh…
                  </Text>
                </View>
              )}
            </LinearGradient>
            {message.body ? (
              <Text className="text-sm mt-1" style={{ color: theme.ink }}>
                {message.body}
              </Text>
            ) : null}
          </Pressable>
        ) : message.kind === "location" ? (
          <View
            style={{
              backgroundColor: theme.soft,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 20,
              padding: 12,
              width: 232,
            }}
          >
            <Text className="text-2xl">📍</Text>
            <Text className="font-semibold mt-1" style={{ color: theme.ink }}>
              {mine
                ? "Bạn đang ở đây"
                : `${partnerName || "Người thương"} đang ở đây`}
            </Text>
            <Text className="text-xs mt-1" style={{ color: theme.sub }}>
              {message.lat?.toFixed(5)}, {message.lng?.toFixed(5)}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mở bản đồ"
              onPress={() =>
                void Linking.openURL(
                  `https://www.google.com/maps/search/?api=1&query=${message.lat},${message.lng}`,
                ).catch(() =>
                  Alert.alert(
                    "Chưa mở được bản đồ",
                    "Máy này chưa có ứng dụng bản đồ.",
                  ),
                )
              }
              style={{
                marginTop: 8,
                backgroundColor: theme.deep[1],
                borderRadius: 14,
                paddingVertical: 7,
                alignItems: "center",
              }}
            >
              <Text className="font-bold" style={{ color: theme.onDeep }}>
                Mở bản đồ
              </Text>
            </Pressable>
          </View>
        ) : message.kind === "voice" ? (
          mine ? (
            <LinearGradient
              colors={theme.deep}
              style={{
                borderRadius: 20,
                borderBottomRightRadius: 6,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
            >
              <VoiceBubble
                uri={message.audio ? imageUri(message.audio) : null}
                mine
                durationMs={message.durationMs}
              />
            </LinearGradient>
          ) : (
            <View
              style={{
                backgroundColor: theme.soft,
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: 20,
                borderBottomLeftRadius: 6,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
            >
              <VoiceBubble
                uri={message.audio ? imageUri(message.audio) : null}
                mine={false}
                durationMs={message.durationMs}
              />
            </View>
          )
        ) : mine ? (
          mineGradient
        ) : (
          theirBubble
        )}
        <View className="flex-row items-center mt-1">
          <Text className="text-xs" style={{ color: theme.sub }}>
            {timeLabel}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Xóa tin nhắn này"
            onPress={() => onDelete(message.id)}
          >
            <Text className="text-xs ml-2" style={{ color: theme.sub }}>
              xóa
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

export default function ChatLocal({
  state,
  update,
  relayStatus,
  onSendMessage,
  onStartCall,
  onSendPhoto,
  onSendLocation,
}: {
  state: State;
  update: (action: Record<string, unknown>) => void;
  relayStatus: {
    state: string;
    partnerOnline: boolean;
    partnerName?: string | null;
  };
  onSendMessage?: () => void;
  onStartCall?: () => void;
  /** App tự nén, lưu và gửi ảnh; màn hình chỉ chọn ảnh. */
  onSendPhoto?: (uri: string, caption: string) => void;
  onSendLocation?: () => void;
}) {
  const { theme } = useTheme();
  const [text, setText] = useState("");
  const [pad, setPad] = useState<"none" | "emoji" | "sticker" | "nudge">(
    "none",
  );
  const [pack, setPack] = useState(0);
  const [recording, setRecording] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [viewing, setViewing] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<State["messages"][number]> | null>(null);
  const followRef = useRef(true);
  const busyRef = useRef(0);
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const messages = state.messages ?? [];
  // Danh sách hiển thị theo thứ tự cũ → mới; tin mới nhất nằm dưới cùng.
  const ordered = useMemo(() => [...messages].reverse(), [messages]);
  const readReceipts = state.settings?.readReceipts !== false;
  const unread = useMemo(
    () => messages.filter((m) => m.authorId === "partner" && !m.readAt).length,
    [messages],
  );
  useEffect(() => {
    // Mở màn hình Tin nhắn là coi như đã đọc tin của người thương.
    if (unread) setTimeout(() => update({ type: "message.read" }), 600);
  }, [unread, update]);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setElapsed(Date.now() - startedAt), 200);
    return () => clearInterval(timer);
  }, [recording, startedAt]);
  function scrollToNewest() {
    followRef.current = true;
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 140);
  }
  function send(kind: string, body: string) {
    const value = body.trim();
    if (!value) return;
    // Chặn bấm hai lần liên tiếp gửi đúng một câu (trước đây bị lặp nhiều tin).
    const now = Date.now();
    if (now - busyRef.current < 900) return;
    busyRef.current = now;
    try {
      update({ type: "message.add", kind, body: value });
      setText("");
      setPad("none");
      onSendMessage?.();
      scrollToNewest();
    } catch (error) {
      Alert.alert(
        "Chưa gửi được",
        error instanceof Error ? error.message : "Tin nhắn không hợp lệ.",
      );
    }
  }
  async function pickPhoto(camera: boolean) {
    try {
      setSending(true);
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            "Cần quyền máy ảnh",
            "Hãy cho phép dùng máy ảnh để chụp rồi gửi cho người thương.",
          );
          return;
        }
      }
      const picked = camera
        ? await ImagePicker.launchCameraAsync({ quality: 0.75 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.75,
            allowsMultipleSelection: false,
          });
      if (picked.canceled || !picked.assets?.length) return;
      const context = ImageManipulator.manipulate(picked.assets[0].uri);
      context.resize({ width: 720 });
      const rendered = await context.renderAsync();
      const processed = await rendered.saveAsync({
        compress: 0.55,
        format: SaveFormat.JPEG,
      });
      onSendPhoto?.(processed.uri, text.trim());
      setText("");
      setPad("none");
      scrollToNewest();
    } catch (error) {
      Alert.alert(
        "Chưa gửi được ảnh",
        error instanceof Error ? error.message : "Ảnh bị lỗi.",
      );
    } finally {
      setSending(false);
    }
  }
  async function startRecording() {
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Cần quyền ghi âm",
          "Hãy cho phép dùng micro để gửi tin thoại cho người thương, hoặc dùng tin nhắn chữ.",
        );
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setStartedAt(Date.now());
      setElapsed(0);
      setRecording(true);
    } catch (error) {
      Alert.alert(
        "Chưa ghi âm được",
        error instanceof Error ? error.message : "Máy này không ghi âm được.",
      );
    }
  }
  async function stopRecording(sendIt: boolean) {
    const beganAt = startedAt;
    setRecording(false);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
      if (!sendIt || !uri) return;
      const durationMs = Math.min(
        MAX_VOICE_MS,
        Date.now() - beganAt || elapsed,
      );
      const id =
        "v" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      const file = saveImage(uri, `voice-${id}.m4a`);
      update({
        type: "message.add",
        id,
        kind: "voice",
        body: "",
        audio: file,
        durationMs,
      });
      onSendMessage?.();
      scrollToNewest();
    } catch (error) {
      Alert.alert(
        "Chưa gửi được tin thoại",
        error instanceof Error ? error.message : "Ghi âm bị lỗi.",
      );
    }
  }
  // Giữ hàm cập nhật trong ref để các dòng tin nhắn không phải vẽ lại khi App
  // vẽ lại (mỗi giây một lần khi đang gọi) — bảng tin chỉ vẽ khi tin đổi.
  const updateRef = useRef(update);
  updateRef.current = update;
  const onDelete = useCallback((id: string) => {
    void (async () => {
      if (
        !(await confirm(
          "Xóa tin nhắn?",
          "Tin này biến mất khỏi máy bạn. Máy người thương vẫn giữ bản của họ.",
        ))
      )
        return;
      updateRef.current({ type: "message.remove", id });
    })();
  }, []);
  const onOpenPhoto = useCallback((photo: string | null | undefined) => {
    if (photo) setViewing(imageUri(photo) ?? "");
    else
      Alert.alert(
        "Ảnh đang tới",
        "Ảnh đang trên đường sang máy bạn, chờ một chút nhé.",
      );
  }, []);
  const renderItem = useCallback(
    ({ item, index }: { item: State["messages"][number]; index: number }) => (
      <MessageRow
        message={item}
        previousAt={ordered[index - 1]?.createdAt ?? null}
        theme={theme}
        mine={item.authorId === "me"}
        partnerName={state.partner?.nickname || relayStatus.partnerName || ""}
        readReceipts={readReceipts}
        onOpenPhoto={onOpenPhoto}
        onDelete={onDelete}
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      ordered,
      theme,
      readReceipts,
      state.partner?.nickname,
      relayStatus.partnerName,
    ],
  );
  const partnerName = state.partner?.nickname || relayStatus.partnerName;
  const statusText = relayStatus.partnerOnline
    ? `${partnerName || "Người thương"} đang trực tuyến`
    : state.partner
      ? "Đã ghép nối — tin sẽ gửi khi người thương mở app"
      : "Chưa ghép nối (mở mục Ghép nối để nối hai máy)";
  const oldPartner =
    Boolean(state.partner) && !versionOk(state.partner?.appVersion);
  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* Thẻ người thương: tên, trạng thái, gọi và nhắn nhanh */}
      <View
        className="flex-row items-center mb-2"
        style={{
          backgroundColor: theme.glass,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: theme.border,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      >
        <LocalAvatar
          name={partnerName || "Người thương"}
          image={state.partner?.avatar ?? null}
          size={44}
        />
        <View className="ml-3 flex-1">
          <Text className="font-bold" style={{ color: theme.ink }}>
            {partnerName || "Người thương"}
          </Text>
          <Text className="text-xs" style={{ color: theme.sub }}>
            {statusText}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Gọi cho người thương"
          onPress={() => onStartCall?.()}
          style={{
            backgroundColor: theme.deep[1],
            borderRadius: 18,
            paddingHorizontal: 12,
            paddingVertical: 8,
            marginRight: 8,
          }}
        >
          <Text className="font-bold" style={{ color: theme.onDeep }}>
            📞 Gọi
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mở lời nhắn nhanh"
          onPress={() => setPad(pad === "nudge" ? "none" : "nudge")}
          style={{
            backgroundColor: pad === "nudge" ? theme.deep[1] : theme.soft,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 18,
            paddingHorizontal: 10,
            paddingVertical: 8,
          }}
        >
          <Text style={{ color: pad === "nudge" ? theme.onDeep : theme.text }}>
            💌
          </Text>
        </Pressable>
      </View>
      {pad === "nudge" ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-2"
        >
          {NUDGES.map((nudge) => (
            <Pressable
              key={nudge.label}
              accessibilityRole="button"
              accessibilityLabel={nudge.label}
              onPress={() => send("nudge", `${nudge.emoji} ${nudge.text}`)}
              className="mr-2"
            >
              <View
                className="rounded-2xl px-3 py-2 items-center"
                style={{
                  backgroundColor: theme.soft,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <Text className="text-xl">{nudge.emoji}</Text>
                <Text className="text-xs mt-1" style={{ color: theme.text }}>
                  {nudge.label}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {oldPartner ? (
        <View
          className="mb-2 p-3"
          style={{
            backgroundColor: theme.soft,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <Text className="text-xs" style={{ color: theme.ink }}>
            Máy người thương đang dùng bản cũ
            {state.partner?.appVersion
              ? ` (${state.partner.appVersion})`
              : " (chưa rõ bản)"}{" "}
            nên chưa hiểu tin nhắn. Hãy cài bản mới nhất trên cả hai máy rồi
            ghép nối lại — sau đó tin nhắn, tin thoại và nhật ký mới hiện đủ hai
            bên.
          </Text>
        </View>
      ) : null}
      {/* Bảng tin cố định: tin mới ở dưới, kéo lên xem lại như Messenger/Zalo */}
      <View className="flex-1" style={{ minHeight: 180 }}>
        <FlatList
          ref={listRef}
          data={ordered}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingVertical: 6 }}
          // Tối ưu cho máy yếu: chỉ vẽ những dòng đang nhìn thấy.
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={40}
          windowSize={9}
          removeClippedSubviews={Platform.OS === "android"}
          // Ở cuối danh sách thì tự bám theo tin mới; kéo lên xem lại thì đứng yên.
          onScroll={(event) => {
            const { contentOffset, contentSize, layoutMeasurement } =
              event.nativeEvent;
            const fromBottom =
              contentSize.height - (contentOffset.y + layoutMeasurement.height);
            followRef.current = fromBottom < 60;
          }}
          scrollEventThrottle={16}
          onContentSizeChange={() => {
            if (followRef.current)
              listRef.current?.scrollToEnd({ animated: false });
          }}
          ListEmptyComponent={
            <Card>
              <Note>
                Chưa có tin nào. Bấm 💌 nhắn nhanh, 😊 sticker, 📷 chụp ảnh hoặc
                📍 gửi vị trí — máy người thương sẽ nổi thông báo như tin nhắn
                Messenger.
              </Note>
            </Card>
          }
          renderItem={renderItem}
        />
        {messages.length > 3 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Xuống tin mới nhất"
            onPress={scrollToNewest}
            style={{
              position: "absolute",
              right: 6,
              bottom: 6,
              backgroundColor: theme.glass,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 18,
              paddingHorizontal: 10,
              paddingVertical: 6,
            }}
          >
            <Text style={{ color: theme.text }}>↓ mới nhất</Text>
          </Pressable>
        ) : null}
      </View>
      {/* Ô viết: gọn 4 dòng, không kéo dài vô tận */}
      <View
        style={{
          backgroundColor: theme.glass,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 22,
          paddingHorizontal: 10,
          paddingVertical: 8,
          marginTop: 10,
          marginBottom: 10,
        }}
      >
        {pad === "emoji" ? (
          <View className="flex-row flex-wrap mb-2">
            {EMOJIS.map((emoji) => (
              <Pressable
                key={emoji}
                accessibilityRole="button"
                accessibilityLabel={`Chèn ${emoji}`}
                onPress={() => setText((current) => `${current}${emoji}`)}
                className="p-1"
              >
                <Text className="text-2xl">{emoji}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {pad === "sticker" ? (
          <View className="mb-2">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-1"
            >
              {STICKER_PACKS.map((item, index) => (
                <Pressable
                  key={item.name}
                  accessibilityRole="button"
                  accessibilityLabel={`Bộ sticker ${item.name}`}
                  onPress={() => setPack(index)}
                  className="mr-2 px-3 py-1 rounded-full"
                  style={{
                    backgroundColor:
                      index === pack ? theme.deep[1] : theme.soft,
                    borderWidth: 1,
                    borderColor: theme.border,
                  }}
                >
                  <Text
                    className="text-xs"
                    style={{
                      color: index === pack ? theme.onDeep : theme.text,
                    }}
                  >
                    {item.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <ScrollView style={{ maxHeight: 150 }}>
              <View className="flex-row flex-wrap">
                {STICKER_PACKS[pack].items.map((sticker) => (
                  <Pressable
                    key={sticker}
                    accessibilityRole="button"
                    accessibilityLabel={`Gửi sticker ${sticker}`}
                    onPress={() => send("sticker", sticker)}
                    className="p-2"
                  >
                    <Text style={{ fontSize: 38 }}>{sticker}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}
        {recording ? (
          <View className="flex-row items-center">
            <Text className="text-lg mr-2" style={{ color: theme.text }}>
              ● {secondsOf(elapsed)}
            </Text>
            <Text className="text-xs flex-1" style={{ color: theme.sub }}>
              Đang ghi âm… tối đa {secondsOf(MAX_VOICE_MS)}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hủy ghi âm"
              onPress={() => void stopRecording(false)}
              className="mr-2"
            >
              <Text style={{ color: theme.sub }}>Hủy</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Gửi tin thoại"
              onPress={() => void stopRecording(true)}
            >
              <Text className="font-bold" style={{ color: theme.text }}>
                Gửi ▶
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View className="flex-row items-end">
              <TextInput
                value={text}
                onChangeText={setText}
                multiline
                placeholder="Nhắn cho người thương…"
                placeholderTextColor={theme.sub}
                accessibilityLabel="Ô viết tin nhắn"
                style={{
                  flex: 1,
                  color: theme.ink,
                  backgroundColor: theme.surface,
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: 18,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  maxHeight: 96,
                }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Gửi tin nhắn"
                onPress={() => send("text", text)}
                className="ml-2"
              >
                <LinearGradient
                  colors={theme.deep}
                  style={{
                    borderRadius: 18,
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                  }}
                >
                  <Text className="font-bold" style={{ color: theme.onDeep }}>
                    Gửi
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
            <View className="flex-row items-center mt-2">
              {(
                [
                  ["😊", "emoji", "Bảng cảm xúc"],
                  ["🧸", "sticker", "Sticker"],
                  ["📷", "camera", "Chụp ảnh gửi ngay"],
                  ["🖼", "photo", "Chọn ảnh trong máy"],
                  ["📍", "location", "Gửi vị trí"],
                  ["🎙", "voice", "Ghi tin thoại"],
                ] as const
              ).map(([emoji, action, label]) => (
                <Pressable
                  key={action}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  onPress={() => {
                    if (action === "emoji" || action === "sticker")
                      setPad(pad === action ? "none" : action);
                    else if (action === "camera") void pickPhoto(true);
                    else if (action === "photo") void pickPhoto(false);
                    else if (action === "location") onSendLocation?.();
                    else void startRecording();
                  }}
                  className="mr-3 py-1"
                >
                  <Text
                    className="text-2xl"
                    style={{
                      opacity:
                        sending || (action === "voice" && recording)
                          ? 0.4
                          : pad === action
                            ? 1
                            : 0.75,
                    }}
                  >
                    {emoji}
                  </Text>
                </Pressable>
              ))}
              <Text
                className="text-xs flex-1 text-right"
                style={{ color: theme.sub }}
              >
                {text.length > 0 ? `${text.length}/600` : ""}
              </Text>
            </View>
          </>
        )}
        {unread ? (
          <Text className="text-xs mt-1" style={{ color: theme.sub }}>
            {unread} tin mới từ người thương
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Bật thông báo"
        onPress={() =>
          void requestNotifications().then((granted) =>
            Alert.alert(
              granted ? "Đã bật thông báo" : "Chưa bật được thông báo",
              granted
                ? "Máy này sẽ nổi thông báo mỗi khi người thương nhắn, gửi tin thoại, khoảnh khắc, nhật ký hoặc đổi cảm xúc."
                : "Hãy mở Cài đặt của điện thoại → Ứng dụng → Hai Trái Tim → Thông báo và bật lên nhé.",
            ),
          )
        }
        className="mb-4"
      >
        <Text className="text-xs text-center" style={{ color: theme.sub }}>
          Bật thông báo để tin nhắn nổi lên như Messenger
        </Text>
      </Pressable>
      {relayStatus.partnerOnline ? null : (
        <View className="mb-3">
          <Note>
            Hai máy cần cùng mở app và cùng có mạng để tin sang ngay; một bên
            đóng app thì tin nằm chờ và tự gửi ở lần mở sau.
          </Note>
        </View>
      )}
      {viewing ? (
        <PhotoViewer uri={viewing} onClose={() => setViewing("")} />
      ) : null}
    </KeyboardAvoidingView>
  );
}
