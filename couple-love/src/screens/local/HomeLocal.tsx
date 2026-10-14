import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { LinearGradient } from "expo-linear-gradient";
import ThreeHeart from "../../components/ThreeHeart";
import LoveBridgeArt from "../../components/LoveBridgeArt";
import DatePicker from "../../components/DatePicker";
import {
  Button,
  Card,
  Chip,
  GradientCard,
  Input,
  LocalAvatar,
  Note,
  Title,
  confirm,
} from "../../components/UI";
import { useTheme } from "../../theme/ThemeContext";
import { loveCounter } from "../../logic/time.mjs";
import { MOODS } from "../../logic/localState.mjs";
import { loveLineFor } from "../../logic/lovelines.mjs";
import { imageUri, saveImage } from "../../services/localdb";
import type { State } from "../../services/localdb";
// Ba câu nhớ nhau bấm một cái là đi ngay: máy người thương nổi thông báo như
// tin nhắn Messenger, nội dung cũng nằm trong mục Nhắn tin.
const QUICK_NOTES = [
  {
    emoji: "💌",
    label: "Nhớ người thương",
    text: "Nhớ người thương nhiều lắm 💌",
  },
  { emoji: "🥰", label: "Thương lắm", text: "Thương người thương lắm 🥰" },
  { emoji: "🌙", label: "Ngủ ngon nhé", text: "Ngủ ngon nhé, mơ đẹp 🌙" },
] as const;
export default function HomeLocal({
  state,
  update,
  openPair,
  relayStatus,
  onSendMoment,
  onQuickNote,
}: {
  state: State;
  update: (action: Record<string, unknown>) => void;
  openPair: () => void;
  relayStatus: {
    state: string;
    partnerOnline: boolean;
    partnerName?: string | null;
  };
  onSendMoment?: () => void;
  onQuickNote?: (text: string) => void;
}) {
  const { theme, wallpaper } = useTheme();
  const [now, setNow] = useState(Date.now());
  const [reduced, setReduced] = useState(false);
  const [picker, setPicker] = useState(false);
  const [camera, setCamera] = useState(false);
  const [caption, setCaption] = useState("");
  const [viewing, setViewing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const today = new Date().toISOString().slice(0, 10);
  const line = loveLineFor(today);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  const elapsed = loveCounter(state.anniversary, now);
  const partnerMood = MOODS.find((mood) => mood.id === state.partner?.mood);
  const moments = state.moments ?? [];
  const pickDate = useCallback(
    (date: Date) => {
      void (async () => {
        if (
          !(await confirm(
            "Đổi ngày bắt đầu?",
            "Ngày này được lưu trên máy bạn và gửi cho người thương ở lần mở app kế tiếp.",
          ))
        )
          return;
        try {
          update({ type: "anniversary.set", iso: date.toISOString() });
          setPicker(false);
          Alert.alert(
            "Đã lưu ngày bắt đầu yêu",
            `Từ ${date.toLocaleDateString("vi-VN")} — số ngày bên nhau đã tính lại.`,
          );
        } catch (error) {
          Alert.alert(
            "Chưa đổi ngày",
            error instanceof Error ? error.message : "Ngày không hợp lệ.",
          );
        }
      })();
    },
    [update],
  );
  const closePicker = useCallback(() => setPicker(false), []);
  async function keepMoment(uri: string) {
    const context = ImageManipulator.manipulate(uri);
    context.resize({ width: 720 });
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      compress: 0.62,
      format: SaveFormat.JPEG,
    });
    const id =
      "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const file = saveImage(saved.uri, `moment-${id}.jpg`);
    update({ type: "moment.add", id, file, caption });
    setCaption("");
    setCamera(false);
    onSendMoment?.();
  }
  async function shoot() {
    if (busy) return;
    setBusy(true);
    try {
      const shot = await cameraRef.current?.takePictureAsync({
        quality: 0.7,
        skipProcessing: false,
      });
      if (!shot?.uri) throw new Error("Chưa chụp được ảnh, bạn thử lại nhé.");
      await keepMoment(shot.uri);
    } catch (error) {
      Alert.alert(
        "Chưa lưu được khoảnh khắc",
        error instanceof Error ? error.message : "Có lỗi khi lưu ảnh.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function pickPhoto() {
    if (busy) return;
    setBusy(true);
    try {
      const allowed = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!allowed.granted)
        throw new Error("Cần quyền chọn ảnh từ thư viện để lưu khoảnh khắc.");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;
      await keepMoment(result.assets[0].uri);
    } catch (error) {
      Alert.alert(
        "Chưa lưu được khoảnh khắc",
        error instanceof Error ? error.message : "Có lỗi khi chọn ảnh.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function openCamera() {
    const result = permission?.granted ? permission : await requestPermission();
    if (!result.granted) {
      Alert.alert(
        "Quyền máy ảnh",
        "Hãy cấp quyền máy ảnh để chụp khoảnh khắc, hoặc dùng nút chọn ảnh từ thư viện.",
      );
      return;
    }
    setCamera(true);
  }
  const viewingMoment = moments.find((moment) => moment.id === viewing);
  const statusText =
    relayStatus.state === "online"
      ? `Đang kết nối với ${state.partner?.nickname || relayStatus.partnerName || "người thương"}`
      : relayStatus.state === "alone"
        ? "Đã vào phòng, chờ người thương mở app"
        : relayStatus.state === "connecting"
          ? "Đang kết nối…"
          : "Chưa bật kết nối tức thời";
  return (
    <>
      <LinearGradient
        colors={wallpaper ? [theme.glass, theme.glass] : theme.hero}
        style={{
          borderRadius: 32,
          padding: 18,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: theme.border,
          shadowColor: theme.glow,
          shadowOpacity: 0.22,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 10 },
          elevation: 5,
        }}
      >
        {theme.emoji.map((symbol, index) => (
          <Text
            key={symbol + index}
            className="absolute text-2xl"
            style={{
              opacity: 0.45,
              right: 14 + index * 36,
              top: 10 + (index % 2) * 44,
            }}
          >
            {symbol}
          </Text>
        ))}
        {/* Hai bạn: ảnh tròn có viền chuyển sắc, tên nằm trong viên thuốc */}
        <View className="flex-row items-center justify-between mb-2">
          <View className="items-center flex-1">
            <LinearGradient
              colors={theme.deep}
              style={{ borderRadius: 46, padding: 3 }}
            >
              <View
                style={{
                  borderRadius: 42,
                  backgroundColor: theme.surface,
                  padding: 2,
                }}
              >
                <LocalAvatar
                  name={state.me.nickname}
                  image={state.me.avatar}
                  size={66}
                />
              </View>
            </LinearGradient>
            <View
              className="px-3 py-1 mt-2"
              style={{
                backgroundColor: theme.glass,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: theme.border,
                maxWidth: 140,
              }}
            >
              <Text
                className="font-bold text-center"
                style={{ color: theme.ink }}
                numberOfLines={1}
              >
                {state.me.nickname}
              </Text>
            </View>
          </View>
          <View className="items-center px-2">
            <Text className="text-3xl" style={{ color: theme.text }}>
              ♥
            </Text>
            <Text className="text-xs" style={{ color: theme.sub }}>
              yêu nhau
            </Text>
          </View>
          <View className="items-center flex-1">
            <LinearGradient
              colors={theme.deep}
              style={{ borderRadius: 46, padding: 3 }}
            >
              <View
                style={{
                  borderRadius: 42,
                  backgroundColor: theme.surface,
                  padding: 2,
                }}
              >
                <LocalAvatar
                  name={state.partner?.nickname || "Người thương"}
                  image={state.partner?.avatar ?? null}
                  size={66}
                />
              </View>
            </LinearGradient>
            <View
              className="px-3 py-1 mt-2"
              style={{
                backgroundColor: theme.glass,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: theme.border,
                maxWidth: 140,
              }}
            >
              <Text
                className="font-bold text-center"
                style={{ color: theme.ink }}
                numberOfLines={1}
              >
                {state.partner?.nickname || "Chưa ghép nối"}
              </Text>
            </View>
          </View>
        </View>
        {/* Cầu tình yêu: tranh vẽ vector theo đúng ảnh bạn gửi — nhẹ, không mở
            thêm vùng WebGL nào nên máy yếu vẫn mượt. */}
        <LoveBridgeArt height={226} reduced={reduced} />
        <ThreeHeart reduced={reduced} height={272} />
        <View className="items-center mb-4">
          <Text
            className="text-xs uppercase"
            style={{ color: theme.text, letterSpacing: 3 }}
          >
            Chúng mình đã bên nhau
          </Text>
          <Text
            className="text-6xl font-bold mt-1"
            style={{ color: theme.ink }}
          >
            {elapsed.totalDays}
          </Text>
          <Text style={{ color: theme.sub }}>ngày yêu thương</Text>
        </View>
        <View className="flex-row flex-wrap items-center">
          <View className="mr-2 mb-2">
            <Chip>{statusText}</Chip>
          </View>
          <View className="mr-2 mb-2">
            <Chip>
              Bắt đầu: {new Date(state.anniversary).toLocaleDateString("vi-VN")}
            </Chip>
          </View>
        </View>
        <View className="flex-row">
          <View className="flex-1 mr-1">
            <Button
              label={picker ? "Đang mở lịch" : "Đổi ngày bắt đầu"}
              secondary={picker}
              onPress={() => setPicker(!picker)}
            />
          </View>
          <View className="flex-1 ml-1">
            <Button label="Khoảnh khắc mới" onPress={() => void openCamera()} />
          </View>
        </View>
        {picker ? (
          <DatePicker
            valueMs={new Date(state.anniversary).getTime()}
            onPick={pickDate}
            onClose={closePicker}
          />
        ) : null}
      </LinearGradient>
      <Card>
        <View className="flex-row flex-wrap justify-between">
          {[
            ["Năm", elapsed.years],
            ["Tháng", elapsed.months],
            ["Ngày", elapsed.days],
            ["Giờ", elapsed.hours],
            ["Phút", elapsed.minutes],
            ["Giây", elapsed.seconds],
          ].map(([label, value]) => (
            <View key={String(label)} className="items-center w-1/3 py-3">
              <Text
                className="text-3xl font-bold"
                style={{ color: theme.text }}
              >
                {String(value).padStart(2, "0")}
              </Text>
              <Text style={{ color: theme.sub }}>{String(label)}</Text>
            </View>
          ))}
        </View>
        <Note>
          Đồng hồ chạy theo ngày bắt đầu ở trên; ngày được lưu ngay trên máy này
          và gửi cho người thương khi hai máy cùng mở app.
        </Note>
      </Card>
      <Card>
        <Title small>Nhớ nhau một cái 💌</Title>
        <Note>
          Bấm một nút là tin bay sang máy người thương ngay: máy kia nổi thông
          báo như tin nhắn Messenger và tin cũng nằm trong mục Nhắn tin.
        </Note>
        <View className="flex-row flex-wrap mt-2">
          {QUICK_NOTES.map((item) => (
            <View key={item.label} className="mr-2 mb-2">
              <Button
                label={`${item.emoji} ${item.label}`}
                secondary
                onPress={() => {
                  try {
                    onQuickNote?.(item.text);
                  } catch (error) {
                    Alert.alert(
                      "Chưa gửi được",
                      error instanceof Error
                        ? error.message
                        : "Tin nhắn không hợp lệ.",
                    );
                  }
                }}
              />
            </View>
          ))}
        </View>
      </Card>
      <GradientCard>
        <View className="flex-row items-center justify-between mb-1">
          <Title small>Lời yêu thương hôm nay</Title>
          <Text className="text-2xl">{line.emoji}</Text>
        </View>
        <Text className="text-lg leading-7" style={{ color: theme.ink }}>
          {line.text}
        </Text>
        <Note>
          Câu này đổi mỗi ngày và giống nhau trên cả hai máy. Bật/tắt lời nhắc
          trong Cài đặt (mặc định 09:00 và 21:00).
        </Note>
      </GradientCard>
      <Card>
        <View className="flex-row items-center justify-between mb-2">
          <Title small>Khoảnh khắc của hai đứa</Title>
          <Chip tone="deep">{`${moments.length} tấm`}</Chip>
        </View>
        {moments.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {moments.slice(0, 20).map((moment) => (
              <Pressable
                key={moment.id}
                accessibilityRole="imagebutton"
                accessibilityLabel={`Khoảnh khắc ${new Date(moment.createdAt).toLocaleDateString("vi-VN")}`}
                onPress={() => setViewing(moment.id)}
                className="mr-3"
              >
                <LinearGradient
                  colors={theme.deep}
                  style={{ borderRadius: 20, padding: 2 }}
                >
                  <Image
                    source={{ uri: imageUri(moment.file) ?? "" }}
                    style={{ width: 118, height: 148, borderRadius: 18 }}
                  />
                </LinearGradient>
                <Text
                  className="text-xs mt-1 text-center"
                  style={{ color: theme.sub }}
                >
                  {moment.authorId === "partner" ? "người thương" : "bạn"} ·{" "}
                  {new Date(moment.createdAt).toLocaleDateString("vi-VN")}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Note>
            Chưa có tấm nào. Bấm “Khoảnh khắc mới” ở trên để chụp — ảnh tự sang
            máy người thương và cả hai cùng xem kèm ngày giờ.
          </Note>
        )}
      </Card>
      <Card>
        <Title small>Gửi khoảnh khắc cho người thương</Title>
        <Note>
          Chụp hoặc chọn một tấm ảnh, ghi vài chữ nếu muốn — ảnh được nén nhỏ
          rồi gửi tới máy người thương kèm ngày tháng. Cần Internet ở cả hai
          máy; người thương chưa mở app thì ảnh sang ở lần mở sau.
        </Note>
        <Input
          label="Ghi vài chữ cho khoảnh khắc này (không bắt buộc)"
          value={caption}
          onChangeText={setCaption}
        />
        <View className="flex-row">
          <View className="flex-1 mr-1">
            <Button
              label="Chụp ngay"
              busy={busy}
              onPress={() => void openCamera()}
            />
          </View>
          <View className="flex-1 ml-1">
            <Button
              label="Chọn từ thư viện"
              secondary
              busy={busy}
              onPress={() => void pickPhoto()}
            />
          </View>
        </View>
        {camera ? (
          <View className="mt-3">
            <CameraView
              ref={cameraRef}
              style={{ height: 340, borderRadius: 22 }}
              facing="front"
            />
            <View className="flex-row mt-1">
              <View className="flex-1 mr-1">
                <Button label="Chụp" busy={busy} onPress={() => void shoot()} />
              </View>
              <View className="flex-1 ml-1">
                <Button
                  label="Đóng máy ảnh"
                  secondary
                  onPress={() => setCamera(false)}
                />
              </View>
            </View>
          </View>
        ) : null}
        <Note>
          Trạng thái kết nối:{" "}
          {relayStatus.state === "online"
            ? "người thương đang trực tuyến — ảnh sang ngay"
            : relayStatus.state === "alone"
              ? "đã vào phòng, chờ người thương mở app"
              : relayStatus.state === "connecting"
                ? "đang kết nối…"
                : "chưa bật kết nối tức thời (bật ở Cài đặt)"}
          .
        </Note>
      </Card>
      {state.partner ? (
        <GradientCard>
          <View className="flex-row items-center justify-between">
            <Title small>{state.partner.nickname}</Title>
            <Chip>
              {partnerMood?.emoji} {partnerMood?.name}
            </Chip>
          </View>
          <Note>{state.partner.moodNote || "Chưa có ghi chú cảm xúc."}</Note>
          <Note>
            Cập nhật tự động qua kết nối tức thời khi hai máy cùng mở app.
          </Note>
        </GradientCard>
      ) : (
        <Card>
          <Title small>Chưa ghép nối</Title>
          <Note>
            Mở mục Ghép nối, một bạn tạo mã 6 số rồi bạn kia nhập đúng 6 số đó.
          </Note>
          <Button label="Mở mục Ghép nối" onPress={openPair} />
        </Card>
      )}
      <Modal
        visible={Boolean(viewingMoment)}
        animationType="fade"
        transparent
        onRequestClose={() => setViewing(null)}
      >
        <View className="flex-1 bg-black/85 items-center justify-center px-5">
          {viewingMoment ? (
            <>
              <Image
                source={{ uri: imageUri(viewingMoment.file) ?? "" }}
                style={{ width: 300, height: 380, borderRadius: 24 }}
                resizeMode="cover"
              />
              <Text className="text-white text-lg mt-3">
                {viewingMoment.authorId === "partner"
                  ? `Từ ${state.partner?.nickname ?? "người thương"}`
                  : "Bạn gửi"}
              </Text>
              <Text className="text-white/80 mt-1">
                {new Date(viewingMoment.createdAt).toLocaleString("vi-VN")}
              </Text>
              {viewingMoment.caption ? (
                <Text className="text-white mt-2 text-center">
                  {viewingMoment.caption}
                </Text>
              ) : null}
              <Text
                className="text-xs mt-2 text-center"
                style={{ color: "#e9d8ff" }}
              >
                {viewingMoment.authorId === "partner"
                  ? "Ảnh nhận từ người thương."
                  : viewingMoment.sentAt
                    ? "Đã gửi cho người thương."
                    : "Chưa gửi — sẽ gửi khi người thương mở app."}
              </Text>
              <View className="w-full mt-2">
                <Button
                  label="Đóng"
                  secondary
                  onPress={() => setViewing(null)}
                />
                <Button
                  label="Xóa khoảnh khắc này"
                  secondary
                  onPress={() =>
                    void (async () => {
                      if (
                        !(await confirm(
                          "Xóa khoảnh khắc?",
                          "Ảnh sẽ bị xóa khỏi máy này. Người thương vẫn giữ bản của họ.",
                        ))
                      )
                        return;
                      update({ type: "moment.remove", id: viewingMoment.id });
                      setViewing(null);
                    })()
                  }
                />
              </View>
            </>
          ) : null}
        </View>
      </Modal>
    </>
  );
}
