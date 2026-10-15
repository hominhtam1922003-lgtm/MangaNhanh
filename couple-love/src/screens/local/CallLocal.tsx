import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Vibration,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAudioPlayer } from "expo-audio";
import { LocalAvatar } from "../../components/UI";
import ThreeHeart from "../../components/ThreeHeart";
import { useTheme } from "../../theme/ThemeContext";
import {
  CALL_BACKGROUNDS,
  callBackgroundById,
  callClock,
} from "../../logic/callLogic.mjs";
import type { CallInfo } from "../../logic/callLogic.mjs";
import { formatAudioBytes } from "../../logic/rtcSignal.mjs";
import { rtcVideoView } from "../../services/rtcCall";
import { imageUri } from "../../services/localdb";
import {
  CALL_CLOSE_MS,
  CALL_PLAY_GAP_MS,
  CALL_PREBUFFER,
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
const PLAY_TICK_MS = 90;

/** Nút tròn trên màn hình gọi Full-screen sang trọng. */
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
  const background =
    tone === "green"
      ? "#22c55e"
      : tone === "red"
        ? "#ef4444"
        : active
          ? "rgba(255, 255, 255, 0.92)"
          : "rgba(255, 255, 255, 0.18)";
  const borderColor =
    tone === "green"
      ? "#4ade80"
      : tone === "red"
        ? "#f87171"
        : active
          ? "#ffffff"
          : "rgba(255, 255, 255, 0.28)";
  return (
    <View className="items-center mx-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => ({
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: background,
          borderWidth: 1.5,
          borderColor,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.84 : 1,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        })}
      >
        <Text style={{ fontSize: size * 0.38 }}>{emoji}</Text>
      </Pressable>
      <Text
        className="text-xs mt-2 font-semibold"
        style={{ color: "#f8fafc" }}
        numberOfLines={1}
      >
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
            marginHorizontal: 2.5,
            borderRadius: 2,
            backgroundColor: color,
            opacity: 0.95,
          }}
        />
      ))}
    </View>
  );
}

/**
 * Giao diện Cuộc gọi Full-screen (Voice & Video):
 * 1. Voice Call Background: Ảnh nền đôi mờ ảo (Blur / LinearGradient overlay phía
 *    sau avatar) với bộ chủ đề lãng mạn + tuỳ chọn chọn ảnh đôi từ thư viện máy,
 *    hiển thị rõ tên, đồng hồ cuộc gọi (`00:25`) và các nút điều khiển trực quan.
 * 2. Video Call Chuẩn Zalo:
 *    - `RTCView` của `remoteStream` đặt `style={{ flex: 1, width: '100%', height: '100%' }}`
 *      và `objectFit="cover"` phủ kín toàn màn hình (không bị cụt nửa khung hay đen).
 *    - `localStream` nằm ở góc trên bên phải dạng PiP.
 *    - Nút Đổi Camera (`🔄 Đổi cam`, gọi `stream.getVideoTracks()[0]._switchCamera()`)
 *      đặt ở góc trên màn hình Video Call giống chuẩn Zalo.
 */
