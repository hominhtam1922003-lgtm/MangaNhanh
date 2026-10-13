import React, { useState } from "react";
import { Alert, Pressable, Share, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { CameraView, useCameraPermissions } from "expo-camera";
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
import type { State } from "../../services/localdb";
export default function PairLocal({
  state,
  update,
  initialCode,
}: {
  state: State;
  update: (action: Record<string, unknown>) => void;
  initialCode: string;
}) {
  const [chunk, setChunk] = useState(0);
  const [scanner, setScanner] = useState(false);
  const [scanned, setScanned] = useState<string[]>([]);
  const [pasted, setPasted] = useState("");
  const [permission, requestPermission] = useCameraPermissions();
  const chunks = codeChunks(linkCode(state));
  function apply(raw: string) {
    try {
      const { payload, images, diaryCount } = importPayload(raw);
      update({ type: "partner.merge", state: payload });
      Alert.alert(
        "Đã nối với người thương",
        `Đã nhận: ${payload.from.nickname}${payload.cycle ? " · có dữ liệu chu kỳ" : ""}${diaryCount ? ` · ${diaryCount} kỷ niệm` : ""}${images ? ` · ${images} ảnh` : ""}.\n\nĐây là bản dữ liệu tại thời điểm người thương tạo mã. Muốn cập nhật cảm xúc mới, hãy ghép nối lại.`,
      );
      setPasted("");
      setScanned([]);
      setScanner(false);
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
    try {
      apply(all.length === 1 ? value : all.join("\n"));
    } catch {}
  }
  return (
    <>
      <Card>
        <Title>Ghép nối không cần máy chủ</Title>
        <Note>
          Ứng dụng không dùng máy chủ, nên hai máy trao đổi dữ liệu trực tiếp:
          một bạn hiện mã, bạn kia quét hoặc dán mã. Mã chỉ chứa hồ sơ, ngày bắt
          đầu và dữ liệu chu kỳ (không chứa nhật ký); tệp dữ liệu ở Cài đặt chứa
          cả nhật ký và ảnh.
        </Note>
      </Card>
      <Card>
        <Title small>Mã của bạn</Title>
        {chunks.length > 1 && (
          <Note>
            Mã dài nên được chia thành {chunks.length} phần. Hiện lần lượt từng
            phần cho người thương quét, hoặc dùng nút chia sẻ để gửi cả mã.
          </Note>
        )}
        <View className="items-center py-4">
          <QRCode
            value={chunks[Math.min(chunk, chunks.length - 1)]}
            size={240}
            color="#e64980"
          />
        </View>
        {chunks.length > 1 && (
          <View className="flex-row justify-between">
            <Button
              label="Phần trước"
              secondary
              disabled={chunk === 0}
              onPress={() => setChunk(Math.max(0, chunk - 1))}
            />
            <Text className="text-ink py-4">
              Phần {Math.min(chunk, chunks.length - 1) + 1}/{chunks.length}
            </Text>
            <Button
              label="Phần sau"
              secondary
              disabled={chunk >= chunks.length - 1}
              onPress={() => setChunk(Math.min(chunks.length - 1, chunk + 1))}
            />
          </View>
        )}
        <Pressable onLongPress={() => {}} accessibilityLabel="Mã của bạn">
          <Text selectable className="text-xs text-stone-500 mt-3">
            Mã văn bản của bạn (giữ để chọn và sao chép):
          </Text>
          <Text selectable className="text-[10px] text-stone-600 mt-1">
            {chunks.join("\n")}
          </Text>
        </Pressable>
        <Button
          label="Chia sẻ mã của bạn"
          secondary
          onPress={() =>
            void Share.share({
              message:
                "Mã Hai Trái Tim của mình đây, bạn dán vào mục Ghép nối nhé:\n" +
                chunks.join("\n"),
            }).catch(() => {})
          }
        />
      </Card>
      <Card>
        <Title small>Nhận từ người thương</Title>
        <Button
          label={scanner ? "Đóng máy quét" : "Quét mã QR"}
          onPress={() =>
            void (async () => {
              const result = permission?.granted
                ? permission
                : await requestPermission();
              if (!result.granted) {
                Alert.alert(
                  "Quyền máy ảnh",
                  "Hãy cấp quyền máy ảnh hoặc dán mã thủ công.",
                );
                return;
              }
              setScanned([]);
              setScanner(!scanner);
            })()
          }
        />
        {scanner && (
          <CameraView
            style={{ height: 280, borderRadius: 20, marginVertical: 8 }}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => {
              if (data.startsWith("HTT1:")) acceptScanned(data.trim());
            }}
          />
        )}
        <Input
          label="Hoặc dán mã người thương gửi"
          value={pasted}
          onChangeText={setPasted}
          multiline
        />
        <Button
          label="Ghép nối bằng mã đã dán"
          disabled={pasted.trim().length < 10}
          onPress={() => apply(pasted)}
        />
      </Card>
      {state.partner && (
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
                Đã nối{" "}
                {new Date(
                  state.links[state.links.length - 1]?.linkedAt ||
                    state.anniversary,
                ).toLocaleDateString("vi-VN")}
              </Note>
            </View>
          </View>
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
      )}
      <Card>
        <Title small>Ghi chú minh bạch</Title>
        <Note>
          Không có máy chủ nên không thể đồng bộ tức thời, không xem được cảm
          xúc của người thương theo thời gian thực và không thể nhắc hộ người
          thương. Mã ghép nối nên chỉ gửi cho đúng người thương vì mã chứa dữ
          liệu riêng tư dạng văn bản.
        </Note>
        {initialCode ? (
          <Note>
            Bạn mở phần này từ Cài đặt để gửi dữ liệu cho người thương.
          </Note>
        ) : null}
      </Card>
    </>
  );
}
