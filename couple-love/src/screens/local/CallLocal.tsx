import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Pressable,
  Text,
  View,
  Vibration,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
} from "expo-audio";
import { LocalAvatar, Note } from "../../components/UI";
import { useTheme } from "../../theme/ThemeContext";
import { imageUri } from "../../services/localdb";
import type { State } from "../../services/localdb";
import { callClock, callSeconds } from "../../logic/callLogic.mjs";
import type { CallInfo } from "../../logic/callLogic.mjs";

const RING = require("../../../assets/ring.wav");
const MAX_TALK_MS = 25000;
const clock = (seconds: number) => callClock(seconds);

/** Nút tròn cho màn hình gọi. */
function CallButton({
  emoji,
  label,
  onPress,
  tone = "soft",
  size = 62,
}: {
  emoji: string;
  label: string;
  onPress: () => void;
  tone?: "soft" | "green" | "red" | "deep";
  size?: number;
}) {
  const { theme } = useTheme();
  const background =
    tone === "green"
      ? "#22c55e"
      : tone === "red"
        ? "#ef4444"
        : tone === "deep"
          ? theme.deep[1]
          : theme.soft;
  const color =
    tone === "soft" ? theme.ink : tone === "deep" ? theme.onDeep : "#ffffff";
  return (
    <View className="items-center mx-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: background,
          borderWidth: tone === "soft" ? 1 : 0,
          borderColor: theme.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: size * 0.42 }}>{emoji}</Text>
      </Pressable>
      <Text className="text-xs mt-1" style={{ color: theme.ink }}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Cuộc gọi giữa hai máy trên chính kênh ghép nối:
 * · Bên gọi bấm Gọi → máy kia đổ chuông (kêu + rung như Messenger/Zalo).
 * · Nghe/Từ chối, bật tắt mic, thu nhỏ cửa sổ, kết thúc.
 * · Nói chuyện: giữ nút 🎙 để nói, nhả ra là tin thoại bay sang máy kia và tự
 *   phát lên loa — nhanh như bộ đàm, không cần máy chủ nào.
 */
