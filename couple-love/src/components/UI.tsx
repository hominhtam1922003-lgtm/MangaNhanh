import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  Image,
  Alert,
  StyleSheet,
  DimensionValue,
} from "react-native";
import { SupabaseClient } from "@supabase/supabase-js";
import { LinearGradient } from "expo-linear-gradient";
import { imageUri } from "../services/localdb";
import { Theme, useTheme } from "../theme/ThemeContext";
export function LocalAvatar({
  name,
  image,
  size = 64,
}: {
  name: string;
  image: string | null;
  size?: number;
}) {
  const { theme } = useTheme();
  const uri = imageUri(image);
  return (
    <LinearGradient
      colors={theme.deep}
      style={{
        padding: 3,
        borderRadius: (size + 8) / 2,
      }}
    >
      {uri ? (
        <Image
          accessibilityLabel={"Ảnh của " + name}
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: theme.soft,
          }}
          className="items-center justify-center"
        >
          <Text className="text-2xl font-bold" style={{ color: theme.text }}>
            {Array.from(name)[0] || "♥"}
          </Text>
        </View>
      )}
    </LinearGradient>
  );
}
export function Card({
  children,
  soft = false,
}: {
  children: React.ReactNode;
  soft?: boolean;
}) {
  const { theme, wallpaper } = useTheme();
  return (
    <View
      className="rounded-3xl p-5 mb-4"
      style={{
        backgroundColor: wallpaper ? theme.glass : theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
        shadowColor: theme.glow,
        shadowOpacity: theme.dark ? 0.32 : 0.16,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 4,
        opacity: soft ? 0.96 : 1,
      }}
    >
      {children}
    </View>
  );
}
export function GradientCard({
  children,
  colors,
}: {
  children: React.ReactNode;
  colors?: [string, string, ...string[]];
}) {
  const { theme } = useTheme();
  return (
    <LinearGradient
      colors={colors ?? [theme.hero[0], theme.hero[1]]}
      className="rounded-3xl p-5 mb-4"
      style={{
        borderWidth: 1,
        borderColor: theme.border,
        shadowColor: theme.glow,
        shadowOpacity: 0.2,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 9 },
        elevation: 5,
      }}
    >
      {children}
    </LinearGradient>
  );
}
export function Title({
  children,
  small = false,
}: {
  children: React.ReactNode;
  small?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <Text
      style={{ color: theme.ink }}
      className={
        small
          ? "text-lg font-bold mb-2 tracking-tight"
          : "text-2xl font-bold mb-3 tracking-tight"
      }
    >
      {children}
    </Text>
  );
}
export function Note({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <Text style={{ color: theme.sub }} className="text-sm leading-6">
      {children}
    </Text>
  );
}
/** Hoạ tiết nền theo chủ đề: hoa, mèo, sóng… rải mờ phía sau nội dung nên
 *  đổi chủ đề là đổi cả không khí, không chỉ đổi màu chữ. */
