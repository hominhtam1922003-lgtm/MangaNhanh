import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import {
  Button,
  Card,
  Chip,
  Input,
  LocalAvatar,
  Note,
  Title,
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
const MAX_VOICE_MS = 30000;
const clockOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
const dayOf = (iso: string) => new Date(iso).toLocaleDateString("vi-VN");
const secondsOf = (ms: number) => `${Math.max(1, Math.round(ms / 1000))}″`;
/** Một tin thoại: có nút nghe, hiện độ dài, tự dừng khi hết. */
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
        <Text
          className="text-xl mr-2"
          style={{ color: mine ? theme.onDeep : theme.text }}
        >
          {!uri ? "⏳" : status.playing ? "⏸" : "▶"}
        </Text>
        <View
          style={{
            height: 6,
            width: 120,
            borderRadius: 3,
            backgroundColor: mine ? theme.deep[1] : theme.border,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              height: 6,
              width: 120 * ratio,
              backgroundColor: mine ? theme.onDeep : theme.deep[0],
            }}
          />
        </View>
        <Text
          className="ml-2 text-xs"
          style={{ color: mine ? theme.onDeep : theme.sub }}
        >
          {secondsOf(status.duration > 0 ? status.duration * 1000 : durationMs)}
        </Text>
      </Pressable>
      {!uri ? (
        <Text
          className="text-xs mt-1"
          style={{ color: mine ? theme.onDeep : theme.sub }}
        >
          Tin thoại đang trên đường sang máy bạn…
        </Text>
      ) : null}
      {error ? (
        <Text className="text-xs mt-1" style={{ color: theme.text }}>
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
  const scrollRef = useRef<ScrollView | null>(null);
  const [recording, setRecording] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const messages = state.messages ?? [];
  const unread = useMemo(
    () =>
      messages.filter(
        (message) => message.authorId === "partner" && !message.readAt,
      ).length,
    [messages],
  );
  useEffect(() => {
    // Mở màn hình Tin nhắn là coi như đã đọc tin của người thương (để còn hiện
    // số chưa đọc ở tab nếu có tin mới lúc đang xem màn hình khác).
    if (unread) setTimeout(() => update({ type: "message.read" }), 600);
  }, [unread, update]);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setElapsed(Date.now() - startedAt), 200);
    return () => clearInterval(timer);
  }, [recording, startedAt]);
  function send(kind: string, body: string) {
    const value = body.trim();
    if (!value) return;
    try {
      update({ type: "message.add", kind, body: value });
      setText("");
      onSendMessage?.();
      setTimeout(
        () => scrollRef.current?.scrollTo({ y: 0, animated: true }),
        200,
      );
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
  async function stopRecording(send: boolean) {
    setRecording(false);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
      if (!send || !uri) return;
      const durationMs = Math.min(
        MAX_VOICE_MS,
        recorderState.durationMillis || elapsed,
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
    } catch (error) {
      Alert.alert(
        "Chưa gửi được tin thoại",
        error instanceof Error ? error.message : "Ghi âm bị lỗi.",
      );
    }
  }
  const statusText = relayStatus.partnerOnline
    ? `${state.partner?.nickname || relayStatus.partnerName || "Người thương"} đang trực tuyến`
    : state.partner
      ? "Đã ghép nối — người thương chưa mở app"
      : "Chưa ghép nối (mở mục Ghép nối để nối hai máy)";
  return (
    <>
      <Card>
        <View className="flex-row items-center mb-3">
          <LocalAvatar
            name={state.partner?.nickname || "Người thương"}
            image={state.partner?.avatar ?? null}
            size={44}
          />
          <View className="ml-3 flex-1">
            <Title small>{state.partner?.nickname || "Người thương"}</Title>
            <Text className="text-xs" style={{ color: theme.sub }}>
              {statusText}
            </Text>
          </View>
          <Chip tone={relayStatus.partnerOnline ? "deep" : "soft"}>
            {relayStatus.partnerOnline ? "trực tuyến" : "chờ"}
          </Chip>
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
      </Card>
      <Card>
        <View className="flex-row items-center justify-between mb-2">
          <Title small>Tin nhắn của hai đứa</Title>
          {unread ? <Chip tone="deep">{`${unread} tin mới`}</Chip> : null}
        </View>
        {messages.length === 0 ? (
          <Note>
            Chưa có tin nào. Bấm một lời nhắn nhanh ở trên, hoặc viết vài chữ
            rồi bấm “Gửi” — máy người thương sẽ nổi thông báo như tin nhắn.
          </Note>
        ) : (
          <View>
            {messages.slice(0, 40).map((message, index, list) => {
              const mine = message.authorId === "me";
              const previous = list[index - 1];
              const showDay =
                !previous ||
                dayOf(previous.createdAt) !== dayOf(message.createdAt);
              return (
                <View key={message.id}>
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
                          <Text style={{ color: theme.ink }}>
                            {message.body}
                          </Text>
                        )}
                      </View>
                    )}
                    <Text className="text-xs mt-1" style={{ color: theme.sub }}>
                      {clockOf(message.createdAt)}
                      {mine
                        ? message.sentAt
                          ? " · đã gửi"
                          : " · đang chờ gửi"
                        : message.readAt
                          ? " · đã xem"
                          : " · mới nhận"}
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
                      <Text
                        className="text-xs mt-1"
                        style={{ color: theme.sub }}
                      >
                        xóa
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Card>
      <Card>
        <Title small>Viết cho người thương</Title>
        <Input
          label="Tin nhắn"
          value={text}
          onChangeText={setText}
          multiline
          placeholder="Hôm nay bạn thế nào?"
        />
        {showEmoji ? (
          <View
            className="flex-row flex-wrap mb-2"
            style={{
              backgroundColor: theme.soft,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 18,
              padding: 8,
            }}
          >
            {EMOJIS.map((emoji) => (
              <Pressable
                key={emoji}
                accessibilityRole="button"
                accessibilityLabel={`Chèn ${emoji}`}
                onPress={() => setText((current) => `${current}${emoji}`)}
                className="p-2"
              >
                <Text className="text-2xl">{emoji}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View className="flex-row">
          <View className="flex-1 mr-1">
            <Button
              label={showEmoji ? "Ẩn emoji" : "Emoji"}
              secondary
              onPress={() => setShowEmoji(!showEmoji)}
            />
          </View>
          <View className="flex-1 ml-1">
            <Button label="Gửi" onPress={() => send("text", text)} />
          </View>
        </View>
        <Note>
          Tin đi qua chính kênh kết nối đang có, mã hoá đầu-cuối, không cần máy
          chủ. Người thương chưa mở app thì tin nằm chờ và sang ở lần mở sau.
        </Note>
        <Button
          label="Bật thông báo để tin nhắn nổi lên như Messenger"
          secondary
          onPress={() =>
            void requestNotifications().then((granted) =>
              Alert.alert(
                granted ? "Đã bật thông báo" : "Chưa bật được thông báo",
                granted
                  ? "Máy này sẽ nổi thông báo mỗi khi người thương nhắn, gửi khoảnh khắc, viết nhật ký hoặc đổi cảm xúc."
                  : "Hãy mở Cài đặt của điện thoại → Ứng dụng → Hai Trái Tim → Thông báo và bật lên nhé.",
              ),
            )
          }
        />
      </Card>
      <Card>
        <Title small>Tin thoại cho người thương</Title>
        {recording ? (
          <>
            <Text className="text-3xl my-2" style={{ color: theme.text }}>
              ● {secondsOf(elapsed)}
            </Text>
            <Note>
              Đang ghi âm… tối đa {secondsOf(MAX_VOICE_MS)}. Bấm “Gửi tin thoại”
              để gửi, hoặc “Hủy” để bỏ.
            </Note>
            <Button
              label="Gửi tin thoại"
              onPress={() => void stopRecording(true)}
            />
            <Button
              label="Hủy"
              secondary
              onPress={() => void stopRecording(false)}
            />
          </>
        ) : (
          <>
            <Note>
              Ghi âm giọng nói của bạn rồi gửi cho người thương — họ nghe được
              ngay trong khung tin nhắn, không cần tải file.
            </Note>
            <Button
              label="Bắt đầu ghi âm"
              onPress={() => void startRecording()}
            />
          </>
        )}
      </Card>
    </>
  );
}
