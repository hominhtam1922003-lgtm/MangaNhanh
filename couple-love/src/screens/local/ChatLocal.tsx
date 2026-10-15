import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
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
  useAudioRecorder,
} from "expo-audio";
import { Card, LocalAvatar, Note, confirm } from "../../components/UI";
import PhotoPicker from "../../components/PhotoPicker";
import { MessageRow } from "../../components/MessageRow";
import { SwipeRow } from "../../components/SwipeRow";
import { useTheme } from "../../theme/ThemeContext";
import { imageUri, saveImage } from "../../services/localdb";
import { requestNotifications } from "../../services/localnotify";
import type { State } from "../../services/localdb";
import {
  REACTIONS,
  isRecalled,
  replyPreview,
  typingText,
} from "../../logic/chatExtras.mjs";
import { MESSENGER_THEMES, THEMES } from "../../logic/themes.mjs";
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
  onOpenPair,
}: {
  state: State;
  update: (action: Record<string, unknown>) => void;
  relayStatus: {
    state: string;
    partnerOnline: boolean;
    partnerName?: string | null;
  };
  onSendMessage?: () => void;
  onStartCall?: (video?: boolean) => void;
  /** App tự nén, lưu và gửi ảnh; màn hình chỉ chọn ảnh. */
  onSendPhoto?: (uri: string, caption: string) => void;
  onSendLocation?: () => void;
  /** Người thương đang gõ chữ (gói tin "đang nhập…" qua kênh ghép nối). */
  partnerTyping?: boolean;
  onTyping?: (typing: boolean) => void;
  onReact?: (id: string, emoji: string | null) => void;
  onRecall?: (id: string) => void;
  onSavePhoto?: (photo: string | null | undefined) => void;
  onOpenPair?: () => void;
}) {
  const { theme } = useTheme();
  const [text, setText] = useState("");
  const [pad, setPad] = useState<
    "none" | "actions" | "emoji" | "sticker" | "theme"
  >("none");
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
  /** Nút "↓ mới nhất": chỉ hiện khi đang cuộn lên khỏi đáy (xem onScroll). */
  const [showJump, setShowJump] = useState(false);
  const jumpRef = useRef(false);
  const viewportRef = useRef(0);
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
    // Mở màn hình Tin nhắn là coi như đã đọc tin của người thương. Hẹn 600 ms để
    // không bắn gói "đã đọc" khi bạn chỉ lướt qua; rời màn hình thì huỷ hẹn luôn.
    if (!unread) return;
    const timer = setTimeout(() => update({ type: "message.read" }), 600);
    return () => clearTimeout(timer);
  }, [unread, update]);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setElapsed(Date.now() - startedAt), 200);
    return () => clearInterval(timer);
  }, [recording, startedAt]);
  function setJump(value: boolean) {
    if (jumpRef.current === value) return;
    jumpRef.current = value;
    setShowJump(value);
  }
  function scrollToNewest() {
    followRef.current = true;
    setJump(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 140);
  }
  /**
   * Đo vị trí cuộn: ẩn nút "mới nhất" khi đang ở đáy, chỉ hiện khi đã cuộn lên.
   * Dùng đúng `contentOffset` / `contentSize` / `layoutMeasurement` như yêu cầu;
   * nội dung ngắn hơn khung thì không bao giờ hiện nút (bản 1.17.0 hiện mãi vì
   * điều kiện cũ chỉ đếm số tin nhắn > 3 nên nút treo lơ lửng trên màn hình).
   */
  function trackScroll(event: {
    nativeEvent: {
      contentOffset: { y: number };
      contentSize: { height: number };
      layoutMeasurement: { height: number };
    };
  }) {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const fromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);
    followRef.current = fromBottom < 60;
    viewportRef.current = layoutMeasurement.height;
    const shortList = contentSize.height <= layoutMeasurement.height + 8;
    setJump(!shortList && fromBottom > 140);
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
      <SwipeRow onReply={() => onReply(item)}>
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
        {!state.partner && onOpenPair ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mở mục Ghép nối"
            onPress={onOpenPair}
            style={{
              backgroundColor: theme.soft,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 18,
              paddingHorizontal: 10,
              paddingVertical: 8,
              marginRight: 6,
            }}
          >
            <Text className="font-bold text-xs" style={{ color: theme.text }}>
              🔗 Ghép nối
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đổi chủ đề cuộc trò chuyện"
          onPress={() => setPad(pad === "theme" ? "none" : "theme")}
          style={{
            backgroundColor: pad === "theme" ? theme.deep[0] : theme.soft,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 18,
            paddingHorizontal: 10,
            paddingVertical: 8,
            marginRight: 6,
          }}
        >
          <Text
            className="font-bold text-xs"
            style={{ color: pad === "theme" ? theme.onDeep : theme.text }}
          >
            🎨
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Gọi cho người thương"
          onPress={() => onStartCall?.(false)}
          style={{
            backgroundColor: theme.deep[1],
            borderRadius: 18,
            paddingHorizontal: 12,
            paddingVertical: 8,
            marginRight: 6,
          }}
        >
          <Text className="font-bold text-xs" style={{ color: theme.onDeep }}>
            📞 Gọi
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Gọi Video cho người thương"
          onPress={() => onStartCall?.(true)}
          style={{
            backgroundColor: theme.deep[0],
            borderRadius: 18,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Text className="font-bold text-xs" style={{ color: theme.onDeep }}>
            📹 Video
          </Text>
        </Pressable>
      </View>
      {pad === "theme" ? (
        <View
          className="mb-2 p-2.5"
          style={{
            backgroundColor: theme.surface,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <View className="flex-row items-center justify-between mb-1.5 px-1">
            <Text className="text-xs font-bold" style={{ color: theme.ink }}>
              🎨 Chủ đề cuộc trò chuyện (đồng bộ hai máy)
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng bảng chủ đề"
              onPress={() => setPad("none")}
            >
              <Text className="text-xs" style={{ color: theme.sub }}>
                Đóng ✕
              </Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {MESSENGER_THEMES.map((preset) => {
              const target =
                THEMES.find((item) => item.id === preset.id) ?? THEMES[0];
              const selected = theme.id === target.id;
              return (
                <Pressable
                  key={preset.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Chủ đề ${preset.label}`}
                  onPress={() => {
                    update({ type: "appearance.set", theme: target.id });
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 11,
                    paddingVertical: 7,
                    borderRadius: 16,
                    marginRight: 8,
                    backgroundColor: selected ? target.deep[1] : target.soft,
                    borderWidth: 1.5,
                    borderColor: selected ? target.deep[0] : target.border,
                  }}
                >
                  <Text className="mr-1.5">{preset.emoji}</Text>
                  <Text
                    className="text-xs font-bold"
                    style={{
                      color: selected ? target.onDeep : target.ink,
                    }}
                  >
                    {preset.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
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
          onScroll={trackScroll}
          scrollEventThrottle={16}
          onLayout={(event) => {
            viewportRef.current = event.nativeEvent.layout.height;
          }}
          onContentSizeChange={(_, height) => {
            if (followRef.current) {
              listRef.current?.scrollToEnd({ animated: false });
              setJump(false);
              return;
            }
            // Người thương vừa gửi tin trong lúc mình đang xem lại tin cũ: hiện
            // nút để nhảy xuống, không tự kéo màn hình khi đang đọc.
            if (height > viewportRef.current + 8) setJump(true);
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
        {showJump ? (
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
          backgroundColor: theme.inputBg ?? theme.glass,
          borderWidth: 1,
          borderColor: theme.inputBorder ?? theme.border,
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
              colors={theme.bubbleMine ?? theme.deep}
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
