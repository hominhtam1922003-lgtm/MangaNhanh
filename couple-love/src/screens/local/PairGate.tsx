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

import { Button, Card, Input, Note, Title } from "../../components/UI";
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
 * Màn hình tài khoản & ghép nối bằng mã cố định 6 ký tự.
 * Nằm gọn trong mục Ghép nối (thanh 5 tab bên dưới luôn hiện đầy đủ để bạn dùng
 * Yêu nhau, Tin nhắn, Chăm sóc, Nhật ký, Cài đặt/Theme bất cứ lúc nào).
 */
export default function PairGate({
  gate,
  account,
  email,
  defaultName = "",
  busy,
  message,
  relayConnected,
  onSignIn,
  onSignInAccount,
  onSignInAnonymous,
  onSignOut,
  onPair,
  onUnpair,
  onRetry,
  onManual,
  onOpenChat,
}: {
  gate: Gate;
  account: Account | null;
  email: string | null;
  defaultName?: string;
  busy: boolean;
  message: string;
  relayConnected: boolean;
  onSignIn: (provider: AuthProvider) => void;
  onSignInAccount?: (
    identifier: string,
    password: string,
    displayName: string,
  ) => void;
  onSignInAnonymous: () => void;
  onSignOut: () => void;
  onPair: (code: string) => void;
  onUnpair: () => void;
  onRetry: () => void;
  onManual: () => void;
  onOpenChat?: () => void;
}) {
  const { theme } = useTheme();
  const [code, setCode] = useState("");
  const [identifier, setIdentifier] = useState(email ?? "");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState(defaultName);

  async function shareCode() {
    const value = formatPairCode(account?.shortCode ?? "");
    try {
      await Share.share({
        message: `Mã kết nối Mật Mã Yêu của mình: ${value}\nBạn mở mục Ghép nối rồi nhập mã này nhé.`,
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

  function submitAccount() {
    if (!identifier.trim()) {
      Alert.alert(
        "Thiếu tài khoản",
        "Hãy nhập địa chỉ Gmail/Email hoặc tên tài khoản của bạn.",
      );
      return;
    }
    if (password.trim().length < 6) {
      Alert.alert("Mật khẩu ngắn", "Mật khẩu cần ít nhất 6 ký tự.");
      return;
    }
    onSignInAccount?.(identifier.trim(), password.trim(), displayName.trim());
  }

  const header = (
    <Card>
      <Title>Ghép nối bằng tài khoản</Title>
      <Note>
        Từ bản 1.18.0 mã kết nối là mã cố định gắn với tài khoản của bạn (không
        còn mã 6 số ngẫu nhiên). Nhờ vậy không thể nối nhầm người lạ, và hai máy
        chỉ vào phòng khi bạn chủ động ghép nối.
      </Note>
      <Text className="mt-2" style={{ color: theme.sub, fontSize: 13 }}>
        {gateReasonText(gate)}
      </Text>
      {message ? (
        <Text
          className="mt-2 font-semibold"
          style={{ color: theme.deep[1], fontSize: 13 }}
        >
          {message}
        </Text>
      ) : null}
    </Card>
  );

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 28 }}
      keyboardShouldPersistTaps="handled"
    >
      {header}

      {gate.screen === "login" ? (
        <>
          <Card>
            <Title small>Cách 1: Đăng nhập / Đăng ký ngay trong app</Title>
            <Note>
              Nhập Gmail (hoặc tên tài khoản bất kỳ) và mật khẩu từ 6 ký tự trở
              lên. Nếu tài khoản chưa có thì app tự tạo mới và cấp ngay mã kết
              nối cố định 6 ký tự (không cần mở trình duyệt).
            </Note>
            <View className="mt-2">
              <Input
                label="Gmail hoặc tên tài khoản (ví dụ: minhtam@gmail.com)"
                value={identifier}
                onChangeText={setIdentifier}
              />
              <Input
                label="Mật khẩu (tối thiểu 6 ký tự)"
                value={password}
                onChangeText={setPassword}
                secure
              />
              <Input
                label="Tên hiển thị của bạn (không bắt buộc)"
                value={displayName}
                onChangeText={setDisplayName}
              />
              <Button
                label="Đăng nhập / Đăng ký tài khoản"
                busy={busy}
                onPress={submitAccount}
              />
            </View>
          </Card>

          <Card>
            <Title small>Cách 2: Lấy mã nhanh 1 chạm</Title>
            <Note>
              Không muốn nhập email/mật khẩu? Bấm nút dưới để cấp ngay một mã cố
              định 6 ký tự gắn với máy này.
            </Note>
            <View className="mt-2">
              <Button
                label="Đăng nhập nhanh (lấy mã 6 ký tự ngay)"
                busy={busy}
                onPress={onSignInAnonymous}
              />
            </View>
          </Card>

          <Card>
            <Title small>Cách 3: Đăng nhập qua trình duyệt (OAuth)</Title>
            <Note>
              Dùng khi dự án Supabase đã cấu hình Google/Facebook OAuth và
              Redirect URL haitraitim://auth-callback.
            </Note>
            <View className="mt-2">
              <Button
                label="Đăng nhập bằng Google"
                secondary
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
          </Card>
        </>
      ) : null}

      {gate.screen === "offline" ? (
        <Card>
          <Title small>Đang chờ xác nhận tài khoản</Title>
          <Note>
            Bấm “Lấy mã kết nối ngay” hoặc “Thử lại” để mở mã cố định 6 ký tự
            của bạn.
          </Note>
          <View className="mt-3">
            <Button label="Thử lại" busy={busy} onPress={onRetry} />
          </View>
          <View className="mt-2">
            <Button
              label="Lấy mã kết nối ngay"
              secondary
              busy={busy}
              onPress={onSignInAnonymous}
            />
          </View>
          <View className="mt-2">
            <Button label="Đổi tài khoản khác" secondary onPress={onSignOut} />
          </View>
        </Card>
      ) : null}

      {account?.shortCode ? (
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
            Gửi mã 6 ký tự này cho người thương (bấm vào mã để chia sẻ). Chỉ cần
            MỘT máy nhập mã của máy kia (hoặc cả hai cùng nhập mã của nhau) là
            hai máy tự kết nối.
            {account?.displayName || email
              ? ` Tài khoản: ${account?.displayName || email}.`
              : ""}
          </Note>
          <View className="mt-3">
            <TextInput
              value={code}
              onChangeText={(value) => setCode(normalizePairCode(value))}
              placeholder="Nhập mã 6 ký tự của người thương"
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
              <Button label="Kết nối với người thương" onPress={connect} />
            )}
          </View>
          <View className="mt-2">
            <Button
              label="Chia sẻ mã của mình"
              secondary
              onPress={() => void shareCode()}
            />
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
            . Kết nối tức thời:{" "}
            {relayConnected
              ? "đang trực tuyến — nhắn tin và gọi điện ngay"
              : "đang nối trạm trung chuyển…"}
            .
          </Note>
          {onOpenChat ? (
            <View className="mt-2">
              <Button label="✉ Mở Tin nhắn ngay" onPress={onOpenChat} />
            </View>
          ) : null}
          <View className="mt-2">
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
        <Title small>Tiện ích khác</Title>
        <View className="mt-1">
          <Button
            label="Chi tiết trạm kết nối & chuyển dữ liệu thủ công"
            secondary
            onPress={onManual}
          />
        </View>
        {account?.uid || email ? (
          <View className="mt-2">
            <Button label="Đăng xuất tài khoản" secondary onPress={onSignOut} />
          </View>
        ) : null}
      </Card>
    </ScrollView>
  );
}
