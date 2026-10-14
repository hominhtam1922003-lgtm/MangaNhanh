import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from "react-native";

import { Button, Card, Note, Title } from "../../components/UI";
import { useTheme } from "../../theme/ThemeContext";
import {
  PAIR_CODE_LENGTH,
  formatPairCode,
  gateReasonText,
  isValidPairCode,
  normalizePairCode,
} from "../../logic/pairing.mjs";
import type { Account, AuthProvider } from "../../services/account";
import type { PairGate as Gate } from "../../logic/pairing.mjs";

/**
 * Màn hình CHẶN khi chưa ghép nối: từ 1.18.0 hai máy chỉ kết nối khi máy chủ xác
 * nhận đã ghép đôi theo tài khoản, nên không còn cảnh "tự chui vào phòng cũ".
 */
export default function PairGate({
  gate,
  account,
  email,
  busy,
  message,
  relayConnected,
  onSignIn,
  onSignInAnonymous,
  onSignOut,
  onPair,
  onUnpair,
  onRetry,
  onManual,
}: {
  gate: Gate;
  account: Account | null;
  email: string | null;
  busy: boolean;
  message: string;
  relayConnected: boolean;
  onSignIn: (provider: AuthProvider) => void;
  onSignInAnonymous: () => void;
  onSignOut: () => void;
  onPair: (code: string) => void;
  onUnpair: () => void;
  onRetry: () => void;
  onManual: () => void;
}) {
  const { theme } = useTheme();
  const [code, setCode] = useState("");

  async function shareCode() {
    const value = formatPairCode(account?.shortCode ?? "");
    try {
      await Share.share({
        message: `Mã kết nối Mật Mã Yêu của mình: ${value}\nBạn nhập mã này trong app (Ghép nối → Nhập mã người thương) nhé.`,
      });
    } catch {}
  }

  function connect() {
    const normalized = normalizePairCode(code);
    if (!isValidPairCode(normalized)) {
      Alert.alert(
        "Mã chưa đúng",
        `Mã kết nối gồm ${PAIR_CODE_LENGTH} ký tự chữ và số (bỏ qua I, O, 0, 1). Bạn xem lại mã của người thương nhé.`,
      );
      return;
    }
    onPair(normalized);
  }

  const header = (
    <Card>
      <Title>Ghép nối bằng tài khoản</Title>
      <Note>
        Từ bản 1.18.0 mã kết nối là mã cố định gắn với tài khoản của bạn (không
        còn mã 6 số ngẫu nhiên). Nhờ vậy không thể nối nhầm người lạ, và máy chỉ
        vào phòng khi máy chủ xác nhận hai bạn đang ghép với nhau.
      </Note>
      <Text className="mt-2" style={{ color: theme.sub, fontSize: 13 }}>
        {gateReasonText(gate)}
      </Text>
      {message ? (
        <Text className="mt-2" style={{ color: theme.deep[1], fontSize: 13 }}>
          {message}
        </Text>
      ) : null}
    </Card>
  );

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {header}

      {gate.screen === "login" ? (
        <Card>
          <Title small>Đăng nhập để ghép nối</Title>
          <Note>
            Bạn đăng nhập bằng Google hoặc Facebook; sau đó mỗi tài khoản có một
            mã cố định để người thương nhập một lần duy nhất. Nếu dự án Supabase
            chưa bật nhà cung cấp nào, hãy dùng nút đăng nhập nhanh bên dưới
            (mục Authentication → Sign In / Providers → Anonymous).
          </Note>
          <View className="mt-3">
            <Button
              label="Đăng nhập bằng Google"
              busy={busy}
              onPress={() => onSignIn("google")}
            />
          </View>
          <View className="mt-2">
            <Button
              label="Đăng nhập bằng Facebook"
              secondary
              busy={busy}
              onPress={() => onSignIn("facebook")}
            />
          </View>
          <View className="mt-2">
            <Button
              label="Đăng nhập nhanh (không cần Google/Facebook)"
              secondary
              busy={busy}
              onPress={onSignInAnonymous}
            />
          </View>
          <Note>
            Đăng nhập nhanh lưu tài khoản trong máy: gỡ app là mất tài khoản đó,
            nên chỉ dùng khi bạn chưa cấu hình Google/Facebook.
          </Note>
          <View className="mt-2">
            <Button label="Thử kiểm tra lại" secondary onPress={onRetry} />
          </View>
        </Card>
      ) : null}

      {gate.screen === "offline" ? (
        <Card>
          <Title small>Chưa liên lạc được máy chủ</Title>
          <Note>
            App cố ý KHÔNG kết nối tức thời khi chưa kiểm tra được trạng thái
            ghép nối, để bạn không bị nối vào phòng cũ. Dữ liệu đã viết vẫn nằm
            trong máy: mở mạng rồi bấm thử lại.
          </Note>
          <View className="mt-3">
            <Button label="Thử lại" busy={busy} onPress={onRetry} />
          </View>
          {account?.uid ? (
            <View className="mt-2">
              <Button label="Đăng xuất" secondary onPress={onSignOut} />
            </View>
          ) : null}
        </Card>
      ) : null}

      {gate.screen === "code" ? (
        <Card>
          <Title small>Mã cố định của bạn</Title>
          <Pressable accessibilityRole="button" onPress={shareCode}>
            <Text
              style={{
                color: theme.deep[0],
                fontSize: 38,
                fontWeight: "800",
                letterSpacing: 4,
                textAlign: "center",
                marginTop: 8,
              }}
            >
              {formatPairCode(account?.shortCode ?? "------")}
            </Text>
          </Pressable>
          <Note>
            Gửi mã này cho người thương (bấm vào mã để chia sẻ). Họ nhập mã của
            bạn, HOẶC bạn nhập mã của họ — ai nhập trước cũng được, máy chủ sẽ
            ghi cho cả hai máy.
            {account?.displayName || email
              ? ` Tài khoản: ${account?.displayName || email}.`
              : ""}
          </Note>
          <View className="mt-3">
            <TextInput
              value={code}
              onChangeText={(value) => setCode(normalizePairCode(value))}
              placeholder="Nhập mã của người thương"
              placeholderTextColor={theme.sub}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={PAIR_CODE_LENGTH}
              style={{
                backgroundColor: theme.glass,
                color: theme.ink,
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 22,
                letterSpacing: 3,
                textAlign: "center",
                borderWidth: 1,
                borderColor: theme.border,
              }}
            />
          </View>
          <View className="mt-2">
            {busy ? (
              <ActivityIndicator />
            ) : (
              <Button label="Kết nối" onPress={connect} />
            )}
          </View>
          <View className="mt-2">
            <Button label="Thử kiểm tra lại" secondary onPress={onRetry} />
          </View>
        </Card>
      ) : null}

      {gate.screen === "paired" ? (
        <Card>
          <Title small>Đang ghép nối</Title>
          <Note>
            Đã ghép nối với {account?.partnerName || "người thương"}
            {account?.partnerCode
              ? ` (mã ${formatPairCode(account.partnerCode)})`
              : ""}
            . Kết nối tức thời: {relayConnected ? "đang chạy" : "chưa chạy"}.
          </Note>
          <View className="mt-3">
            <Button
              label="Ngắt kết nối (cả hai máy)"
              secondary
              busy={busy}
              onPress={() =>
                Alert.alert(
                  "Ngắt kết nối?",
                  "Máy chủ sẽ xoá ghép nối ở CẢ HAI máy. Dữ liệu đã viết vẫn còn trong máy này, nhưng hai máy không còn nhận tin của nhau cho tới khi ghép lại.",
                  [
                    { text: "Để sau", style: "cancel" },
                    {
                      text: "Ngắt kết nối",
                      style: "destructive",
                      onPress: onUnpair,
                    },
                  ],
                )
              }
            />
          </View>
          <View className="mt-2">
            <Button label="Thử kiểm tra lại" secondary onPress={onRetry} />
          </View>
        </Card>
      ) : null}

      <Card>
        <Title small>Cần gì khác?</Title>
        <View className="mt-1">
          <Button
            label="Chuyển dữ liệu thủ công (không cần ghép nối)"
            secondary
            onPress={onManual}
          />
        </View>
        {account?.uid ? (
          <View className="mt-2">
            <Button label="Đăng xuất tài khoản" secondary onPress={onSignOut} />
          </View>
        ) : null}
        <Note>
          Hai máy phải bật mạng mới ghép nối được. Mã kết nối cố định chỉ dùng
          để ghép MỘT lần; sau đó muốn đổi người thương thì bấm Ngắt kết nối.
        </Note>
      </Card>
    </ScrollView>
  );
}
