import React from "react";
import { useTheme } from "../../theme/ThemeContext";
import { Alert, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Button,
  Card,
  LocalAvatar,
  Note,
  Title,
  Input,
  GradientCard,
} from "../../components/UI";
import { MOODS } from "../../logic/localState.mjs";
import type { State } from "../../services/localdb";
import { useState } from "react";
export default function MoodLocal({
  state,
  update,
}: {
  state: State;
  update: (action: Record<string, unknown>) => void;
}) {
  const [mood, setMood] = useState(state.me.mood);
  const [note, setNote] = useState(state.me.moodNote);
  const { theme } = useTheme();
  const partnerMood = MOODS.find((item) => item.id === state.partner?.mood);
  function save() {
    try {
      update({
        type: "profile.set",
        nickname: state.me.nickname,
        mood,
        moodNote: note,
      });
      Alert.alert(
        "Đã lưu cảm xúc",
        "Cảm xúc tự sang máy người thương ngay khi cả hai cùng mở app — không cần gửi tay.",
      );
    } catch (error) {
      Alert.alert(
        "Chưa lưu",
        error instanceof Error ? error.message : "Thao tác không hợp lệ.",
      );
    }
  }
  return (
    <>
      <Card>
        <Title>Hôm nay bạn thế nào?</Title>
        <Note>Chia sẻ để được lắng nghe, không phải để phán xét.</Note>
        <View className="flex-row flex-wrap my-4">
          {MOODS.map((item) => (
            <Pressable
              key={item.id}
              accessibilityLabel={item.name}
              accessibilityState={{ selected: mood === item.id }}
              onPress={() => setMood(item.id)}
              className="w-1/3 p-3 items-center rounded-2xl"
            >
              <LinearGradient
                colors={
                  mood === item.id ? theme.deep : [theme.soft, theme.soft]
                }
                style={{
                  width: "100%",
                  borderRadius: 18,
                  paddingVertical: 10,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: mood === item.id ? theme.deep[1] : theme.border,
                }}
              >
                <Text className="text-3xl">{item.emoji}</Text>
                <Text
                  className="text-sm mt-2 font-semibold"
                  style={{
                    color: mood === item.id ? theme.onDeep : theme.ink,
                  }}
                >
                  {item.name}
                </Text>
              </LinearGradient>
            </Pressable>
          ))}
        </View>
        <Input
          label="Điều bạn muốn người thương biết"
          value={note}
          onChangeText={setNote}
          multiline
        />
        <Button label="Lưu cảm xúc" onPress={save} />
      </Card>
      {state.partner ? (
        <GradientCard>
          <View className="flex-row items-center mb-4">
            <LocalAvatar
              name={state.partner.nickname}
              image={state.partner.avatar}
              size={48}
            />
            <View className="ml-4 flex-1">
              <Title small>{state.partner.nickname}</Title>
              <Text style={{ color: theme.text }}>
                {partnerMood?.emoji} {partnerMood?.name}
              </Text>
            </View>
          </View>
          <Note>
            {state.partner.moodNote ||
              "Một lời hỏi han nhẹ nhàng có thể mở đầu câu chuyện."}
          </Note>
        </GradientCard>
      ) : (
        <Card>
          <Note>
            Chưa nối với người thương. Cảm xúc của bạn vẫn được lưu trên máy để
            gửi ở lần ghép nối sau.
          </Note>
        </Card>
      )}
    </>
  );
}
