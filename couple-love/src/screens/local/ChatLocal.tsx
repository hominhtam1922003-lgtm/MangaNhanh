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
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
import PhotoPicker from "../../components/PhotoPicker";
import { useTheme } from "../../theme/ThemeContext";
import { imageUri, saveImage } from "../../services/localdb";
import { requestNotifications } from "../../services/localnotify";
import type { State } from "../../services/localdb";
import {
  REACTIONS,
  isRecalled,
  reactList,
  recallText,
  replyPreview,
  typingText,
} from "../../logic/chatExtras.mjs";
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
/** Ghi quá ngắn thì coi như bấm nhầm, không gửi. */
const MIN_VOICE_MS = 700;
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
function PhotoViewer({
  uri,
  onClose,
  onSave,
}: {
  uri: string;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <View
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Đóng ảnh"
        onPress={onClose}
        style={{ alignItems: "center" }}
      >
        <Image
          source={{ uri }}
          style={{ width: 300, height: 380, borderRadius: 20 }}
          resizeMode="contain"
        />
        <Text className="text-white mt-3">Chạm để đóng</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Lưu ảnh về máy"
        onPress={onSave}
        style={{
          marginTop: 12,
          paddingHorizontal: 18,
          paddingVertical: 10,
          borderRadius: 20,
          backgroundColor: "#ffffff22",
          borderWidth: 1,
          borderColor: "#ffffff55",
        }}
      >
        <Text className="text-white">⬇ Lưu ảnh về máy</Text>
      </Pressable>
    </View>
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
 * Vuốt một dòng tin nhắn sang phải để trả lời — thao tác quen thuộc của
 * Messenger/Zalo. Dùng PanResponder sẵn có của React Native (không cần thêm thư
 * viện native nào), và chỉ giành lấy cử chỉ khi người dùng vuốt NGANG thật sự để
 * việc cuộn dọc trong khung chat vẫn trơn.
 */
function SwipeRow({
  children,
  onReply,
  hint,
}: {
  children: React.ReactNode;
  onReply: () => void;
  hint: string;
}) {
  const translate = useRef(new Animated.Value(0)).current;
  const { theme } = useTheme();
  const settle = useCallback(() => {
    Animated.timing(translate, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [translate]);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          gesture.dx > 14 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
        onPanResponderMove: (_event, gesture) => {
          if (gesture.dx > 0) translate.setValue(Math.min(76, gesture.dx));
        },
        onPanResponderRelease: (_event, gesture) => {
          const go = gesture.dx > 48;
          settle();
          if (go) onReply();
        },
        onPanResponderTerminate: settle,
      }),
    [onReply, settle, translate],
  );
  return (
    <View>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 8,
          top: 0,
          bottom: 0,
          justifyContent: "center",
        }}
      >
        <Text style={{ color: theme.sub, opacity: 0.7 }}>↩ {hint}</Text>
      </View>
      <Animated.View
        style={{ transform: [{ translateX: translate }] }}
        {...pan.panHandlers}
      >
        {children}
      </Animated.View>
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
  partnerAvatar,
  readReceipts,
  showSeen,
  onOpenPhoto,
  onHold,
  onReply,
}: {
  message: State["messages"][number];
  previousAt: string | null;
  theme: ReturnType<typeof useTheme>["theme"];
  mine: boolean;
  partnerName: string;
  partnerAvatar: string | null;
  readReceipts: boolean;
  showSeen: boolean;
  onOpenPhoto: (photo: string | null | undefined) => void;
  onHold: (message: State["messages"][number]) => void;
  onReply: (message: State["messages"][number]) => void;
}) {
  const showDay = !previousAt || dayOf(previousAt) !== dayOf(message.createdAt);
  const recalled = isRecalled(message);
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
  const reactions = reactList(message.react);
  const quote = message.reply ? (
    <View
      style={{
        borderLeftWidth: 3,
        borderLeftColor: mine ? theme.onDeep : theme.deep[1],
        paddingLeft: 8,
        marginBottom: 6,
        opacity: 0.9,
      }}
    >
      <Text
        className="text-xs font-bold"
        style={{ color: mine ? theme.onDeep : theme.deep[1] }}
      >
        {message.reply.mine ? "Bạn" : partnerName || "Người thương"}
      </Text>
      <Text
        className="text-xs"
        style={{ color: mine ? theme.onDeep : theme.sub }}
        numberOfLines={2}
      >
        {message.reply.body}
      </Text>
    </View>
  ) : null;
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
      {quote}
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
      {quote}
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
        {recalled ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 16,
              paddingHorizontal: 12,
              paddingVertical: 8,
              backgroundColor: theme.glass,
            }}
          >
            <Text className="text-xs italic" style={{ color: theme.sub }}>
              🚫 {recallText(mine)}
            </Text>
          </View>
        ) : message.kind === "sticker" ? (
          <Pressable
            onLongPress={() => onHold(message)}
            accessibilityRole="button"
            accessibilityLabel="Sticker, giữ để chọn thao tác"
          >
            <Text style={{ fontSize: 68, lineHeight: 78 }}>{message.body}</Text>
          </Pressable>
        ) : message.kind === "photo" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mở ảnh, giữ để chọn thao tác"
            onPress={() => onOpenPhoto(message.photo)}
            onLongPress={() => onHold(message)}
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
            {quote}
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
            {quote}
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
          <Pressable
            onLongPress={() => onHold(message)}
            accessibilityRole="button"
            accessibilityLabel="Tin thoại, giữ để chọn thao tác"
          >
            {mine ? (
              <LinearGradient
                colors={theme.deep}
                style={{
                  borderRadius: 20,
                  borderBottomRightRadius: 6,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                }}
              >
                {quote}
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
                {quote}
                <VoiceBubble
                  uri={message.audio ? imageUri(message.audio) : null}
                  mine={false}
                  durationMs={message.durationMs}
                />
              </View>
            )}
          </Pressable>
        ) : (
          <Pressable
            onLongPress={() => onHold(message)}
            accessibilityRole="button"
            accessibilityLabel="Tin nhắn, giữ để chọn thao tác"
          >
            {mine ? mineGradient : theirBubble}
          </Pressable>
        )}
        {reactions.length ? (
          <View
            className="flex-row items-center"
            style={{
              marginTop: -6,
              marginLeft: mine ? 0 : 8,
              marginRight: mine ? 8 : 0,
              backgroundColor: theme.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: theme.border,
              paddingHorizontal: 7,
              paddingVertical: 2,
            }}
          >
            {reactions.map((item) => (
              <Text
                key={item.who}
                className="text-sm"
                style={{ marginRight: 2 }}
              >
                {item.emoji}
              </Text>
            ))}
          </View>
        ) : null}
        <View className="flex-row items-center mt-1">
          <Text className="text-xs" style={{ color: theme.sub }}>
            {timeLabel}
          </Text>
          {showSeen ? (
            <View className="ml-2 flex-row items-center">
              <LocalAvatar
                name={partnerName || "Người thương"}
                image={partnerAvatar}
                size={16}
              />
              <Text className="text-xs ml-1" style={{ color: theme.sub }}>
                đã xem
              </Text>
            </View>
          ) : null}
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
  partnerTyping = false,
  onTyping,
  onReact,
  onRecall,
  onSavePhoto,
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
  /** Người thương đang gõ chữ (gói tin "đang nhập…" qua kênh ghép nối). */
  partnerTyping?: boolean;
  onTyping?: (typing: boolean) => void;
  onReact?: (id: string, emoji: string | null) => void;
  onRecall?: (id: string) => void;
  onSavePhoto?: (photo: string | null | undefined) => void;
}) {
  const { theme } = useTheme();
  const [text, setText] = useState("");
  const [pad, setPad] = useState<"none" | "actions" | "emoji" | "sticker">(
    "none",
  );
  const [pack, setPack] = useState(0);
  const [reply, setReply] = useState<{
    id: string;
    body: string;
    mine: boolean;
  } | null>(null);
  const [sheet, setSheet] = useState<State["messages"][number] | null>(null);
  const [picker, setPicker] = useState(false);
  const [recording, setRecording] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [slideCancel, setSlideCancel] = useState(false);
  const [viewing, setViewing] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<State["messages"][number]> | null>(null);
  const followRef = useRef(true);
  const busyRef = useRef(0);
  const textRef = useRef("");
  const replyRef = useRef<typeof reply>(null);
  const slideRef = useRef(false);
  const typingSentAt = useRef(0);
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const messages = state.messages ?? [];
  // Danh sách hiển thị theo thứ tự cũ → mới; tin mới nhất nằm dưới cùng.
  const ordered = useMemo(() => [...messages].reverse(), [messages]);
  const readReceipts = state.settings?.readReceipts !== false;
  const partnerName = state.partner?.nickname || relayStatus.partnerName || "";
  const partnerAvatar = state.partner?.avatar ?? null;
  const unread = useMemo(
    () => messages.filter((m) => m.authorId === "partner" && !m.readAt).length,
    [messages],
  );
  // Avatar nhỏ "đã xem" nằm cạnh tin CUỐI CÙNG của mình mà người thương đã đọc.
  const lastSeenId = useMemo(() => {
    if (!readReceipts) return "";
    const seen = ordered.filter((m) => m.authorId === "me" && m.readAt);
    return seen.length ? seen[seen.length - 1].id : "";
  }, [ordered, readReceipts]);
  textRef.current = text;
  replyRef.current = reply;
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
      update({
        type: "message.add",
        kind,
        body: value,
        reply: replyRef.current ?? undefined,
      });
      setText("");
      setPad("none");
      setReply(null);
      onTyping?.(false);
      onSendMessage?.();
      scrollToNewest();
    } catch (error) {
      Alert.alert(
        "Chưa gửi được",
        error instanceof Error ? error.message : "Tin nhắn không hợp lệ.",
      );
    }
  }
  /** Gõ chữ: báo máy kia "đang nhập…" nhưng đừng gửi mỗi ký tự. */
  function onChangeText(value: string) {
    setText(value);
    textRef.current = value;
    const now = Date.now();
    if (now - typingSentAt.current < 1200) return;
    typingSentAt.current = now;
    onTyping?.(value.trim().length > 0);
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
      setSlideCancel(false);
      slideRef.current = false;
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
      const durationMs = Math.min(
        MAX_VOICE_MS,
        Date.now() - beganAt || elapsed,
      );
      if (!sendIt || !uri) return;
      if (durationMs < MIN_VOICE_MS) {
        Alert.alert(
          "Chưa ghi được gì",
          "Giữ nút mic lâu hơn một chút (khoảng 1 giây) rồi nhả ra để gửi tin thoại nhé.",
        );
        return;
      }
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
  /**
   * Giữ nút mic để ghi, nhả ra là gửi (kiểu Zalo/Messenger); kéo lên trên để huỷ.
   */
  const micPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => textRef.current.trim().length === 0,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dy) > 6,
        onPanResponderGrant: () => {
          void startRecording();
        },
        onPanResponderMove: (_event, gesture) => {
          const cancel = gesture.dy < -70;
          if (cancel !== slideRef.current) {
            slideRef.current = cancel;
            setSlideCancel(cancel);
          }
        },
        onPanResponderRelease: () => {
          void stopRecording(!slideRef.current);
          slideRef.current = false;
          setSlideCancel(false);
        },
        onPanResponderTerminate: () => {
          void stopRecording(false);
          slideRef.current = false;
          setSlideCancel(false);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recorder, elapsed],
  );
  // Giữ hàm cập nhật trong ref để các dòng tin nhắn không phải vẽ lại khi App
  // vẽ lại (mỗi giây một lần khi đang gọi) — bảng tin chỉ vẽ khi tin đổi.
  const updateRef = useRef(update);
  updateRef.current = update;
  const onOpenPhoto = useCallback((photo: string | null | undefined) => {
    if (photo) setViewing(imageUri(photo) ?? "");
    else
      Alert.alert(
        "Ảnh đang tới",
        "Ảnh đang trên đường sang máy bạn, chờ một chút nhé.",
      );
  }, []);
  const onHold = useCallback((message: State["messages"][number]) => {
    setSheet(message);
  }, []);
  const onReply = useCallback((message: State["messages"][number]) => {
    setReply({
      id: message.id,
      body: replyPreview(message),
      mine: message.authorId === "me",
    });
    setSheet(null);
  }, []);
  const onDeleteLocal = useCallback((id: string) => {
    void (async () => {
      if (
        !(await confirm(
          "Xóa tin nhắn ở máy này?",
          "Tin này chỉ biến mất trên máy bạn, người thương vẫn còn. Muốn xoá cả hai bên thì dùng “Thu hồi”.",
        ))
      )
        return;
      updateRef.current({ type: "message.remove", id });
    })();
  }, []);
  const onRecallLocal = useCallback(
    (id: string) => {
      void (async () => {
        if (
          !(await confirm(
            "Thu hồi tin nhắn?",
            "Tin này sẽ bị thu hồi ở CẢ HAI máy: chữ, ảnh và tin thoại đều mất, chỉ còn dòng “đã thu hồi”.",
          ))
        )
          return;
        onRecall?.(id);
        setSheet(null);
      })();
    },
    [onRecall],
  );
  const renderItem = useCallback(
    ({ item, index }: { item: State["messages"][number]; index: number }) => (
      <SwipeRow hint="trả lời" onReply={() => onReply(item)}>
        <MessageRow
          message={item}
          previousAt={ordered[index - 1]?.createdAt ?? null}
          theme={theme}
          mine={item.authorId === "me"}
          partnerName={partnerName}
          partnerAvatar={partnerAvatar}
          readReceipts={readReceipts}
          showSeen={Boolean(lastSeenId) && item.id === lastSeenId}
          onOpenPhoto={onOpenPhoto}
          onHold={onHold}
          onReply={onReply}
        />
      </SwipeRow>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      ordered,
      theme,
      readReceipts,
      partnerName,
      partnerAvatar,
      lastSeenId,
      onOpenPhoto,
      onHold,
      onReply,
    ],
  );
  const partnerOnline = relayStatus.partnerOnline;
  const statusText = partnerOnline
    ? `${partnerName || "Người thương"} đang trực tuyến`
    : state.partner
      ? "Đã ghép nối — tin sẽ gửi khi người thương mở app"
      : "Chưa ghép nối (mở mục Ghép nối để nối hai máy)";
  const oldPartner =
    Boolean(state.partner) && !versionOk(state.partner?.appVersion);
  const canSend = text.trim().length > 0;
  const sheetActions: [string, () => void][] = sheet
    ? [
        ["↩ Trả lời", () => onReply(sheet)],
        ...(sheet.authorId === "me" && !isRecalled(sheet)
          ? ([
              ["🚫 Thu hồi (xoá cả hai bên)", () => onRecallLocal(sheet.id)],
            ] as [string, () => void][])
          : []),
        ...(sheet.kind === "photo" && sheet.photo
          ? ([
              [
                "⬇ Lưu ảnh về máy",
                () => {
                  onSavePhoto?.(sheet.photo);
                  setSheet(null);
                },
              ],
            ] as [string, () => void][])
          : []),
        ["🗑 Xóa ở máy này", () => onDeleteLocal(sheet.id)],
      ]
    : [];
  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* Thẻ người thương: tên, trạng thái (hoặc "đang nhập…"), gọi */}
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
          image={partnerAvatar}
          size={44}
        />
        <View className="ml-3 flex-1">
          <Text className="font-bold" style={{ color: theme.ink }}>
            {partnerName || "Người thương"}
          </Text>
          <Text
            className="text-xs"
            style={{ color: partnerTyping ? theme.deep[1] : theme.sub }}
          >
            {partnerTyping ? typingText(partnerName) : statusText}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Gọi cho người thương"
          onPress={() => onStartCall?.()}
          style={{
            backgroundColor: theme.deep[1],
            borderRadius: 18,
            paddingHorizontal: 14,
            paddingVertical: 9,
          }}
        >
          <Text className="font-bold" style={{ color: theme.onDeep }}>
            📞 Gọi
          </Text>
        </Pressable>
      </View>
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
            nên chưa hiểu tin nhắn mới. Hãy cài bản mới nhất trên cả hai máy rồi
            ghép nối lại.
          </Text>
        </View>
      ) : null}
      {/* Bảng tin cố định: tin mới ở dưới, kéo lên xem lại như Messenger/Zalo */}
      <View className="flex-1" style={{ minHeight: 160 }}>
        <FlatList
          ref={listRef}
          data={ordered}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingVertical: 6, paddingBottom: 12 }}
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
                Chưa có tin nào. Bấm ＋ để gửi ảnh, giữ nút mic để gửi tin
                thoại, hoặc gõ vài chữ cho người thương nhé.
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
      {/* Trả lời: dòng trích dẫn nằm ngay trên ô viết */}
      {reply ? (
        <View
          className="flex-row items-center mb-1 px-3 py-2"
          style={{
            backgroundColor: theme.soft,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <View
            style={{
              borderLeftWidth: 3,
              borderLeftColor: theme.deep[1],
              paddingLeft: 8,
              flex: 1,
            }}
          >
            <Text
              className="text-xs font-bold"
              style={{ color: theme.deep[1] }}
            >
              Trả lời {reply.mine ? "bạn" : partnerName || "người thương"}
            </Text>
            <Text
              className="text-xs"
              style={{ color: theme.sub }}
              numberOfLines={1}
            >
              {reply.body}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Bỏ trả lời"
            onPress={() => setReply(null)}
            style={{ paddingHorizontal: 6 }}
          >
            <Text style={{ color: theme.sub }}>✕</Text>
          </Pressable>
        </View>
      ) : null}
      {/* Bảng ít dùng: ảnh, máy ảnh, vị trí, sticker, emoji, nhắn nhanh */}
      {pad === "actions" ? (
        <View
          className="mb-2 p-2"
          style={{
            backgroundColor: theme.glass,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <View className="flex-row flex-wrap">
            {(
              [
                ["🖼 Ảnh", "photo", "Chọn ảnh trong máy"],
                ["📷 Chụp", "camera", "Chụp ảnh gửi ngay"],
                ["📍 Vị trí", "location", "Gửi vị trí"],
                ["🧸 Sticker", "sticker", "Sticker"],
                ["😊 Emoji", "emoji", "Bảng cảm xúc"],
                ["💌 Nhắn nhanh", "nudge", "Lời nhắn nhanh"],
              ] as const
            ).map(([label, action, hint]) => (
              <Pressable
                key={action}
                accessibilityRole="button"
                accessibilityLabel={hint}
                onPress={() => {
                  if (action === "photo" || action === "camera") {
                    setPad("none");
                    setPicker(true);
                  } else if (action === "location") {
                    setPad("none");
                    onSendLocation?.();
                  } else if (action === "sticker") setPad("sticker");
                  else setPad("emoji");
                }}
                className="px-2 py-1 m-1 rounded-full"
                style={{
                  backgroundColor: theme.soft,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <Text className="text-xs" style={{ color: theme.text }}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
        </View>
      ) : null}
      {pad === "emoji" ? (
        <View
          className="mb-2 p-2 flex-row flex-wrap"
          style={{
            backgroundColor: theme.glass,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <ScrollView style={{ maxHeight: 140 }}>
            <View className="flex-row flex-wrap">
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
          </ScrollView>
        </View>
      ) : null}
      {pad === "sticker" ? (
        <View
          className="mb-2 p-2"
          style={{
            backgroundColor: theme.glass,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {STICKER_PACKS.map((item, index) => (
              <Pressable
                key={item.name}
                accessibilityRole="button"
                accessibilityLabel={`Bộ sticker ${item.name}`}
                onPress={() => setPack(index)}
                className="mr-2 px-3 py-1 rounded-full"
                style={{
                  backgroundColor: index === pack ? theme.deep[1] : theme.soft,
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
      {/* Ô nhập liệu: viên thuốc nổi, chỉ 3 thứ — ＋, ô chữ, mic ⇄ gửi */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          backgroundColor: theme.glass,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 28,
          paddingHorizontal: 6,
          paddingVertical: 6,
          marginTop: 8,
          marginBottom: 14,
          shadowColor: theme.glow,
          shadowOpacity: 0.25,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 5,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Thêm ảnh, vị trí, sticker"
          onPress={() => setPad(pad === "actions" ? "none" : "actions")}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: pad === "actions" ? theme.deep[1] : theme.soft,
            borderWidth: 1,
            borderColor: theme.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontSize: 20,
              color: pad === "actions" ? theme.onDeep : theme.text,
            }}
          >
            {pad === "actions" ? "✕" : "＋"}
          </Text>
        </Pressable>
        <TextInput
          value={text}
          onChangeText={onChangeText}
          onBlur={() => onTyping?.(false)}
          multiline
          placeholder="Nhắn cho người thương…"
          placeholderTextColor={theme.sub}
          accessibilityLabel="Ô viết tin nhắn"
          style={{
            flex: 1,
            color: theme.ink,
            paddingHorizontal: 10,
            paddingVertical: 9,
            maxHeight: 104,
            fontSize: 15,
          }}
        />
        {canSend ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Gửi tin nhắn"
            onPress={() => send("text", text)}
            style={{ marginLeft: 4 }}
          >
            <LinearGradient
              colors={theme.deep}
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 18, color: theme.onDeep }}>➤</Text>
            </LinearGradient>
          </Pressable>
        ) : (
          <View
            {...micPan.panHandlers}
            accessibilityRole="button"
            accessibilityLabel="Giữ để ghi tin thoại"
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: recording
                ? "#ef4444"
                : slideCancel
                  ? "#f97316"
                  : theme.soft,
              borderWidth: 1,
              borderColor: theme.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 19 }}>{slideCancel ? "🗑" : "🎙"}</Text>
          </View>
        )}
      </View>
      {recording ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 84,
            backgroundColor: "#000000cc",
            borderRadius: 18,
            paddingHorizontal: 14,
            paddingVertical: 10,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Text className="text-white font-bold mr-2">
            ● {secondsOf(elapsed)}
          </Text>
          <Text className="text-white text-xs flex-1">
            {slideCancel
              ? "Nhả ra để HUỶ tin thoại này"
              : `Giữ và nói… nhả ra là gửi (tối đa ${secondsOf(MAX_VOICE_MS)}). Kéo lên để huỷ.`}
          </Text>
        </View>
      ) : null}
      {unread ? (
        <Text className="text-xs mb-2 text-center" style={{ color: theme.sub }}>
          {unread} tin mới từ người thương
        </Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bật thông báo"
          onPress={() =>
            void requestNotifications().then((granted) =>
              Alert.alert(
                granted ? "Đã bật thông báo" : "Chưa bật được thông báo",
                granted
                  ? "Máy này sẽ nổi thông báo mỗi khi người thương nhắn — bấm vào thông báo là vào thẳng đoạn chat."
                  : "Hãy mở Cài đặt của điện thoại → Ứng dụng → Mật Mã Yêu → Thông báo và bật lên nhé.",
              ),
            )
          }
          className="mb-3"
        >
          <Text className="text-xs text-center" style={{ color: theme.sub }}>
            Bật thông báo để tin nhắn nổi lên như Messenger
          </Text>
        </Pressable>
      )}
      {/* Chọn thao tác cho một tin nhắn: cảm xúc, trả lời, thu hồi, xóa, lưu ảnh */}
      {sheet ? (
        <View style={StyleSheet.absoluteFill}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng bảng thao tác"
            onPress={() => setSheet(null)}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={{
              position: "absolute",
              left: 10,
              right: 10,
              bottom: 10,
              backgroundColor: theme.surface,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: theme.border,
              padding: 10,
            }}
          >
            {!isRecalled(sheet) ? (
              <View className="flex-row justify-around mb-2">
                {REACTIONS.map((emoji) => (
                  <Pressable
                    key={emoji}
                    accessibilityRole="button"
                    accessibilityLabel={`Thả ${emoji}`}
                    onPress={() => {
                      onReact?.(
                        sheet.id,
                        sheet.react?.me === emoji ? null : emoji,
                      );
                      setSheet(null);
                    }}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor:
                        sheet.react?.me === emoji ? theme.soft : "transparent",
                    }}
                  >
                    <Text style={{ fontSize: 24 }}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {sheetActions.map(([label, action]) => (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityLabel={label}
                onPress={action}
                style={{
                  paddingVertical: 11,
                  paddingHorizontal: 10,
                  borderRadius: 14,
                }}
              >
                <Text style={{ color: theme.ink }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      {picker ? (
        <PhotoPicker
          title="Gửi ảnh cho người thương"
          onClose={() => setPicker(false)}
          onPick={(uri) => {
            setSending(true);
            try {
              onSendPhoto?.(uri, textRef.current.trim());
              setText("");
              textRef.current = "";
              setPad("none");
              setTimeout(scrollToNewest, 200);
            } finally {
              setSending(false);
            }
          }}
          busyLabel={sending ? "Đang nén và gửi ảnh…" : "Đang xử lý ảnh…"}
        />
      ) : null}
      {viewing ? (
        <PhotoViewer
          uri={viewing}
          onClose={() => setViewing("")}
          onSave={() => {
            const name = ordered.find(
              (item) => item.photo && imageUri(item.photo) === viewing,
            )?.photo;
            onSavePhoto?.(name);
          }}
        />
      ) : null}
      {relayStatus.partnerOnline ? null : (
        <Text className="text-xs text-center mb-2" style={{ color: theme.sub }}>
          Tin sẽ gửi ngay khi người thương mở app và có mạng.
        </Text>
      )}
    </KeyboardAvoidingView>
  );
}
