import React, { useState } from "react";
import { Alert, Image, Pressable, Switch, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  ImageManipulator as ImageTool,
  SaveFormat,
} from "expo-image-manipulator";
import { LinearGradient } from "expo-linear-gradient";
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
import { deleteImage, imageUri, saveImage } from "../../services/localdb";
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
import { useTheme } from "../../theme/ThemeContext";
import { peerSupport, rtcSupport } from "../../services/rtcCall";
import { callServiceSupport } from "../../services/callService";
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
  onPickRingtone,
  onResetRingtone,
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
  /** Chọn nhạc chuông từ thư viện nhạc trong máy. */
  onPickRingtone: () => void;
  /** Trở về nhạc chuông có sẵn trong app. */
  onResetRingtone: () => void;
}) {
  const [name, setName] = useState(state.me.nickname);
  const [busy, setBusy] = useState(false);
  const { theme } = useTheme();
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
      const context = ImageTool.manipulate(result.assets[0].uri);
      context.resize({ width: 480 });
      const rendered = await context.renderAsync();
      const processed = await rendered.saveAsync({
        compress: 0.8,
        format: SaveFormat.JPEG,
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
          <Text className="flex-1" style={{ color: theme.ink }}>
            Khóa bằng Face ID / vân tay
          </Text>
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
            trackColor={{ true: theme.deep[1] }}
          />
        </View>
        <Note>
          Khóa khi rời ứng dụng. Không có mã dự phòng: nếu cảm biến hỏng, hãy xử
          lý trong cài đặt sinh trắc học của hệ thống.
        </Note>
        <View className="flex-row justify-between items-center my-3">
          <Text className="flex-1" style={{ color: theme.ink }}>
            Lời nhắc trên máy này
          </Text>
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
            trackColor={{ true: theme.deep[1] }}
          />
        </View>
        <Note>
          Lời nhắc dùng lịch của máy: mốc 08:00 trước kỳ 3 ngày, đầu kỳ và mốc
          rụng trứng ước tính, kèm ngày kỷ niệm. Máy có thể trì hoãn thông báo;
          đây không phải báo thức reo như chuông.
        </Note>
        <View className="flex-row justify-between items-center my-3">
          <Text className="flex-1" style={{ color: theme.ink }}>
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
            trackColor={{ true: theme.deep[1] }}
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
          Chọn chủ đề cho cả app — thẻ, nút, thanh dưới đều đổi theo nên giao
          diện hài hoà với nhau. Hai máy đang ghép nối sẽ dùng chung một giao
          diện: ai đổi sau thì cả hai cùng đổi.
        </Note>
        <View className="flex-row flex-wrap mt-2">
          {THEMES.map((item) => {
            const active =
              (state.appearance?.theme ?? state.settings.theme) === item.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Chủ đề ${item.name}`}
                onPress={() =>
                  update({
                    type: "appearance.set",
                    theme: item.id,
                    wallpaperId: state.appearance?.wallpaperId ?? null,
                    wallpaper: state.appearance?.wallpaper ?? null,
                  })
                }
                className="items-center mr-2 mb-3"
              >
                <LinearGradient
                  colors={item.hero as [string, string]}
                  style={{
                    borderRadius: 20,
                    padding: 3,
                    borderWidth: active ? 3 : 1,
                    borderColor: active ? item.deep[1] : item.border,
                  }}
                >
                  <View
                    style={{
                      width: 74,
                      height: 74,
                      borderRadius: 16,
                      backgroundColor: item.surface,
                      justifyContent: "space-between",
                      padding: 7,
                      overflow: "hidden",
                    }}
                  >
                    <Text
                      style={{
                        position: "absolute",
                        right: -4,
                        bottom: -6,
                        fontSize: 30,
                        opacity: 0.35,
                      }}
                    >
                      {item.deco?.[0] ?? item.emoji[0]}
                    </Text>
                    <Text
                      style={{
                        position: "absolute",
                        left: -6,
                        top: 26,
                        fontSize: 22,
                        opacity: 0.3,
                      }}
                    >
                      {item.deco?.[1] ?? item.emoji[1]}
                    </Text>
                    <View className="flex-row justify-between">
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          backgroundColor: item.deep[0],
                        }}
                      />
                      <Text className="text-base">{item.emoji[0]}</Text>
                    </View>
                    <View>
                      <View
                        style={{
                          height: 7,
                          borderRadius: 4,
                          backgroundColor: item.ink,
                          opacity: 0.75,
                          marginBottom: 5,
                        }}
                      />
                      <View
                        style={{
                          height: 7,
                          width: "62%",
                          borderRadius: 4,
                          backgroundColor: item.soft,
                        }}
                      />
                    </View>
                    <View
                      style={{
                        height: 9,
                        borderRadius: 5,
                        backgroundColor: item.deep[1],
                        opacity: 0.85,
                      }}
                    />
                  </View>
                </LinearGradient>
                <Text
                  className="text-xs mt-1"
                  style={{
                    color: active ? item.deep[1] : theme.sub,
                    fontWeight: active ? "700" : "400",
                  }}
                >
                  {item.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Note>
          Ảnh nền: chọn một tấm trong thư viện để làm nền app. Khi có ảnh nền,
          các ô trong giao diện tự mờ đi để thấy ảnh phía sau (kiểu Zalo). Ảnh
          được nén nhỏ rồi gửi sang máy người thương để hai máy nhìn giống nhau;
          chưa kết nối thì máy kia nhận khi mở app.
        </Note>
        {state.appearance?.wallpaper ? (
          <View className="mt-3">
            <Text className="font-semibold" style={{ color: theme.ink }}>
              Ảnh nền rõ tới đâu?
            </Text>
            <Note>
              Kéo xuống “Ảnh rõ” nếu muốn thấy ảnh nổi hơn, hoặc lên “Chữ rõ”
              nếu chữ khó đọc trên ảnh.
            </Note>
            <View className="flex-row flex-wrap mt-2">
              {(
                [
                  { label: "Ảnh rõ", value: 0.3 },
                  { label: "Vừa", value: 0.5 },
                  { label: "Chữ rõ", value: 0.7 },
                ] as const
              ).map((item) => {
                const selected =
                  Math.abs((state.settings.wallpaperTint ?? 0.5) - item.value) <
                  0.01;
                return (
                  <View key={item.label} className="mr-2 mb-2">
                    <Button
                      label={item.label}
                      secondary={!selected}
                      onPress={() =>
                        update({
                          type: "settings.set",
                          notify: state.settings.notify,
                          relay: state.settings.relay,
                          loveNotes: state.settings.loveNotes,
                          theme: state.settings.theme,
                          wallpaperTint: item.value,
                        })
                      }
                    />
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}
        {state.appearance?.wallpaper ? (
          <View className="flex-row items-center mb-1">
            <Image
              source={{ uri: imageUri(state.appearance.wallpaper) ?? "" }}
              style={{ width: 64, height: 96, borderRadius: 14 }}
            />
            <View className="flex-1 ml-3">
              <Text className="font-semibold" style={{ color: theme.ink }}>
                Đang dùng ảnh nền này
              </Text>
              <Note>
                Bấm “Bỏ ảnh nền” nếu muốn quay lại nền chuyển sắc của chủ đề.
              </Note>
            </View>
          </View>
        ) : (
          <Note>
            Hiện chưa đặt ảnh nền, app đang dùng nền chuyển sắc của chủ đề.
          </Note>
        )}
        <Button
          label="Chọn ảnh từ thư viện làm nền"
          busy={busy}
          onPress={() =>
            void run(async () => {
              const allowed =
                await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!allowed.granted)
                throw new Error("Cần quyền chọn ảnh từ thư viện.");
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                allowsEditing: false,
                quality: 0.9,
              });
              if (result.canceled || !result.assets?.length) return;
              const context = ImageTool.manipulate(result.assets[0].uri);
              context.resize({ width: 1080 });
              const rendered = await context.renderAsync();
              const saved = await rendered.saveAsync({
                compress: 0.72,
                format: SaveFormat.JPEG,
              });
              const id = "w" + Date.now().toString(36);
              const previous = state.appearance?.wallpaper;
              const file = saveImage(saved.uri, `wallpaper-${id}.jpg`);
              update({
                type: "appearance.set",
                theme: state.appearance?.theme ?? state.settings.theme,
                wallpaperId: id,
                wallpaper: file,
              });
              if (previous && previous !== file) deleteImage(previous);
              Alert.alert(
                "Đã đặt ảnh nền",
                "Ảnh nền sẽ sang máy người thương ở lần kết nối kế tiếp.",
              );
            })
          }
        />
        {state.appearance?.wallpaper ? (
          <Button
            label="Bỏ ảnh nền"
            secondary
            onPress={() => {
              const previous = state.appearance?.wallpaper;
              update({
                type: "appearance.set",
                theme: state.appearance?.theme ?? state.settings.theme,
                wallpaperId: null,
                wallpaper: null,
              });
              if (previous) deleteImage(previous);
            }}
          />
        ) : null}
      </Card>
      <Card>
        <Title small>Nhạc chuông cuộc gọi</Title>
        <View className="mb-3">
          <Text style={{ color: theme.ink }}>
            {state.settings.ringtoneName
              ? `Đang dùng: ${state.settings.ringtoneName}`
              : "Đang dùng nhạc chuông có sẵn trong app"}
          </Text>
          <Note>
            Bạn có thể lấy một bài nhạc trong thư viện nhạc của máy làm nhạc
            chuông khi người thương gọi tới. Nhạc này chỉ đổi trên máy bạn.
          </Note>
          <View className="flex-row mt-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chọn nhạc chuông từ thư viện nhạc trong máy"
              onPress={onPickRingtone}
              className="mr-3 px-4 py-2 rounded-full"
              style={{ backgroundColor: theme.deep[1] }}
            >
              <Text className="font-bold" style={{ color: theme.onDeep }}>
                🎵 Chọn nhạc trong máy
              </Text>
            </Pressable>
            {state.settings.ringtone ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Trở về nhạc chuông mặc định"
                onPress={onResetRingtone}
                className="px-4 py-2 rounded-full"
                style={{
                  backgroundColor: theme.soft,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <Text style={{ color: theme.ink }}>Nhạc mặc định</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        <Title small>Nhắc nhở &amp; lời yêu tự động</Title>
        <View className="flex-row justify-between items-center my-3">
          <View className="flex-1 pr-2">
            <Text style={{ color: theme.ink }}>
              Cho người thương biết mình đã xem tin
            </Text>
            <Note>
              Tắt thì máy bạn không báo “đã xem” và cũng không hiện “đã xem” của
              máy kia — đọc tin vẫn bình thường.
            </Note>
          </View>
          <Switch
            accessibilityLabel="Cho biết đã xem tin nhắn"
            value={state.settings.readReceipts !== false}
            onValueChange={(value) =>
              update({
                type: "settings.set",
                notify: state.settings.notify,
                relay: state.settings.relay,
                loveNotes: state.settings.loveNotes,
                theme: state.settings.theme,
                readReceipts: value,
              })
            }
          />
        </View>
        <View className="flex-row justify-between items-center my-3">
          <View className="flex-1 pr-2">
            <Text style={{ color: theme.ink }}>
              Tự gửi lời yêu hoặc thơ mỗi 2 tiếng
            </Text>
            <Note>
              Chỉ gửi trong khung 07:00–22:00, ban đêm không làm phiền. Vào mục
              Tin nhắn xem lần gửi gần nhất.
            </Note>
          </View>
          <Switch
            accessibilityLabel="Tự gửi lời yêu mỗi 2 tiếng"
            value={state.settings.autoLove !== false}
            onValueChange={(value) =>
              update({
                type: "settings.set",
                notify: state.settings.notify,
                relay: state.settings.relay,
                loveNotes: state.settings.loveNotes,
                theme: state.settings.theme,
                autoLove: value,
              })
            }
          />
        </View>
        <View className="flex-row justify-between items-center my-3">
          <View className="flex-1 pr-2">
            <Text style={{ color: theme.ink }}>
              Nhắc khi mình chưa trả lời người thương
            </Text>
            <Note>
              Quá 3 phút chưa trả lời: “Người ấy vẫn đang đợi tin nhắn từ bạn”.
              Quá 1 tiếng nhắc thêm một lời yêu. Không nhắc từ 22:00 đến 07:00.
            </Note>
          </View>
          <Switch
            accessibilityLabel="Nhắc khi chưa trả lời"
            value={state.settings.replyNudge !== false}
            onValueChange={(value) =>
              update({
                type: "settings.set",
                notify: state.settings.notify,
                relay: state.settings.relay,
                loveNotes: state.settings.loveNotes,
                theme: state.settings.theme,
                replyNudge: value,
              })
            }
          />
        </View>
      </Card>
      <Card>
        <View className="flex-row justify-between items-center my-3">
          <Text className="flex-1" style={{ color: theme.ink }}>
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
            trackColor={{ true: theme.deep[1] }}
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
        Cuộc gọi tiếng trực tiếp — lớp 1 PeerJS: {peerSupport().detail}; lớp 2
        WebRTC: {rtcSupport().detail}; khi tắt màn hình:{" "}
        {callServiceSupport().detail}. Khi đã nối trực tiếp, tiếng đi thẳng từ
        máy này sang máy kia nên liền mạch như gọi thường; mạng khó thì PeerJS
        đưa tiếng qua máy chủ trung chuyển miễn phí của họ, còn nếu cả hai lớp
        đều không nối được thì app tự quay về đường tiếng qua kênh ghép nối,
        không ai bị mất cuộc gọi. Ghi lại dòng này nếu cuộc gọi còn đứt quãng để
        tôi biết máy đang dùng đường tiếng nào.
      </Note>
      <Note>
        Hai Trái Tim {Constants.expoConfig?.version ?? "1.15.0"} (chế độ trên
        máy, bản dựng {Constants.expoConfig?.android?.versionCode ?? 17}) — ghi
        lại số này để biết máy đang chạy bản nào. Dữ liệu nằm trong thư mục
        riêng của ứng dụng, không tải lên máy chủ nào. Gỡ ứng dụng sẽ xóa dữ
        liệu, nên hãy xuất tệp dự phòng. Dự báo chu kỳ chỉ là phép tính lịch,
        không phải kết luận y tế và không dùng để tránh thai.
      </Note>
    </>
  );
}
