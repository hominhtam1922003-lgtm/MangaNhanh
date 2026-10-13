import React, { useState, useEffect } from "react";
import { View, Text, Alert, Switch, Pressable, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SupabaseClient } from "@supabase/supabase-js";
import { Snapshot } from "../services/sync";
import { Card, Title, Note, Input, Button, confirm } from "../components/UI";
import { cycleForecast, dateOnly, addDays } from "../logic/time.mjs";
import { explain } from "../services/backend";
const pretty = (d: string) => d.split("-").reverse().join("/");
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
  const year = first.getUTCFullYear(),
    month = first.getUTCMonth();
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
        {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((t) => (
          <Text
            key={t}
            style={{ width: "14.2857%", textAlign: "center" }}
            className="text-stone-400 py-2"
          >
            {t}
          </Text>
        ))}
      </View>
      <View className="flex-row flex-wrap">
        {Array.from({ length: blanks + count }, (_, i) => {
          const day = i - blanks + 1;
          const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          let forecast = null;
          try {
            if (day > 0) forecast = cycleForecast(last, length, duration, date);
          } catch {}
          return (
            <View key={i} style={{ width: "14.2857%", height: 40, padding: 2 }}>
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
export default function CycleScreen({
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
  const c = data.cycle,
    today = dateOnly(new Date(), data.couple?.timezone);
  const [last, setLast] = useState(c?.last_period || today),
    [length, setLength] = useState(String(c?.cycle_length || 28)),
    [duration, setDuration] = useState(String(c?.period_length || 5)),
    [shared, setShared] = useState(c?.shared || false),
    [reminders, setReminders] = useState(c?.reminders ?? true),
    [picker, setPicker] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setLast(c?.last_period || today);
    setLength(String(c?.cycle_length || 28));
    setDuration(String(c?.period_length || 5));
    setShared(c?.shared || false);
    setReminders(c?.reminders ?? true);
  }, [c?.updated_at, c?.last_period, c?.shared, c?.owner_id]);
  let forecast: ReturnType<typeof cycleForecast> | null = null;
  try {
    forecast = cycleForecast(last, Number(length), Number(duration), today);
  } catch {}
  const owner = !c || c.owner_id === uid;
  async function save() {
    if (!data.couple) return;
    if (
      shared &&
      !c?.shared &&
      !(await confirm(
        "Chia sẻ dữ liệu chu kỳ?",
        "Người thương sẽ thấy ngày kỳ kinh và dự báo. Bạn có thể tắt bất cứ lúc nào.",
      ))
    )
      return;
    setBusy(true);
    try {
      cycleForecast(last, Number(length), Number(duration), today);
      const r = await db.from("cycles").upsert({
        couple_id: data.couple.id,
        owner_id: uid,
        last_period: last,
        cycle_length: Number(length),
        period_length: Number(duration),
        shared,
        reminders,
      });
      if (r.error) throw r.error;
      refresh();
      Alert.alert("Đã lưu", "Dự báo và tùy chọn riêng tư đã đồng bộ.");
    } catch (e) {
      Alert.alert("Chưa lưu", explain(e));
    } finally {
      setBusy(false);
    }
  }
  if (!data.couple)
    return (
      <Card>
        <Title small>Góc chăm sóc</Title>
        <Note>
          Tạo mã ghép đôi trong mục Bên nhau trước khi ghi nhận chu kỳ. Dữ liệu
          mặc định chỉ người ghi nhìn thấy.
        </Note>
      </Card>
    );
  return (
    <>
      <Card>
        <Title>Góc chăm sóc</Title>
        <Note>
          Ước tính theo lịch, không phải AI hay chẩn đoán. Chu kỳ thực tế có thể
          thay đổi; không dùng lịch để tránh thai. Dữ liệu không chia sẻ mặc
          định.
        </Note>
      </Card>
      {c && !owner && (
        <Card>
          <Note>
            Người thương đã đồng ý chia sẻ. Chỉ người ghi có thể sửa dữ liệu
            này.
          </Note>
        </Card>
      )}
      <Card>
        <Title small>{owner ? "Ghi nhận kỳ kinh" : "Lịch được chia sẻ"}</Title>
        {owner ? (
          <>
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
              <Text className="text-ink flex-1">
                Chia sẻ lịch với người thương
              </Text>
              <Switch
                accessibilityLabel="Chia sẻ lịch chu kỳ"
                value={shared}
                onValueChange={setShared}
                trackColor={{ true: "#e64980" }}
              />
            </View>
            <View className="flex-row justify-between items-center my-2">
              <Text className="text-ink flex-1">
                Lời nhắc chăm sóc theo lịch
              </Text>
              <Switch
                accessibilityLabel="Lời nhắc chăm sóc"
                value={reminders}
                onValueChange={setReminders}
                trackColor={{ true: "#e64980" }}
              />
            </View>
            <Button
              label="Lưu chu kỳ và quyền chia sẻ"
              busy={busy}
              onPress={() => void save()}
            />
            {c && (
              <Button
                label="Xóa dữ liệu chu kỳ"
                secondary
                onPress={() =>
                  void (async () => {
                    if (
                      await confirm(
                        "Xóa chu kỳ?",
                        "Dữ liệu và lời nhắc chu kỳ của cặp đôi sẽ bị xóa.",
                      )
                    ) {
                      const r = await db
                        .from("cycles")
                        .delete()
                        .eq("couple_id", c.couple_id);
                      if (r.error) Alert.alert("Chưa xóa", explain(r.error));
                      else refresh();
                    }
                  })()
                }
              />
            )}
          </>
        ) : (
          <Note>
            Đầu kỳ gần nhất: {pretty(last)} · Vòng kinh {length} ngày · Kỳ kinh{" "}
            {duration} ngày
          </Note>
        )}
      </Card>
      {forecast && (
        <Card>
          {forecast.stale ? (
            <>
              <Title small>Cần cập nhật kỳ gần nhất</Title>
              <Note>
                Dữ liệu đã quá cũ. Đã dừng lời nhắc tự động; cập nhật ngày thực
                tế trước khi tham khảo dự báo.
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
        <Title small>Quan tâm bằng sự lắng nghe</Title>
        <Note>
          Trước kỳ khoảng 3 ngày, hai bạn có thể nhận lời nhắc nếu người ghi bật
          chia sẻ và người nhận bật đồng ý trong Cài đặt. Thông báo ngoài màn
          hình không hiển thị thông tin sức khỏe.
        </Note>
        <Note>
          Nước ấm, nghỉ ngơi, đồ dùng cần thiết và một lời hỏi han có thể hữu
          ích. Nếu đau dữ dội, chảy máu nhiều bất thường, ngất hoặc trễ kinh kéo
          dài, hãy liên hệ cơ sở y tế. Không tự dùng thuốc theo ứng dụng.
        </Note>
      </Card>
    </>
  );
}
