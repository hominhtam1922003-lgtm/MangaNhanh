import React, { useMemo, useState } from "react";
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
import { joinCodes } from "../../logic/localState.mjs";
import type { State } from "../../services/localdb";
type Receipt = { name: string; cycle: boolean; diary: number; images: number };
export default function PairLocal({
  state,
  update,
  initialCode,
}: {
  state: State;
  update: (action: Record<string, unknown>) => void;
  initialCode: string;
}) {
  const [step, setStep] = useState<"scan" | "reply">(
    state.partner ? "reply" : "scan",
  );
  const [chunk, setChunk] = useState(0);
  const [scanner, setScanner] = useState(false);
  const [scanned, setScanned] = useState<string[]>([]);
  const [pasted, setPasted] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const chunks = useMemo(() => codeChunks(linkCode(state)), [state]);
  const partnerDiary = state.diary.filter(
    (entry) => entry.authorId === "partner",
  ).length;
  function apply(raw: string) {
    try {
      const codes = raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const payloadText = codes.length > 1 ? joinCodes(codes) : codes[0];
      const { payload, images, diaryCount } = importPayload(payloadText);
      update({ type: "partner.merge", state: payload });
      setReceipt({
        name: payload.from.nickname,
        cycle: Boolean(payload.cycle),
        diary: diaryCount,
        images,
      });
      setPasted("");
      setScanned([]);
      setScanner(false);
      setStep("reply");
      setChunk(0);
    } catch (error) {
      Alert.alert(
        "Mã chưa hợp lệ",
        error instanceof Error ? error.message : "Hãy kiểm tra lại mã.",
      );
    }
  }
  function acceptScanned(value: string) {
    const all = [...scanned, value];
    setScanned(all);
    if (all.length > 1) {
      const complete = all.join("\n");
      if (complete.includes(`/${all.length}:`)) {
        apply(complete);
        return;
      }
    }
    apply(value);
  }
  async function openScanner(open: boolean) {
    const result = permission?.granted ? permission : await requestPermission();
    if (!result.granted) {
      Alert.alert(
        "Quyền máy ảnh",
        "Hãy cấp quyền máy ảnh hoặc dán mã thủ công.",
      );
      return;
    }
    setScanned([]);
    setScanner(open);
  }
  return (
    <>
      <LinearGradient
        colors={["#ffe3ee", "#fff1f5"]}
        className="rounded-3xl p-5 mb-4"
      >
        <Text className="text-4xl mb-2">💞</Text>
        <Title>Nối hai máy trong 2 bước</Title>
        <Note>
          Không cần máy chủ. Bước 1: bạn quét mã của người thương để nhận dữ
          liệu của họ. Bước 2: đưa mã phản hồi của bạn cho người thương quét —
          mã này đã gồm cả hai bên, nên người thương cũng có đủ dữ liệu của bạn.
        </Note>
      </LinearGradient>
      <View className="flex-row mb-4">
        {(
          [
            ["scan", "Bước 1 · Quét mã"],
            ["reply", "Bước 2 · Mã phản hồi"],
          ] as const
        ).map(([id, label]) => (
          <Pressable
            key={id}
            accessibilityRole="tab"
            accessibilityState={{ selected: step === id }}
            onPress={() => setStep(id)}
            className="flex-1 mx-1"
          >
            <LinearGradient
              colors={
                step === id ? ["#f6699f", "#d61f69"] : ["#ffe3ee", "#fff1f5"]
              }
              className="rounded-2xl py-3 items-center"
            >
              <Text
                className={
                  step === id
                    ? "text-white font-bold"
                    : "text-love font-semibold"
                }
              >
                {label}
              </Text>
            </LinearGradient>
          </Pressable>
        ))}
      </View>
      {receipt ? (
        <Card>
          <Title small>Đã nhận từ {receipt.name} 🎉</Title>
          <Note>
            {receipt.cycle ? "Có dữ liệu chu kỳ · " : ""}
            {receipt.diary ? `${receipt.diary} kỷ niệm · ` : ""}
            {receipt.images ? `${receipt.images} ảnh · ` : ""}hồ sơ và cảm xúc
            đã về máy bạn.
          </Note>
          <Note>
            Giờ sang <Text className="font-bold">Bước 2</Text> và cho người
            thương quét mã bên dưới. Khi họ quét, dữ liệu của bạn (và cả những
            gì vừa nhận) sẽ sang máy họ — hai bên có đủ, không cần làm lại từ
            đầu.
          </Note>
          <Button
            label="Đưa mã phản hồi ngay"
            onPress={() => setStep("reply")}
          />
        </Card>
      ) : null}
      {step === "scan" ? (
        <Card>
          <Title small>Quét mã của người thương</Title>
          <Note>
            Người thương mở mục Ghép nối → tab “Mã phản hồi”, rồi bạn quét QR
            đó. Nếu mã bị chia nhiều phần thì quét lần lượt từng phần (app tự
            ghép lại).
          </Note>
          <Button
            label={scanner ? "Đóng máy quét" : "Mở máy quét QR"}
            onPress={() => void openScanner(!scanner)}
          />
          {scanner ? (
            <CameraView
              style={{ height: 290, borderRadius: 22, marginVertical: 10 }}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={({ data }) => {
                const value = data.trim();
                if (!value.startsWith("HTT1:")) return;
                if (scanned[scanned.length - 1] === value) return;
                acceptScanned(value);
              }}
            />
          ) : null}
          <Input
            label="Hoặc dán mã người thương gửi"
            value={pasted}
            onChangeText={setPasted}
            multiline
          />
          <Button
            label="Ghép nối bằng mã đã dán"
            disabled={pasted.trim().length < 10}
            onPress={() => apply(pasted.trim())}
          />
        </Card>
      ) : (
        <Card>
          <Title small>Mã phản hồi của bạn</Title>
          <Text className="text-xs text-stone-500 mt-2">
            Trong mã: {state.me.nickname}
            {state.cycle ? " · dữ liệu chu kỳ của bạn" : ""}
            {partnerDiary ? ` · ${partnerDiary} kỷ niệm của người thương` : ""}
            {state.diary.length
              ? ` · ${state.diary.length} kỷ niệm trên máy`
              : ""}
          </Text>
          {chunks.length > 1 ? (
            <Note>
              Mã dài nên chia thành {chunks.length} phần. Hiện lần lượt từng
              phần cho người thương quét.
            </Note>
          ) : (
            <Note>
              Cho người thương quét mã này để họ nhận đủ dữ liệu của bạn.
            </Note>
          )}
          <LinearGradient
            colors={["#ffffff", "#fff1f5"]}
            className="items-center rounded-3xl py-5 my-2"
          >
            <QRCode
              value={chunks[Math.min(chunk, chunks.length - 1)]}
              size={244}
              color="#d61f69"
            />
          </LinearGradient>
          {chunks.length > 1 ? (
            <View className="flex-row items-center justify-between">
              <Button
                label="Phần trước"
                secondary
                disabled={chunk === 0}
                onPress={() => setChunk(chunk - 1)}
              />
              <Text className="text-ink">
                Phần {Math.min(chunk, chunks.length - 1) + 1}/{chunks.length}
              </Text>
              <Button
                label="Phần sau"
                secondary
                disabled={chunk >= chunks.length - 1}
                onPress={() => setChunk(chunk + 1)}
              />
            </View>
          ) : null}
          <Button
            label="Chia sẻ mã qua tin nhắn"
            secondary
            onPress={() =>
              void Share.share({
                message:
                  "Mã Hai Trái Tim của mình đây, bạn mở ứng dụng → Ghép nối → Bước 1 → dán mã này nhé:\n" +
                  chunks.join("\n"),
              }).catch(() => {})
            }
          />
          <Button
            label="Mình cần quét mã mới từ người thương"
            secondary
            onPress={() => setStep("scan")}
          />
        </Card>
      )}
      {state.partner ? (
        <Card>
          <View className="flex-row items-center mb-4">
            <LocalAvatar
              name={state.partner.nickname}
              image={state.partner.avatar}
              size={48}
            />
            <View className="ml-4 flex-1">
              <Title small>{state.partner.nickname}</Title>
              <Note>
                Đã trao đổi {state.links.length} lần · lần gần nhất{" "}
                {new Date(
                  state.links[state.links.length - 1]?.linkedAt ||
                    state.anniversary,
                ).toLocaleString("vi-VN")}
              </Note>
            </View>
          </View>
          <Note>
            Không có máy chủ nên cảm xúc và kỷ niệm mới sẽ không tự sang máy
            kia: hai bạn lặp lại Bước 1 → Bước 2 mỗi khi muốn cập nhật. App tự
            gộp, không tạo trùng kỷ niệm hay lời nhắc.
          </Note>
          <Button
            label="Hủy nối với người thương"
            secondary
            onPress={() =>
              void (async () => {
                if (
                  !(await confirm(
                    "Hủy nối?",
                    "Hồ sơ người thương và các kỷ niệm do người thương gửi sẽ bị xóa khỏi máy này. Dữ liệu của bạn vẫn giữ nguyên.",
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
          Mã chứa hồ sơ, ngày bắt đầu, dữ liệu chu kỳ và cảm xúc — hãy chỉ gửi
          cho đúng người thương. Muốn gửi kèm nhật ký và ảnh thì dùng nút “Xuất
          và chia sẻ tệp dữ liệu” trong Cài đặt.
        </Note>
        {initialCode ? <Note>Bạn mở mục này từ Cài đặt.</Note> : null}
      </Card>
    </>
  );
}
