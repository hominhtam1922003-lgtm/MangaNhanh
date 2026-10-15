import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../theme/ThemeContext";
import {
  PET_GIFTS,
  PET_SPEECH_BUBBLES,
  computePetStatus,
} from "../../logic/pet.mjs";
import type { State } from "../../services/localdb";

/**
 * Nhân vật Chú Vịt trắng mỏ cam / Mèo trắng phẳng 2D (Flat UI kiểu Widgetable):
 * hoàn toàn bằng các khối bo tròn mềm mại, không dùng 3D WebGL nên siêu nhẹ.
 */
function CutePetAvatar({
  species,
  mood,
  blinking,
  sleeping,
  reaction,
  accentColor,
}: {
  species: "duck" | "cat";
  mood: string;
  blinking: boolean;
  sleeping: boolean;
  reaction: string;
  accentColor: string;
}) {
  const isCat = species === "cat";
  return (
    <View
      style={{
        width: 190,
        height: 195,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Bóng đổ phẳng mềm dưới chân trên thảm */}
      <View
        style={{
          position: "absolute",
          bottom: 8,
          width: 126,
          height: 24,
          borderRadius: 63,
          backgroundColor: "rgba(0,0,0,0.08)",
        }}
      />

      {/* Hai bàn chân cam nhỏ nhắn */}
      <View
        style={{
          position: "absolute",
          bottom: 14,
          flexDirection: "row",
          width: 68,
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            width: 24,
            height: 14,
            borderRadius: 10,
            backgroundColor: "#fb923c",
            transform: [{ rotate: "-8deg" }],
          }}
        />
        <View
          style={{
            width: 24,
            height: 14,
            borderRadius: 10,
            backgroundColor: "#fb923c",
            transform: [{ rotate: "8deg" }],
          }}
        />
      </View>

      {/* Chỏm lông đỉnh đầu (Vịt) hoặc đôi tai hồng (Mèo) */}
      {isCat ? (
        <View
          style={{
            position: "absolute",
            top: 16,
            width: 118,
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 8,
              borderBottomLeftRadius: 8,
              backgroundColor: "#ffffff",
              borderWidth: 2.5,
              borderColor: "#f3e8ff",
              transform: [{ rotate: "-18deg" }],
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 16,
                height: 16,
                borderRadius: 6,
                backgroundColor: "#fda4af",
              }}
            />
          </View>
          <View
            style={{
              width: 34,
              height: 34,
              borderTopRightRadius: 18,
              borderTopLeftRadius: 8,
              borderBottomRightRadius: 8,
              backgroundColor: "#ffffff",
              borderWidth: 2.5,
              borderColor: "#f3e8ff",
              transform: [{ rotate: "18deg" }],
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 16,
                height: 16,
                borderRadius: 6,
                backgroundColor: "#fda4af",
              }}
            />
          </View>
        </View>
      ) : (
        <View
          style={{
            position: "absolute",
            top: 12,
            flexDirection: "row",
            alignItems: "flex-end",
          }}
        >
          <View
            style={{
              width: 16,
              height: 22,
              borderRadius: 10,
              backgroundColor: "#ffffff",
              transform: [{ rotate: "-18deg" }],
              marginRight: -4,
            }}
          />
          <View
            style={{
              width: 14,
              height: 18,
              borderRadius: 9,
              backgroundColor: "#fffbeb",
              transform: [{ rotate: "14deg" }],
            }}
          />
        </View>
      )}

      {/* Hai cánh trắng tròn hai bên hông */}
      <View
        style={{
          position: "absolute",
          width: 168,
          top: 78,
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            width: 28,
            height: 52,
            borderRadius: 18,
            backgroundColor: "#fffefc",
            borderWidth: 2,
            borderColor: "#f1f5f9",
            transform: [
              { rotate: reaction ? "-28deg" : "14deg" },
              { translateY: reaction ? -6 : 0 },
            ],
          }}
        />
        <View
          style={{
            width: 28,
            height: 52,
            borderRadius: 18,
            backgroundColor: "#fffefc",
            borderWidth: 2,
            borderColor: "#f1f5f9",
            transform: [
              { rotate: reaction ? "28deg" : "-14deg" },
              { translateY: reaction ? -6 : 0 },
            ],
          }}
        />
      </View>

      {/* Thân tròn mũm mĩm màu trắng kem */}
      <View
        style={{
          width: 138,
          height: 142,
          borderRadius: 68,
          backgroundColor: "#ffffff",
          borderWidth: 3,
          borderColor: "#f8fafc",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: 6,
        }}
      >
        {/* Phụ kiện nhỏ trên đầu theo trạng thái */}
        <View style={{ position: "absolute", top: 8, right: 22 }}>
          <Text style={{ fontSize: 18 }}>
            {sleeping
              ? "💤"
              : reaction === "feed"
                ? "🍓"
                : reaction === "bath"
                  ? "🫧"
                  : "🌱"}
          </Text>
        </View>

        {/* Đôi mắt tròn long lanh (hoặc nhắm khi ngủ/chớp mắt) */}
        <View
          style={{
            flexDirection: "row",
            width: 68,
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 6,
          }}
        >
          {sleeping || blinking ? (
            <>
              <View
                style={{
                  width: 16,
                  height: 3.5,
                  borderRadius: 2,
                  backgroundColor: "#1e293b",
                }}
              />
              <View
                style={{
                  width: 16,
                  height: 3.5,
                  borderRadius: 2,
                  backgroundColor: "#1e293b",
                }}
              />
            </>
          ) : mood === "sulky" ? (
            <>
              <View
                style={{
                  width: 15,
                  height: 15,
                  borderRadius: 8,
                  backgroundColor: "#1e293b",
                  transform: [{ scaleY: 0.75 }],
                }}
              />
              <View
                style={{
                  width: 15,
                  height: 15,
                  borderRadius: 8,
                  backgroundColor: "#1e293b",
                  transform: [{ scaleY: 0.75 }],
                }}
              />
            </>
          ) : (
            <>
              <View
                style={{
                  width: 15,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: "#1e293b",
                  alignItems: "flex-end",
                  justifyContent: "flex-start",
                  padding: 2.5,
                }}
              >
                <View
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 2.5,
                    backgroundColor: "#ffffff",
                  }}
                />
              </View>
              <View
                style={{
                  width: 15,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: "#1e293b",
                  alignItems: "flex-end",
                  justifyContent: "flex-start",
                  padding: 2.5,
                }}
              >
                <View
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 2.5,
                    backgroundColor: "#ffffff",
                  }}
                />
              </View>
            </>
          )}
        </View>

        {/* Đôi má hồng phấn + chiếc mỏ cam xinh xắn ở giữa */}
        <View
          style={{
            flexDirection: "row",
            width: 96,
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 2,
          }}
        >
          <View
            style={{
              width: 20,
              height: 11,
              borderRadius: 6,
              backgroundColor: "#fda4af",
              opacity: 0.75,
            }}
          />
          <View
            style={{
              width: isCat ? 18 : 28,
              height: isCat ? 12 : 16,
              borderRadius: 10,
              backgroundColor: isCat ? "#fb7185" : "#fb923c",
              borderWidth: 1.5,
              borderColor: isCat ? "#f43f5e" : "#f97316",
            }}
          />
          <View
            style={{
              width: 20,
              height: 11,
              borderRadius: 6,
              backgroundColor: "#fda4af",
              opacity: 0.75,
            }}
          />
        </View>

        {/* Bụng tròn màu pastel ấm */}
        <View
          style={{
            width: 74,
            height: 44,
            borderRadius: 37,
            backgroundColor: "#fff1f2",
            marginTop: 10,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 15, color: accentColor }}>♥</Text>
        </View>
      </View>
    </View>
  );
}

