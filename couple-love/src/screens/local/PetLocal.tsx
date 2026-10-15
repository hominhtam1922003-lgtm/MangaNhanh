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
  buildPetReminderText,
  computePetStatus,
} from "../../logic/pet.mjs";
import type { State } from "../../services/localdb";

/**
 * Nhân vật Thú Cưng 2D phẳng (Flat UI kiểu Widgetable):
 * Phân định rạch ròi giữa:
 * - VỊT (`species === "duck"`): lông trắng tinh, chỏm lông đỉnh đầu, cánh trắng,
 *   MỎ CAM (`#fb923c`) và đôi chân vịt màng cam.
 * - MÈO (`species === "cat"`): lông trắng kem sữa (`#fffbeb`), ĐÔI TAI MÈO nhọn
 *   lót hồng, mũi mèo hồng tam giác, 6 sợi ria mép hai bên má, đệm chân mèo
 *   trắng hồng và chiếc đuôi mèo cong phía sau.
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
  const bodyColor = isCat ? "#fffbeb" : "#ffffff";
  const bodyBorder = isCat ? "#fde68a" : "#e2e8f0";

  return (
    <View
      style={{
        width: 200,
        height: 205,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Bóng đổ phẳng mềm dưới chân trên thảm sàn gỗ */}
      <View
        style={{
          position: "absolute",
          bottom: 8,
          width: 132,
          height: 24,
          borderRadius: 66,
          backgroundColor: "rgba(0,0,0,0.12)",
        }}
      />

      {/* Đuôi mèo cong mềm mại (chỉ hiển thị khi là Mèo) */}
      {isCat ? (
        <View
          style={{
            position: "absolute",
            right: 12,
            bottom: 34,
            width: 44,
            height: 22,
            borderRadius: 14,
            backgroundColor: "#fef3c7",
            borderWidth: 2.5,
            borderColor: "#fde68a",
            transform: [{ rotate: reaction ? "-28deg" : "-16deg" }],
          }}
        />
      ) : null}

      {/* Chân thú cưng: Chân vịt màng cam (Vịt) vs Đệm chân tròn trắng hồng (Mèo) */}
      {isCat ? (
        <View
          style={{
            position: "absolute",
            bottom: 14,
            flexDirection: "row",
            width: 74,
            justifyContent: "space-between",
          }}
        >
          <View
            style={{
              width: 26,
              height: 16,
              borderRadius: 12,
              backgroundColor: "#fffbeb",
              borderWidth: 2,
              borderColor: "#fde68a",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 10,
                height: 6,
                borderRadius: 4,
                backgroundColor: "#fda4af",
              }}
            />
          </View>
          <View
            style={{
              width: 26,
              height: 16,
              borderRadius: 12,
              backgroundColor: "#fffbeb",
              borderWidth: 2,
              borderColor: "#fde68a",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 10,
                height: 6,
                borderRadius: 4,
                backgroundColor: "#fda4af",
              }}
            />
          </View>
        </View>
      ) : (
        <View
          style={{
            position: "absolute",
            bottom: 14,
            flexDirection: "row",
            width: 72,
            justifyContent: "space-between",
          }}
        >
          <View
            style={{
              width: 26,
              height: 15,
              borderRadius: 10,
              backgroundColor: "#fb923c",
              borderWidth: 1.5,
              borderColor: "#ea580c",
              transform: [{ rotate: "-10deg" }],
            }}
          />
          <View
            style={{
              width: 26,
              height: 15,
              borderRadius: 10,
              backgroundColor: "#fb923c",
              borderWidth: 1.5,
              borderColor: "#ea580c",
              transform: [{ rotate: "10deg" }],
            }}
          />
        </View>
      )}

      {/* Đôi tai mèo nhọn lót hồng (Mèo) vs Chỏm lông trắng đỉnh đầu (Vịt) */}
      {isCat ? (
        <View
          style={{
            position: "absolute",
            top: 14,
            width: 126,
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderTopLeftRadius: 6,
              borderTopRightRadius: 20,
              borderBottomLeftRadius: 16,
              backgroundColor: "#fffbeb",
              borderWidth: 2.5,
              borderColor: "#fde68a",
              transform: [{ rotate: "-15deg" }],
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderTopLeftRadius: 4,
                borderTopRightRadius: 10,
                borderBottomLeftRadius: 8,
                backgroundColor: "#fda4af",
              }}
            />
          </View>
          <View
            style={{
              width: 38,
              height: 38,
              borderTopRightRadius: 6,
              borderTopLeftRadius: 20,
              borderBottomRightRadius: 16,
              backgroundColor: "#fffbeb",
              borderWidth: 2.5,
              borderColor: "#fde68a",
              transform: [{ rotate: "15deg" }],
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderTopRightRadius: 4,
                borderTopLeftRadius: 10,
                borderBottomRightRadius: 8,
                backgroundColor: "#fda4af",
              }}
            />
          </View>
        </View>
      ) : (
        <View
          style={{
            position: "absolute",
            top: 10,
            flexDirection: "row",
            alignItems: "flex-end",
          }}
        >
          <View
            style={{
              width: 18,
              height: 24,
              borderRadius: 11,
              backgroundColor: "#ffffff",
              borderWidth: 1.5,
              borderColor: "#e2e8f0",
              transform: [{ rotate: "-18deg" }],
              marginRight: -4,
            }}
          />
          <View
            style={{
              width: 15,
              height: 19,
              borderRadius: 9,
              backgroundColor: "#ffffff",
              borderWidth: 1.5,
              borderColor: "#e2e8f0",
              transform: [{ rotate: "14deg" }],
            }}
          />
        </View>
      )}

      {/* Hai cánh trắng tròn (Vịt) hoặc Hai tay mèo sữa (Mèo) */}
      <View
        style={{
          position: "absolute",
          width: 172,
          top: 80,
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            width: isCat ? 24 : 30,
            height: isCat ? 40 : 54,
            borderRadius: 18,
            backgroundColor: bodyColor,
            borderWidth: 2,
            borderColor: bodyBorder,
            transform: [
              { rotate: reaction ? "-28deg" : "14deg" },
              { translateY: reaction ? -6 : 0 },
            ],
          }}
        />
        <View
          style={{
            width: isCat ? 24 : 30,
            height: isCat ? 40 : 54,
            borderRadius: 18,
            backgroundColor: bodyColor,
            borderWidth: 2,
            borderColor: bodyBorder,
            transform: [
              { rotate: reaction ? "28deg" : "-14deg" },
              { translateY: reaction ? -6 : 0 },
            ],
          }}
        />
      </View>

      {/* Thân tròn mũm mĩm */}
      <View
        style={{
          width: 142,
          height: 144,
          borderRadius: 70,
          backgroundColor: bodyColor,
          borderWidth: 3,
          borderColor: bodyBorder,
          alignItems: "center",
          justifyContent: "center",
          paddingTop: 6,
        }}
      >
        {/* Phụ kiện cảm xúc nhỏ trên đầu */}
        <View style={{ position: "absolute", top: 8, right: 22 }}>
          <Text style={{ fontSize: 18 }}>
            {sleeping
              ? "💤"
              : reaction === "feed"
                ? "🍓"
                : reaction === "bath"
                  ? "🫧"
                  : isCat
                    ? "🐾"
                    : "🌱"}
          </Text>
        </View>

        {/* Đôi mắt tròn long lanh */}
        <View
          style={{
            flexDirection: "row",
            width: 70,
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
                  width: 16,
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
                  width: 16,
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

        {/* Má hồng + MỎ CAM RÕ RÀNG (Vịt) hoặc MŨI HỒNG + RIA MÉP (Mèo) */}
        <View
          style={{
            flexDirection: "row",
            width: 108,
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 3,
          }}
        >
          {/* Má trái + ria mèo trái */}
          <View style={{ alignItems: "center" }}>
            <View
              style={{
                width: 20,
                height: 11,
                borderRadius: 6,
                backgroundColor: "#fda4af",
                opacity: 0.8,
              }}
            />
            {isCat ? (
              <View style={{ marginTop: 2 }}>
                <View
                  style={{
                    width: 14,
                    height: 1.5,
                    backgroundColor: "#94a3b8",
                    marginBottom: 2,
                  }}
                />
                <View
                  style={{
                    width: 14,
                    height: 1.5,
                    backgroundColor: "#94a3b8",
                  }}
                />
              </View>
            ) : null}
          </View>

          {/* Giữa mặt: Mỏ vịt màu cam (#fb923c) HOẶC Mũi mèo hồng + miệng chữ w */}
          {isCat ? (
            <View style={{ alignItems: "center" }}>
              <View
                style={{
                  width: 14,
                  height: 10,
                  borderTopLeftRadius: 6,
                  borderTopRightRadius: 6,
                  borderBottomLeftRadius: 10,
                  borderBottomRightRadius: 10,
                  backgroundColor: "#fb7185",
                }}
              />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  color: "#475569",
                  marginTop: -3,
                }}
              >
                ω
              </Text>
            </View>
          ) : (
            <View
              style={{
                width: 34,
                height: 18,
                borderRadius: 11,
                backgroundColor: "#fb923c",
                borderWidth: 2,
                borderColor: "#ea580c",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 18,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: "#9a3412",
                  opacity: 0.45,
                }}
              />
            </View>
          )}

          {/* Má phải + ria mèo phải */}
          <View style={{ alignItems: "center" }}>
            <View
              style={{
                width: 20,
                height: 11,
                borderRadius: 6,
                backgroundColor: "#fda4af",
                opacity: 0.8,
              }}
            />
            {isCat ? (
              <View style={{ marginTop: 2 }}>
                <View
                  style={{
                    width: 14,
                    height: 1.5,
                    backgroundColor: "#94a3b8",
                    marginBottom: 2,
                  }}
                />
                <View
                  style={{
                    width: 14,
                    height: 1.5,
                    backgroundColor: "#94a3b8",
                  }}
                />
              </View>
            ) : null}
          </View>
        </View>

        {/* Bụng tròn pastel */}
        <View
          style={{
            width: 74,
            height: 42,
            borderRadius: 37,
            backgroundColor: isCat ? "#fef3c7" : "#fff1f2",
            marginTop: 8,
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

  // Nhịp chớp mắt tự nhiên + cập nhật chu kỳ giảm chỉ số 15 phút.
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

  function selectSpecies(targetSpecies: "duck" | "cat") {
    if (status.pet.species === targetSpecies) return;
    update({
      type: "pet.interact",
      action: "species",
      species: targetSpecies,
    });
    onSyncPet?.("species", { species: targetSpecies });
  }

  function handleAction(
    action: "feed" | "bath" | "sleep" | "poke" | "gift",
    tag: string,
  ) {
    setCustomQuoteIdx(null);
    update({ type: "pet.interact", action, by: "me" });
    triggerBounce(tag, action);
    if (action === "poke") {
      const reminderText = buildPetReminderText(status.pet, Date.now());
      onSyncPet?.("poke", {
        notify: true,
        reminderText,
      });
      onSendPetNote?.(reminderText);
      return;
    }
    onSyncPet?.(action);
  }

  function handleSendGift(gift: (typeof PET_GIFTS)[number]) {
    setGiftBoxOpen(false);
    handleAction("gift", `${gift.emoji} +5 Exp`);
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
      tag: "🍴 +5 Exp",
    },
    {
      id: "bath" as const,
      icon: "🚿",
      label: "Tắm rửa",
      tag: "🫧 +5 Exp",
    },
    {
      id: "sleep" as const,
      icon: "🌙",
      label: status.pet.sleeping ? "Thức dậy" : "Đi ngủ",
      tag: status.pet.sleeping ? "☀️ +5 Exp" : "🌙 +5 Exp",
    },
    {
      id: "poke" as const,
      icon: "👥",
      label: "Nhắc nhở",
      tag: "🔔 Đã nhắc",
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
      {/* Căn phòng ấm cúng phong cách Widgetable (Tường pastel + Cửa sổ + Kệ gỗ + Sàn gỗ) */}
      <LinearGradient
        colors={theme.hero}
        style={{
          borderRadius: 30,
          borderWidth: 1,
          borderColor: theme.border,
          overflow: "hidden",
        }}
      >
        {/* Phần tường căn phòng */}
        <View style={{ padding: 16, paddingBottom: 8 }}>
          {/* Hàng trên: Thanh trạng thái (Top-Left) + Chọn loài Vịt / Mèo (Top-Right) */}
          <View className="flex-row items-start justify-between">
            {/* Thanh trạng thái Top-Left: Lv.1, Exp cấp độ 0/1000, Exp hôm nay 0/100, ⚡ */}
            <View
              style={{
                backgroundColor: theme.surface,
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderWidth: 1,
                borderColor: theme.border,
                minWidth: 214,
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

              {/* Thanh tiến trình Exp Cấp độ (0/1000 ở Lv.1, +1000 mỗi cấp) */}
              <View className="flex-row items-center justify-between mt-1.5">
                <Text
                  className="text-xs font-semibold"
                  style={{ color: theme.ink }}
                >
                  {`Exp: ${status.levelExp}/${status.levelGoal}`}
                </Text>
                <Text className="text-xs" style={{ color: theme.sub }}>
                  {`Exp hôm nay: ${status.todayExp}/${status.dailyGoal}`}
                </Text>
              </View>
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
                    width: `${Math.round(status.levelProgressRatio * 100)}%`,
                    borderRadius: 4,
                    backgroundColor: theme.deep[1],
                  }}
                />
              </View>
            </View>

            {/* Góc phải: Hai nút chọn riêng biệt Vịt 🐣 và Mèo 🐱 (không tự hoán đổi) */}
            <View className="items-end">
              <View
                style={{
                  flexDirection: "row",
                  backgroundColor: theme.surface,
                  borderRadius: 16,
                  padding: 3,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Chọn nuôi Vịt trắng mỏ cam"
                  onPress={() => selectSpecies("duck")}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 5,
                    borderRadius: 12,
                    backgroundColor:
                      status.pet.species === "duck"
                        ? theme.deep[1]
                        : "transparent",
                  }}
                >
                  <Text
                    className="text-xs font-bold"
                    style={{
                      color:
                        status.pet.species === "duck"
                          ? theme.onDeep
                          : theme.sub,
                    }}
                  >
                    🐣 Vịt
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Chọn nuôi Mèo tai hồng"
                  onPress={() => selectSpecies("cat")}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 5,
                    borderRadius: 12,
                    backgroundColor:
                      status.pet.species === "cat"
                        ? theme.deep[1]
                        : "transparent",
                  }}
                >
                  <Text
                    className="text-xs font-bold"
                    style={{
                      color:
                        status.pet.species === "cat" ? theme.onDeep : theme.sub,
                    }}
                  >
                    🐱 Mèo
                  </Text>
                </Pressable>
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

          {/* Đồ trang trí căn phòng phẳng tối giản: Cửa sổ + Kệ gỗ tranh cây */}
          <View className="flex-row items-center justify-between mt-3 px-2">
            {/* Cửa sổ phòng có rèm và bầu trời */}
            <View
              style={{
                width: 78,
                height: 68,
                borderRadius: 16,
                backgroundColor: status.pet.sleeping ? "#1e1b4b" : "#bae6fd",
                borderWidth: 3,
                borderColor: "#ffffff",
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 22 }}>
                {status.pet.sleeping ? "🌙✨" : "☀️☁️"}
              </Text>
              {/* Khung chữ thập cửa sổ */}
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  width: "100%",
                  height: 2,
                  backgroundColor: "#ffffff",
                }}
              />
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  width: 2,
                  height: "100%",
                  backgroundColor: "#ffffff",
                }}
              />
            </View>

            {/* Kệ gỗ treo tường tối giản */}
            <View style={{ alignItems: "center" }}>
              <View className="flex-row items-end px-2">
                <Text style={{ fontSize: 18, marginRight: 6 }}>🪴</Text>
                <Text style={{ fontSize: 16, marginRight: 6 }}>🖼️</Text>
                <Text style={{ fontSize: 16 }}>⏰</Text>
              </View>
              <View
                style={{
                  width: 92,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: "#c28e5c",
                  marginTop: 2,
                }}
              />
            </View>
          </View>

          {/* Bong bóng thoại (Speech Bubble) chữa lành ở giữa */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đổi câu nói của thú cưng"
            onPress={cycleQuote}
            style={{
              marginTop: 12,
              marginHorizontal: 6,
              backgroundColor: theme.surface,
              borderRadius: 22,
              paddingHorizontal: 16,
              paddingVertical: 11,
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
        </View>

        {/* Sàn gỗ ấm cúng (Wooden Floor) + Thảm tròn + Nhân vật Thú Cưng */}
        <View
          style={{
            backgroundColor: "#e6ccb2",
            borderTopWidth: 4,
            borderTopColor: "#b08968",
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 16,
          }}
        >
          {/* Đường vân ván sàn gỗ phẳng tối giản */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 38,
              left: 0,
              right: 0,
              height: 1.5,
              backgroundColor: "rgba(127, 85, 57, 0.18)",
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 86,
              left: 0,
              right: 0,
              height: 1.5,
              backgroundColor: "rgba(127, 85, 57, 0.18)",
            }}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chạm vào thú cưng"
            onPress={cycleQuote}
            className="items-center justify-center my-1"
            style={{ minHeight: 210 }}
          >
            {/* Thảm dệt tròn trên sàn gỗ */}
            <View
              style={{
                position: "absolute",
                bottom: 6,
                width: 216,
                height: 56,
                borderRadius: 108,
                backgroundColor: theme.soft,
                borderWidth: 3,
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

          {/* Ba chỉ số sinh học: Đói (No bụng) · Dơ (Sạch sẽ) · Yêu thương (chu kỳ 15 phút) */}
          <View
            className="flex-row justify-between mb-3 px-3 py-2.5"
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
                <Text
                  className="text-xs font-bold"
                  style={{ color: theme.ink }}
                >
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

          <Text
            className="text-xs text-center mt-3"
            style={{ color: "#5c4033" }}
          >
            Tương tác phòng (+5 Exp), nhắn tin (+10 Exp), gọi thoại/video (+25
            Exp, tối đa 100 Exp/ngày). Chỉ số tự giảm mỗi 15 phút nếu chưa chăm
            sóc.
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}
