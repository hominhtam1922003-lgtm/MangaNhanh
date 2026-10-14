// Màn hình chọn cách chạy (trên máy / đồng bộ): tách khỏi App.tsx từ 1.18.0.
import React from "react";
import { ScrollView, Text, View } from "react-native";

import { Button, Card, Note, Title } from "../components/UI";

export default function ModeChooser({
  onPick,
}: {
  onPick: (mode: "local" | "cloud") => void;
}) {
  return (
    <ScrollView
      className="flex-1 bg-pink-50"
      contentContainerStyle={{ padding: 24, paddingTop: 60 }}
    >
      <Text className="text-5xl mb-6">💕</Text>
      <Title>Mật Mã Yêu</Title>
      <Note>
        Một góc riêng để hai bạn giữ những ngày yêu thương. Chọn cách chạy phù
        hợp — có thể đổi lại trong Cài đặt.
      </Note>
      <View className="h-6" />
      <Card>
        <Title small>Trên máy này · không cần máy chủ</Title>
        <Note>
          Đếm ngày yêu, trái tim 3D, chu kỳ, nhật ký, cảm xúc và lời nhắc đều
          chạy trên máy. Hai bạn nối nhau bằng mã QR hoặc tệp dữ liệu. Không cần
          tài khoản, không cần Internet, nhưng không có cập nhật tức thời giữa
          hai máy và không nhắc hộ được người thương.
        </Note>
        <Button label="Dùng trên máy này" onPress={() => onPick("local")} />
      </Card>
      <Card>
        <Title small>Đồng bộ hai máy · cần dự án Supabase</Title>
        <Note>
          Dữ liệu cập nhật tức thời giữa Android và iPhone và có thể nhắc hộ
          người thương, nhưng bạn phải tự tạo một dự án Supabase miễn phí rồi
          nhập URL và khóa công khai.
        </Note>
        <Button
          label="Dùng chế độ đồng bộ"
          secondary
          onPress={() => onPick("cloud")}
        />
      </Card>
      <Note>
        Tôi không thể tạo tài khoản hay máy chủ thay bạn vì việc đó cần email
        của bạn. Chế độ trên máy là cách chạy đầy đủ mà không cần đăng ký gì.
      </Note>
    </ScrollView>
  );
}
