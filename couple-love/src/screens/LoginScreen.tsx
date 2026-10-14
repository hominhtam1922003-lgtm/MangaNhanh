// LoginScreen.tsx — màn hình đăng nhập tối giản: Google + Facebook qua Supabase.
//
// Tự chứa (chỉ dùng react-native + client trong `src/services/supabaseClient.ts`)
// nên dán vào dự án nào cũng chạy. Muốn dùng chung giao diện với app thì thay
// Text/Pressable bằng `src/components/UI` (Button, Card, Note, Title).
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Session } from "@supabase/supabase-js";

import {
  AUTH_REDIRECT,
  AuthProvider,
  getSavedSession,
  onAuthChange,
  signInWithProvider,
  signOut,
} from "../services/supabaseClient";

type Props = {
  /** Gọi sau khi đăng nhập thành công (nếu cần điều hướng ở màn cha). */
  onSignedIn?: (session: Session) => void;
};

const PROVIDERS: { id: AuthProvider; label: string; color: string }[] = [
  { id: "google", label: "Đăng nhập bằng Google", color: "#db4437" },
  { id: "facebook", label: "Đăng nhập bằng Facebook", color: "#1877f2" },
];

export default function LoginScreen({ onSignedIn }: Props) {
  const [busy, setBusy] = useState<AuthProvider | null>(null);
  const [error, setError] = useState("");
  const [session, setSession] = useState<Session | null>(null);

  // Mở app là đọc lại phiên đã lưu (AsyncStorage), không bắt đăng nhập lại.
  useEffect(() => {
    void getSavedSession().then(setSession);
    const stop = onAuthChange((next) => setSession(next));
    return stop;
  }, []);

  const login = useCallback(
    async (provider: AuthProvider) => {
      setBusy(provider);
      setError("");
      const result = await signInWithProvider(provider);
      setBusy(null);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSession(result.session);
      onSignedIn?.(result.session);
    },
    [onSignedIn],
  );

  const logout = useCallback(async () => {
    await signOut();
    setSession(null);
    setError("");
  }, []);

  return (
    <ScrollView
      contentContainerStyle={styles.wrap}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        <Text style={styles.title}>
          Mật Mã Yêu <Text style={styles.heart}>♡</Text>
        </Text>
        <Text style={styles.subtitle}>
          Đăng nhập để mỗi người có một mã kết nối cố định theo tài khoản.
        </Text>

        {session ? (
          <>
            <Text style={styles.ok}>
              Đã đăng nhập{session.user.email ? `: ${session.user.email}` : "."}
            </Text>
            <Text style={styles.meta}>Mã người dùng: {session.user.id}</Text>
            <Pressable
              accessibilityRole="button"
              style={[styles.button, styles.secondary]}
              onPress={() => void logout()}
            >
              <Text style={styles.secondaryText}>Đăng xuất</Text>
            </Pressable>
          </>
        ) : (
          PROVIDERS.map((provider) => (
            <Pressable
              key={provider.id}
              accessibilityRole="button"
              accessibilityLabel={provider.label}
              disabled={busy !== null}
              style={[
                styles.button,
                { backgroundColor: provider.color, opacity: busy ? 0.6 : 1 },
              ]}
              onPress={() => void login(provider.id)}
            >
              {busy === provider.id ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{provider.label}</Text>
              )}
            </Pressable>
          ))
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.note}>
          Cần bật Google/Facebook trong Supabase → Authentication → Providers,
          và thêm địa chỉ quay về {AUTH_REDIRECT} vào Authentication → URL
          Configuration. Đăng nhập chạy trong trình duyệt hệ thống nên app không
          thấy mật khẩu của bạn.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#fff5f8",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#ffd6e3",
  },
  title: { fontSize: 26, fontWeight: "800", color: "#3d2b33" },
  heart: { color: "#e64980" },
  subtitle: { marginTop: 6, marginBottom: 18, color: "#7a6a70", fontSize: 14 },
  button: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  secondary: { backgroundColor: "#f3e8ee" },
  secondaryText: { color: "#3d2b33", fontSize: 15, fontWeight: "600" },
  ok: { color: "#2f9e44", fontSize: 15, fontWeight: "700" },
  meta: { color: "#7a6a70", fontSize: 12, marginTop: 6, marginBottom: 8 },
  error: { color: "#c92a2a", fontSize: 14, marginTop: 14 },
  note: { color: "#8a7a80", fontSize: 12, marginTop: 18, lineHeight: 18 },
});
