import React, { useEffect, useState } from "react";
import { AccessibilityInfo, Alert, Platform, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import ThreeHeart from "../../components/ThreeHeart";
import {
  Button,
  Card,
  LocalAvatar,
  Note,
  Title,
  confirm,
} from "../../components/UI";
import { loveCounter } from "../../logic/time.mjs";
import { MOODS } from "../../logic/localState.mjs";
import type { State } from "../../services/localdb";
export default function HomeLocal({
  state,
  update,
  openPair,
}: {
  state: State;
  update: (action: Record<string, unknown>) => void;
  openPair: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [reduced, setReduced] = useState(false);
  const [picker, setPicker] = useState(false);
  const [selected, setSelected] = useState(new Date(state.anniversary));
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  const elapsed = loveCounter(state.anniversary, now);
  const partnerMood = MOODS.find((mood) => mood.id === state.partner?.mood);
  async function saveDate(date: Date) {
    if (
      !(await confirm(
        "Đổi ngày bắt đầu?",
        "Ngày này được lưu trên máy bạn và gửi cho người thương ở lần ghép nối tiếp theo.",
      ))
    )
      return;
    try {
      update({ type: "anniversary.set", iso: date.toISOString() });
    } catch (error) {
      Alert.alert(
        "Chưa đổi ngày",
        error instanceof Error ? error.message : "Ngày không hợp lệ.",
      );
    }
  }
  return (
    <>
      <View className="flex-row items-center justify-around mb-2">
        <View className="items-center max-w-36">
          <LocalAvatar name={state.me.nickname} image={state.me.avatar} />
          <Text className="text-ink font-semibold mt-2 text-center">
            {state.me.nickname}
          </Text>
        </View>
        <View className="items-center max-w-36">
          <LocalAvatar
            name={state.partner?.nickname || "Người thương"}
            image={state.partner?.avatar ?? null}
          />
          <Text className="text-ink font-semibold mt-2 text-center">
            {state.partner?.nickname || "Chưa ghép nối"}
          </Text>
        </View>
      </View>
      <ThreeHeart reduced={reduced} />
      <View className="items-center mb-5">
        <Text className="text-sm uppercase tracking-widest text-love">
          Chúng mình đã bên nhau
        </Text>
        <Text className="text-6xl font-bold text-ink mt-2">
          {elapsed.totalDays}
        </Text>
        <Text className="text-love mt-1">ngày yêu thương</Text>
      </View>
      <Card>
        <View className="flex-row flex-wrap justify-between">
          {[
            ["Năm", elapsed.years],
            ["Tháng", elapsed.months],
            ["Ngày", elapsed.days],
            ["Giờ", elapsed.hours],
            ["Phút", elapsed.minutes],
            ["Giây", elapsed.seconds],
          ].map(([label, value]) => (
            <View key={String(label)} className="items-center w-1/3 py-3">
              <Text className="text-3xl text-love font-bold">
                {String(value).padStart(2, "0")}
              </Text>
              <Text className="text-stone-500 mt-1">{String(label)}</Text>
            </View>
          ))}
        </View>
        <Note>
          Bắt đầu: {new Date(state.anniversary).toLocaleDateString("vi-VN")} ·
          lưu ngay trên máy này.
        </Note>
        <Button
          label="Chọn ngày bắt đầu"
          secondary
          onPress={() => {
            setSelected(new Date(state.anniversary));
            setPicker(true);
          }}
        />
        {picker && (
          <>
            <DateTimePicker
              value={selected}
              maximumDate={new Date()}
              minimumDate={new Date("1900-01-01")}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event, date) => {
                if (Platform.OS === "android") setPicker(false);
                if (event.type === "set" && date) {
                  setSelected(date);
                  if (Platform.OS === "android") void saveDate(date);
                }
              }}
            />
            {Platform.OS === "ios" && (
              <Button
                label="Lưu ngày đã chọn"
                secondary
                onPress={() => {
                  setPicker(false);
                  void saveDate(selected);
                }}
              />
            )}
          </>
        )}
      </Card>
      {state.partner ? (
        <Card>
          <Title small>{state.partner.nickname}</Title>
          <Text className="text-love mb-2">
            {partnerMood?.emoji} {partnerMood?.name}
          </Text>
          <Note>{state.partner.moodNote || "Chưa có ghi chú cảm xúc."}</Note>
          <Note>
            Cập nhật lần cuối khi bạn quét mã của người thương. Không có cập
            nhật tự động vì ứng dụng không dùng máy chủ.
          </Note>
        </Card>
      ) : (
        <Card>
          <Title small>Nối với người thương</Title>
          <Note>
            Ứng dụng chạy hoàn toàn trên máy. Hai bạn nối nhau bằng quét mã QR
            hoặc gửi tệp dữ liệu: đổi cảm xúc, kỷ niệm rồi ghép nối lại để cập
            nhật. Không cần máy chủ, nhưng cũng không có thông báo tự động giữa
            hai máy.
          </Note>
          <Button label="Mở phần ghép nối" onPress={openPair} />
        </Card>
      )}
      <Card>
        <Title small>Một điều nhỏ hôm nay</Title>
        <Note>
          Hỏi “Hôm nay bạn cần mình làm gì?”. Không phải ngày nào cũng cần hoàn
          hảo; chỉ cần hai bạn thật lòng lắng nghe.
        </Note>
      </Card>
    </>
  );
}