export default function CallLocal({
  call,
  micOn,
  camOn = false,
  speakerOn = true,
  cameraFacing = "user",
  partnerName,
  partnerAvatar,
  ringtoneUri,
  callBgId = "sunset-love",
  callBgUri = null,
  queueRef,
  playingRef,
  rtcInfo,
  rtcLive,
  rtcStreams,
  reduced = false,
  rtcAudio,
  onUseLegacyAudio,
  onToggleMic,
  onToggleCam,
  onSwitchCamera,
  onToggleSpeaker,
  onChangeCallBg,
  onPickCallBgPhoto,
  onMinimize,
  onRestore,
  onAccept,
  onReject,
  onHangUp,
}: {
  call: CallInfo;
  micOn: boolean;
  camOn?: boolean;
  speakerOn?: boolean;
  cameraFacing?: "user" | "environment";
  partnerName: string;
  partnerAvatar: string | null;
  ringtoneUri: string | null;
  callBgId?: string;
  callBgUri?: string | null;
  queueRef: React.MutableRefObject<AudioFrame[]>;
  playingRef: React.MutableRefObject<boolean>;
  rtcInfo: { state: string; detail: string };
  rtcLive: boolean;
  rtcStreams?: { localUrl: string | null; remoteUrl: string | null };
  reduced?: boolean;
  rtcAudio: {
    inBytes: number;
    outBytes: number;
    level: number;
    levelSource: string;
  };
  onUseLegacyAudio: () => void;
  onToggleMic: () => void;
  onToggleCam?: () => void;
  onSwitchCamera?: () => void;
  onToggleSpeaker?: () => void;
  onChangeCallBg?: (bgId: string) => void;
  onPickCallBgPhoto?: () => void;
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
  const [bgPickerOpen, setBgPickerOpen] = useState(false);
  const lastPlayRef = useRef(0);
  const startedRef = useRef(false);
  const pulse = useRef(new Animated.Value(0)).current;
  const beat = useRef(new Animated.Value(0)).current;
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

  // Nhịp thở của vòng hào quang avatar khi đang gọi.
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

  // Đưa mức tiếng nói WebRTC vào nhịp tim.
  useEffect(() => {
    if (!active) return;
    const next = Math.min(1, Math.max(0, Number(rtcAudio.level) || 0));
    Animated.timing(beat, {
      toValue: next,
      duration: 160,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, rtcAudio.level]);

  useEffect(() => {
    if (active) return;
    playingRef.current = false;
    startedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Đồng hồ cuộc gọi (`00:25`).
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

  useEffect(() => {
    if (!rtcLive) return;
    queueRef.current = [];
    playingRef.current = false;
    setBuffered(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rtcLive]);

  useEffect(() => {
    if (!active || rtcLive) {
      setBuffered(0);
      return;
    }
    const timer = setInterval(() => {
      playingRef.current = Boolean(incoming.playing);
      setBuffered(queueSize(queueRef.current));
      if (incoming.playing) return;
      if (!startedRef.current && queueSize(queueRef.current) < CALL_PREBUFFER)
        return;
      const now = Date.now();
      const { frame, queue } = takeFrame(
        queueRef.current,
        now,
        lastPlayRef.current,
        CALL_PLAY_GAP_MS,
      );
      if (!frame?.uri) {
        startedRef.current = false;
        return;
      }
      startedRef.current = true;
      queueRef.current = queue;
      lastPlayRef.current = now;
      try {
        incoming.replace({ uri: frame.uri });
        incoming.play();
      } catch {}
    }, PLAY_TICK_MS);
    return () => clearInterval(timer);
  }, [active, incoming, queueRef, rtcLive]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.16],
  });
  const heartScale = beat.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.34],
  });
  const haloOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.38, 0.08],
  });
  const statusText = callBarText(call, Date.now());
  const endedText = call.reason || "Cuộc gọi đã kết thúc";
  const endedLog = callLogText(call, Date.now());
  const flatUi = true;
  const RTCView = rtcVideoView();
  const isVideoCall = Boolean(
    call.video || camOn || rtcStreams?.remoteUrl || rtcStreams?.localUrl,
  );
  const hasRemoteVideo = Boolean(RTCView && rtcStreams?.remoteUrl);
  const topInset =
    Platform.OS === "android" ? (StatusBar.currentHeight ?? 28) + 12 : 52;
  const bgPreset = callBackgroundById(callBgId);
  const partnerAvatarUri = partnerAvatar ? imageUri(partnerAvatar) : null;
  const effectiveBgImageUri = callBgUri || partnerAvatarUri;

  if (call.minimized && call.phase !== "ended") {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mở lại cuộc gọi"
        onPress={onRestore}
        style={{
          marginHorizontal: 16,
          marginBottom: 8,
          borderRadius: 24,
          backgroundColor: "#111827",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.18)",
          paddingVertical: 10,
          paddingHorizontal: 14,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <LocalAvatar name={partnerName} image={partnerAvatar} size={36} />
        <View className="flex-1 ml-2.5">
          <Text className="font-semibold" style={{ color: "#f8fafc" }}>
            {partnerName} {isVideoCall ? "· 📹" : ""}
          </Text>
          <Text className="text-xs" style={{ color: "#94a3b8" }}>
            {call.phase === "active" ? `Đang gọi · ${statusText}` : statusText}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={speakerOn ? "Tắt loa ngoài" : "Bật loa ngoài"}
          onPress={() => onToggleSpeaker?.()}
          className="mr-3"
        >
          <Text className="text-lg">{speakerOn ? "🔊" : "🔈"}</Text>
        </Pressable>
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
    <Modal
      visible
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={active ? onMinimize : onHangUp}
    >
      <LinearGradient
        colors={bgPreset.colors as [string, string, string]}
        style={{
          flex: 1,
          width: "100%",
          height: "100%",
          justifyContent: "space-between",
          backgroundColor: "#090d16",
        }}
      >
        {/* 1. LỚP ẢNH NỀN ĐÔI MỜ ẢO (VOICE CALL BACKGROUND - BLUR & GRADIENT OVERLAY) */}
        {(!hasRemoteVideo || !active) && effectiveBgImageUri ? (
          <Image
            source={{ uri: effectiveBgImageUri }}
            blurRadius={callBgUri ? 12 : 22}
            resizeMode="cover"
            style={[
              StyleSheet.absoluteFillObject,
              {
                width: "100%",
                height: "100%",
                opacity: callBgUri ? 0.68 : 0.42,
              },
            ]}
          />
        ) : null}

        {/* Hiệu ứng Bokeh mờ ảo lãng mạn phía sau Avatar khi gọi thoại */}
        {!hasRemoteVideo || !active ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
            <View
              style={{
                position: "absolute",
                top: "14%",
                left: -40,
                width: 210,
                height: 210,
                borderRadius: 105,
                backgroundColor: bgPreset.accent,
                opacity: 0.16,
              }}
            />
            <View
              style={{
                position: "absolute",
                bottom: "22%",
                right: -50,
                width: 240,
                height: 240,
                borderRadius: 120,
                backgroundColor: theme.deep[1],
                opacity: 0.18,
              }}
            />
            <LinearGradient
              colors={bgPreset.overlay as [string, string, string]}
              style={StyleSheet.absoluteFillObject}
            />
          </View>
        ) : null}

        {/* 2. LUỒNG VIDEO CHÍNH FULL-SCREEN (objectFit="cover", flex: 1, width/height 100%) */}
        {isVideoCall && active && RTCView && rtcStreams?.remoteUrl ? (
          <View
            pointerEvents="none"
            style={{
              ...StyleSheet.absoluteFillObject,
              flex: 1,
              width: "100%",
              height: "100%",
              backgroundColor: "#000000",
            }}
          >
            <RTCView
              key={rtcStreams.remoteUrl}
              streamURL={rtcStreams.remoteUrl}
              objectFit="cover"
              zOrder={0}
              style={{ flex: 1, width: "100%", height: "100%" }}
            />
          </View>
        ) : null}

        {/* Lớp phủ mờ nhẹ phía trên và dưới khi có video để chữ/nút luôn sắc nét */}
        {hasRemoteVideo && active ? (
          <LinearGradient
            pointerEvents="none"
            colors={[
              "rgba(9,13,22,0.72)",
              "rgba(9,13,22,0.05)",
              "rgba(9,13,22,0.82)",
            ]}
            style={StyleSheet.absoluteFillObject}
          />
        ) : null}

        {/* LUỒNG CAMERA CÁ NHÂN (localStream) DẠNG PiP Ở GÓC TRÊN BÊN PHẢI */}
        {isVideoCall && active && RTCView && rtcStreams?.localUrl && camOn ? (
          <View
            style={{
              position: "absolute",
              top: topInset + 52,
              right: 16,
              width: 114,
              height: 164,
              borderRadius: 18,
              overflow: "hidden",
              borderWidth: 2,
              borderColor: "rgba(255, 255, 255, 0.82)",
              backgroundColor: "#1f2937",
              zIndex: 20,
              elevation: 8,
            }}
          >
            <RTCView
              key={`${rtcStreams.localUrl}-${cameraFacing}`}
              streamURL={rtcStreams.localUrl}
              mirror={cameraFacing !== "environment"}
              objectFit="cover"
              zOrder={1}
              style={{ flex: 1, width: "100%", height: "100%" }}
            />
            {onSwitchCamera ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đổi camera trên khung PiP"
                onPress={onSwitchCamera}
                style={{
                  position: "absolute",
                  bottom: 6,
                  right: 6,
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: "rgba(9, 13, 22, 0.72)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.35)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 14 }}>🔄</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* THANH ĐẦU FULL-SCREEN: Nhãn cuộc gọi + Nút Đổi Camera (góc trên chuẩn Zalo) + Đổi Ảnh nền + Thu nhỏ */}
        <View
          style={{ paddingTop: topInset, paddingHorizontal: 16, zIndex: 25 }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.15)",
                borderRadius: 18,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.24)",
              }}
            >
              <Text
                className="text-xs font-semibold"
                style={{ color: "#f8fafc" }}
              >
                {isVideoCall ? "📹 Cuộc gọi Video" : "📞 Cuộc gọi Thoại"} ·{" "}
                {speakerOn ? "🔊 Loa ngoài" : "🔈 Loa trong"}
              </Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {/* Nút Đổi Camera trước/sau ở góc trên màn hình Video Call (Chuẩn Zalo) */}
              {(isVideoCall || camOn) && onSwitchCamera ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Đổi camera trước sau"
                  onPress={onSwitchCamera}
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.18)",
                    borderRadius: 18,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    marginRight: 8,
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.28)",
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: "#f8fafc" }}
                  >
                    🔄 Đổi cam
                  </Text>
                </Pressable>
              ) : null}

              {/* Nút cài đặt Ảnh nền cuộc gọi đôi mờ ảo */}
              {!hasRemoteVideo && (onChangeCallBg || onPickCallBgPhoto) ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Chọn ảnh nền cuộc gọi"
                  onPress={() => setBgPickerOpen((prev) => !prev)}
                  style={{
                    backgroundColor: bgPickerOpen
                      ? "rgba(244, 114, 182, 0.35)"
                      : "rgba(255, 255, 255, 0.15)",
                    borderRadius: 18,
                    paddingHorizontal: 11,
                    paddingVertical: 6,
                    marginRight: active ? 8 : 0,
                    borderWidth: 1,
                    borderColor: bgPickerOpen
                      ? "#f472b6"
                      : "rgba(255, 255, 255, 0.24)",
                  }}
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: "#f8fafc" }}
                  >
                    🖼️ Ảnh nền
                  </Text>
                </Pressable>
              ) : null}

              {active ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Thu nhỏ"
                  onPress={onMinimize}
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.15)",
                    borderRadius: 18,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.24)",
                  }}
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: "#f8fafc" }}
                  >
                    ⤡ Thu nhỏ
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Thanh chọn nhanh Ảnh nền cuộc gọi đôi dễ thương */}
          {bgPickerOpen && !hasRemoteVideo ? (
            <View
              style={{
                marginTop: 10,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 18,
                backgroundColor: "rgba(9, 13, 22, 0.84)",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.22)",
              }}
            >
              <Text
                className="text-xs font-semibold mb-2"
                style={{ color: "#f8fafc" }}
              >
                Chọn ảnh nền cuộc gọi đôi (hiệu ứng mờ ảo phía sau avatar):
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {CALL_BACKGROUNDS.map((preset) => {
                  const selected = bgPreset.id === preset.id;
                  return (
                    <Pressable
                      key={preset.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Ảnh nền ${preset.name}`}
                      onPress={() => {
                        if (preset.id === "custom" && onPickCallBgPhoto) {
                          onPickCallBgPhoto();
                        } else {
                          onChangeCallBg?.(preset.id);
                        }
                      }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 14,
                        marginRight: 8,
                        backgroundColor: selected
                          ? preset.accent
                          : "rgba(255,255,255,0.12)",
                        borderWidth: 1,
                        borderColor: selected
                          ? "#ffffff"
                          : "rgba(255,255,255,0.2)",
                      }}
                    >
                      <Text
                        className="text-xs font-bold"
                        style={{ color: "#ffffff" }}
                      >
                        {preset.emoji} {preset.name}
                      </Text>
                    </Pressable>
                  );
                })}
                {onPickCallBgPhoto ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Tải ảnh đôi từ máy làm nền cuộc gọi"
                    onPress={onPickCallBgPhoto}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 14,
                      backgroundColor: "rgba(244, 114, 182, 0.28)",
                      borderWidth: 1,
                      borderColor: "#f472b6",
                    }}
                  >
                    <Text
                      className="text-xs font-bold"
                      style={{ color: "#ffffff" }}
                    >
                      📸 Chọn ảnh trong máy
                    </Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            </View>
          ) : null}
        </View>

        {/* KHỐI TRUNG TÂM: Avatar lớn + Khung cảnh đôi + Tên đối phương + Đồng hồ 00:25 sắc nét */}
        <View
          className="items-center px-6"
          style={{
            zIndex: 10,
            marginTop: hasRemoteVideo && active ? "auto" : 0,
            marginBottom: hasRemoteVideo && active ? 16 : 0,
          }}
        >
          {!hasRemoteVideo || !active ? (
            <>
              <View
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: "rgba(255, 255, 255, 0.12)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.2)",
                  marginBottom: 14,
                }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{ color: "#fce7f3" }}
                >
                  {bgPreset.scene} {bgPreset.subtitle}
                </Text>
              </View>
              <View
                style={{
                  width: 160,
                  height: 160,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                }}
              >
                <Animated.View
                  style={{
                    position: "absolute",
                    width: 154,
                    height: 154,
                    borderRadius: 77,
                    backgroundColor: bgPreset.accent || theme.deep[1],
                    opacity: active ? haloOpacity : 0.25,
                    transform: [{ scale }],
                  }}
                />
                <Animated.View
                  style={{
                    position: "absolute",
                    width: 132,
                    height: 132,
                    borderRadius: 66,
                    borderWidth: 2,
                    borderColor: "rgba(255,255,255,0.34)",
                    transform: [{ scale }],
                  }}
                />
                {!flatUi && active && !reduced ? (
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      width: 320,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ThreeHeart
                      height={230}
                      level={active && rtcLive ? rtcAudio.level : 0}
                      interactive={false}
                    />
                  </View>
                ) : null}
                <Animated.View
                  pointerEvents="none"
                  style={{
                    transform: [
                      {
                        scale:
                          active && rtcLive ? heartScale : active ? scale : 1,
                      },
                    ],
                  }}
                >
                  <LocalAvatar
                    name={partnerName}
                    image={partnerAvatar}
                    size={114}
                  />
                </Animated.View>
              </View>
            </>
          ) : null}

          <Text
            className="text-2xl font-extrabold text-center"
            style={{ color: "#ffffff", letterSpacing: 0.3 }}
          >
            {partnerName}
          </Text>

          {/* Đồng hồ thời gian cuộc gọi `00:25` hoặc trạng thái đổ chuông */}
          <View
            style={{
              marginTop: 8,
              paddingHorizontal: 18,
              paddingVertical: 5,
              borderRadius: 999,
              backgroundColor: active
                ? "rgba(34, 197, 94, 0.18)"
                : "rgba(255, 255, 255, 0.12)",
              borderWidth: 1,
              borderColor: active
                ? "rgba(74, 222, 128, 0.45)"
                : "rgba(255, 255, 255, 0.22)",
            }}
          >
            <Text
              className="text-2xl font-bold text-center"
              style={{
                color: active ? "#4ade80" : "#e2e8f0",
                fontVariant: ["tabular-nums"],
                letterSpacing: 1,
              }}
            >
              {ringing
                ? call.role === "caller"
                  ? "Đang đổ chuông…"
                  : "Cuộc gọi đến…"
                : active
                  ? callClock(elapsed)
                  : endedText}
            </Text>
          </View>

          {active ? (
            <View className="mt-3 items-center">
              <Waveform color="#4ade80" live={micOn} />
              <Text
                className="text-xs mt-1.5 text-center"
                style={{ color: "#cbd5e1" }}
              >
                {micOn
                  ? "Nói bình thường, không cần giữ nút"
                  : "Mic đang tắt — bấm mic để nói tiếp"}
                {!rtcLive && buffered > 0
                  ? ` · đang nhận ${buffered} mảnh tiếng`
                  : ""}
              </Text>
              {rtcInfo.state !== "off" && rtcInfo.detail ? (
                <View
                  style={{
                    marginTop: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: 14,
                    backgroundColor: "rgba(255, 255, 255, 0.12)",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.2)",
                  }}
                >
                  <Text
                    className="text-xs font-medium"
                    style={{
                      color: rtcLive ? "#4ade80" : "#e2e8f0",
                    }}
                  >
                    {rtcLive ? "● " : "○ "}
                    {rtcInfo.detail}
                  </Text>
                </View>
              ) : null}
              {rtcLive ? (
                <Text className="text-xs mt-1.5" style={{ color: "#94a3b8" }}>
                  Tiếng vào {formatAudioBytes(rtcAudio.inBytes)} · tiếng ra{" "}
                  {formatAudioBytes(rtcAudio.outBytes)} · lọc ồn & chống vang
                </Text>
              ) : null}
              {rtcLive ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Nghe không được, dùng đường tiếng thường"
                  onPress={onUseLegacyAudio}
                  className="mt-2 px-3.5 py-1.5 rounded-full"
                  style={{
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.22)",
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                  }}
                >
                  <Text className="text-xs" style={{ color: "#e2e8f0" }}>
                    Nghe không được? Chuyển sang đường tiếng dự phòng
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {call.phase === "ended" ? (
            <Text className="text-xs mt-2" style={{ color: "#94a3b8" }}>
              {endedLog} · tự đóng sau {Math.round(CALL_CLOSE_MS / 1000)} giây
            </Text>
          ) : null}
        </View>

        {/* THANH CÔNG CỤ DƯỚI CÙNG FULL-SCREEN */}
        <View
          style={{
            paddingBottom: Platform.OS === "ios" ? 46 : 36,
            paddingHorizontal: 20,
            zIndex: 10,
          }}
        >
          {ringing && call.role === "callee" ? (
            /* Cuộc gọi đến: Tách rời nút Từ chối (Đỏ rực) và Nghe (Xanh lá) hai bên */
            <View
              className="flex-row items-center"
              style={{
                width: "100%",
                paddingHorizontal: 42,
                justifyContent: "space-between",
              }}
            >
              <CallButton
                emoji="📵"
                label="Từ chối"
                tone="red"
                size={76}
                onPress={onReject}
              />
              <CallButton
                emoji="📞"
                label="Nghe"
                tone="green"
                size={76}
                onPress={onAccept}
              />
            </View>
          ) : ringing ? (
            <View className="flex-row justify-center items-end mt-5">
              <CallButton
                emoji={micOn ? "🎙" : "🔇"}
                label={micOn ? "Tắt mic" : "Bật mic"}
                tone="soft"
                active={!micOn}
                size={62}
                onPress={onToggleMic}
              />
              <CallButton
                emoji={speakerOn ? "🔊" : "🔈"}
                label={speakerOn ? "Loa ngoài" : "Loa trong"}
                tone="soft"
                active={speakerOn}
                size={62}
                onPress={() => onToggleSpeaker?.()}
              />
              <CallButton
                emoji="📴"
                label="Kết thúc"
                tone="red"
                size={76}
                onPress={onHangUp}
              />
              <CallButton
                emoji={camOn ? "📹" : "📷"}
                label={camOn ? "Tắt cam" : "Bật cam"}
                tone="soft"
                active={camOn}
                size={62}
                onPress={() => onToggleCam?.()}
              />
            </View>
          ) : active ? (
            <View className="flex-row justify-center items-end mt-6">
              <CallButton
                emoji={micOn ? "🎙" : "🔇"}
                label={micOn ? "Tắt mic" : "Bật mic"}
                tone="soft"
                active={!micOn}
                size={68}
                onPress={onToggleMic}
              />
              <CallButton
                emoji={speakerOn ? "🔊" : "🔈"}
                label={speakerOn ? "Loa ngoài" : "Loa trong"}
                tone="soft"
                active={speakerOn}
                size={64}
                onPress={() => onToggleSpeaker?.()}
              />
              <CallButton
                emoji="📴"
                label="Kết thúc"
                tone="red"
                size={80}
                onPress={onHangUp}
              />
              <CallButton
                emoji={camOn ? "📹" : "📷"}
                label={camOn ? "Tắt cam" : "Bật cam"}
                tone="soft"
                active={camOn}
                size={64}
                onPress={() => onToggleCam?.()}
              />
            </View>
          ) : (
            <View className="flex-row justify-center">
              <CallButton
                emoji="✖"
                label="Đóng"
                tone="soft"
                onPress={onHangUp}
              />
            </View>
          )}
        </View>
      </LinearGradient>
    </Modal>
  );
}
