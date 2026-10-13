import React, { useState, useEffect } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { SupabaseClient } from "@supabase/supabase-js";
import { Card, Title, Note, Input, Button, Avatar } from "../components/UI";
import { Snapshot } from "../services/sync";
import { explain } from "../services/backend";
const moods = [
  { id: "happy", name: "Vui vẻ", emoji: "😊" },
  { id: "love", name: "Yêu thương", emoji: "🥰" },
  { id: "calm", name: "Bình yên", emoji: "😌" },
  { id: "tired", name: "Mệt", emoji: "😴" },
  { id: "sad", name: "Buồn", emoji: "😔" },
  { id: "angry", name: "Bực mình", emoji: "😤" },
];
export default function Mood({
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
  const me = data.profiles.find((p) => p.id === uid),
    partner = data.profiles.find((p) => p.id !== uid);
  const [mood, setMood] = useState(me?.mood || "calm"),
    [note, setNote] = useState(me?.mood_note || ""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (me) {
      setMood(me.mood);
      setNote(me.mood_note);
    }
  }, [me?.mood, me?.mood_note]);
  async function save() {
    if (note.length > 300) {
      Alert.alert("Ghi chú quá dài", "Chia sẻ tối đa 300 ký tự nhé.");
      return;
    }
    setBusy(true);
    try {
      const r = await db
        .from("profiles")
        .update({ mood, mood_note: note })
        .eq("id", uid);
      if (r.error) throw r.error;
      refresh();
    } catch (e) {
      Alert.alert("Chưa chia sẻ", explain(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Card>
        <Title>Hôm nay bạn thế nào?</Title>
        <Note>Chia sẻ để được lắng nghe, không phải để phán xét.</Note>
        <View className="flex-row flex-wrap my-4">
          {moods.map((m) => (
            <Pressable
              key={m.id}
              accessibilityLabel={m.name}
              accessibilityState={{ selected: mood === m.id }}
              onPress={() => setMood(m.id)}
              className={`w-1/3 p-3 items-center rounded-2xl ${mood === m.id ? "bg-pink-100" : ""}`}
            >
              <Text className="text-3xl">{m.emoji}</Text>
              <Text className="text-ink text-sm mt-2">{m.name}</Text>
            </Pressable>
          ))}
        </View>
        <Input
          label="Điều bạn muốn người thương biết"
          value={note}
          onChangeText={setNote}
          multiline
        />
        <Button
          label="Chia sẻ cảm xúc"
          busy={busy}
          onPress={() => void save()}
        />
        <Note>
          Người thương thấy cảm xúc theo thời gian thực và nhận lời nhắc nếu đã
          bật thông báo.
        </Note>
      </Card>
      {partner && (
        <Card>
          <View className="flex-row items-center mb-4">
            <Avatar
              db={db}
              path={partner.avatar_path}
              name={partner.nickname}
              size={48}
            />
            <View className="ml-4 flex-1">
              <Title small>{partner.nickname}</Title>
              <Text className="text-love">
                {moods.find((m) => m.id === partner.mood)?.emoji}{" "}
                {moods.find((m) => m.id === partner.mood)?.name}
              </Text>
            </View>
          </View>
          <Note>
            {partner.mood_note ||
              "Một lời hỏi han nhẹ nhàng có thể mở đầu câu chuyện."}
          </Note>
          <Text className="text-xs text-stone-400 mt-3">
            Cập nhật: {new Date(partner.updated_at).toLocaleString("vi-VN")}
          </Text>
        </Card>
      )}
    </>
  );
}
