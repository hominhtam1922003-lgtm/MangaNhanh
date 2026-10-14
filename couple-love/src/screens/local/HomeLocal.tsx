import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { LinearGradient } from "expo-linear-gradient";
import ThreeHeart from "../../components/ThreeHeart";
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
import { loveCounter } from "../../logic/time.mjs";
import { MOODS } from "../../logic/localState.mjs";
import { loveLineFor } from "../../logic/lovelines.mjs";
import { themeById } from "../../logic/themes.mjs";
import { imageUri, saveImage } from "../../services/localdb";
import type { State } from "../../services/localdb";
/** Picker nằm riêng và được memo: đồng hồ đếm mỗi giây không làm nó tự nhảy về hôm nay. */
const MIN_DATE = new Date(1900, 0, 1);
const AnniversaryPicker = memo(function AnniversaryPicker({
  valueMs,
  onPick,
  onClose,
}: {
  valueMs: number;
  onPick: (date: Date) => void;
  onClose: () => void;
}) {
  const maximum = useMemo(() => new Date(), []);
  return (
    <DateTimePicker
      value={new Date(valueMs)}
      maximumDate={maximum}
      minimumDate={MIN_DATE}
      mode="date"
      display={Platform.OS === "ios" ? "spinner" : "default"}
      onChange={(event, date) => {
        if (Platform.OS === "android") onClose();
        if (event.type === "set" && date) onPick(date);
      }}
    />
  );
});
export default function HomeLocal({
  state,
  update,
  openPair,
  relayStatus,
  onSendMoment,
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
}) {
  const [now, setNow] = useState(Date.now());
  const [reduced, setReduced] = useState(false);
  const [picker, setPicker] = useState(false);
  const [camera, setCamera] = useState(false);
  const [caption, setCaption] = useState("");
  const [viewing, setViewing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const theme = themeById(state.settings.theme);
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
            "Ngày này được lưu trên máy bạn và gửi cho người thương ở lần ghép nối tiếp theo.",
          ))
        )
          return;
        try {
          // Lưu ở 12 giờ trưa để đổi múi giờ không làm lệch ngày.
          const kept = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            12,
            0,
            0,
          );
          update({ type: "anniversary.set", iso: kept.toISOString() });
          Alert.alert(
            "Đã lưu ngày bắt đầu yêu",
            `Từ ${kept.toLocaleDateString("vi-VN")} — số ngày bên nhau đã tính lại.`,
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
    Alert.alert(
      "Đã lưu khoảnh khắc",
      "Ảnh sẽ tự sang máy người thương khi cả hai cùng mở app.",
    );
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
  return (
    <>
      <LinearGradient
        colors={theme.colors as [string, string]}
        className="rounded-3xl p-4 mb-3 -mt-1"
      >
        {theme.emoji.map((symbol, index) => (
          <Text
            key={symbol + index}
            className="absolute text-2xl"
            style={{
              opacity: 0.5,
              right: 12 + index * 34,
              top: 8 + (index % 2) * 46,
            }}
          >
            {symbol}
          </Text>
        ))}
        <View className="flex-row items-center justify-around mb-2">
          <View className="items-center max-w-36">
            <LocalAvatar name={state.me.nickname} image={state.me.avatar} />
            <Text className="text-ink font-semibold mt-2 text-center">
              {state.me.nickname}
            </Text>
          </View>
          <View className="items-center max-w-36">
            <LocalAvatar
              name={state.partner?.nickname || "Người thương"}
              image={state.partner?.avatar ?? null}
            />
            <Text className="text-ink font-semibold mt-2 text-center">
              {state.partner?.nickname || "Chưa ghép nối"}
            </Text>
          </View>
        </View>
        <ThreeHeart reduced={reduced} />
        <View className="items-center mb-5">
          <Text
            className="text-sm uppercase tracking-widest"
            style={{ color: theme.text }}
          >
            Chúng mình đã bên nhau
          </Text>
          <Text className="text-6xl font-bold text-ink mt-2">
            {elapsed.totalDays}
          </Text>
          <Text className="mt-1" style={{ color: theme.text }}>
            ngày yêu thương
          </Text>
        </View>
      </LinearGradient>
      {moments.length > 0 ? (
        <Card>
          <Title small>Khoảnh khắc của hai đứa</Title>
          <Note>
            {moments.length} khoảnh khắc — chụp là ảnh tự sang máy người thương,
            cả hai cùng xem.
          </Note>
          <View className="flex-row flex-wrap">
            {moments.slice(0, 9).map((moment) => (
              <Pressable
                key={moment.id}
                accessibilityRole="imagebutton"
                accessibilityLabel={`Khoảnh khắc ${new Date(moment.createdAt).toLocaleDateString("vi-VN")}`}
                onPress={() => setViewing(moment.id)}
                className="m-1"
              >
                <LinearGradient
                  colors={theme.deep as [string, string]}
                  className="rounded-2xl p-1"
                >
                  <Image
                    source={{ uri: imageUri(moment.file) ?? "" }}
                    style={{ width: 96, height: 96, borderRadius: 14 }}
                  />
                </LinearGradient>
                <Text className="text-xs text-stone-500 mt-1 text-center">
                  {moment.authorId === "partner" ? "người thương" : "bạn"} ·{" "}
                  {new Date(moment.createdAt).toLocaleDateString("vi-VN")}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : null}
      <Card>
        <Title small>Gửi khoảnh khắc cho người thương</Title>
        <Note>
          Chụp hoặc chọn một tấm ảnh, ghi vài chữ nếu muốn — ảnh được gửi tới
          máy người thương kèm ngày tháng, cả hai cùng xem. Cần Internet ở cả
          hai máy; người thương chưa mở app thì ảnh sẽ sang ở lần mở sau.
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
              style={{ height: 360, borderRadius: 22 }}
              facing="front"
            />
            <View className="flex-row mt-2">
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
            ? `người thương đang trực tuyến — ảnh sang ngay`
            : relayStatus.state === "alone"
              ? "đã vào phòng, chờ người thương mở app"
              : relayStatus.state === "connecting"
                ? "đang kết nối…"
                : "chưa bật kết nối tức thời (bật ở Cài đặt)"}
          .
        </Note>
      </Card>
      <GradientCard colors={theme.colors as [string, string]}>
        <Title small>Lời yêu thương hôm nay</Title>
        <Text className="text-3xl my-2">{line.emoji}</Text>
        <Text className="text-ink text-lg leading-7">{line.text}</Text>
        <Note>
          Câu này đổi mỗi ngày và giống nhau trên cả hai máy, nên hai đứa đọc
          cùng một câu. Có thể bật/tắt lời nhắc yêu thương trong Cài đặt (mặc
          định 09:00 và 21:00).
        </Note>
      </GradientCard>
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
              <Text className="text-3xl text-love font-bold">
                {String(value).padStart(2, "0")}
              </Text>
              <Text className="text-stone-500 mt-1">{String(label)}</Text>
            </View>
          ))}
        </View>
        <Note>
          Bắt đầu: {new Date(state.anniversary).toLocaleDateString("vi-VN")} ·
          lưu ngay trên máy này.
        </Note>
        <Button
          label="Chọn ngày bắt đầu"
          secondary
          onPress={() => setPicker(true)}
        />
        {picker ? (
          <>
            <AnniversaryPicker
              valueMs={new Date(state.anniversary).getTime()}
              onPick={pickDate}
              onClose={() => setPicker(false)}
            />
            {Platform.OS === "ios" ? (
              <Button
                label="Đóng bảng chọn ngày"
                secondary
                onPress={() => setPicker(false)}
              />
            ) : null}
          </>
        ) : null}
      </Card>
      {state.partner ? (
        <GradientCard colors={theme.colors as [string, string]}>
          <Title small>{state.partner.nickname}</Title>
          <Text className="text-love mb-2">
            {partnerMood?.emoji} {partnerMood?.name}
          </Text>
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
        <View className="flex-1 bg-black/80 items-center justify-center px-5">
          {viewingMoment ? (
            <>
              <Image
                source={{ uri: imageUri(viewingMoment.file) ?? "" }}
                style={{ width: 300, height: 380, borderRadius: 22 }}
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
              <Note>
                {viewingMoment.authorId === "partner"
                  ? "Ảnh nhận từ người thương."
                  : viewingMoment.sentAt
                    ? "Đã gửi cho người thương."
                    : "Chưa gửi — sẽ gửi khi người thương mở app."}
              </Note>
              <Button label="Đóng" secondary onPress={() => setViewing(null)} />
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
            </>
          ) : null}
        </View>
      </Modal>
    </>
  );
}
