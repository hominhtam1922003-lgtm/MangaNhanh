import React, { useState, useEffect } from "react";
import { View, Text, Alert } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { CameraView, useCameraPermissions } from "expo-camera";
import { SupabaseClient } from "@supabase/supabase-js";
import { Card, Title, Note, Button, Input } from "../components/UI";
import { explain } from "../services/backend";
export default function Pair({
  db,
  refresh,
}: {
  db: SupabaseClient;
  refresh: () => void;
}) {
  const [code, setCode] = useState(""),
    [own, setOwn] = useState(""),
    [expires, setExpires] = useState(0),
    [tick, setTick] = useState(Date.now()),
    [busy, setBusy] = useState(false),
    [scanner, setScanner] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  async function create() {
    setBusy(true);
    try {
      const r = await db.rpc("create_pair_code");
      if (r.error) throw r.error;
      if (r.data.error) throw new Error(r.data.error);
      setOwn(r.data.code);
      setExpires(Date.parse(r.data.expires_at));
      refresh();
    } catch (e) {
      Alert.alert("Chưa tạo được mã", explain(e));
    } finally {
      setBusy(false);
    }
  }
  async function join(value = code) {
    setScanner(false);
    if (!/^\d{6}$/.test(value)) {
      Alert.alert("Mã ghép đôi", "Nhập đúng 6 chữ số.");
      return;
    }
    setBusy(true);
    try {
      const r = await db.rpc("join_pair", { code: value });
      if (r.error) throw r.error;
      if (r.data.error) throw new Error(r.data.error);
      refresh();
    } catch (e) {
      Alert.alert("Chưa ghép đôi", explain(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Card>
        <Title small>Mời người thương</Title>
        <Note>
          Một bạn tạo mã, bạn còn lại nhập mã hoặc quét QR. Mã dùng một lần, hết
          hạn sau 10 phút. Cả hai dùng cùng máy chủ.
        </Note>
        <Button
          label="Tạo mã ghép đôi"
          busy={busy}
          onPress={() => void create()}
        />
        {own && expires > tick ? (
          <View className="items-center py-4">
            <QRCode
              value={"haitraitim://pair?code=" + own}
              size={176}
              color="#e64980"
            />
            <Text
              selectable
              className="text-4xl font-bold tracking-widest text-love my-4"
            >
              {own}
            </Text>
            <Note>
              Còn {Math.ceil((expires - tick) / 60000)} phút. Chỉ gửi cho người
              bạn tin tưởng.
            </Note>
          </View>
        ) : own ? (
          <Note>Mã đã hết hạn. Tạo mã mới để tiếp tục.</Note>
        ) : null}
      </Card>
      <Card>
        <Title small>Kết nối bằng mã</Title>
        <Input
          label="Mã 6 chữ số của người thương"
          value={code}
          onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
          keyboardType="number-pad"
        />
        <Button
          label="Ghép đôi"
          disabled={code.length !== 6}
          busy={busy}
          onPress={() => void join()}
        />
        <Button
          label="Quét mã QR"
          secondary
          onPress={() => {
            void (async () => {
              const p = permission?.granted
                ? permission
                : await requestPermission();
              if (p.granted) setScanner(true);
              else
                Alert.alert(
                  "Quyền máy ảnh",
                  "Cấp quyền máy ảnh hoặc nhập mã thủ công.",
                );
            })();
          }}
        />
        {scanner && (
          <>
            <CameraView
              style={{ height: 270, borderRadius: 20 }}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={({ data }) => {
                const m = /^haitraitim:\/\/pair\?code=(\d{6})$/.exec(data);
                if (m && !busy) void join(m[1]);
              }}
            />
            <Button
              label="Đóng máy quét"
              secondary
              onPress={() => setScanner(false)}
            />
          </>
        )}
      </Card>
    </>
  );
}
