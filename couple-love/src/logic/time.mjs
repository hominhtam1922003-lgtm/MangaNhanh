export const DAY = 86400000;
export function addDays(date, days) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Ngày không hợp lệ.");
  const time = Date.parse(`${date}T00:00:00Z`);
  if (
    !Number.isFinite(time) ||
    new Date(time).toISOString().slice(0, 10) !== date
  )
    throw new Error("Ngày không tồn tại.");
  return new Date(time + days * DAY).toISOString().slice(0, 10);
}
export function dateOnly(date = new Date(), zone = "Asia/Ho_Chi_Minh") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (key) => parts.find((p) => p.type === key)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function anchor(start, months) {
  const year =
    start.getUTCFullYear() + Math.floor((start.getUTCMonth() + months) / 12);
  const month = (start.getUTCMonth() + months) % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Date.UTC(
    year,
    month,
    Math.min(start.getUTCDate(), last),
    start.getUTCHours(),
    start.getUTCMinutes(),
    start.getUTCSeconds(),
  );
}
export function loveCounter(iso, now = Date.now()) {
  const start = new Date(iso);
  const time = start.getTime();
  if (!Number.isFinite(time) || time > now)
    return {
      years: 0,
      months: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalDays: 0,
    };
  const end = new Date(now);
  let months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    end.getUTCMonth() -
    start.getUTCMonth();
  if (anchor(start, months) > now) months--;
  let remaining = Math.floor((now - anchor(start, months)) / 1000);
  const days = Math.floor(remaining / 86400);
  remaining %= 86400;
  const hours = Math.floor(remaining / 3600);
  remaining %= 3600;
  return {
    years: Math.floor(months / 12),
    months: months % 12,
    days,
    hours,
    minutes: Math.floor(remaining / 60),
    seconds: remaining % 60,
    totalDays: Math.floor((now - time) / DAY),
  };
}
export function cycleForecast(last, length, duration, today = dateOnly()) {
  if (
    !Number.isInteger(length) ||
    length < 14 ||
    length > 60 ||
    !Number.isInteger(duration) ||
    duration < 1 ||
    duration > 10 ||
    duration >= length
  )
    throw new Error(
      "Vòng kinh 14–60 ngày, kỳ kinh 1–10 ngày và ngắn hơn vòng kinh.",
    );
  addDays(last, 0);
  addDays(today, 0);
  const age = Math.floor(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${last}T00:00:00Z`)) / DAY,
  );
  if (age < 0) throw new Error("Ngày đầu kỳ kinh không được ở tương lai.");
  const index = Math.floor(age / length);
  const cycleStart = addDays(last, index * length),
    next = addDays(cycleStart, length);
  const ovulation = addDays(next, -14);
  const fertileStart = addDays(ovulation, -5),
    fertileEnd = addDays(ovulation, 1);
  const inPeriod =
    today >= cycleStart && today <= addDays(cycleStart, duration - 1);
  const fertile = today >= fertileStart && today <= fertileEnd;
  const stale = age > Math.min(90, length * 3);
  return {
    nextPeriod: next,
    ovulation,
    fertileStart,
    fertileEnd,
    cycleStart,
    inPeriod,
    fertile,
    stale,
    daysUntil: Math.floor(
      (Date.parse(`${next}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
        DAY,
    ),
  };
}
export function reminderEvents(last, length, duration, today) {
  const forecast = cycleForecast(last, length, duration, today);
  if (forecast.stale) return [];
  const result = [];
  for (
    let n = 1;
    n <=
    Math.floor(
      (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${last}T00:00:00Z`)) /
        DAY /
        length,
    ) +
      2;
    n++
  ) {
    const period = addDays(last, n * length);
    for (const [kind, date] of [
      ["period_soon", addDays(period, -3)],
      ["period", period],
      ["ovulation", addDays(period, -14)],
    ])
      if (date === today) result.push({ kind, date, period });
  }
  return result;
}
