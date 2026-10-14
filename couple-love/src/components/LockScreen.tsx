// Màn hình khoá sinh trắc học: tách khỏi App.tsx từ bản dọn dẹp 1.18.0.
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { Button, Note, Title } from "./UI";
import { useTheme } from "../theme/ThemeContext";

export default function LockScreen({
  unlocking,
  onUnlock,
}: {
  unlocking: boolean;
  onUnlock: () => void;
}) {
  const { theme } = useTheme();
  return (
    <View className="flex-1 justify-center px-8">
      <LinearGradient colors={theme.bg} style={StyleSheet.absoluteFill} />
      <Text className="text-7xl text-center mb-7">🔐</Text>
      <Title>Không gian riêng của bạn</Title>
      <Note>Xác thực Face ID hoặc vân tay để xem dữ liệu trên máy này.</Note>
      <Button
        label="Mở bằng sinh trắc học"
        busy={unlocking}
        onPress={onUnlock}
      />
    </View>
  );
}
