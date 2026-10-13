import React, { useEffect, useState } from "react";
import { Alert, Platform, Pressable, Switch, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Button, Card, Input, Note, Title, confirm } from "../../components/UI";
import { cycleForecast, dateOnly } from "../../logic/time.mjs";
import type { State } from "../../services/localdb";
const pretty = (day: string) => day.split("-").reverse().join("/");
function Calendar({
  last,
  length,
  duration,
  today,
}: {
  last: string;
  length: number;
  duration: number;
  today: string;
}) {
  const [offset, setOffset] = useState(0);
  const base = new Date(today + "T00:00:00Z");
  const first = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset, 1),
  );
  const year = first.getUTCFullYear();
  const month = first.getUTCMonth();
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const blanks = (first.getUTCDay() + 6) % 7;
  return (
    <View className="mt-4">
      <View className="flex-row justify-between items-center">
        <Pressable
          accessibilityLabel="Tháng trước"
          onPress={() => setOffset(offset - 1)}
          className="p-3"
        >
          <Text className="text-love text-xl">‹</Text>
        </Pressable>
        <Text className="font-bold text-ink">
          Tháng {month + 1} · {year}
        </Text>
        <Pressable
          accessibilityLabel="Tháng sau"
          onPress={() => setOffset(offset + 1)}
          className="p-3"
        >
          <Text className="text-love text-xl">›</Text>
        </Pressable>
      </View>
      <View className="flex-row">
        {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((label) => (
          <Text
            key={label}
            style={{ width: "14.2857%", textAlign: "center" }}
            className="text-stone-400 py-2"
          >
            {label}
          </Text>
        ))}
      </View>
      <View className="flex-row flex-wrap">
        {Array.from({ length: blanks + count }, (_, index) => {
          const day = index - blanks + 1;
          const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          let forecast: ReturnType<typeof cycleForecast> | null = null;
          try {
            if (day > 0) forecast = cycleForecast(last, length, duration, date);
          } catch {}
          return (
            <View
              key={index}
              style={{ width: "14.2857%", height: 40, padding: 2 }}
            >
              <View
                className={`flex-1 rounded-full items-center justify-center ${forecast?.inPeriod ? "bg-pink-200" : forecast?.fertile ? "bg-violet-100" : date === today ? "bg-stone-100" : ""}`}
              >
                <Text
                  className={`text-sm ${date === today ? "font-bold text-love" : "text-ink"}`}
                >
                  {day > 0 ? day : ""}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
      <Note>
        Hồng: kỳ kinh theo lịch · Tím: khoảng dễ thụ thai ước tính. Đây không
        phải “ngày an toàn”.
      </Note>
    </View>
  );
}
export default function CycleLocal({
  state,
  update,
}: {
  state: State;
  update: (action: Record<string, unknown>) => void;
}) {
  const cycle = state.cycle;
  const today = dateOnly(new Date(), state.timezone);
  const [last, setLast] = useState(cycle?.lastPeriod || today);
  const [length, setLength] = useState(String(cycle?.cycleLength || 28));
  const [duration, setDuration] = useState(String(cycle?.periodLength || 5));
  const [reminders, setReminders] = useState(cycle?.reminders ?? true);
  const [picker, setPicker] = useState(false);
  useEffect(() => {
    setLast(cycle?.lastPeriod || today);
    setLength(String(cycle?.cycleLength || 28));
    setDuration(String(cycle?.periodLength || 5));
    setReminders(cycle?.reminders ?? true);
  }, [cycle?.updatedAt, cycle?.lastPeriod, today]);
  let forecast: ReturnType<typeof cycleForecast> | null = null;
  try {
    forecast = cycleForecast(last, Number(length), Number(duration), today);
  } catch {}
  function save() {
    try {
      update({
        type: "cycle.save",
        lastPeriod: last,
        cycleLength: Number(length),
        periodLength: Number(duration),
        reminders,
      });
      Alert.alert(
        "Đã lưu",
        reminders
          ? "Dữ liệu được lưu trên máy và lời nhắc đã được đặt lại."
          : "Dữ liệu được lưu trên máy, không đặt lời nhắc.",
      );
    } catch (error) {
      Alert.alert(
        "Chưa lưu",
        error instanceof Error ? error.message : "Dữ liệu chu kỳ không hợp lệ.",
      );
    }
  }
  return (
    <>
      <Card>
        <Title>Góc chăm sóc</Title>
        <Note>
          Ứng dụng chỉ tính theo lịch, không phải AI hay chẩn đoán y tế. Chu kỳ
          thật có thể lệch; không dùng lịch để tránh thai. Toàn bộ dữ liệu này
          nằm trên máy bạn và không tự gửi đi đâu.
        </Note>
      </Card>
      <Card>
        <Title small>Ghi nhận kỳ kinh</Title>
        <Button
          label={"Ngày đầu kỳ gần nhất: " + pretty(last)}
          secondary
          onPress={() => setPicker(true)}
        />
        {picker && (
          <>
            <DateTimePicker
              value={new Date(last + "T12:00:00")}
              maximumDate={new Date()}
              mode="date"
              onChange={(event, date) => {
                if (Platform.OS === "android") setPicker(false);
                if (event.type === "set" && date) setLast(dateOnly(date));
              }}
            />
            {Platform.OS === "ios" && (
              <Button
                label="Đóng lịch"
                secondary
                onPress={() => setPicker(false)}
              />
            )}
          </>
        )}
        <Input
          label="Độ dài vòng kinh (14–60 ngày)"
          value={length}
          onChangeText={setLength}
          keyboardType="number-pad"
        />
        <Input
          label="Số ngày có kinh (1–10 ngày)"
          value={duration}
          onChangeText={setDuration}
          keyboardType="number-pad"
        />
        <View className="flex-row justify-between items-center my-2">
          <Text className="text-ink flex-1">Lời nhắc chăm sóc theo lịch</Text>
          <Switch
            accessibilityLabel="Lời nhắc chăm sóc"
            value={reminders}
            onValueChange={setReminders}
            trackColor={{ true: "#e64980" }}
          />
        </View>
        <Button label="Lưu chu kỳ" onPress={save} />
        {cycle && (
          <Button
            label="Xóa dữ liệu chu kỳ"
            secondary
            onPress={() =>
              void (async () => {
                if (
                  !(await confirm(
                    "Xóa chu kỳ?",
                    "Dữ liệu chu kỳ và lời nhắc trên máy này sẽ bị xóa.",
                  ))
                )
                  return;
                update({ type: "cycle.clear" });
              })()
            }
          />
        )}
      </Card>
      {forecast && (
        <Card>
          {forecast.stale ? (
            <>
              <Title small>Cần cập nhật kỳ gần nhất</Title>
              <Note>
                Dữ liệu đã quá cũ nên không hiển thị dự báo và không đặt lời
                nhắc. Hãy cập nhật ngày thực tế.
              </Note>
            </>
          ) : (
            <>
              <Title small>
                Kỳ tiếp theo ước tính: {pretty(forecast.nextPeriod)}
              </Title>
              <Note>
                Khoảng {forecast.daysUntil} ngày nữa. Rụng trứng ước tính:{" "}
                {pretty(forecast.ovulation)}. Khoảng dễ thụ thai:{" "}
                {pretty(forecast.fertileStart)} – {pretty(forecast.fertileEnd)}.
              </Note>
              <Calendar
                last={last}
                length={Number(length)}
                duration={Number(duration)}
                today={today}
              />
            </>
          )}
        </Card>
      )}
      <Card>
        <Title small>Chăm sóc và an toàn</Title>
        <Note>
          Nước ấm, nghỉ ngơi, đồ dùng cần thiết và một lời hỏi han có thể hữu
          ích. Nếu đau dữ dội, chảy máu bất thường, ngất hoặc trễ kinh kéo dài,
          hãy tới cơ sở y tế. Không tự dùng thuốc theo ứng dụng.
        </Note>
        <Note>
          Lời nhắc trên máy này chỉ dành cho bạn. Nhắc cho người thương cần gửi
          dữ liệu qua phần ghép nối, vì ứng dụng không có máy chủ.
        </Note>
      </Card>
    </>
  );
}
