import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, Share, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { CameraView, useCameraPermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import {
  Button,
  Card,
  Input,
  LocalAvatar,
  Note,
  Title,
  confirm,
} from "../../components/UI";
import { codeChunks, importPayload, linkCode } from "../../services/localsync";
import {
  createRoom,
  makeCode,
  roomFromCode,
  roomFromQr,
  roomToQr,
} from "../../services/relay";
import { joinCodes } from "../../logic/localState.mjs";
import { useTheme } from "../../theme/ThemeContext";
import type { State } from "../../services/localdb";
type Room = {
  id: string;
  key: string;
  mode: string;
  code?: string | null;
  role?: string | null;
};
type Status = {
  state: string;
  broker: string | null;
  partnerOnline: boolean;
  partnerName?: string | null;
  readyCount?: number;
  summary?: { host: string; state: string }[];
};
const digitsOf = (text: string) => text.replace(/\D/g, "").slice(0, 6);
const prettyCode = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;
export default function PairLocal({
  state,
  update,
  initialCode,
  relayStatus,
  relayLog,
  selfTest,
  onRunSelfTest,
  lastError,
  syncNow,
  onRetryRelay,
}: {
  state: State;
  update: (action: Record<string, unknown>) => void;
  initialCode: string;
  relayStatus: Status;
  relayLog: string[];
  selfTest: { name: string; ok: boolean; detail: string }[];
  onRunSelfTest: () => void;
  lastError: string;
  syncNow: () => void;
  onRetryRelay: () => void;
}) {
  const [mode, setMode] = useState<"code" | "manual">("code");
  const { theme } = useTheme();
  const [extra, setExtra] = useState(false);
  const [joinValue, setJoinValue] = useState("");
  const [scanner, setScanner] = useState(false);
  const [pasted, setPasted] = useState("");
  const [permission, requestPermission] = useCameraPermissions();
  const [slow, setSlow] = useState(false);
  const [details, setDetails] = useState(false);
  const handled = useRef("");
  const room: Room | null = (state.relay as Room | null) ?? null;
  const guest = room?.role === "guest";
  const partnerName =
    relayStatus.partnerName ?? state.partner?.nickname ?? null;
  const chunks = useMemo(() => codeChunks(linkCode(state)), [state]);
  const partnerDiary = state.diary.filter(
    (entry) => entry.authorId === "partner",
  ).length;
  const online = relayStatus.state === "online";
  const statusLine = online
    ? `Đã ghép nối với ${partnerName ?? "người thương"} — hai máy đang chung dữ liệu`
    : relayStatus.state === "alone"
      ? room
        ? "Đã nối trạm · đang chờ người thương nhập mã"
        : "Đã nối trạm · hãy tạo mã 6 số ở bước 1"
      : relayStatus.state === "connecting"
        ? "Đang kết nối tới trạm trung chuyển…"
        : "Chưa bật kết nối tức thời (bật ở Cài đặt)";
  useEffect(() => {
    if (!room || room.mode !== "code") return;
    if (online || state.partner) return;
    void syncNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, online, state.partner?.nickname]);
  function startCodeRoom() {
    const code = makeCode();
    update({
      type: "relay.set",
      room: { ...roomFromCode(code), code, role: "host" },
    });
  }
  function startQrRoom() {
    const created = createRoom();
    update({
      type: "relay.set",
      room: { ...created, code: null, role: "host" },
    });
    Alert.alert(
      "Đã tạo mã QR",
      "Cho người thương quét mã này. Khi họ quét xong là hai máy chung dữ liệu luôn, bạn không phải quét lại.",
    );
  }
  function joinWith(text: string) {
    try {
      const value = String(text).trim();
      const digits = digitsOf(value);
      const target =
        value.startsWith("HTT2:") || digits.length === 6
          ? roomFromQr(value.startsWith("HTT2:") ? value : digits)
          : null;
      if (!target) throw new Error("Mã kết nối phải gồm đúng 6 chữ số.");
      if (handled.current === target.id) return;
      handled.current = target.id;
      update({
        type: "relay.set",
        room: { ...target, code: digits, role: "guest" },
      });
      setScanner(false);
      setJoinValue("");
    } catch (error) {
      Alert.alert(
        "Chưa kết nối được",
        error instanceof Error ? error.message : "Mã không hợp lệ.",
      );
    }
  }
  useEffect(() => {
    if (relayStatus.state !== "connecting") {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), 20000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relayStatus.state, relayStatus.readyCount]);
  function applyManual(raw: string) {
    try {
      const codes = raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const { payload, images, diaryCount } = importPayload(
        codes.length > 1 ? joinCodes(codes) : codes[0],
      );
      update({ type: "partner.merge", state: payload });
      setPasted("");
      Alert.alert(
        "Đã nhận dữ liệu",
        `${payload.from.nickname}: ${diaryCount} kỷ niệm${images ? `, ${images} ảnh` : ""}.`,
      );
    } catch (error) {
      Alert.alert(
        "Mã chưa hợp lệ",
        error instanceof Error ? error.message : "Hãy kiểm tra lại mã.",
      );
    }
  }
  const statusDot = online
    ? "bg-emerald-500"
    : relayStatus.state === "alone"
      ? "bg-amber-400"
      : relayStatus.state === "connecting"
        ? "bg-sky-400"
        : "bg-stone-300";
  return (
    <>
      <LinearGradient
        colors={[theme.hero[0], theme.hero[1]]}
        className="rounded-3xl p-5 mb-4"
      >
        <Text className="text-4xl mb-2">💞</Text>
        <Title>Ở xa vẫn chung một nhà — bằng mã 6 số</Title>
        <Note>
          Một bạn bấm “Tạo mã 6 số”, bạn kia nhập đúng 6 số đó. Kết nối xong là
          hai máy tự gửi dữ liệu cho nhau và cùng nhận ghép nối, không phải quét
          hay nhập lại ở bên nào. Cả hai máy cần có Internet (WiFi hoặc 4G).
        </Note>
      </LinearGradient>
      <View className="flex-row mb-4">
        {(
          [
            ["code", "Mã 6 số"],
            ["manual", "Không có mạng"],
          ] as const
        ).map(([id, label]) => (
          <Pressable
            key={id}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === id }}
            onPress={() => setMode(id)}
            className="flex-1 mx-1"
          >
            <LinearGradient
              colors={mode === id ? theme.deep : [theme.soft, theme.soft]}
              className="rounded-2xl py-3 items-center"
            >
              <Text
                className={mode === id ? "font-bold" : "font-semibold"}
                style={{ color: mode === id ? theme.onDeep : theme.text }}
              >
                {label}
              </Text>
            </LinearGradient>
          </Pressable>
        ))}
      </View>
      {mode === "code" ? (
        <>
          <Card>
            <View className="flex-row items-center mb-2">
              <View className={`w-3 h-3 rounded-full mr-3 ${statusDot}`} />
              <Text
                className="font-semibold flex-1"
                style={{ color: theme.ink }}
              >
                {statusLine}
              </Text>
            </View>
            {state.partner ? (
              <View className="flex-row items-center my-3">
                <LocalAvatar
                  name={state.partner.nickname}
                  image={state.partner.avatar}
                  size={48}
                />
                <View className="ml-4 flex-1">
                  <Text className="font-bold" style={{ color: theme.ink }}>
                    {state.partner.nickname}
                  </Text>
                  <Text className="text-sm" style={{ color: theme.sub }}>
                    Cảm xúc: {state.partner.moodNote || "chưa có ghi chú"} ·{" "}
                    {partnerDiary} kỷ niệm nhận được
                  </Text>
                </View>
              </View>
            ) : (
              <Note>
                Chưa nhận được dữ liệu của người thương. Làm xong bước 1 và bước
                2 là dữ liệu về ngay.
              </Note>
            )}
            {slow ? (
              <Note>
                Máy này chưa tới được trạm trung chuyển nào. Hãy kiểm tra
                WiFi/4G của máy (máy ảo Android cũng cần bật mạng), rồi bấm “Thử
                kết nối lại”. Nếu vẫn không được, mở “Chi tiết kết nối” để xem
                từng trạm báo gì.
              </Note>
            ) : null}
            <Button label="Thử kết nối lại" secondary onPress={onRetryRelay} />
            {room ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Chi tiết kết nối"
                onPress={() => setDetails(!details)}
              >
                <Text
                  className="font-semibold mt-3"
                  style={{ color: theme.text }}
                >
                  {details
                    ? "▲ Ẩn chi tiết kết nối"
                    : `▼ Chi tiết kết nối (${relayStatus.readyCount ?? 0}/${relayStatus.summary?.length ?? 0} trạm sẵn sàng)`}
                </Text>
              </Pressable>
            ) : null}
            {details && room ? (
              <View className="mt-2">
                {(relayStatus.summary ?? []).map((item) => (
                  <Text
                    key={item.host}
                    className="text-xs"
                    style={{ color: theme.sub }}
                  >
                    {item.state === "sẵn sàng" ? "● " : "○ "}
                    {item.host}: {item.state}
                  </Text>
                ))}
                {selfTest.map((item) => (
                  <Text
                    key={item.name}
                    className="text-xs"
                    style={{ color: theme.sub }}
                  >
                    {item.ok ? "✓ " : "✗ "}
                    {item.name}: {item.detail}
                  </Text>
                ))}
                <Button
                  label="Tự kiểm tra lại"
                  secondary
                  onPress={onRunSelfTest}
                />
                {relayLog.slice(-6).map((line) => (
                  <Text
                    key={line}
                    className="text-xs mt-1"
                    style={{ color: theme.sub }}
                  >
                    {line}
                  </Text>
                ))}
                {lastError ? (
                  <Note>Lỗi gần nhất trên máy: {lastError}</Note>
                ) : null}
              </View>
            ) : null}
            <Button
              label="Gửi lại toàn bộ dữ liệu ngay"
              busy={!room}
              onPress={syncNow}
              disabled={!room}
            />
            {room ? (
              <Note>
                Trạm trung chuyển (
                {relayStatus.broker?.replace("wss://", "") ?? "chưa nối"}) chỉ
                thấy dữ liệu đã mã hóa. Khóa phòng chỉ nằm trong máy hai bạn.
              </Note>
            ) : null}
          </Card>
          <Card>
            <Title small>
              {guest
                ? "Bạn đang vào phòng của người thương"
                : "Bước 1 — Bạn tạo mã cho người thương"}
            </Title>
            <Note>
              {guest
                ? "Bạn đã nhập mã của người thương nên không phải gửi mã cho ai nữa. Cứ để app mở; khi dòng trạng thái ghi “Đã ghép nối với …” là hai máy đã chung dữ liệu."
                : "Bấm tạo mã rồi gửi 6 số này cho người thương qua tin nhắn bất kỳ. Bạn không phải làm gì thêm."}
            </Note>
            {room && room.mode === "code" && room.code && !guest ? (
              <View className="items-center py-4">
                <Text
                  selectable
                  accessibilityLabel={`Mã kết nối ${room.code}`}
                  className="text-6xl font-bold tracking-widest"
                  style={{ color: theme.text }}
                >
                  {prettyCode(room.code)}
                </Text>
                <Text className="text-sm mt-2" style={{ color: theme.sub }}>
                  {online
                    ? `Đã ghép nối với ${partnerName ?? "người thương"}.`
                    : guest
                      ? "Đang chờ người thương mở app…"
                      : "Đang chờ người thương nhập mã…"}
                </Text>
              </View>
            ) : null}
            {guest && room?.code ? (
              <Note>
                Bạn đã vào phòng bằng mã {prettyCode(room.code)} của người
                thương. Không cần gửi mã đi đâu nữa.
              </Note>
            ) : null}
            {guest && room?.code ? (
              <Note>
                Bạn đã vào phòng bằng mã {prettyCode(room.code)} của người
                thương. Không cần gửi mã đi đâu nữa.
              </Note>
            ) : null}
            <Button
              label={
                guest
                  ? "Tạo phòng mới của bạn (đổi mã khác)"
                  : room && room.mode === "code"
                    ? "Tạo mã 6 số khác"
                    : "Tạo mã 6 số"
              }
              secondary={guest}
              onPress={startCodeRoom}
            />
            {room && room.mode === "code" && room.code && !guest ? (
              <Button
                label="Gửi mã cho người thương"
                secondary
                onPress={() =>
                  void Share.share({
                    message:
                      `Mã kết nối Hai Trái Tim của mình: ${room.code}\n` +
                      "Bạn mở app → mục Ghép nối → nhập 6 số này là hai máy chung dữ liệu luôn nhé.",
                  }).catch(() => {})
                }
              />
            ) : null}
          </Card>
          <Card>
            <Title small>Bước 2 — Bạn nhập mã người thương gửi</Title>
            <Note>
              Nhập đúng 6 chữ số người thương gửi. Vào phòng là máy bạn gửi dữ
              liệu của mình đi và nhận dữ liệu của họ về, cả hai bên cùng thấy
              đã ghép nối.
            </Note>
            <Input
              label="Mã 6 số của người thương"
              value={joinValue}
              onChangeText={(text) => setJoinValue(digitsOf(text))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="Ví dụ 482913"
            />
            <Button
              label={
                joinValue.length === 6 ? `Kết nối với ${joinValue}` : "Kết nối"
              }
              disabled={joinValue.length !== 6}
              onPress={() => joinWith(joinValue)}
            />
            {room && relayStatus.state !== "off" ? (
              <Button
                label="Rời phòng kết nối"
                secondary
                onPress={() =>
                  void (async () => {
                    if (
                      !(await confirm(
                        "Rời phòng?",
                        "Tắt kết nối tức thời. Dữ liệu đã nhận vẫn giữ trên máy.",
                      ))
                    )
                      return;
                    update({ type: "relay.set", room: null });
                  })()
                }
              />
            ) : null}
          </Card>
          <Card>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cách khác: quét mã QR hoặc dán mã"
              onPress={() => setExtra(!extra)}
            >
              <Text className="font-semibold" style={{ color: theme.text }}>
                {extra ? "▲ Ẩn cách khác" : "▼ Cách khác: quét mã QR / dán mã"}
              </Text>
            </Pressable>
            {extra ? (
              <>
                <Note>
                  Dùng khi bạn thích quét hơn là nhập số. Cách này cũng cần
                  Internet và vẫn chỉ cần một bên quét.
                </Note>
                <View className="flex-row">
                  <View className="flex-1 mr-1">
                    <Button label="Tạo mã QR" secondary onPress={startQrRoom} />
                  </View>
                  <View className="flex-1 ml-1">
                    <Button
                      label={scanner ? "Đóng máy quét" : "Quét mã QR"}
                      secondary
                      onPress={() =>
                        void (async () => {
                          const result = permission?.granted
                            ? permission
                            : await requestPermission();
                          if (!result.granted) {
                            Alert.alert(
                              "Quyền máy ảnh",
                              "Hãy cấp quyền máy ảnh hoặc dùng mã 6 số ở bước 2.",
                            );
                            return;
                          }
                          setScanner(!scanner);
                        })()
                      }
                    />
                  </View>
                </View>
                {room && room.mode === "qr" ? (
                  <LinearGradient
                    colors={[theme.surface, theme.soft]}
                    className="items-center rounded-3xl py-5 my-3"
                  >
                    <QRCode
                      value={roomToQr(room)}
                      size={220}
                      color={theme.text}
                    />
                    <Text
                      selectable
                      className="text-xs mt-3"
                      style={{ color: theme.sub }}
                    >
                      {roomToQr(room)}
                    </Text>
                  </LinearGradient>
                ) : null}
                {scanner ? (
                  <CameraView
                    style={{
                      height: 280,
                      borderRadius: 22,
                      marginVertical: 10,
                    }}
                    barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                    onBarcodeScanned={({ data }) => {
                      if (data.startsWith("HTT2:")) joinWith(data);
                    }}
                  />
                ) : null}
              </>
            ) : null}
          </Card>
        </>
      ) : (
        <Card>
          <Title small>Khi không có mạng ở một bên</Title>
          <Note>
            Cách này không cần Internet nhưng phải đưa mã qua lại hai lần: bạn
            gửi mã của mình, người thương dán vào đây, rồi gửi mã phản hồi lại
            cho bạn dán. Có mạng thì hãy dùng “Mã 6 số” cho nhanh.
          </Note>
          <Input
            label="Dán mã của người thương"
            value={pasted}
            onChangeText={setPasted}
            multiline
          />
          <Button
            label="Nhận dữ liệu từ mã đã dán"
            disabled={pasted.trim().length < 10}
            onPress={() => applyManual(pasted)}
          />
          <Button
            label="Chia sẻ mã phản hồi của bạn"
            secondary
            onPress={() =>
              void Share.share({
                message:
                  "Mã Hai Trái Tim của mình đây, bạn dán vào mục “Không có mạng” nhé:\n" +
                  chunks.join("\n"),
              }).catch(() => {})
            }
          />
        </Card>
      )}
      {state.partner ? (
        <Card>
          <Title small>Hủy ghép nối</Title>
          <Note>
            Đang nhận dữ liệu của {state.partner.nickname}. Dữ liệu của bạn vẫn
            giữ nguyên nếu hủy.
          </Note>
          <Button
            label="Hủy nối với người thương"
            secondary
            onPress={() =>
              void (async () => {
                if (
                  !(await confirm(
                    "Hủy nối?",
                    "Hồ sơ người thương và kỷ niệm do người thương gửi sẽ bị xóa khỏi máy này. Dữ liệu của bạn vẫn giữ nguyên.",
                  ))
                )
                  return;
                update({ type: "partner.unlink" });
              })()
            }
          />
        </Card>
      ) : null}
      <Card>
        <Title small>Cần biết</Title>
        <Note>
          Kết nối tức thời đi qua một trạm trung chuyển công cộng miễn phí
          (không phải máy chủ của bạn) nên hai máy tìm thấy nhau ở bất cứ đâu,
          nhưng nội dung luôn được mã hóa đầu-cuối và chỉ mở được bằng mã 6 số
          của hai bạn. Khi cả hai cùng mở app thì dữ liệu cập nhật liên tục; khi
          một bên đóng app, dữ liệu mới sẽ được gửi bù ở lần mở sau. Muốn gửi cả
          nhật ký kèm ảnh thì dùng “Xuất và chia sẻ tệp dữ liệu” trong Cài đặt.
        </Note>
        {initialCode ? <Note>Bạn mở mục này từ Cài đặt.</Note> : null}
      </Card>
    </>
  );
}
