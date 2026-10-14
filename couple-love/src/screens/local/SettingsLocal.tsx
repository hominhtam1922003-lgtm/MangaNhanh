import React, { useState } from "react";
import { Alert, Switch, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Manipulator from "expo-image-manipulator";
import {
  Button,
  Card,
  Input,
  LocalAvatar,
  Note,
  Title,
  confirm,
  GradientCard,
} from "../../components/UI";
import { deleteImage, saveImage } from "../../services/localdb";
import type { State } from "../../services/localdb";
import {
  importPayload,
  exportBackup,
  shareBackup,
  pickBackupFile,
} from "../../services/localsync";
import { requestNotifications } from "../../services/localnotify";
import { restoreFromPayload } from "../../logic/localState.mjs";
import Constants from "expo-constants";
export default function SettingsLocal({
  state,
  update,
  replaceState,
  clearAll,
  locked,
  onToggleLock,
  onSwitchMode,
  onOpenPair,
}: {
  state: State;
  update: (action: Record<string, unknown>) => void;
  replaceState: (state: State) => void;
  clearAll: () => Promise<void>;
  locked: boolean;
  onToggleLock: (value: boolean) => Promise<void>;
  onSwitchMode: () => void;
  onOpenPair: () => void;
}) {
  const [name, setName] = useState(state.me.nickname);
  const [busy, setBusy] = useState(false);
  async function run(task: () => Promise<void> | void) {
    setBusy(true);
    try {
      await task();
    } catch (error) {
      Alert.alert(
        "Chưa hoàn tất",
        error instanceof Error ? error.message : "Thao tác không thành công.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function pickAvatar() {
    await run(async () => {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted)
        throw new Error("Cần quyền chọn ảnh từ thư viện.");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;
      const processed = await Manipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 480 } }],
        { compress: 0.8, format: Manipulator.SaveFormat.JPEG },
      );
      const previous = state.me.avatar;
      const saved = saveImage(processed.uri, "me-avatar.jpg");
      update({ type: "profile.avatar", file: saved });
      if (previous && previous !== saved) deleteImage(previous);
    });
  }
  return (
    <>
      <GradientCard>
        <Title>Góc của bạn</Title>
        <View className="items-center mb-4">
          <LocalAvatar
            name={state.me.nickname}
            image={state.me.avatar}
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
            void run(() => {
              update({
                type: "profile.set",
                nickname: name,
                mood: state.me.mood,
                moodNote: state.me.moodNote,
              });
            })
          }
        />
        <Button
          label="Đổi ảnh đại diện"
          secondary
          busy={busy}
          onPress={() => void pickAvatar()}
        />
      </GradientCard>
      <Card>
        <Title small>Riêng tư trên máy này</Title>
        <View className="flex-row justify-between items-center my-3">
          <Text className="text-ink flex-1">Khóa bằng Face ID / vân tay</Text>
          <Switch
            accessibilityLabel="Khóa sinh trắc học"
            value={locked}
            onValueChange={(value) =>
              void onToggleLock(value).catch((error) =>
                Alert.alert(
                  "Chưa bật được khóa",
                  error instanceof Error
                    ? error.message
                    : "Thiết bị chưa hỗ trợ.",
                ),
              )
            }
            trackColor={{ true: "#e64980" }}
          />
        </View>
        <Note>
          Khóa khi rời ứng dụng. Không có mã dự phòng: nếu cảm biến hỏng, hãy xử
          lý trong cài đặt sinh trắc học của hệ thống.
        </Note>
        <View className="flex-row justify-between items-center my-3">
          <Text className="text-ink flex-1">Lời nhắc trên máy này</Text>
          <Switch
            accessibilityLabel="Lời nhắc trên máy"
            value={state.settings.notify}
            onValueChange={(value) =>
              void run(async () => {
                if (value) {
                  const granted = await requestNotifications();
                  if (!granted)
                    throw new Error(
                      "Chưa được cấp quyền thông báo. Bạn có thể bật lại trong cài đặt hệ thống.",
                    );
                }
                update({
                  type: "settings.set",
                  notify: value,
                  relay: state.settings.relay,
                });
              })
            }
            trackColor={{ true: "#e64980" }}
          />
        </View>
        <Note>
          Lời nhắc dùng lịch của máy: mốc 08:00 trước kỳ 3 ngày, đầu kỳ và mốc
          rụng trứng ước tính, kèm ngày kỷ niệm. Máy có thể trì hoãn thông báo;
          đây không phải báo thức reo như chuông.
        </Note>
        <View className="flex-row justify-between items-center my-3">
          <Text className="text-ink flex-1">
            Kết nối tức thời với người thương
          </Text>
          <Switch
            accessibilityLabel="Kết nối tức thời"
            value={state.settings.relay}
            onValueChange={(value) =>
              update({
                type: "settings.set",
                notify: state.settings.notify,
                relay: value,
              })
            }
            trackColor={{ true: "#e64980" }}
          />
        </View>
        <Note>
          Bật để hai máy tự gửi dữ liệu cho nhau qua trạm trung chuyển công cộng
          miễn phí, dùng mã 6 số trong mục Ghép nối. Tắt nếu bạn chỉ muốn dữ
          liệu nằm trên máy mình; khi đó dùng “Xuất và chia sẻ tệp dữ liệu”.
        </Note>
      </Card>
      <Card>
        <Title small>Gửi và nhận dữ liệu</Title>
        <Note>
          Tệp dữ liệu là văn bản chứa hồ sơ, ngày bắt đầu, chu kỳ, nhật ký và
          tối đa vài ảnh nhỏ. Chỉ gửi cho người bạn tin tưởng.
        </Note>
        <Button
          label="Xuất và chia sẻ tệp dữ liệu"
          busy={busy}
          onPress={() =>
            void run(async () => {
              const result = await exportBackup(state);
              await shareBackup(result.uri);
              if (result.skipped)
                Alert.alert(
                  "Đã tạo tệp",
                  `Đã bỏ qua ${result.skipped} ảnh vì tệp quá lớn.`,
                );
            })
          }
        />
        <Button
          label="Nhận dữ liệu người thương từ tệp"
          secondary
          busy={busy}
          onPress={() =>
            void run(async () => {
              const text = await pickBackupFile();
              if (!text) return;
              const { payload, diaryCount, images } = importPayload(text);
              update({ type: "partner.merge", state: payload });
              Alert.alert(
                "Đã nhận",
                `Từ ${payload.from.nickname}: ${diaryCount} kỷ niệm${images ? `, ${images} ảnh` : ""}.`,
              );
            })
          }
        />
        <Button
          label="Khôi phục từ tệp của chính bạn"
          secondary
          busy={busy}
          onPress={() =>
            void run(async () => {
              const text = await pickBackupFile();
              if (!text) return;
              const { payload } = importPayload(text);
              if (
                !(await confirm(
                  "Khôi phục dữ liệu?",
                  `Dữ liệu hiện tại trên máy sẽ được thay bằng bản của ${payload.from.nickname}. Cảm xúc và cài đặt của bạn vẫn được đặt lại theo tệp.`,
                ))
              )
                return;
              replaceState(restoreFromPayload(payload));
            })
          }
        />
      </Card>
      <Card>
        <Title small>Không gian riêng</Title>
        <Button
          label="Mở phần ghép nối với người thương"
          secondary
          onPress={onOpenPair}
        />
        <Button
          label="Dùng chế độ đồng bộ máy chủ (Supabase)"
          secondary
          onPress={onSwitchMode}
        />
        <Note>
          Chế độ máy chủ cho phép cập nhật tức thời giữa hai máy và nhắc hộ
          người thương, nhưng cần một dự án Supabase do bạn tạo.
        </Note>
      </Card>
      <Card>
        <Title small>Xóa dữ liệu</Title>
        <Button
          label="Xóa toàn bộ dữ liệu trên máy"
          secondary
          busy={busy}
          onPress={() =>
            void run(async () => {
              if (
                !(await confirm(
                  "Xóa toàn bộ dữ liệu?",
                  "Cảm xúc, ngày yêu, chu kỳ, nhật ký, ảnh và lời nhắc trên máy này sẽ bị xóa. Không thể hoàn tác.",
                ))
              )
                return;
              await clearAll();
            })
          }
        />
      </Card>
      <Note>
        Hai Trái Tim {Constants.expoConfig?.version ?? "1.4.0"} (chế độ trên
        máy, bản dựng {Constants.expoConfig?.android?.versionCode ?? 5}) — ghi
        lại số này để biết máy đang chạy bản nào. Dữ liệu nằm trong thư mục
        riêng của ứng dụng, không tải lên máy chủ nào. Gỡ ứng dụng sẽ xóa dữ
        liệu, nên hãy xuất tệp dự phòng. Dự báo chu kỳ chỉ là phép tính lịch,
        không phải kết luận y tế và không dùng để tránh thai.
      </Note>
    </>
  );
}
