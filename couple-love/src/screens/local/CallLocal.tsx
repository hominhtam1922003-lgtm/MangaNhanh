import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  Text,
  View,
  Vibration,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAudioPlayer } from "expo-audio";
import { LocalAvatar, Note } from "../../components/UI";
import { useTheme } from "../../theme/ThemeContext";
import { callClock } from "../../logic/callLogic.mjs";
import type { CallInfo } from "../../logic/callLogic.mjs";
import {
  CALL_CLOSE_MS,
  CALL_PLAY_GAP_MS,
  callBarText,
  callLogText,
  queueSize,
  takeFrame,
} from "../../logic/callAudio.mjs";
import type { AudioFrame } from "../../logic/callAudio.mjs";

/** Nhạc chuông mặc định có sẵn trong app; người dùng có thể thay bằng nhạc trong máy. */
const RINGTONE = require("../../../assets/ringtone.wav");
/** Hồi chuông cho bên GỌI — cả hai máy cùng nghe chuông như gọi thường. */
const RINGBACK = require("../../../assets/ringback.wav");
/** Nhịp phát lại tiếng của người thương. */
const PLAY_TICK_MS = 180;

/** Nút tròn trên màn hình gọi. */
function CallButton({
  emoji,
  label,
  onPress,
  tone = "soft",
  size = 64,
  active = false,
}: {
  emoji: string;
  label: string;
  onPress: () => void;
  tone?: "soft" | "green" | "red" | "deep";
  size?: number;
  active?: boolean;
}) {
  const { theme } = useTheme();
  const background =
    tone === "green"
      ? "#22c55e"
      : tone === "red"
        ? "#ef4444"
        : tone === "deep"
          ? theme.deep[1]
          : active
            ? theme.deep[0]
            : theme.soft;
  const color =
    tone === "soft" && !active
      ? theme.ink
      : tone === "deep"
        ? theme.onDeep
        : "#ffffff";
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
          borderWidth: tone === "soft" && !active ? 1 : 0,
          borderColor: theme.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: size * 0.4 }}>{emoji}</Text>
      </Pressable>
      <Text className="text-xs mt-1" style={{ color: theme.ink }}>
        {label}
      </Text>
    </View>
  );
}

