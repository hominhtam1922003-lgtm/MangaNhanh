import React, { useState, useEffect } from "react";
import { Text, View, Switch, Alert } from "react-native";
import { SupabaseClient, User } from "@supabase/supabase-js";
import {
  Card,
  Title,
  Note,
  Input,
  Button,
  Avatar,
  confirm,
} from "../components/UI";
import { Snapshot } from "../services/sync";
import { Config, explain } from "../services/backend";
import { uploadPhoto } from "../services/images";
import { enablePush } from "../services/notifications";
import { secureStorage } from "../services/storage";
export default function Settings({
  db,
  data,
  user,
  config,
  refresh,
  locked,
  onToggleLock,
}: {
  db: SupabaseClient;
  data: Snapshot;
  user: User;
  config: Config;
  refresh: () => void;
  locked: boolean;
  onToggleLock: (value: boolean) => Promise<void>;
}) {
  const me = data.profiles.find((p) => p.id === user.id);
  const [name, setName] = useState(me?.nickname || "Bạn"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [pushMessage, setPushMessage] = useState("");
  useEffect(() => {
    if (me) setName(me.nickname);
  }, [me?.nickname]);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      Alert.alert("Chưa hoàn tất", explain(e));
    } finally {
      setBusy(false);
    }
  }
  async function pref(
    key: "allow_cycle_alerts" | "allow_mood_alerts",
    value: boolean,
  ) {
    if (
      key === "allow_cycle_alerts" &&
      value &&
      !(await confirm(
        "Đồng ý lời nhắc chu kỳ?",
        "Bạn chỉ nhận lời nhắc khi người ghi đã đồng ý chia sẻ. Không chia sẻ thông tin này cho người khác.",
      ))
    )
      return;
    await action(async () => {
      const r = await db
        .from("preferences")
        .update({ [key]: value })
        .eq("user_id", user.id);
      if (r.error) throw r.error;
      refresh();
    });
  }
  return (
    <>
      <Card>
        <Title>Góc của bạn</Title>
        <View className="items-center mb-4">
          <Avatar
            db={db}
            path={me?.avatar_path || null}
            name={name}
            size={86}
          />
        </View>
        <Input
          label="Tên gọi thân thương (1–40 ký tự)"
          value={name}
          onChangeText={setName}
        />
        <Button
          label="Lưu tên"
          busy={busy}
          onPress={() =>
            void action(async () => {
              if (!name.trim() || name.trim().length > 40)
                throw new Error("Tên cần từ 1 đến 40 ký tự.");
              const r = await db
                .from("profiles")
                .update({ nickname: name.trim() })
                .eq("id", user.id);
              if (r.error) throw r.error;
              refresh();
            })
          }
        />
        <Button
          label="Đổi ảnh đại diện"
          secondary
          busy={busy}
          onPress={() =>
            void action(async () => {
              const path = await uploadPhoto(db, user.id);
              if (!path) return;
              const r = await db
                .from("profiles")
                .update({ avatar_path: path })
                .eq("id", user.id);
              if (r.error) {
                await db.storage.from("love-assets").remove([path]);
                throw r.error;
              }
              if (me?.avatar_path)
                await db.storage.from("love-assets").remove([me.avatar_path]);
              refresh();
            })
          }
        />
      </Card>
      <Card>
        <Title small>Riêng tư & thông báo</Title>
        <View className="flex-row justify-between items-center my-3">
          <Text className="text-ink flex-1">Khóa bằng Face ID / vân tay</Text>
          <Switch
            accessibilityLabel="Khóa sinh trắc học"
            value={locked}
            onValueChange={(v) => void action(() => onToggleLock(v))}
            trackColor={{ true: "#e64980" }}
          />
        </View>
        <Note>
          Khóa khi rời ứng dụng. Không mở bằng mã máy nếu sinh trắc học không
          thành công; hãy giữ vân tay/Face ID hoạt động trước khi bật.
        </Note>
        <View className="flex-row justify-between items-center my-3">
          <Text className="text-ink flex-1">
            Nhận lời nhắc chu kỳ được chia sẻ
          </Text>
          <Switch
            accessibilityLabel="Đồng ý lời nhắc chu kỳ"
            value={data.prefs.allow_cycle_alerts}
            onValueChange={(v) => void pref("allow_cycle_alerts", v)}
            trackColor={{ true: "#e64980" }}
          />
        </View>
        <View className="flex-row justify-between items-center my-3">
          <Text className="text-ink flex-1">Nhận lời nhắc cảm xúc</Text>
          <Switch
            accessibilityLabel="Lời nhắc cảm xúc"
            value={data.prefs.allow_mood_alerts}
            onValueChange={(v) => void pref("allow_mood_alerts", v)}
            trackColor={{ true: "#e64980" }}
          />
        </View>
        <Button
          label="Đăng ký thông báo trên máy này"
          busy={busy}
          onPress={() =>
            void action(async () => {
              const token = await enablePush(db, user.id, config.projectId);
              await secureStorage.setItem("push-token", token);
              setPushMessage(
                "Đã đăng ký với máy chủ. Khả năng nhận ngoài ứng dụng còn phụ thuộc FCM/APNs và cấu hình cổng Expo.",
              );
            })
          }
        />
        {pushMessage && <Note>{pushMessage}</Note>}
        <Button
          label="Tắt thông báo đẩy trên máy này"
          secondary
          onPress={() =>
            void action(async () => {
              const token = await secureStorage.getItem("push-token");
              if (token) {
                const r = await db
                  .from("push_tokens")
                  .delete()
                  .eq("token", token)
                  .eq("user_id", user.id);
                if (r.error) throw r.error;
                await secureStorage.removeItem("push-token");
              }
              setPushMessage("Đã tắt thông báo đẩy trên máy này.");
            })
          }
        />
      </Card>
      {user.is_anonymous && (
        <Card>
          <Title small>Giữ tài khoản khi đổi máy</Title>
          <Input
            label="Email cần liên kết"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />
          <Input
            label="Mật khẩu mới (ít nhất 8 ký tự)"
            value={password}
            onChangeText={setPassword}
            secure
          />
          <Button
            label="Liên kết email"
            busy={busy}
            disabled={password.length < 8}
            onPress={() =>
              void action(async () => {
                const r = await db.auth.updateUser({
                  email: email.trim(),
                  password,
                });
                if (r.error) throw r.error;
                Alert.alert(
                  "Kiểm tra email",
                  "Xác nhận email để bảo vệ tài khoản.",
                );
              })
            }
          />
        </Card>
      )}
      <Card>
        <Title small>Quản lý không gian</Title>
        <Note>Máy chủ: {config.url}</Note>
        {data.couple && (
          <Button
            label="Hủy ghép đôi và xóa không gian chung"
            secondary
            onPress={() =>
              void action(async () => {
                if (
                  !(await confirm(
                    "Hủy ghép đôi?",
                    "Ngày yêu, nhật ký, chu kỳ và lời nhắc sẽ bị xóa cho cả hai. Ảnh đã tải lên phải được dọn trong Storage theo hướng dẫn quản trị.",
                  ))
                )
                  return;
                const r = await db.rpc("unpair");
                if (r.error) throw r.error;
                refresh();
              })
            }
          />
        )}
        <Button
          label="Đăng xuất"
          secondary
          busy={busy}
          onPress={() =>
            void action(async () => {
              if (
                !(await confirm(
                  "Đăng xuất?",
                  user.is_anonymous
                    ? "Tài khoản chưa liên kết email có thể không khôi phục được sau đăng xuất."
                    : "Bạn có thể đăng nhập lại bằng email.",
                ))
              )
                return;
              const token = await secureStorage.getItem("push-token");
              if (token) {
                const r = await db
                  .from("push_tokens")
                  .delete()
                  .eq("token", token)
                  .eq("user_id", user.id);
                if (r.error) throw r.error;
                await secureStorage.removeItem("push-token");
              }
              const r = await db.auth.signOut();
              if (r.error) throw r.error;
            })
          }
        />
      </Card>
      <Note>
        Hai Trái Tim · 1.0.0. Dữ liệu truyền qua HTTPS, quyền truy cập kiểm tra
        ở máy chủ. Không phải mã hóa đầu-cuối: quản trị viên Supabase có thể
        truy cập. Không dùng dự báo sức khỏe làm biện pháp tránh thai.
      </Note>
    </>
  );
}
