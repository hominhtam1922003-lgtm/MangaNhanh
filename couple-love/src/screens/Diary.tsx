import React, { useState, useEffect } from "react";
import { View, Text, Image, Alert } from "react-native";
import { SupabaseClient } from "@supabase/supabase-js";
import { Card, Title, Note, Input, Button, confirm } from "../components/UI";
import { Snapshot, Diary } from "../services/sync";
import { uploadPhoto } from "../services/images";
import { explain } from "../services/backend";
function Entry({
  db,
  item,
  uid,
  onDelete,
}: {
  db: SupabaseClient;
  item: Diary;
  uid: string;
  onDelete: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => {
      if (item.image_path)
        void db.storage
          .from("love-assets")
          .createSignedUrl(item.image_path, 3600)
          .then(({ data }) => {
            if (alive) setUrl(data?.signedUrl || null);
          });
    };
    load();
    const timer = setInterval(load, 3300000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [db, item.image_path]);
  return (
    <Card>
      {url && (
        <Image
          accessibilityLabel={"Ảnh kỷ niệm: " + item.title}
          source={{ uri: url }}
          style={{ height: 230, borderRadius: 18, marginBottom: 16 }}
          resizeMode="cover"
        />
      )}
      <Title small>{item.title}</Title>
      <Note>{item.body}</Note>
      <Text className="text-xs text-stone-400 mt-3">
        {new Date(item.created_at).toLocaleString("vi-VN")}
      </Text>
      {item.author_id === uid && (
        <Button label="Xóa kỷ niệm này" secondary onPress={onDelete} />
      )}
    </Card>
  );
}
export default function DiaryScreen({
  db,
  data,
  uid,
  refresh,
}: {
  db: SupabaseClient;
  data: Snapshot;
  uid: string;
  refresh: () => void;
}) {
  const [title, setTitle] = useState(""),
    [body, setBody] = useState(""),
    [image, setImage] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const cid = data.couple?.id;
  async function removeOrphan(path: string) {
    await db.storage.from("love-assets").remove([path]);
  }
  async function photo() {
    if (!cid) return;
    setBusy(true);
    try {
      const path = await uploadPhoto(db, cid + "/" + uid);
      if (path) {
        if (image) await removeOrphan(image);
        setImage(path);
      }
    } catch (e) {
      Alert.alert("Chưa chọn được ảnh", explain(e));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!cid) return;
    if (title.trim().length < 1 || title.length > 100 || body.length > 6000) {
      Alert.alert(
        "Kiểm tra nội dung",
        "Tiêu đề 1–100 ký tự, ghi chú tối đa 6.000 ký tự.",
      );
      return;
    }
    setBusy(true);
    try {
      const r = await db.from("diary").insert({
        couple_id: cid,
        author_id: uid,
        title: title.trim(),
        body,
        image_path: image,
      });
      if (r.error) throw r.error;
      setTitle("");
      setBody("");
      setImage(null);
      refresh();
    } catch (e) {
      Alert.alert("Chưa lưu kỷ niệm", explain(e));
    } finally {
      setBusy(false);
    }
  }
  if (!cid)
    return (
      <Card>
        <Title>Nhật ký chung</Title>
        <Note>Tạo mã ghép đôi trước để mở không gian kỷ niệm của hai bạn.</Note>
      </Card>
    );
  return (
    <>
      <Card>
        <Title>Giữ một khoảnh khắc</Title>
        <Input label="Tên kỷ niệm" value={title} onChangeText={setTitle} />
        <Input
          label="Điều bạn muốn ghi lại"
          value={body}
          onChangeText={setBody}
          multiline
        />
        <Button
          label={image ? "Đã thêm ảnh · Chọn ảnh khác" : "Thêm ảnh từ thư viện"}
          secondary
          busy={busy}
          onPress={() => void photo()}
        />
        {image && (
          <Button
            label="Bỏ ảnh đang chọn"
            secondary
            onPress={() => {
              const path = image;
              setImage(null);
              void removeOrphan(path);
            }}
          />
        )}
        <Button
          label="Lưu vào nhật ký chung"
          busy={busy}
          onPress={() => void save()}
        />
        <Note>
          Ảnh được thu nhỏ và lưu trong kho riêng. Người thương cùng cặp đôi có
          thể xem; chỉ người tạo xóa được kỷ niệm của mình.
        </Note>
      </Card>
      {data.diary.length === 0 ? (
        <Card>
          <Note>
            Chưa có kỷ niệm. Hãy lưu điều nhỏ khiến hai bạn mỉm cười hôm nay.
          </Note>
        </Card>
      ) : (
        data.diary.map((item) => (
          <Entry
            key={item.id}
            item={item}
            db={db}
            uid={uid}
            onDelete={() =>
              void (async () => {
                if (
                  !(await confirm(
                    "Xóa kỷ niệm?",
                    "Thao tác này xóa bài viết và ảnh đính kèm, không thể hoàn tác.",
                  ))
                )
                  return;
                const r = await db.from("diary").delete().eq("id", item.id);
                if (r.error) Alert.alert("Chưa xóa", explain(r.error));
                else {
                  if (item.image_path) await removeOrphan(item.image_path);
                  refresh();
                }
              })()
            }
          />
        ))
      )}
      {data.diary.length === 100 && (
        <Note>Đang hiển thị 100 kỷ niệm mới nhất.</Note>
      )}
    </>
  );
}
