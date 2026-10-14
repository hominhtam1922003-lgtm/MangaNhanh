import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Share, Text, View } from "react-native";
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
const prettyCode = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;
export default function PairLocal({
  state,
  update,
  pairCode = "",
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
  /** Mã cố định theo tài khoản (rỗng nếu chưa đăng nhập). */
  pairCode?: string;
  initialCode: string;
  relayStatus: Status;
  relayLog: string[];
  selfTest: { name: string; ok: boolean; detail: string }[];
  onRunSelfTest: () => void;
  lastError: string;
  syncNow: () => void;
  onRetryRelay: () => void;
}) {
  const [mode, setMode] = useState<"pair" | "manual">("pair");
  const { theme } = useTheme();
  const [pasted, setPasted] = useState("");
  const [slow, setSlow] = useState(false);
  const [details, setDetails] = useState(false);
  const room: Room | null = (state.relay as Room | null) ?? null;
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
        <Title>Ở xa vẫn chung một nhà — bằng mã cố định của tài khoản</Title>
        <Note>
          Từ 1.18.0 hai máy ghép nối bằng mã cố định gắn với tài khoản
          Google/Facebook (không còn mã 6 số ngẫu nhiên). Bạn nhập mã của người
          thương — hoặc họ nhập mã của bạn — máy chủ ghi cho cả hai máy. Cả hai
          máy cần có Internet (WiFi hoặc 4G; máy ảo Android cũng phải bật mạng).
        </Note>
      </LinearGradient>
      <View className="flex-row mb-4">
        {(
          [
            ["pair", "Kết nối tài khoản"],
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
      {mode === "pair" ? (
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
            <Title small>Ghép nối bằng tài khoản (từ 1.18.0)</Title>
            <Note>
              Hai máy ghép nối bằng MÃ CỐ ĐỊNH gắn với tài khoản Google/Facebook
              của bạn; không còn mã 6 số ngẫu nhiên nên không thể nối nhầm người
              lạ hay tự nối lại phòng cũ. Mã cố định nằm ở màn hình ghép nối khi
              bạn mở app (chỗ nhập mã của người thương) — ai nhập trước cũng
              được, máy chủ ghi cho cả hai máy.
              {pairCode ? ` Mã cố định của bạn: ${prettyCode(pairCode)}.` : ""}
            </Note>
            <Note>
              Màn hình này chỉ còn để: xem “Chi tiết kết nối” của kênh trung
              chuyển và chuyển dữ liệu thủ công khi một máy không có mạng.
            </Note>
            <Button
              label="Chuyển dữ liệu thủ công (không cần mạng)"
              secondary
              onPress={() => setMode("manual")}
            />
          </Card>
        </>
      ) : (
        <Card>
          <Title small>Khi không có mạng ở một bên</Title>
          <Note>
            Cách này không cần Internet nhưng phải đưa mã qua lại hai lần: bạn
            gửi mã của mình, người thương dán vào đây, rồi gửi mã phản hồi lại
            cho bạn dán. Có mạng thì dùng ghép nối theo tài khoản cho nhanh.
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
                  "Mã ghép nối Mật Mã Yêu của mình đây, bạn dán vào mục “Không có mạng” nhé:\n" +
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