export default function PetLocal({
  state,
  update,
  onSyncPet,
  onSendPetNote,
}: {
  state: State;
  update: (action: Record<string, unknown>) => void;
  /** Đồng bộ tức thì trạng thái thú cưng sang máy người thương qua MQTT. */
  onSyncPet?: (action: string, extra?: Record<string, unknown>) => void;
  /** Gửi lời nhắn / món quà của thú cưng vào khung chat của hai người. */
  onSendPetNote?: (text: string) => void;
}) {
  const { theme } = useTheme();
  const [now, setNow] = useState(Date.now());
  const [blinking, setBlinking] = useState(false);
  const [reaction, setReaction] = useState<string>("");
  const [floatingTag, setFloatingTag] = useState<string>("");
  const [giftBoxOpen, setGiftBoxOpen] = useState(false);
  const [customQuoteIdx, setCustomQuoteIdx] = useState<number | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(state.pet?.name || "Bơ");

  const bounce = useRef(new Animated.Value(0)).current;
  const floatHeart = useRef(new Animated.Value(0)).current;

  const status = computePetStatus(state, now);
  const partnerName = state.partner?.nickname || "Người thương";
  const speechText =
    customQuoteIdx !== null
      ? (PET_SPEECH_BUBBLES[customQuoteIdx % PET_SPEECH_BUBBLES.length] ??
        status.speech)
      : status.speech;

  // Nhịp chớp mắt tự nhiên mỗi 3.4 giây.
  useEffect(() => {
    const timer = setInterval(() => {
      setBlinking(true);
      setTimeout(() => setBlinking(false), 180);
      setNow(Date.now());
    }, 3400);
    return () => clearInterval(timer);
  }, []);

  function triggerBounce(tag: string, actionType: string) {
    setReaction(actionType);
    setFloatingTag(tag);
    bounce.setValue(0);
    floatHeart.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: -18,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 220,
          easing: Easing.bounce,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(floatHeart, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTimeout(() => {
        setReaction("");
        setFloatingTag("");
      }, 450);
    });
  }

  function handleAction(
    action: "feed" | "bath" | "sleep" | "poke" | "gift",
    tag: string,
  ) {
    setCustomQuoteIdx(null);
    update({ type: "pet.interact", action, by: "me" });
    triggerBounce(tag, action);
    onSyncPet?.(action);
    if (action === "poke") {
      onSendPetNote?.(
        `🐣 Bé ${status.pet.name} vừa chạy sang nhắc ${partnerName}: “Nhớ đằng ấy quá trời, vào chăm thú cưng với mình nha 💕”`,
      );
    }
  }

  function handleSendGift(gift: (typeof PET_GIFTS)[number]) {
    setGiftBoxOpen(false);
    handleAction("gift", `${gift.emoji} +25 Exp`);
    onSendPetNote?.(`${gift.emoji} ${gift.text}`);
  }

  function cycleQuote() {
    const nextIdx =
      ((customQuoteIdx ?? status.pet.quoteIndex) + 1) %
      PET_SPEECH_BUBBLES.length;
    setCustomQuoteIdx(nextIdx);
    triggerBounce("❤️", "tap");
  }

  function savePetName() {
    const trimmed = nameInput.trim();
    setEditingName(false);
    if (!trimmed) return;
    update({ type: "pet.interact", action: "rename", name: trimmed });
    onSyncPet?.("rename", { name: trimmed });
  }

  const heartTranslateY = floatHeart.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -42],
  });
  const heartOpacity = floatHeart.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [1, 1, 0],
  });

  const TOOLBAR_ITEMS = [
    {
      id: "feed" as const,
      icon: "🍴",
      label: "Cho ăn",
      tag: "🍴 +20 Exp",
    },
    {
      id: "bath" as const,
      icon: "🚿",
      label: "Tắm rửa",
      tag: "🫧 +15 Exp",
    },
    {
      id: "sleep" as const,
      icon: "🌙",
      label: status.pet.sleeping ? "Thức dậy" : "Đi ngủ",
      tag: status.pet.sleeping ? "☀️ Dậy thôi" : "🌙 Ngủ ngoan",
    },
    {
      id: "poke" as const,
      icon: "👥",
      label: "Nhắc nhở",
      tag: "💌 Đã nhắc",
    },
    {
      id: "gift" as const,
      icon: "💬",
      label: "Quà tặng",
      tag: "🎁 Hộp thư",
    },
  ];

  return (
    <View>
      {/* Khung căn phòng ấm cúng phong cách Widgetable */}
      <LinearGradient
        colors={theme.hero}
        style={{
          borderRadius: 30,
          padding: 16,
          borderWidth: 1,
          borderColor: theme.border,
          overflow: "hidden",
        }}
      >
        {/* Hàng trên: Thanh trạng thái (Top-Left) + Đổi nhân vật (Top-Right) */}
        <View className="flex-row items-start justify-between">
          {/* Thanh trạng thái Top-Left: Lv, Exp hôm nay: 20/100, ⚡⚡⚡⚡⚡ */}
          <View
            style={{
              backgroundColor: theme.surface,
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: theme.border,
              minWidth: 210,
            }}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View
                  style={{
                    backgroundColor: theme.deep[1],
                    borderRadius: 10,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    marginRight: 8,
                  }}
                >
                  <Text
                    className="text-xs font-bold"
                    style={{ color: theme.onDeep }}
                  >
                    {`Lv.${status.level}`}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Đổi tên thú cưng"
                  onPress={() => {
                    setNameInput(status.pet.name);
                    setEditingName(!editingName);
                  }}
                >
                  <Text
                    className="font-bold text-sm"
                    style={{ color: theme.ink }}
                  >
                    {status.pet.name} ✎
                  </Text>
                </Pressable>
              </View>
              <Text className="text-xs ml-2">{status.energyIcons}</Text>
            </View>

            {/* Thanh tiến trình Exp hôm nay */}
            <Text
              className="text-xs mt-1.5 font-medium"
              style={{ color: theme.sub }}
            >
              {`Exp hôm nay: ${status.todayExp}/${status.dailyGoal}`}
            </Text>
            <View
              style={{
                height: 7,
                borderRadius: 4,
                backgroundColor: theme.soft,
                marginTop: 4,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  height: 7,
                  width: `${Math.round(status.progressRatio * 100)}%`,
                  borderRadius: 4,
                  backgroundColor: theme.deep[1],
                }}
              />
            </View>
          </View>

          {/* Góc phải: Cửa sổ phòng + Nút đổi Vịt Bơ / Mèo Sữa */}
          <View className="items-end">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đổi hình dáng thú cưng Vịt hoặc Mèo"
              onPress={() => {
                const nextSpecies =
                  status.pet.species === "duck" ? "cat" : "duck";
                update({
                  type: "pet.interact",
                  action: "species",
                  species: nextSpecies,
                });
                onSyncPet?.("species", { species: nextSpecies });
              }}
              style={{
                backgroundColor: theme.surface,
                borderRadius: 16,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderWidth: 1,
                borderColor: theme.border,
              }}
            >
              <Text className="text-xs font-bold" style={{ color: theme.text }}>
                {status.pet.species === "duck" ? "🐣 Vịt Bơ" : "🐱 Mèo Sữa"}
              </Text>
            </Pressable>
            <View
              style={{
                marginTop: 8,
                width: 54,
                height: 54,
                borderRadius: 16,
                backgroundColor: status.pet.sleeping
                  ? "#1e1b4b"
                  : "rgba(255,255,255,0.65)",
                borderWidth: 2,
                borderColor: theme.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 22 }}>
                {status.pet.sleeping ? "🌙" : "☀️"}
              </Text>
            </View>
          </View>
        </View>

        {editingName ? (
          <View
            className="flex-row items-center mt-3 p-2"
            style={{
              backgroundColor: theme.surface,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Đặt tên thú cưng…"
              placeholderTextColor={theme.sub}
              maxLength={20}
              style={{
                flex: 1,
                color: theme.ink,
                paddingHorizontal: 8,
                paddingVertical: 4,
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Lưu tên thú cưng"
              onPress={savePetName}
              style={{
                backgroundColor: theme.deep[1],
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}
            >
              <Text
                className="text-xs font-bold"
                style={{ color: theme.onDeep }}
              >
                Lưu
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Bong bóng thoại (Speech Bubble) chữa lành ở giữa */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đổi câu nói của thú cưng"
          onPress={cycleQuote}
          style={{
            marginTop: 18,
            marginHorizontal: 8,
            backgroundColor: theme.surface,
            borderRadius: 22,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderWidth: 1.5,
            borderColor: theme.border,
            alignItems: "center",
          }}
        >
          <Text
            className="text-sm font-medium text-center leading-5"
            style={{ color: theme.ink }}
          >
            “{speechText}”
          </Text>
          <Text className="text-xs mt-1" style={{ color: theme.sub }}>
            {status.moodLabel} · chạm để nghe câu khác
          </Text>
        </Pressable>

        {/* Nhân vật Thú Cưng đứng trên tấm thảm tròn ấm cúng */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chạm vào thú cưng"
          onPress={cycleQuote}
          className="items-center justify-center my-4"
          style={{ minHeight: 215 }}
        >
          {/* Thảm phòng pastel dưới chân */}
          <View
            style={{
              position: "absolute",
              bottom: 6,
              width: 210,
              height: 54,
              borderRadius: 105,
              backgroundColor: theme.soft,
              borderWidth: 2,
              borderColor: theme.border,
            }}
          />

          {/* Hiệu ứng tim/điểm bay lên khi tương tác */}
          {floatingTag ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 4,
                zIndex: 10,
                opacity: heartOpacity,
                transform: [{ translateY: heartTranslateY }],
                backgroundColor: theme.deep[1],
                borderRadius: 16,
                paddingHorizontal: 12,
                paddingVertical: 5,
              }}
            >
              <Text
                className="text-xs font-bold"
                style={{ color: theme.onDeep }}
              >
                {floatingTag} ❤️
              </Text>
            </Animated.View>
          ) : null}

          <Animated.View style={{ transform: [{ translateY: bounce }] }}>
            <CutePetAvatar
              species={status.pet.species}
              mood={status.mood}
              blinking={blinking}
              sleeping={status.pet.sleeping}
              reaction={reaction}
              accentColor={theme.deep[1]}
            />
          </Animated.View>
        </Pressable>

        {/* Ba chỉ số No bụng · Sạch sẽ · Yêu thương */}
        <View
          className="flex-row justify-between mb-4 px-3 py-2.5"
          style={{
            backgroundColor: theme.surface,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          {[
            ["🍴 No bụng", `${status.pet.hunger}%`],
            ["🚿 Sạch sẽ", `${status.pet.cleanliness}%`],
            ["💗 Yêu thương", `${status.pet.affection}%`],
          ].map(([label, value]) => (
            <View key={label} className="items-center flex-1">
              <Text className="text-xs" style={{ color: theme.sub }}>
                {label}
              </Text>
              <Text
                className="text-sm font-bold mt-0.5"
                style={{ color: theme.ink }}
              >
                {value}
              </Text>
            </View>
          ))}
        </View>

        {/* Hộp thư / Quà tặng mở rộng khi bấm nút Quà tặng 💬 */}
        {giftBoxOpen ? (
          <View
            className="mb-3 p-3"
            style={{
              backgroundColor: theme.surface,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xs font-bold" style={{ color: theme.ink }}>
                💬 Chọn quà nhờ {status.pet.name} mang sang cho {partnerName}
              </Text>
              <Pressable onPress={() => setGiftBoxOpen(false)}>
                <Text className="text-xs" style={{ color: theme.sub }}>
                  Đóng ✕
                </Text>
              </Pressable>
            </View>
            <View className="flex-row flex-wrap justify-between">
              {PET_GIFTS.map((gift) => (
                <Pressable
                  key={gift.id}
                  accessibilityRole="button"
                  accessibilityLabel={gift.label}
                  onPress={() => handleSendGift(gift)}
                  style={{
                    width: "48%",
                    backgroundColor: theme.soft,
                    borderRadius: 14,
                    paddingVertical: 9,
                    paddingHorizontal: 10,
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: theme.border,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <Text className="text-xl mr-2">{gift.emoji}</Text>
                  <Text
                    className="text-xs font-semibold flex-1"
                    style={{ color: theme.ink }}
                    numberOfLines={1}
                  >
                    {gift.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* Thanh công cụ tương tác (Bottom Toolbar kiểu Widgetable) */}
        <View
          className="flex-row justify-between items-center p-2"
          style={{
            backgroundColor: theme.surface,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          {TOOLBAR_ITEMS.map((item) => {
            const isActive =
              (item.id === "sleep" && status.pet.sleeping) ||
              (item.id === "gift" && giftBoxOpen);
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => {
                  if (item.id === "gift") {
                    setGiftBoxOpen(!giftBoxOpen);
                    return;
                  }
                  handleAction(item.id, item.tag);
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  alignItems: "center",
                  paddingVertical: 8,
                  marginHorizontal: 2,
                  borderRadius: 18,
                  backgroundColor: isActive ? theme.deep[0] : theme.soft,
                  borderWidth: 1,
                  borderColor: isActive ? theme.deep[1] : theme.border,
                  opacity: pressed ? 0.8 : 1,
                  transform: [{ scale: pressed ? 0.94 : 1 }],
                })}
              >
                <Text style={{ fontSize: 22 }}>{item.icon}</Text>
                <Text
                  className="text-xs font-semibold mt-1"
                  style={{ color: isActive ? theme.onDeep : theme.ink }}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text className="text-xs text-center mt-3" style={{ color: theme.sub }}>
          Mỗi lần hai bạn nhắn tin (+10 Exp), gọi thoại hoặc gọi video (+25 Exp)
          năng lượng ⚡ và cấp độ của {status.pet.name} sẽ tự động tăng trên cả
          hai máy.
        </Text>
      </LinearGradient>
    </View>
  );
}
