import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
const EMOJIS = [
  "🥰",
  "😍",
  "😘",
  "🤗",
  "😊",
  "😁",
  "🥲",
  "😴",
  "💗",
  "💖",
  "💌",
  "🌹",
  "🌸",
  "✨",
  "🌙",
  "⭐",
  "🐻",
  "🐰",
  "🍓",
  "🧋",
  "🍰",
  "🎁",
  "🎶",
  "🫶",
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
export default function ChatLocal({
  state,
  update,
  relayStatus,
  onSendMessage,
}: {
  state: State;
  update: (action: Record<string, unknown>) => void;
  relayStatus: {
    state: string;
    partnerOnline: boolean;
    partnerName?: string | null;
  };
  onSendMessage?: () => void;
}) {
  const { theme } = useTheme();
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showNudges, setShowNudges] = useState(false);
  const [recording, setRecording] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const listRef = useRef<FlatList<State["messages"][number]> | null>(null);
  const busyRef = useRef(0);
  const lastNudgeRef = useRef("");
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const messages = state.messages ?? [];
  const unread = useMemo(
    () =>
      messages.filter(
        (message) => message.authorId === "partner" && !message.readAt,
      ).length,
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
    setTimeout(
      () => listRef.current?.scrollToOffset({ offset: 0, animated: true }),
      120,
    );
  }
  function send(kind: string, body: string) {
    const value = body.trim();
    if (!value) return;
    // Chặn bấm hai lần liên tiếp gửi đúng một câu (trước đây bị lặp nhiều tin).
    const now = Date.now();
    if (now - busyRef.current < 900) return;
    busyRef.current = now;
    if (kind === "nudge") {
      if (lastNudgeRef.current === value && now - busyRef.current < 1500)
        return;
      lastNudgeRef.current = value;
    }
    try {
      update({ type: "message.add", kind, body: value });
      setText("");
      onSendMessage?.();
      scrollToNewest();
    } catch (error) {
      Alert.alert(
        "Chưa gửi được",
        error instanceof Error ? error.message : "Tin nhắn không hợp lệ.",
      );
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
  const partnerName = state.partner?.nickname || relayStatus.partnerName;
  const statusText = relayStatus.partnerOnline
    ? `${partnerName || "Người thương"} đang trực tuyến`
    : state.partner
      ? "Đã ghép nối — người thương chưa mở app, tin sẽ gửi khi họ mở"
      : "Chưa ghép nối (mở mục Ghép nối để nối hai máy)";
  const oldPartner =
    Boolean(state.partner) && !versionOk(state.partner?.appVersion);
  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View
        className="flex-row items-center mb-2"
        style={{
          backgroundColor: theme.glass,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: theme.border,
          paddingHorizontal: 12,
          paddingVertical: 8,
        }}
      >
        <LocalAvatar
          name={partnerName || "Người thương"}
          image={state.partner?.avatar ?? null}
          size={40}
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
          accessibilityLabel="Mở lời nhắn nhanh"
          onPress={() => setShowNudges(!showNudges)}
          style={{
            backgroundColor: showNudges ? theme.deep[1] : theme.soft,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 16,
            paddingHorizontal: 10,
            paddingVertical: 6,
          }}
        >
          <Text style={{ color: showNudges ? theme.onDeep : theme.text }}>
            💌 nhắn nhanh
          </Text>
        </Pressable>
      </View>
      {showNudges ? (
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
      <FlatList
        ref={listRef}
        inverted
        data={messages}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingVertical: 6 }}
        ListEmptyComponent={
          <View style={{ transform: [{ scaleY: -1 }] }}>
            <Card>
              <Note>
                Chưa có tin nào. Bấm 💌 nhắn nhanh ở trên, hoặc viết vài chữ rồi
                bấm “Gửi” — máy người thương sẽ nổi thông báo như tin nhắn
                Messenger.
              </Note>
            </Card>
          </View>
        }
        renderItem={({ item: message, index }) => {
          const mine = message.authorId === "me";
          const older = messages[index + 1];
          const showDay =
            !older || dayOf(older.createdAt) !== dayOf(message.createdAt);
          const status = mine
            ? !message.sentAt
              ? "đang chờ gửi"
              : message.deliveredAt
                ? "đã tới máy kia"
                : "đã gửi"
            : message.readAt
              ? "đã xem"
              : "mới nhận";
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
              <View
                className={`mb-2 ${mine ? "items-end" : "items-start"}`}
                style={{ maxWidth: "92%" }}
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
                    {message.kind === "voice" ? (
                      <VoiceBubble
                        uri={message.audio ? imageUri(message.audio) : null}
                        mine
                        durationMs={message.durationMs}
                      />
                    ) : (
                      <Text style={{ color: theme.onDeep }}>
                        {message.body}
                      </Text>
                    )}
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
                    {message.kind === "voice" ? (
                      <VoiceBubble
                        uri={message.audio ? imageUri(message.audio) : null}
                        mine={false}
                        durationMs={message.durationMs}
                      />
                    ) : (
                      <Text style={{ color: theme.ink }}>{message.body}</Text>
                    )}
                  </View>
                )}
                <View className="flex-row items-center mt-1">
                  <Text className="text-xs" style={{ color: theme.sub }}>
                    {clockOf(message.createdAt)} · {status}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Xóa tin nhắn này"
                    onPress={() =>
                      void (async () => {
                        if (
                          !(await confirm(
                            "Xóa tin nhắn?",
                            "Tin này biến mất khỏi máy bạn. Máy người thương vẫn giữ bản của họ.",
                          ))
                        )
                          return;
                        update({ type: "message.remove", id: message.id });
                      })()
                    }
                  >
                    <Text className="text-xs ml-2" style={{ color: theme.sub }}>
                      xóa
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }}
      />
      <View
        style={{
          backgroundColor: theme.glass,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: theme.border,
          paddingHorizontal: 10,
          paddingVertical: 8,
          marginTop: 6,
        }}
      >
        {showEmoji ? (
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
          <View className="flex-row items-end">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chọn emoji"
              onPress={() => setShowEmoji(!showEmoji)}
              className="mr-2 py-2"
            >
              <Text className="text-2xl">{showEmoji ? "⌨️" : "😊"}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ghi âm tin thoại"
              onPress={() => void startRecording()}
              className="mr-2 py-2"
            >
              <Text className="text-2xl">🎙</Text>
            </Pressable>
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
        )}
        {unread ? (
          <Text className="text-xs mt-1" style={{ color: theme.sub }}>
            {unread} tin mới từ người thương · chạm vào tin để đánh dấu đã xem
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
        className="mt-2"
      >
        <Text className="text-xs text-center" style={{ color: theme.sub }}>
          Bật thông báo để tin nhắn nổi lên như Messenger
        </Text>
      </Pressable>
      {relayStatus.partnerOnline ? null : (
        <Note>
          Hai máy cần cùng mở app và cùng có mạng để tin sang ngay; một bên đóng
          app thì tin nằm chờ và tự gửi ở lần mở sau.
        </Note>
      )}
    </KeyboardAvoidingView>
  );
}
