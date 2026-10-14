import React, { useState } from "react";
import { Alert, Image, Linking, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

import { LocalAvatar } from "./UI";
import { useTheme } from "../theme/ThemeContext";
import { imageUri } from "../services/localdb";
import { isRecalled, reactList, recallText } from "../logic/chatExtras.mjs";
import type { State } from "../services/localdb";

/**
 * Một dòng tin nhắn. Tách riêng và nhớ sẵn (React.memo) để khi bạn đang gõ chữ
 * trong ô nhắn, cả bảng tin không phải vẽ lại từng dòng — app mượt hơn hẳn.
 */
/** Giờ gửi tin, kiểu Việt Nam: 09:41. */
const clockOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
/** Ngày gửi tin, kiểu Việt Nam. */
const dayOf = (iso: string) => new Date(iso).toLocaleDateString("vi-VN");
/** Độ dài tin thoại: 3″ */
const secondsOf = (ms: number) => `${Math.max(1, Math.round(ms / 1000))}″`;

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

export const MessageRow = React.memo(function MessageRow({
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
