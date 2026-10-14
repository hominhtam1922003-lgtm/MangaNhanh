// Lịch chọn ngày tự viết (không dùng hộp thoại hệ điều hành) nên không bao giờ
// tự nhảy về tháng hiện tại khi màn hình cha vẽ lại mỗi giây; kèm phần gõ thẳng
// ngày / tháng / năm. Toàn bộ phép tính nằm ở đây để kiểm thử được.
export const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const MONTH_NAMES = [
  "tháng 1",
  "tháng 2",
  "tháng 3",
  "tháng 4",
  "tháng 5",
  "tháng 6",
  "tháng 7",
  "tháng 8",
  "tháng 9",
  "tháng 10",
  "tháng 11",
  "tháng 12",
];
/** Số ngày của một tháng (month: 1–12). */
export function daysInMonth(year, month) {
  if (!Number.isInteger(year) || !Number.isInteger(month))
    throw new Error("Ngày không hợp lệ.");
  if (month < 1 || month > 12) throw new Error("Tháng phải từ 1 đến 12.");
  if (year < 1900 || year > 2200) throw new Error("Năm phải từ 1900 đến 2200.");
  return new Date(year, month, 0).getDate();
}
export function monthLabel(year, month) {
  return `${MONTH_NAMES[month - 1] ?? "tháng ?"} năm ${year}`;
}
/** Lùi/tiến tháng, tự sang năm mới; luôn giữ trong khoảng 1900–2200. */
export function shiftMonth(view, delta) {
  const total = (view.year - 1900) * 12 + (view.month - 1) + delta;
  const year = 1900 + Math.floor(total / 12);
  const month = (((total % 12) + 12) % 12) + 1;
  if (year < 1900) return { year: 1900, month: 1 };
  if (year > 2200) return { year: 2200, month: 12 };
  return { year, month };
}
export function shiftYear(view, delta) {
  const year = Math.min(2200, Math.max(1900, view.year + delta));
  return { year, month: view.month };
}
export function isoOf(year, month, day) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
/** Lưới 6 tuần × 7 ngày, tuần bắt đầu Thứ Hai, có cả ngày của tháng kề. */
export function monthGrid(year, month) {
  const first = new Date(year, month - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const cells = [];
  const total = 42;
  for (let index = 0; index < total; index++) {
    const offset = index - lead;
    const date = new Date(year, month - 1, 1 + offset);
    cells.push({
      day: date.getDate(),
      month: date.getMonth() + 1,
      year: date.getFullYear(),
      inMonth: date.getMonth() + 1 === month && date.getFullYear() === year,
      iso: isoOf(date.getFullYear(), date.getMonth() + 1, date.getDate()),
    });
  }
  return cells;
}
/** Ngày ở 12 giờ trưa giờ máy: đổi múi giờ vẫn đúng ngày đã chọn. */
export function toNoon(year, month, day) {
  daysInMonth(year, month);
  if (!Number.isInteger(day) || day < 1 || day > daysInMonth(year, month))
    return null;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}
/** Gõ thẳng ngày / tháng / năm: trả về ngày 12 giờ trưa, sai thì ném lỗi tiếng Việt. */
export function parseTypedDate(dayText, monthText, yearText, now = new Date()) {
  const dayRaw = String(dayText ?? "").trim();
  const monthRaw = String(monthText ?? "").trim();
  const yearRaw = String(yearText ?? "").trim();
  if (
    !/^\d{1,2}$/.test(dayRaw) ||
    !/^\d{1,2}$/.test(monthRaw) ||
    !/^\d{1,4}$/.test(yearRaw)
  )
    throw new Error("Ngày, tháng và năm phải là số.");
  const day = Number(dayRaw);
  const month = Number(monthRaw);
  const year = Number(yearRaw);
  if (year < 1900) throw new Error("Năm phải từ 1900 trở lên.");
  if (month < 1 || month > 12) throw new Error("Tháng phải từ 1 đến 12.");
  const limit = new Date(year, month, 0).getDate();
  if (day < 1 || day > limit)
    throw new Error(`Tháng ${month} năm ${year} chỉ có ${limit} ngày.`);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    12,
    0,
    0,
    0,
  );
  if (date.getTime() > today.getTime())
    throw new Error("Ngày bắt đầu không được ở tương lai.");
  return date;
}
export function partsOf(value) {
  const date = new Date(value);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}