/** Vòng sóng nhỏ chạy khi đang nói (nhìn là biết máy đang truyền tiếng). */
function Waveform({ color, live }: { color: string; live: boolean }) {
  const bars = [0, 1, 2, 3, 4];
  const [heights, setHeights] = useState([6, 12, 18, 10, 6]);
  useEffect(() => {
    if (!live) {
      setHeights([6, 6, 6, 6, 6]);
      return;
    }
    const timer = setInterval(() => {
      setHeights(bars.map(() => 5 + Math.round(Math.random() * 22)));
    }, 200);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);
  return (
    <View className="flex-row items-end" style={{ height: 30 }}>
      {heights.map((height, index) => (
        <View
          key={index}
          style={{
            width: 4,
            height,
            marginHorizontal: 2,
            borderRadius: 2,
            backgroundColor: color,
            opacity: 0.9,
          }}
        />
      ))}
    </View>
  );
}

/**
 * Cuộc gọi giữa hai máy trên chính kênh ghép nối (không cần máy chủ):
 * · Bên gọi bấm Gọi → máy kia đổ chuông, CẢ HAI cùng nghe chuông (bên gọi nghe
 *   hồi chuông “tu… tu…”, bên nhận nghe nhạc chuông — có thể chọn nhạc trong máy).
 * · Nghe/Từ chối, bật tắt mic, thu nhỏ cửa sổ, kết thúc.
 * · Nói chuyện: hai bên nói liên tục, KHÔNG cần giữ nút — tiếng được cắt thành
 *   từng mảnh ngắn, gửi tới máy kia rồi tự phát lên loa.
 */
export default function CallLocal({
  call,
  micOn,
  partnerName,
  partnerAvatar,
  ringtoneUri,
  queueRef,
  onToggleMic,
  onMinimize,
  onRestore,
  onAccept,
  onReject,
  onHangUp,
}: {
  call: CallInfo;
  micOn: boolean;
  partnerName: string;
  partnerAvatar: string | null;
  ringtoneUri: string | null;
  queueRef: React.MutableRefObject<AudioFrame[]>;
  onToggleMic: () => void;
  onMinimize: () => void;
  onRestore: () => void;
  onAccept: () => void;
  onReject: () => void;
  onHangUp: () => void;
}) {
  const { theme } = useTheme();
  const ringtone = useAudioPlayer(
    ringtoneUri ? { uri: ringtoneUri } : RINGTONE,
  );
  const ringback = useAudioPlayer(RINGBACK);
  const incoming = useAudioPlayer(undefined);
  const [elapsed, setElapsed] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const lastPlayRef = useRef(0);
  const pulse = useRef(new Animated.Value(0)).current;
  const active = call.phase === "active";
  const ringing = call.phase === "ringing";

  // Cả hai máy cùng nghe chuông khi một bên bấm gọi.
  useEffect(() => {
    if (!ringing) {
      try {
        ringtone.pause();
        ringback.pause();
      } catch {}
      Vibration.cancel();
      return undefined;
    }
    if (call.role === "callee") {
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
    // Bên gọi: hồi chuông như tổng đài, không rung.
    try {
      ringback.loop = true;
      ringback.volume = 1;
      ringback.play();
    } catch {}
    return () => {
      try {
        ringback.pause();
      } catch {}
    };
  }, [ringing, call.role, call.id, ringtone, ringback]);

  // Nhịp thở của vòng tròn avatar khi đang gọi.
  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  // Đồng hồ cuộc gọi.
  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    const timer = setInterval(
      () =>
        setElapsed(
          Math.max(0, Math.floor((Date.now() - call.startedAt) / 1000)),
        ),
      500,
    );
    return () => clearInterval(timer);
  }, [active, call.startedAt]);

  // Phát tiếng của người thương: lấy từng mảnh trong hàng đợi, phát lên loa.
  useEffect(() => {
    if (!active) {
      setBuffered(0);
      return;
    }
    const timer = setInterval(() => {
      setBuffered(queueSize(queueRef.current));
      if (incoming.playing) return;
      const now = Date.now();
      const { frame, queue } = takeFrame(
        queueRef.current,
        now,
        lastPlayRef.current,
        CALL_PLAY_GAP_MS,
      );
      if (!frame?.uri) return;
      queueRef.current = queue;
      lastPlayRef.current = now;
      try {
        incoming.replace({ uri: frame.uri });
        incoming.play();
      } catch {}
    }, PLAY_TICK_MS);
    return () => clearInterval(timer);
  }, [active, incoming, queueRef]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.14],
  });
  const haloOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.06],
  });
  const statusText = callBarText(call, Date.now());
  const endedText = call.reason || "Cuộc gọi đã kết thúc";
  const endedLog = callLogText(call, Date.now());

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
          borderRadius: 26,
          backgroundColor: theme.glass,
          borderWidth: 1,
          borderColor: theme.border,
          paddingVertical: 8,
          paddingHorizontal: 12,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <LocalAvatar name={partnerName} image={partnerAvatar} size={34} />
        <View className="flex-1 ml-2">
          <Text className="font-semibold" style={{ color: theme.ink }}>
            {partnerName}
          </Text>
          <Text className="text-xs" style={{ color: theme.sub }}>
            {call.phase === "active" ? `Đang gọi · ${statusText}` : statusText}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={micOn ? "Tắt mic" : "Bật mic"}
          onPress={onToggleMic}
          className="mr-3"
        >
          <Text className="text-xl">{micOn ? "🎙" : "🔇"}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kết thúc cuộc gọi"
          onPress={onHangUp}
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
          borderRadius: 30,
          paddingVertical: 18,
          paddingHorizontal: 16,
          borderWidth: 1,
          borderColor: theme.border,
          shadowColor: theme.glow,
          shadowOpacity: 0.35,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 10 },
          elevation: 8,
        }}
      >
        {/* Hàng trên: người thương + trạng thái */}
        <View className="items-center">
          <View
            style={{
              width: 132,
              height: 132,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Animated.View
              style={{
                position: "absolute",
                width: 132,
                height: 132,
                borderRadius: 66,
                backgroundColor: theme.glow,
                opacity: active ? haloOpacity : 0.14,
                transform: [{ scale }],
              }}
            />
            <Animated.View
              style={{ transform: [{ scale: active ? scale : 1 }] }}
            >
              <LocalAvatar name={partnerName} image={partnerAvatar} size={92} />
            </Animated.View>
          </View>
          <Text
            className="text-xl font-bold mt-2"
            style={{ color: theme.dark ? theme.ink : "#ffffff" }}
          >
            {partnerName}
          </Text>
          <Text
            className="text-base mt-1"
            style={{ color: theme.dark ? theme.sub : "#ffffffcc" }}
          >
            {ringing
              ? call.role === "caller"
                ? "Đang đổ chuông…"
                : "Đang gọi cho bạn…"
              : active
                ? callClock(elapsed)
                : endedText}
          </Text>
          {active ? (
            <View className="mt-2 items-center">
              <Waveform
                color={theme.dark ? theme.deep[1] : "#ffffff"}
                live={micOn}
              />
              <Text
                className="text-xs mt-1"
                style={{ color: theme.dark ? theme.sub : "#ffffffcc" }}
              >
                {micOn
                  ? "Nói bình thường, không cần giữ nút"
                  : "Mic đang tắt — bấm mic để nói tiếp"}
                {buffered > 0 ? ` · đang nhận ${buffered} mảnh tiếng` : ""}
              </Text>
            </View>
          ) : null}
          {call.phase === "ended" ? (
            <Text
              className="text-xs mt-1"
              style={{ color: theme.dark ? theme.sub : "#ffffffcc" }}
            >
              {endedLog} · tự đóng sau {Math.round(CALL_CLOSE_MS / 1000)} giây
            </Text>
          ) : null}
        </View>

        {/* Hàng nút */}
        {ringing && call.role === "callee" ? (
          <View className="flex-row justify-center mt-5">
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
        ) : ringing ? (
          <View className="flex-row justify-center mt-5">
            <CallButton
              emoji={micOn ? "🎙" : "🔇"}
              label={micOn ? "Đang bật mic" : "Đang tắt mic"}
              tone="soft"
              size={58}
              onPress={onToggleMic}
            />
            <CallButton
              emoji="📴"
              label="Kết thúc"
              tone="red"
              size={72}
              onPress={onHangUp}
            />
          </View>
        ) : active ? (
          <View className="flex-row justify-center mt-5">
            <CallButton
              emoji={micOn ? "🎙" : "🔇"}
              label={micOn ? "Tắt mic" : "Bật mic"}
              tone="soft"
              active={!micOn}
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
              size={72}
              onPress={onHangUp}
            />
          </View>
        ) : (
          <View className="flex-row justify-center mt-5">
            <CallButton emoji="✖" label="Đóng" tone="soft" onPress={onHangUp} />
          </View>
        )}

        {active ? (
          <View className="mt-3">
            <Note>
              Tiếng nói được gửi liên tục qua kênh ghép nối (từng mảnh ngắn) nên
              hai bạn nói chuyện tự nhiên; máy yếu hoặc mạng chậm có thể nghe
              ngắt quãng vài chỗ.
            </Note>
          </View>
        ) : null}
      </LinearGradient>
    </View>
  );
}
