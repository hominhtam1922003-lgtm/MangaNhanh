import { test } from "node:test";
import assert from "node:assert/strict";
import {
  THEMES,
  DEFAULT_THEME,
  isTheme,
  themeById,
} from "../src/logic/themes.mjs";
import {
  daysInMonth,
  isoOf,
  monthGrid,
  monthLabel,
  parseTypedDate,
  partsOf,
  shiftMonth,
  shiftYear,
  toNoon,
} from "../src/logic/datepicker.mjs";
import { emptyState, reduce, wallpaperFile } from "../src/logic/localState.mjs";
import { buildRelayPayload } from "../src/services/relayProtocol.mjs";
import { photoMessages } from "../src/services/momentTransfer.mjs";
const hex = /^#[0-9a-f]{6}$/i;
const rgba = /^rgba\(\d+, \d+, \d+, [0-9.]+\)$/;
const toRgb = (hex) =>
  [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16));
const luminance = (color) => {
  const [r, g, b] = toRgb(color)
    .map((value) => value / 255)
    .map((value) =>
      value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};
test("Chủ đề: chữ luôn đủ tương phản nên không bị mờ/mất khi đổi chủ đề", () => {
  for (const theme of THEMES) {
    const rows = [
      ["chữ chính trên thẻ", theme.ink, theme.surface, 4.5],
      ["chữ chính trên nền ô nhập", theme.ink, theme.soft, 4.5],
      ["chữ chính trên nền app", theme.ink, theme.bg[1], 4.5],
      ["chữ mờ trên thẻ", theme.sub, theme.surface, 3],
      ["chữ mờ trên nền app", theme.sub, theme.bg[1], 3],
      ["màu nhấn trên ô nhập", theme.text, theme.soft, 3.2],
      ["màu nhấn trên thẻ", theme.text, theme.surface, 3.2],
      ["chữ trên nút chính", theme.onDeep, theme.deep[0], 3.2],
      ["chữ trên nút chính (đậm)", theme.onDeep, theme.deep[1], 4.6],
      ["chữ chính trên thẻ nổi", theme.ink, theme.hero[0], 4.5],
      ["chữ mờ trên thẻ nổi", theme.sub, theme.hero[0], 3],
    ];
    for (const [label, a, b, min] of rows)
      assert.equal(
        contrast(a, b) >= min,
        true,
        `${theme.id}: ${label} chỉ ${contrast(a, b).toFixed(2)} (cần ${min})`,
      );
    assert.match(theme.onDeep, hex, `${theme.id}: thiếu onDeep`);
    // Nền có ảnh: lớp phủ phải đủ dày để chữ trên nền vẫn đọc được.
    const alpha = Number(theme.veil.match(/([0-9.]+)\)$/)[1]);
    assert.equal(
      alpha >= (theme.dark ? 0.7 : 0.85),
      true,
      `${theme.id}: lớp phủ mỏng quá`,
    );
  }
});
test("Chủ đề: 12 bảng màu đầy đủ, mọi màn hình lấy đủ màu để hài hoà", () => {
  assert.equal(THEMES.length, 12);
  assert.equal(new Set(THEMES.map((theme) => theme.id)).size, 12);
  assert.equal(isTheme(DEFAULT_THEME), true);
  assert.equal(themeById("hong").name, "Hồng kẹo");
  assert.equal(themeById("khong-co").id, DEFAULT_THEME);
  assert.equal(themeById(undefined).id, DEFAULT_THEME);
  // Các chủ đề cũ vẫn còn để máy đang dùng không bị mất chủ đề.
  for (const legacy of [
    "hong",
    "tim",
    "bien",
    "bacam",
    "hoanghon",
    "nang",
    "tuyet",
    "dem",
  ])
    assert.equal(isTheme(legacy), true, `thiếu chủ đề cũ ${legacy}`);
  for (const theme of THEMES) {
    assert.equal(theme.bg.length, 3, `${theme.id}: cần 3 màu nền`);
    assert.equal(theme.hero.length, 2);
    assert.equal(theme.deep.length, 2);
    assert.equal(theme.emoji.length, 3);
    for (const color of [...theme.bg, ...theme.hero, ...theme.deep])
      assert.match(color, hex, `${theme.id}: màu ${color} không hợp lệ`);
    for (const color of [
      theme.soft,
      theme.surface,
      theme.border,
      theme.ink,
      theme.sub,
      theme.text,
      theme.glow,
    ])
      assert.match(color, hex, `${theme.id}: màu ${color} không hợp lệ`);
    assert.match(theme.glass, rgba);
    assert.match(theme.veil, rgba);
  }
  const dark = THEMES.filter((theme) => theme.dark);
  assert.equal(dark.length >= 1, true, "cần ít nhất một chủ đề tối");
  for (const theme of dark) assert.notEqual(theme.ink, theme.bg[0]);
});
test("Lịch tự viết: lưới tháng đúng, qua tháng không nhảy về tháng hiện tại", () => {
  // Tháng 10/2026 bắt đầu Thứ Năm: 3 ô đệm của tháng 9 rồi tới ngày 1.
  const grid = monthGrid(2026, 10);
  assert.equal(grid.length, 42);
  assert.equal(grid[0].day, 28);
  assert.equal(grid[0].inMonth, false);
  assert.equal(grid[3].day, 1);
  assert.equal(grid[3].inMonth, true);
  assert.equal(grid[3].iso, "2026-10-01");
  assert.equal(grid[32].iso, "2026-10-30");
  assert.equal(grid[41].iso, "2026-11-08");
  // Đi lùi/tháng tiến đều giữ đúng tháng đang xem, không tự về tháng hiện tại.
  let view = { year: 2026, month: 10 };
  view = shiftMonth(view, -3);
  assert.deepEqual(view, { year: 2026, month: 7 });
  view = shiftMonth(view, -7);
  assert.deepEqual(view, { year: 2025, month: 12 });
  view = shiftMonth(view, 25);
  assert.deepEqual(view, { year: 2028, month: 1 });
  assert.deepEqual(shiftYear({ year: 1900, month: 5 }, -1), {
    year: 1900,
    month: 5,
  });
  assert.deepEqual(shiftYear({ year: 2200, month: 5 }, 1), {
    year: 2200,
    month: 5,
  });
  assert.deepEqual(shiftMonth({ year: 1900, month: 1 }, -1), {
    year: 1900,
    month: 1,
  });
  for (let month = 1; month <= 12; month++) {
    const cells = monthGrid(2024, month);
    assert.equal(
      cells.filter((cell) => cell.inMonth).length,
      daysInMonth(2024, month),
    );
  }
  assert.equal(monthLabel(2026, 10), "tháng 10 năm 2026");
  assert.equal(isoOf(2024, 2, 9), "2024-02-09");
  assert.equal(daysInMonth(2024, 2), 29);
  assert.equal(daysInMonth(2023, 2), 28);
  assert.equal(daysInMonth(2026, 4), 30);
  assert.throws(() => daysInMonth(2026, 13), /Tháng phải từ 1 đến 12/);
});
test("Lịch: gõ thẳng ngày tháng năm, chặn ngày sai và ngày tương lai", () => {
  const today = new Date(2026, 9, 14, 9, 0, 0);
  const picked = parseTypedDate("14", "2", "2024", today);
  assert.equal(picked.getFullYear(), 2024);
  assert.equal(picked.getMonth(), 1);
  assert.equal(picked.getDate(), 14);
  assert.equal(
    picked.getHours(),
    12,
    "lưu ở 12 giờ trưa để đổi múi giờ vẫn đúng ngày",
  );
  assert.equal(parseTypedDate("29", "2", "2024", today).getDate(), 29);
  assert.throws(
    () => parseTypedDate("29", "2", "2023", today),
    /chỉ có 28 ngày/,
  );
  assert.throws(
    () => parseTypedDate("31", "4", "2026", today),
    /chỉ có 30 ngày/,
  );
  assert.throws(
    () => parseTypedDate("0", "5", "2026", today),
    /chỉ có 31 ngày|không hợp lệ/,
  );
  assert.throws(
    () => parseTypedDate("5", "13", "2026", today),
    /Tháng phải từ 1 đến 12/,
  );
  assert.throws(
    () => parseTypedDate("5", "5", "1899", today),
    /Năm phải từ 1900/,
  );
  assert.throws(
    () => parseTypedDate("15", "10", "2026", today),
    /không được ở tương lai/,
  );
  assert.throws(() => parseTypedDate("", "", "", today), /phải là số/);
  assert.throws(() => parseTypedDate("a", "5", "2026", today), /phải là số/);
  // Chọn hôm nay vẫn được (không bị coi là tương lai).
  assert.equal(parseTypedDate("14", "10", "2026", today).getDate(), 14);
  assert.deepEqual(partsOf(picked), { year: 2024, month: 2, day: 14 });
  assert.equal(toNoon(2024, 2, 29).getDate(), 29);
  assert.equal(toNoon(2023, 2, 29), null);
  assert.equal(toNoon(2026, 4, 31), null);
});
test("Giao diện dùng chung: đổi bên nào cũng thành giao diện của cả hai máy", () => {
  let mine = emptyState("2026-10-01T00:00:00.000Z");
  assert.deepEqual(
    [
      mine.appearance.theme,
      mine.appearance.wallpaper,
      mine.appearance.wallpaperId,
    ],
    [DEFAULT_THEME, null, null],
  );
  mine = reduce(mine, {
    type: "appearance.set",
    theme: "dem",
    wallpaperId: "w1",
    wallpaper: wallpaperFile("w1"),
  });
  assert.equal(mine.appearance.theme, "dem");
  assert.equal(mine.settings.theme, "dem", "Cài đặt đọc cùng một chủ đề");
  assert.equal(mine.appearance.wallpaper, "wallpaper-w1.jpg");
  assert.match(mine.appearance.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  const mineStamp = mine.appearance.updatedAt;
  // settings.set đổi chủ đề cũng cập nhật giao diện dùng chung.
  const viaSettings = reduce(mine, {
    type: "settings.set",
    notify: false,
    relay: true,
    theme: "matcha",
  });
  assert.equal(viaSettings.appearance.theme, "matcha");
  assert.equal(
    viaSettings.appearance.wallpaperId,
    "w1",
    "đổi chủ đề không mất ảnh nền",
  );
  // Máy kia đổi giao diện muộn hơn: máy này nhận đúng giao diện đó.
  const partnerLater = {
    from: {
      id: "p",
      nickname: "Ngọc",
      mood: "love",
      moodNote: "",
      updatedAt: "2026-10-02T00:00:00.000Z",
    },
    appearance: {
      theme: "bien",
      wallpaperId: "w9",
      updatedAt: "2026-11-01T00:00:00.000Z",
    },
  };
  const adopted = reduce(mine, { type: "partner.merge", state: partnerLater });
  assert.equal(adopted.appearance.theme, "bien");
  assert.equal(adopted.appearance.wallpaperId, "w9");
  assert.equal(adopted.appearance.wallpaper, "wallpaper-w9.jpg");
  assert.equal(adopted.appearance.by, "partner");
  assert.equal(adopted.settings.theme, "bien");
  assert.deepEqual(
    adopted.moments,
    [],
    "nhận giao diện không làm hỏng dữ liệu khác",
  );
  // Gói tin của máy kia mang theo giao diện để máy này so mốc thời gian.
  const payload = buildRelayPayload(mine, 60000, "may-A");
  assert.equal(payload.appearance.theme, "dem");
  assert.equal(payload.appearance.wallpaperId, "w1");
  assert.equal(payload.appearance.updatedAt, mineStamp);
  // Bản cũ hơn không ghi đè giao diện đang dùng.
  const older = reduce(mine, {
    type: "partner.merge",
    state: {
      from: {
        id: "p",
        nickname: "Ngọc",
        mood: "love",
        moodNote: "",
        updatedAt: "2026-10-01T00:00:00.000Z",
      },
      appearance: {
        theme: "tuyet",
        wallpaperId: null,
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
    },
  });
  assert.equal(older.appearance.theme, "dem");
  // Ảnh nền nhận được gắn vào đúng bản giao diện.
  const withWallpaper = reduce(adopted, {
    type: "appearance.wallpaper",
    id: "w9",
    file: "wallpaper-w9.jpg",
  });
  assert.equal(withWallpaper.appearance.wallpaper, "wallpaper-w9.jpg");
  // Ảnh nền của bản cũ không gắn nhầm vào bản mới.
  const stale = reduce(withWallpaper, {
    type: "appearance.wallpaper",
    id: "w1",
    file: "wallpaper-w1.jpg",
  });
  assert.equal(stale.appearance.wallpaper, "wallpaper-w9.jpg");
  assert.throws(
    () => reduce(mine, { type: "appearance.wallpaper", id: "", file: "" }),
    /thiếu tệp/,
  );
});
test("Ảnh nền gửi qua kênh kết nối như ảnh khoảnh khắc, có đánh dấu riêng", () => {
  const base64 = Buffer.from("anh nen that dep ".repeat(400), "utf8").toString(
    "base64",
  );
  const messages = photoMessages({
    id: "w1",
    base64,
    nickname: "Minh",
    role: "wallpaper",
    wallpaperId: "w1",
  });
  assert.equal(
    messages.length > 1,
    true,
    "ảnh nền cũng bị cắt thành nhiều gói",
  );
  assert.equal(messages[0].meta.role, "wallpaper");
  assert.equal(messages[0].meta.wallpaperId, "w1");
  const momentPackets = photoMessages({
    id: "m1",
    base64: "AAAA",
    nickname: "Minh",
  });
  assert.equal(momentPackets[0].meta.role, "moment");
  assert.equal(momentPackets[0].meta.wallpaperId, "");
});
