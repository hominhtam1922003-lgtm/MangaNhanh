import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { SupabaseClient } from "@supabase/supabase-js";
import { LinearGradient } from "expo-linear-gradient";
import { imageUri } from "../services/localdb";
export function LocalAvatar({
  name,
  image,
  size = 64,
}: {
  name: string;
  image: string | null;
  size?: number;
}) {
  const uri = imageUri(image);
  return uri ? (
    <Image
      accessibilityLabel={"Ảnh của " + name}
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  ) : (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className="bg-pink-100 items-center justify-center"
    >
      <Text className="text-love text-2xl font-bold">
        {Array.from(name)[0] || "♥"}
      </Text>
    </View>
  );
}
export function Card({ children }: { children: React.ReactNode }) {
  return (
    <View
      className="bg-white rounded-3xl border border-pink-100 p-5 mb-4"
      style={{
        shadowColor: "#c2185b",
        shadowOpacity: 0.1,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 3,
      }}
    >
      {children}
    </View>
  );
}
export function GradientCard({
  children,
  colors = ["#fff0f5", "#ffe1ec"],
}: {
  children: React.ReactNode;
  colors?: [string, string, ...string[]];
}) {
  return (
    <LinearGradient
      colors={colors}
      className="rounded-3xl border border-pink-100 p-5 mb-4"
      style={{
        shadowColor: "#c2185b",
        shadowOpacity: 0.12,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 4,
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
  return (
    <Text
      className={
        small
          ? "text-lg font-bold text-ink mb-2"
          : "text-2xl font-bold text-ink mb-3"
      }
    >
      {children}
    </Text>
  );
}
export function Note({ children }: { children: React.ReactNode }) {
  return <Text className="text-sm text-stone-600 leading-6">{children}</Text>;
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy || disabled}
      onPress={onPress}
      className={`${secondary ? "bg-pink-50" : "bg-love"} rounded-2xl px-5 py-4 my-2 ${disabled ? "opacity-40" : ""}`}
    >
      <View className="flex-row items-center justify-center">
        {busy && <ActivityIndicator color={secondary ? "#e64980" : "white"} />}
        <Text
          className={`font-bold text-center ${secondary ? "text-love" : "text-white"}`}
        >
          {label}
        </Text>
      </View>
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
  return (
    <View className="mb-3">
      <Text className="text-sm font-semibold text-stone-600 mb-2">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        multiline={multiline}
        keyboardType={keyboardType}
        maxLength={maxLength}
        placeholder={placeholder}
        autoCapitalize={
          secure || keyboardType === "email-address" ? "none" : "sentences"
        }
        autoCorrect={!secure}
        className={`bg-pink-50 border border-pink-100 rounded-2xl px-4 py-3 text-ink ${multiline ? "min-h-24" : ""}`}
        placeholderTextColor="#9a8290"
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
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className="bg-pink-100 items-center justify-center"
    >
      <Text className="text-love text-2xl font-bold">
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
