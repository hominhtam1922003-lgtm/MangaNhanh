import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  cycleForecast,
  loveCounter,
  reminderEvents,
  dateOnly,
} from "../src/logic/time.mjs";
test("Ngày nhuận và ngày không tồn tại", () => {
  assert.equal(addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.throws(() => addDays("2026-02-30", 0));
});
test("Đếm năm/tháng kẹp cuối tháng, phần giây chính xác", () => {
  const v = loveCounter(
    "2024-02-29T12:00:00Z",
    Date.parse("2025-03-01T13:02:03Z"),
  );
  assert.deepEqual(
    [v.years, v.months, v.days, v.hours, v.minutes, v.seconds],
    [1, 0, 1, 1, 2, 3],
  );
});
test("Mốc tương lai không đếm âm", () =>
  assert.equal(loveCounter("2099-01-01", 0).seconds, 0));
test("Hai thiết bị dùng chung mốc UTC", () =>
  assert.deepEqual(
    loveCounter("2026-01-01T00:00:00Z", Date.parse("2026-01-02T01:02:03Z")),
    loveCounter(
      "2026-01-01T07:00:00+07:00",
      Date.parse("2026-01-02T01:02:03Z"),
    ),
  ));
test("Dự báo chu kỳ 28 ngày", () => {
  const f = cycleForecast("2026-01-01", 28, 5, "2026-01-09");
  assert.equal(f.nextPeriod, "2026-01-29");
  assert.equal(f.ovulation, "2026-01-15");
  assert.equal(f.fertileStart, "2026-01-10");
  assert.equal(f.fertileEnd, "2026-01-16");
});
test("Nhắc trước ba ngày và ngày đầu kỳ", () => {
  assert.equal(
    reminderEvents("2026-01-01", 28, 5, "2026-01-26")[0].kind,
    "period_soon",
  );
  assert.equal(
    reminderEvents("2026-01-01", 28, 5, "2026-01-29")[0].kind,
    "period",
  );
});
test("Không gửi mốc cũ/không hợp lệ", () => {
  assert.deepEqual(reminderEvents("2025-01-01", 28, 5, "2026-01-01"), []);
  assert.throws(() => cycleForecast("2027-01-01", 28, 5, "2026-01-01"));
  assert.throws(() => cycleForecast("2026-01-01", 13, 5, "2026-01-02"));
});
test("Múi giờ Việt Nam đổi ngày đúng", () =>
  assert.equal(dateOnly(new Date("2026-01-01T18:00:00Z")), "2026-01-02"));