export default function CallLocal({
  call,
  state,
  micOn,
  partnerName,
  partnerAvatar,
  onToggleMic,
  onMinimize,
  onRestore,
  onAccept,
  onReject,
  onHangUp,
  onSendVoice,
  tick,
}: {
  call: CallInfo;
  state: State;
  micOn: boolean;
  partnerName: string;
  partnerAvatar: string | null;
  onToggleMic: () => void;
  onMinimize: () => void;
  onRestore: () => void;
  onAccept: () => void;
  onReject: () => void;
  onHangUp: () => void;
  onSendVoice: (uri: string, durationMs: number) => void;
  tick: number;
}) {
  const { theme } = useTheme();
  const ringtone = useAudioPlayer(RING);
  const incoming = useAudioPlayer(undefined);
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const [elapsed, setElapsed] = useState(0);
  const [recording, setRecording] = useState(false);
  const startedAtRef = useRef(0);
  const pulse = useRef(new Animated.Value(0)).current;
  const seconds = callSeconds(call, Date.now() + tick * 0);
  const active = call.phase === "active";

  // Chuông reo khi có người gọi tới, kèm rung — tắt ngay khi nghe/từ chối.
  useEffect(() => {
    if (call.phase === "ringing" && call.role === "callee") {
      try {
        ringtone.loop = true;
        ringtone.volume = 1;
        ringtone.play();
      } catch {}
      Vibration.vibrate([0, 600, 400, 600], true);
      return () => {
        try {
          ringtone.pause();
        } catch {}
        Vibration.cancel();
      };
    }
    try {
      ringtone.pause();
    } catch {}
    Vibration.cancel();
    return undefined;
  }, [call.phase, call.role, call.id, ringtone]);

  // Nhịp thở của vòng tròn avatar khi đang gọi.
  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  // Đang trong cuộc gọi thì tin thoại của người thương tự phát lên loa.
  const latestVoice = (state.messages ?? []).find(
    (message) =>
      message.authorId === "partner" &&
      message.kind === "voice" &&
      message.audio,
  );
  const playedRef = useRef("");
  useEffect(() => {
    if (!active || !latestVoice?.audio) return;
    if (playedRef.current === latestVoice.id) return;
    playedRef.current = latestVoice.id;
    try {
      incoming.replace({ uri: imageUri(latestVoice.audio) ?? "" });
      incoming.play();
    } catch {}
  }, [active, latestVoice?.id, latestVoice?.audio, incoming]);

  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    const timer = setInterval(
      () => setElapsed(callSeconds(call, Date.now())),
      500,
    );
    return () => clearInterval(timer);
  }, [active, call]);

  async function startTalking() {
    if (!micOn) {
      Alert.alert(
        "Mic đang tắt",
        "Bấm nút “Mic đang tắt” để bật mic rồi giữ để nói nhé.",
      );
      return;
    }
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Cần quyền ghi âm",
          "Hãy cho phép dùng micro để nói trong cuộc gọi.",
        );
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAtRef.current = Date.now();
      setRecording(true);
    } catch (error) {
      Alert.alert(
        "Chưa nói được",
        error instanceof Error ? error.message : "Máy này không ghi âm được.",
      );
    }
  }
  async function stopTalking(sendIt: boolean) {
    const began = startedAtRef.current;
    setRecording(false);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
      if (!sendIt || !uri) return;
      onSendVoice(uri, Math.min(MAX_TALK_MS, Date.now() - began || 1000));
    } catch (error) {
      Alert.alert(
        "Chưa gửi được tiếng nói",
        error instanceof Error ? error.message : "Ghi âm bị lỗi.",
      );
    }
  }

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });
  const duration = Math.max(elapsed, seconds);
  const statusText =
    call.phase === "ringing"
      ? call.role === "caller"
        ? "Đang đổ chuông…"
        : "Đang gọi cho bạn…"
      : call.phase === "active"
        ? clock(duration)
        : call.reason || "Cuộc gọi đã kết thúc";

  if (call.minimized && call.phase !== "ended") {
    // Thu nhỏ: thanh nổi vẫn thấy khi mở tab khác, chạm để mở lại.
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mở lại cuộc gọi"
        onPress={onRestore}
        style={{
          marginHorizontal: 16,
          marginBottom: 8,
          borderRadius: 24,
          backgroundColor: theme.glass,
          borderWidth: 1,
          borderColor: theme.border,
          paddingVertical: 8,
          paddingHorizontal: 12,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Text className="text-xl mr-2" style={{ color: theme.text }}>
          {call.phase === "active" ? "🟢" : "📞"}
        </Text>
        <Text className="flex-1 font-semibold" style={{ color: theme.ink }}>
          {partnerName} · {statusText}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={micOn ? "Tắt mic" : "Bật mic"}
          onPress={onToggleMic}
          className="mr-2 px-2"
        >
          <Text className="text-xl">{micOn ? "🎙" : "🔇"}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kết thúc cuộc gọi"
          onPress={onHangUp}
          className="px-2"
        >
          <Text className="text-xl">📴</Text>
        </Pressable>
      </Pressable>
    );
  }

  return (
    <View style={{ marginHorizontal: 16, marginBottom: 8 }}>
      <LinearGradient
        colors={theme.dark ? [theme.surface, theme.bg[0]] : theme.deep}
        style={{
          borderRadius: 26,
          padding: 16,
          borderWidth: 1,
          borderColor: theme.border,
          shadowColor: theme.glow,
          shadowOpacity: 0.3,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6,
        }}
      >
        <View className="flex-row items-center">
          <Animated.View style={{ transform: [{ scale }] }}>
            <LocalAvatar name={partnerName} image={partnerAvatar} size={56} />
          </Animated.View>
          <View className="ml-3 flex-1">
            <Text
              className="text-lg font-bold"
              style={{ color: theme.dark ? theme.ink : "#ffffff" }}
            >
              {partnerName}
            </Text>
            <Text style={{ color: theme.dark ? theme.sub : "#ffffffcc" }}>
              {statusText}
            </Text>
          </View>
          {call.phase !== "ended" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Thu nhỏ cuộc gọi"
              onPress={onMinimize}
              className="px-2 py-1"
            >
              <Text
                className="text-lg"
                style={{ color: theme.dark ? theme.text : "#ffffff" }}
              >
                ⤡ Thu nhỏ
              </Text>
            </Pressable>
          ) : null}
        </View>

        {call.phase === "ringing" && call.role === "callee" ? (
          <View className="flex-row justify-center mt-4">
            <CallButton
              emoji="📴"
              label="Từ chối"
              tone="red"
              onPress={onReject}
            />
            <CallButton
              emoji="📞"
              label="Nghe"
              tone="green"
              onPress={onAccept}
            />
          </View>
        ) : call.phase === "ringing" ? (
          <View className="flex-row justify-center mt-4">
            <CallButton
              emoji="📴"
              label="Kết thúc"
              tone="red"
              onPress={onHangUp}
            />
            <CallButton
              emoji={micOn ? "🎙" : "🔇"}
              label={micOn ? "Mic đang bật" : "Mic đang tắt"}
              tone="soft"
              onPress={onToggleMic}
            />
          </View>
        ) : call.phase === "active" ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Giữ để nói"
              onPressIn={() => void startTalking()}
              onPressOut={() => void stopTalking(true)}
              style={{
                marginTop: 14,
                borderRadius: 22,
                paddingVertical: 16,
                alignItems: "center",
                backgroundColor: recording
                  ? "#ef4444"
                  : theme.dark
                    ? theme.soft
                    : "#ffffff22",
                borderWidth: 1,
                borderColor: theme.dark ? theme.border : "#ffffff55",
              }}
            >
              <Text
                className="text-2xl font-bold"
                style={{ color: theme.dark ? theme.ink : "#ffffff" }}
              >
                {recording ? "● Đang nói… nhả ra để gửi" : "🎙 Giữ để nói"}
              </Text>
            </Pressable>
            <View className="flex-row justify-center mt-4">
              <CallButton
                emoji={micOn ? "🎙" : "🔇"}
                label={micOn ? "Tắt mic" : "Bật mic"}
                tone="soft"
                onPress={onToggleMic}
              />
              <CallButton
                emoji="⤡"
                label="Thu nhỏ"
                tone="soft"
                onPress={onMinimize}
              />
              <CallButton
                emoji="📴"
                label="Kết thúc"
                tone="red"
                onPress={onHangUp}
              />
            </View>
            <Note>
              {micOn
                ? "Cách nói: giữ nút “Giữ để nói”, nói xong nhả ra — máy người thương phát lên loa ngay. Tin thoại cũng nằm trong mục Tin nhắn."
                : "Mic đang tắt nên không ghi âm được. Bấm “Bật mic” khi bạn muốn nói."}
            </Note>
          </>
        ) : (
          <View className="flex-row justify-center mt-4">
            <CallButton emoji="✖" label="Đóng" tone="soft" onPress={onHangUp} />
          </View>
        )}
      </LinearGradient>
    </View>
  );
}