const DECO_SPOTS: {
  left?: DimensionValue;
  right?: DimensionValue;
  top?: DimensionValue;
  bottom?: DimensionValue;
  size: number;
  rotate: string;
}[] = [
  { left: "5%", top: "9%", size: 34, rotate: "-14deg" },
  { right: "7%", top: "5%", size: 28, rotate: "12deg" },
  { left: "16%", top: "38%", size: 24, rotate: "8deg" },
  { right: "11%", top: "34%", size: 32, rotate: "-10deg" },
  { left: "8%", bottom: "16%", size: 30, rotate: "16deg" },
  { right: "6%", bottom: "22%", size: 26, rotate: "-8deg" },
];
export function ThemeDeco({ dim = false }: { dim?: boolean }) {
  const { theme } = useTheme();
  const deco = theme.deco?.length ? theme.deco : theme.emoji;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {DECO_SPOTS.map((spot, index) => (
        <Text
          key={`${theme.id}-${index}`}
          style={{
            position: "absolute",
            left: spot.left,
            right: spot.right,
            top: spot.top,
            bottom: spot.bottom,
            fontSize: spot.size,
            opacity: dim ? 0.16 : 0.3,
            transform: [{ rotate: spot.rotate }],
          }}
        >
          {deco[index % deco.length]}
        </Text>
      ))}
    </View>
  );
}
/** Nhãn nhỏ dạng viên thuốc, dùng cho trạng thái kết nối, ngày tháng… */
export function Chip({
  children,
  tone = "soft",
}: {
  children: React.ReactNode;
  tone?: "soft" | "deep";
}) {
  const { theme } = useTheme();
  if (tone === "deep")
    return (
      <LinearGradient
        colors={theme.deep}
        style={{ borderRadius: 999 }}
        className="px-3 py-1 self-start"
      >
        <Text className="text-xs font-semibold" style={{ color: theme.onDeep }}>
          {children}
        </Text>
      </LinearGradient>
    );
  return (
    <View
      style={{
        backgroundColor: theme.soft,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 999,
      }}
      className="px-3 py-1 self-start"
    >
      <Text style={{ color: theme.text }} className="text-xs font-semibold">
        {children}
      </Text>
    </View>
  );
}
export function Button({
  label,
  onPress,
  busy = false,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  secondary?: boolean;
  disabled?: boolean;
}) {
  const { theme } = useTheme();
  const inner = (
    <View className="flex-row items-center justify-center">
      {busy && (
        <ActivityIndicator
          color={secondary ? theme.text : theme.onDeep}
          style={{ marginRight: 8 }}
        />
      )}
      <Text
        className="font-bold text-center"
        style={{ color: secondary ? theme.text : theme.onDeep }}
      >
        {label}
      </Text>
    </View>
  );
  if (secondary)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={busy || disabled}
        onPress={onPress}
        className="rounded-2xl px-5 py-4 my-2"
        style={{
          backgroundColor: theme.soft,
          borderWidth: 1,
          borderColor: theme.border,
          opacity: disabled ? 0.4 : 1,
        }}
      >
        {inner}
      </Pressable>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy || disabled}
      onPress={onPress}
      style={{ opacity: disabled ? 0.4 : 1, marginVertical: 8 }}
    >
      <LinearGradient
        colors={theme.deep}
        className="rounded-2xl px-5 py-4"
        style={{
          shadowColor: theme.glow,
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 4,
        }}
      >
        {inner}
      </LinearGradient>
    </Pressable>
  );
}
export function Input({
  label,
  value,
  onChangeText,
  secure = false,
  multiline = false,
  keyboardType = "default",
  maxLength,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secure?: boolean;
  multiline?: boolean;
  keyboardType?: "default" | "number-pad" | "email-address";
  maxLength?: number;
  placeholder?: string;
}) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View className="mb-3">
      <Text className="text-sm font-semibold mb-2" style={{ color: theme.sub }}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        secureTextEntry={secure}
        multiline={multiline}
        keyboardType={keyboardType}
        maxLength={maxLength}
        placeholder={placeholder}
        autoCapitalize={
          secure || keyboardType === "email-address" ? "none" : "sentences"
        }
        autoCorrect={!secure}
        style={{
          backgroundColor: theme.soft,
          borderColor: focused ? theme.deep[0] : theme.border,
          borderWidth: focused ? 1.5 : 1,
          color: theme.ink,
        }}
        className={`rounded-2xl px-4 py-3 ${multiline ? "min-h-24" : ""}`}
        placeholderTextColor={theme.sub}
      />
    </View>
  );
}
export function Avatar({
  db,
  path,
  name,
  size = 64,
}: {
  db: SupabaseClient;
  path: string | null;
  name: string;
  size?: number;
}) {
  const { theme } = useTheme();
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setUri(null);
    if (path)
      db.storage
        .from("love-assets")
        .createSignedUrl(path, 120)
        .then(({ data }) => {
          if (live) setUri(data?.signedUrl || null);
        });
    return () => {
      live = false;
    };
  }, [path, db]);
  return uri ? (
    <Image
      accessibilityLabel={"Ảnh của " + name}
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.soft,
      }}
      className="items-center justify-center"
    >
      <Text className="text-2xl font-bold" style={{ color: theme.text }}>
        {Array.from(name)[0] || "♥"}
      </Text>
    </View>
  );
}
export function confirm(title: string, body: string): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(
      title,
      body,
      [
        { text: "Hủy", style: "cancel", onPress: () => resolve(false) },
        {
          text: "Xác nhận",
          style: "destructive",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
export type { Theme };
