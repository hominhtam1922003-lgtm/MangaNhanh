import React, { memo, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Button, Input } from "./UI";
import { useTheme } from "../theme/ThemeContext";
import {
  WEEKDAYS,
  daysInMonth,
  monthGrid,
  monthLabel,
  parseTypedDate,
  partsOf,
  shiftMonth,
  shiftYear,
  toNoon,
} from "../logic/datepicker.mjs";
/**
 * Lịch chọn ngày của app (không phải hộp thoại của hệ điều hành).
 * Tháng đang xem nằm trong state của chính nó nên màn hình cha vẽ lại mỗi giây
 * cũng không làm nó nhảy về tháng hiện tại, và có thể gõ thẳng ngày/tháng/năm.
 */
const DatePicker = memo(function DatePicker({
  valueMs,
  onPick,
  onClose,
}: {
  valueMs: number;
  onPick: (date: Date) => void;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const initial = partsOf(valueMs);
  const [view, setView] = useState({
    year: initial.year,
    month: initial.month,
  });
  const [selected, setSelected] = useState(initial);
  const [mode, setMode] = useState<"lich" | "go">("lich");
  const [dayText, setDayText] = useState(String(initial.day));
  const [monthText, setMonthText] = useState(String(initial.month));
  const [yearText, setYearText] = useState(String(initial.year));
  const [error, setError] = useState("");
  const today = new Date();
  const cells = useMemo(
    () => monthGrid(view.year, view.month),
    [view.year, view.month],
  );
  function choose(cell: { year: number; month: number; day: number }) {
    setSelected({ year: cell.year, month: cell.month, day: cell.day });
    setDayText(String(cell.day));
    setMonthText(String(cell.month));
    setYearText(String(cell.year));
    setError("");
    if (cell.year !== view.year || cell.month !== view.month)
      setView({ year: cell.year, month: cell.month });
  }
  function useToday() {
    const now = partsOf(Date.now());
    choose(now);
    setView({ year: now.year, month: now.month });
  }
  function submitTyped() {
    try {
      const date = parseTypedDate(dayText, monthText, yearText, today);
      setError("");
      onPick(date);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Ngày không hợp lệ.");
    }
  }
  const isToday = (cell: { year: number; month: number; day: number }) =>
    cell.year === today.getFullYear() &&
    cell.month === today.getMonth() + 1 &&
    cell.day === today.getDate();
  return (
    <View
      className="rounded-3xl p-4 mt-3"
      style={{
        backgroundColor: theme.soft,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <View className="flex-row items-center justify-between mb-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Lùi một năm"
          onPress={() => setView((current) => shiftYear(current, -1))}
          className="px-3 py-1"
        >
          <Text style={{ color: theme.text }} className="text-xl font-bold">
            «
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Lùi một tháng"
          onPress={() => setView((current) => shiftMonth(current, -1))}
          className="px-3 py-1"
        >
          <Text style={{ color: theme.text }} className="text-2xl font-bold">
            ‹
          </Text>
        </Pressable>
        <Text
          accessibilityLabel={monthLabel(view.year, view.month)}
          style={{ color: theme.ink }}
          className="text-base font-bold flex-1 text-center"
        >
          {monthLabel(view.year, view.month)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tiến một tháng"
          onPress={() => setView((current) => shiftMonth(current, 1))}
          className="px-3 py-1"
        >
          <Text style={{ color: theme.text }} className="text-2xl font-bold">
            ›
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tiến một năm"
          onPress={() => setView((current) => shiftYear(current, 1))}
          className="px-3 py-1"
        >
          <Text style={{ color: theme.text }} className="text-xl font-bold">
            »
          </Text>
        </Pressable>
      </View>
      <View
        className="flex-row mb-1"
        style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}
      >
        {WEEKDAYS.map((label) => (
          <View key={label} style={{ width: `${100 / 7}%` }} className="py-2">
            <Text
              className="text-xs font-semibold text-center"
              style={{ color: theme.sub }}
            >
              {label}
            </Text>
          </View>
        ))}
      </View>
      <View className="flex-row flex-wrap">
        {cells.map((cell) => {
          const picked =
            cell.year === selected.year &&
            cell.month === selected.month &&
            cell.day === selected.day;
          const content = (
            <Text
              className="text-center text-sm font-semibold"
              style={{
                color: picked
                  ? "#ffffff"
                  : cell.inMonth
                    ? theme.ink
                    : theme.sub,
                opacity: cell.inMonth ? 1 : 0.5,
              }}
            >
              {cell.day}
            </Text>
          );
          return (
            <Pressable
              key={cell.iso}
              accessibilityRole="button"
              accessibilityLabel={`Ngày ${cell.day} ${monthLabel(cell.year, cell.month)}`}
              onPress={() => choose(cell)}
              style={{ width: `${100 / 7}%`, paddingVertical: 3 }}
            >
              {picked ? (
                <LinearGradient
                  colors={theme.deep}
                  style={{ height: 36, borderRadius: 18 }}
                  className="items-center justify-center"
                >
                  {content}
                </LinearGradient>
              ) : (
                <View
                  style={{
                    height: 36,
                    borderRadius: 18,
                    borderWidth: isToday(cell) ? 1.5 : 0,
                    borderColor: theme.deep[0],
                    backgroundColor: isToday(cell)
                      ? theme.glass
                      : "transparent",
                  }}
                  className="items-center justify-center"
                >
                  {content}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
      <View className="flex-row mt-2">
        <View className="flex-1 mr-1">
          <Button label="Hôm nay" secondary onPress={useToday} />
        </View>
        <View className="flex-1 ml-1">
          <Button
            label={mode === "lich" ? "Gõ ngày tháng" : "Chọn trên lịch"}
            secondary
            onPress={() => setMode(mode === "lich" ? "go" : "lich")}
          />
        </View>
      </View>
      {mode === "go" ? (
        <View className="mt-2">
          <View className="flex-row">
            <View className="flex-1 mr-1">
              <Input
                label="Ngày"
                value={dayText}
                onChangeText={setDayText}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
            <View className="flex-1 mx-1">
              <Input
                label="Tháng"
                value={monthText}
                onChangeText={setMonthText}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
            <View className="flex-1 ml-1">
              <Input
                label="Năm"
                value={yearText}
                onChangeText={setYearText}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
          </View>
          {error ? (
            <Text className="text-sm mb-1" style={{ color: "#d6336c" }}>
              {error}
            </Text>
          ) : (
            <Text className="text-xs mb-1" style={{ color: theme.sub }}>
              Gõ thẳng ví dụ 14 / 2 / 2024 rồi bấm “Lưu ngày này”.
            </Text>
          )}
        </View>
      ) : null}
      <Text className="text-sm mt-1" style={{ color: theme.sub }}>
        Đang chọn: ngày {selected.day}{" "}
        {monthLabel(selected.year, selected.month)}
      </Text>
      <Button
        label="Lưu ngày này"
        onPress={() => {
          if (mode === "go") return submitTyped();
          const date = toNoon(selected.year, selected.month, selected.day);
          if (!date) {
            setError("Ngày không hợp lệ.");
            return;
          }
          onPick(date);
        }}
      />
      <Button label="Đóng lịch" secondary onPress={onClose} />
      <Text className="text-xs mt-1" style={{ color: theme.sub }}>
        Số ngày trong tháng đang xem: {daysInMonth(view.year, view.month)} · chỉ
        chọn được ngày từ 1900 tới hôm nay.
      </Text>
    </View>
  );
});
export default DatePicker;
