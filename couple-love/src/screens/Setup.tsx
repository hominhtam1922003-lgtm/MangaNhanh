import React, { useState } from "react";
import { ScrollView, View, Text, Alert } from "react-native";
import { SupabaseClient } from "@supabase/supabase-js";
import { Card, Title, Note, Input, Button } from "../components/UI";
import { Config, saveConfig, explain } from "../services/backend";
export function Setup({ onReady }: { onReady: (config: Config) => void }) {
  const [url, setUrl] = useState(""),
    [key, setKey] = useState(""),
    [projectId, setProject] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <ScrollView
      className="flex-1 bg-pink-50"
      contentContainerStyle={{ padding: 24, paddingTop: 60 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text className="text-5xl mb-6">💕</Text>
      <Title>Mật Mã Yêu</Title>
      <Note>
        Một góc riêng để hai bạn giữ những ngày yêu thương. Dùng chung một dự án
        Supabase để kết nối Android và iPhone.
      </Note>
      <View className="h-6" />
      <Card>
        <Title small>Kết nối không gian riêng</Title>
        <Input label="URL dự án Supabase" value={url} onChangeText={setUrl} />
        <Input
          label="Khóa công khai anon / publishable"
          value={key}
          onChangeText={setKey}
          secure
        />
        <Input
          label="Project ID Expo/EAS (cho thông báo đẩy)"
          value={projectId}
          onChangeText={setProject}
        />
        <Note>
          Chỉ dùng khóa công khai. Không nhập service role. Backend cần được
          triển khai bằng bộ mã nguồn đi kèm; ứng dụng không tự tạo một máy chủ.
        </Note>
        <Button
          label="Kết nối"
          busy={busy}
          onPress={() => {
            setBusy(true);
            const config = {
              url: url.trim(),
              key: key.trim(),
              projectId: projectId.trim(),
            };
            saveConfig(config)
              .then(() => onReady(config))
              .catch((e) => Alert.alert("Chưa kết nối", explain(e)))
              .finally(() => setBusy(false));
          }}
        />
      </Card>
      <Note>
        Ảnh và dữ liệu sức khỏe thuộc không gian riêng tư. Bạn quyết định có
        chia sẻ chu kỳ với người thương hay không.
      </Note>
    </ScrollView>
  );
}
export function Login({
  db,
  onReset,
}: {
  db: SupabaseClient;
  onReset: () => void;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false);
  async function run(action: "login" | "signup" | "anon" | "reset") {
    setBusy(true);
    try {
      const result =
        action === "anon"
          ? await db.auth.signInAnonymously()
          : action === "signup"
            ? await db.auth.signUp({ email: email.trim(), password })
            : action === "reset"
              ? await db.auth.resetPasswordForEmail(email.trim())
              : await db.auth.signInWithPassword({
                  email: email.trim(),
                  password,
                });
      if (result.error) throw result.error;
      if (
        action === "signup" &&
        !("session" in result.data && result.data.session)
      )
        Alert.alert("Kiểm tra email", "Hãy xác nhận email rồi đăng nhập.");
      if (action === "reset")
        Alert.alert(
          "Kiểm tra email",
          "Liên kết đổi mật khẩu được gửi nếu tài khoản tồn tại.",
        );
    } catch (e) {
      Alert.alert("Chưa hoàn tất", explain(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScrollView
      className="flex-1 bg-pink-50"
      contentContainerStyle={{ padding: 24, paddingTop: 55 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text className="text-5xl mb-6">💌</Text>
      <Title>Bắt đầu câu chuyện của hai bạn</Title>
      <Card>
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />
        <Input
          label="Mật khẩu (ít nhất 8 ký tự khi đăng ký)"
          value={password}
          onChangeText={setPassword}
          secure
        />
        <Button
          label="Đăng nhập"
          busy={busy}
          onPress={() => void run("login")}
        />
        <Button
          label="Tạo tài khoản"
          secondary
          disabled={password.length < 8}
          busy={busy}
          onPress={() => void run("signup")}
        />
        <Button
          label="Quên mật khẩu"
          secondary
          busy={busy}
          onPress={() => void run("reset")}
        />
      </Card>
      <Button
        label="Bắt đầu không cần email"
        secondary
        busy={busy}
        onPress={() => void run("anon")}
      />
      <Note>
        Tài khoản không email gắn với phiên trên máy này. Gỡ ứng dụng có thể mất
        quyền truy cập; liên kết email trong Cài đặt trước khi đổi máy.
      </Note>
      <Button label="Đổi cấu hình máy chủ" secondary onPress={onReset} />
    </ScrollView>
  );
}
