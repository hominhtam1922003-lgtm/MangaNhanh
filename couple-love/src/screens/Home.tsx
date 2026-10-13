import React, { useEffect, useState } from "react";
import { View, Text, Alert, AccessibilityInfo, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SupabaseClient } from "@supabase/supabase-js";
import ThreeHeart from "../components/ThreeHeart";
import { Card, Title, Note, Button, Avatar, confirm } from "../components/UI";
import { Snapshot } from "../services/sync";
import { explain } from "../services/backend";
import { loveCounter } from "../logic/time.mjs";
import Pair from "./Pair";
export default function Home({
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
  const [now, setNow] = useState(Date.now()),
    [reduced, setReduced] = useState(false),
    [picker, setPicker] = useState(false),
    [selectedDate, setSelectedDate] = useState(new Date());
  const couple = data.couple;
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  const elapsed = loveCounter(
    couple?.anniversary || new Date(now).toISOString(),
    now,
  );
  const me = data.profiles.find((p) => p.id === uid),
    partner = data.profiles.find((p) => p.id !== uid);
  async function setDate(date: Date) {
    if (
      !(await confirm(
        "Đổi ngày bắt đầu?",
        "Ngày mới sẽ đồng bộ cho cả hai bạn.",
      ))
    )
      return;
    try {
      const r = await db.rpc("set_anniversary", {
        start_at: date.toISOString(),
      });
      if (r.error) throw r.error;
      refresh();
    } catch (e) {
      Alert.alert("Chưa đổi ngày", explain(e));
    }
  }
  return (
    <>
      <View className="flex-row items-center justify-around mb-2">
        {[me, partner].map((p, i) => (
          <View key={p?.id || i} className="items-center max-w-36">
            <Avatar
              db={db}
              path={p?.avatar_path || null}
              name={p?.nickname || "Người thương"}
            />
            <Text className="text-ink font-semibold mt-2 text-center">
              {p?.nickname || (i === 0 ? "Bạn" : "Chờ người thương")}
            </Text>
          </View>
        ))}
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
            <View key={label} className="items-center w-1/3 py-3">
              <Text className="text-3xl text-love font-bold">
                {String(value).padStart(2, "0")}
              </Text>
              <Text className="text-stone-500 mt-1">{label}</Text>
            </View>
          ))}
        </View>
        {couple && (
          <>
            <Note>
              Bắt đầu:{" "}
              {new Date(couple.anniversary).toLocaleDateString("vi-VN")} · Theo
              cùng một mốc thời gian, không phụ thuộc máy của hai bạn.
            </Note>
            <Button
              label="Chọn ngày bắt đầu"
              secondary
              onPress={() => {
                setSelectedDate(new Date(couple.anniversary));
                setPicker(true);
              }}
            />
            {picker && (
              <>
                <DateTimePicker
                  value={selectedDate}
                  maximumDate={new Date()}
                  minimumDate={new Date("1900-01-01")}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(event, date) => {
                    if (Platform.OS === "android") setPicker(false);
                    if (event.type === "set" && date) {
                      setSelectedDate(date);
                      if (Platform.OS === "android") void setDate(date);
                    }
                  }}
                />
                {Platform.OS === "ios" && (
                  <Button
                    label="Lưu ngày đã chọn"
                    secondary
                    onPress={() => {
                      setPicker(false);
                      void setDate(selectedDate);
                    }}
                  />
                )}
              </>
            )}
          </>
        )}
      </Card>
      {!partner && <Pair db={db} refresh={refresh} />}
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
