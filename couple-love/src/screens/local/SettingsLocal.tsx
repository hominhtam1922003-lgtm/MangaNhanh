import React, { useState } from "react";
import { Alert, Pressable, Switch, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
import { THEMES } from "../../logic/themes.mjs";
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
  lastError,
  onClearError,
  onOpenHome,
}: {
  state: State;
  update: (action: Record<string, unknown>) => void;
  replaceState: (state: State) => void;
  clearAll: () => Promise<void>;
  locked: boolean;
  onToggleLock: (value: boolean) => Promise<void>;
  onSwitchMode: () => void;
  onOpenPair: () => void;
  lastError: string;
  onClearError: () => void;
  onOpenHome: () => void;
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
      const context = Manipulator.ImageManipulator.manipulate(
        result.assets[0].uri,
      );
      context.resize({ width: 480 });
      const rendered = await context.renderAsync();
      const processed = await rendered.saveAsync({
        compress: 0.8,
        format: Manipulator.SaveFormat.JPEG,
      });
      const previous = state.me.avatar;
      // Tên tệp mới mỗi lần đổi để máy không hiện lại ảnh cũ đã nhớ trong bộ đệm.
      const saved = saveImage(
        processed.uri,
        `avatar-${Date.now().toString(36)}.jpg`,
      );
      update({ type: "profile.avatar", file: saved });
      if (previous && previous !== saved) deleteImage(previous);
      Alert.alert(
        "Đã đổi ảnh đại diện",
        "Ảnh mới sẽ tự sang máy người thương ở lần ghép nối tiếp theo.",
      );
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
                  loveNotes: state.settings.loveNotes,
                  theme: state.settings.theme,
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
                loveNotes: state.settings.loveNotes,
                theme: state.settings.theme,
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
        <Title small>Khoảnh khắc — chụp là hai máy cùng xem</Title>
        <Note>
          Thay cho cách gửi/nhận tệp thủ công trước đây: giờ bạn chỉ cần chụp
          ảnh ở trang chủ (mục “Gửi khoảnh khắc cho người thương”). Ảnh được nén
          nhỏ, gửi qua kết nối tức thời và lưu kèm ngày tháng trên cả hai máy.
        </Note>
        <Button label="Mở trang chủ để chụp" onPress={onOpenHome} />
        <Button
          label="Xuất tệp dự phòng (sao lưu)"
          secondary
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
          label="Phục hồi từ tệp dự phòng của chính bạn"
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
        <Title small>Hình nền &amp; chủ đề</Title>
        <Note>
          Chọn chủ đề cho trang chủ và cả ứng dụng — giống đổi chủ đề trong tin
          nhắn. Chủ đề chỉ đổi trên máy bạn.
        </Note>
        <View className="flex-row flex-wrap">
          {THEMES.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="radio"
              accessibilityState={{
                selected: state.settings.theme === item.id,
              }}
              accessibilityLabel={`Chủ đề ${item.name}`}
              onPress={() =>
                update({
                  type: "settings.set",
                  notify: state.settings.notify,
                  relay: state.settings.relay,
                  loveNotes: state.settings.loveNotes,
                  theme: item.id,
                })
              }
              className="items-center m-1"
            >
              <LinearGradient
                colors={[item.colors[0], item.deep[0]]}
                className={`w-16 h-16 rounded-2xl items-center justify-center ${
                  state.settings.theme === item.id
                    ? "border-2 border-ink"
                    : "border border-pink-100"
                }`}
              >
                <Text className="text-xl">{item.emoji[0]}</Text>
              </LinearGradient>
              <Text className="text-xs text-stone-600 mt-1">{item.name}</Text>
            </Pressable>
          ))}
        </View>
      </Card>
      <Card>
        <View className="flex-row justify-between items-center my-3">
          <Text className="text-ink flex-1">
            Lời yêu thương mỗi ngày (09:00 và 21:00)
          </Text>
          <Switch
            accessibilityLabel="Lời yêu thương mỗi ngày"
            value={state.settings.loveNotes}
            onValueChange={(value) =>
              update({
                type: "settings.set",
                notify: state.settings.notify,
                relay: state.settings.relay,
                theme: state.settings.theme,
                loveNotes: value,
              })
            }
            trackColor={{ true: "#e64980" }}
          />
        </View>
        <Note>
          Mỗi ngày hai máy nhận cùng một câu yêu thương hoặc thơ ngắn (câu chọn
          theo ngày nên không cần mạng). Cần bật quyền thông báo của máy. Nhắc
          lời nhắc kia (chu kỳ, ngày kỷ niệm) vẫn nằm ở mục “Lời nhắc trên máy
          này”.
        </Note>
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
      {lastError ? (
        <Card>
          <Title small>Lỗi gần nhất</Title>
          <Note>{lastError}</Note>
          <Note>
            Chụp màn hình dòng lỗi này gửi cho tôi là tôi sửa được ngay. Lỗi
            không làm mất dữ liệu của bạn.
          </Note>
          <Button label="Xóa dòng lỗi này" secondary onPress={onClearError} />
        </Card>
      ) : null}
      <Note>
        Hai Trái Tim {Constants.expoConfig?.version ?? "1.6.0"} (chế độ trên
        máy, bản dựng {Constants.expoConfig?.android?.versionCode ?? 7}) — ghi
        lại số này để biết máy đang chạy bản nào. Dữ liệu nằm trong thư mục
        riêng của ứng dụng, không tải lên máy chủ nào. Gỡ ứng dụng sẽ xóa dữ
        liệu, nên hãy xuất tệp dự phòng. Dự báo chu kỳ chỉ là phép tính lịch,
        không phải kết luận y tế và không dùng để tránh thai.
      </Note>
    </>
  );
}
