import React, { useState } from "react";
import { Alert, Image, Text } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Manipulator from "expo-image-manipulator";
import {
  Button,
  Card,
  GradientCard,
  Input,
  Note,
  Title,
  confirm,
} from "../../components/UI";
import { deleteImage, imageUri, saveImage } from "../../services/localdb";
import type { State } from "../../services/localdb";
import { makeId } from "../../logic/localState.mjs";
export default function DiaryLocal({
  state,
  update,
}: {
  state: State;
  update: (action: Record<string, unknown>) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function pickPhoto() {
    setBusy(true);
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted)
        throw new Error("Cần quyền chọn ảnh từ thư viện.");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;
      const processed = await Manipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 900 } }],
        { compress: 0.75, format: Manipulator.SaveFormat.JPEG },
      );
      const name = saveImage(processed.uri, `draft-${Date.now()}.jpg`);
      if (image && image !== name) deleteImage(image);
      setImage(name);
    } catch (error) {
      Alert.alert(
        "Chưa chọn được ảnh",
        error instanceof Error ? error.message : "Thao tác không thành công.",
      );
    } finally {
      setBusy(false);
    }
  }
  function save() {
    try {
      if (image) {
        const id = makeId();
        const finalName = `diary-${id}.jpg`;
        saveImage(imageUri(image)!, finalName);
        deleteImage(image);
        update({ type: "diary.add", id, title, body, image: finalName });
      } else {
        update({ type: "diary.add", title, body });
      }
      setTitle("");
      setBody("");
      setImage(null);
      Alert.alert(
        "Đã lưu",
        "Kỷ niệm được lưu trên máy. Gửi cho người thương bằng tệp dữ liệu trong phần ghép nối.",
      );
    } catch (error) {
      Alert.alert(
        "Chưa lưu kỷ niệm",
        error instanceof Error ? error.message : "Nội dung không hợp lệ.",
      );
    }
  }
  return (
    <>
      <GradientCard>
        <Title>Giữ một khoảnh khắc</Title>
        <Input label="Tên kỷ niệm" value={title} onChangeText={setTitle} />
        <Input
          label="Điều bạn muốn ghi lại"
          value={body}
          onChangeText={setBody}
          multiline
        />
        {imageUri(image) && (
          <Image
            accessibilityLabel="Ảnh đang chọn"
            source={{ uri: imageUri(image)! }}
            style={{ height: 190, borderRadius: 18, marginBottom: 12 }}
            resizeMode="cover"
          />
        )}
        <Button
          label={image ? "Đã thêm ảnh · Chọn ảnh khác" : "Thêm ảnh từ thư viện"}
          secondary
          busy={busy}
          onPress={() => void pickPhoto()}
        />
        {image && (
          <Button
            label="Bỏ ảnh đang chọn"
            secondary
            onPress={() => {
              deleteImage(image);
              setImage(null);
            }}
          />
        )}
        <Button label="Lưu vào nhật ký" busy={busy} onPress={save} />
        <Note>
          Ảnh được thu nhỏ, lưu trong thư mục riêng của ứng dụng trên máy này.
          Không có tải lên máy chủ nào.
        </Note>
      </GradientCard>
      {state.diary.length === 0 ? (
        <Card>
          <Note>
            Chưa có kỷ niệm. Hãy lưu điều nhỏ khiến hai bạn mỉm cười hôm nay.
          </Note>
        </Card>
      ) : (
        state.diary.map((item) => (
          <Card key={item.id}>
            {imageUri(item.image) && (
              <Image
                accessibilityLabel={"Ảnh kỷ niệm: " + item.title}
                source={{ uri: imageUri(item.image)! }}
                style={{ height: 230, borderRadius: 18, marginBottom: 16 }}
                resizeMode="cover"
              />
            )}
            <Title small>{item.title}</Title>
            <Note>{item.body}</Note>
            <Text className="text-xs text-stone-400 mt-3">
              {item.authorId === "me"
                ? state.me.nickname
                : state.partner?.nickname || "Người thương"}{" "}
              · {new Date(item.createdAt).toLocaleString("vi-VN")}
            </Text>
            {item.authorId === "me" && (
              <Button
                label="Xóa kỷ niệm này"
                secondary
                onPress={() =>
                  void (async () => {
                    if (
                      !(await confirm(
                        "Xóa kỷ niệm?",
                        "Bài viết và ảnh đính kèm trên máy này sẽ bị xóa, không thể hoàn tác.",
                      ))
                    )
                      return;
                    deleteImage(item.image);
                    update({ type: "diary.remove", id: item.id });
                  })()
                }
              />
            )}
          </Card>
        ))
      )}
      <Note>Đang hiển thị {state.diary.length} kỷ niệm trên máy này.</Note>
    </>
  );
}
