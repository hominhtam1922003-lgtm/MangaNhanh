import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decodeLink,
  dueAlerts,
  emptyState,
  encodeLink,
  joinCodes,
  makeId,
  migrate,
  reduce,
  restoreFromPayload,
  splitCode,
} from "../src/logic/localState.mjs";
const state = (mutate = () => {}) => {
  let value = emptyState("2026-01-01T00:00:00.000Z");
  value = reduce(value, {
    type: "profile.set",
    nickname: "Ngọc Ánh",
    mood: "love",
    moodNote: "nhớ anh 💕",
  });
  mutate(value);
  return value;
};
test("Chế độ trên máy: dữ liệu hỏng không làm mất trạng thái mặc định", () => {
  const fresh = migrate(null);
  assert.equal(fresh.me.nickname, "Bạn");
  assert.deepEqual(fresh.diary, []);
  const messy = migrate({
    me: { nickname: 42, mood: "không tồn tại" },
    diary: [null, { title: "" }, { title: "Đi chơi", body: "vui" }],
    alerts: "sai",
  });
  assert.equal(messy.me.nickname, "Bạn");
  assert.equal(messy.me.mood, "calm");
  assert.equal(messy.diary.length, 1);
  assert.equal(messy.diary[0].title, "Đi chơi");
  assert.deepEqual(messy.alerts, []);
});
test("Chế độ trên máy: kiểm tra tên, ngày và vòng kinh", () => {
  let value = emptyState();
  assert.throws(() =>
    reduce(value, {
      type: "profile.set",
      nickname: "   ",
      mood: "love",
      moodNote: "",
    }),
  );
  assert.throws(() =>
    reduce(value, {
      type: "profile.set",
      nickname: "An",
      mood: "sai",
      moodNote: "",
    }),
  );
  assert.throws(() =>
    reduce(value, { type: "anniversary.set", iso: "2099-01-01T00:00:00.000Z" }),
  );
  assert.throws(() =>
    reduce(value, {
      type: "cycle.save",
      lastPeriod: "2099-01-01",
      cycleLength: 28,
      periodLength: 5,
    }),
  );
  assert.throws(() =>
    reduce(value, {
      type: "cycle.save",
      lastPeriod: "2026-01-01",
      cycleLength: 13,
      periodLength: 5,
    }),
  );
  assert.throws(() =>
    reduce(value, {
      type: "cycle.save",
      lastPeriod: "2026-01-01",
      cycleLength: 28,
      periodLength: 29,
    }),
  );
  value = reduce(value, {
    type: "cycle.save",
    lastPeriod: "2026-01-01",
    cycleLength: 28,
    periodLength: 5,
  });
  assert.equal(value.cycle.cycleLength, 28);
  assert.equal(reduce(value, { type: "cycle.clear" }).cycle, null);
});
test("Chế độ trên máy: chỉ sửa và xóa được kỷ niệm của mình", () => {
  let value = state();
  value = reduce(value, {
    type: "diary.add",
    title: "Phở Mỹ Tho",
    body: "Sáng chủ nhật",
  });
  const id = value.diary[0].id;
  assert.equal(value.diary[0].authorId, "me");
  assert.throws(() => reduce(value, { type: "diary.add", title: "" }));
  value = reduce(value, {
    type: "diary.update",
    id,
    title: "Phở Mỹ Tho",
    body: "Ngon hơn khi có em",
  });
  assert.equal(value.diary[0].body, "Ngon hơn khi có em");
  const foreign = {
    ...value,
    diary: [
      { ...value.diary[0], authorId: "partner" },
      ...value.diary.slice(1),
    ],
  };
  assert.throws(() =>
    reduce(foreign, { type: "diary.update", id, title: "Sửa trộm", body: "" }),
  );
  assert.throws(() => reduce(foreign, { type: "diary.remove", id }));
  assert.equal(reduce(value, { type: "diary.remove", id }).diary.length, 0);
  assert.equal(
    reduce(value, {
      type: "diary.add",
      id: makeId(),
      title: "Tự đặt mã",
      body: "",
    }).diary[0].id.length > 5,
    true,
  );
});
test("Chế độ trên máy: lời nhắc cùng mốc không bị nhân đôi", () => {
  let value = state();
  value = reduce(value, {
    type: "alerts.add",
    key: "cycle:period:2026-01-29",
    title: "A",
    body: "B",
    category: "cycle",
  });
  value = reduce(value, {
    type: "alerts.add",
    key: "cycle:period:2026-01-29",
    title: "A",
    body: "B",
    category: "cycle",
  });
  assert.equal(value.alerts.length, 1);
  value = reduce(value, {
    type: "alerts.add",
    key: "cycle:period:2026-01-29",
    title: "A",
    body: "B",
    category: "cycle",
  });
  assert.equal(value.alerts.length, 1);
  assert.equal(reduce(value, { type: "alerts.clear" }).alerts.length, 0);
});
test("Chế độ trên máy: mã QR ghép nối giữ đúng tiếng Việt và chống sửa lỗi", () => {
  const value = state();
  const code = encodeLink(value);
  const payload = decodeLink(code);
  assert.equal(payload.from.nickname, "Ngọc Ánh");
  assert.equal(payload.from.moodNote, "nhớ anh 💕");
  assert.equal(payload.diary.length, 0);
  assert.throws(() => decodeLink(code.replace("HTT1:", "XXX1:")), /định dạng/);
  const tampered =
    code.slice(0, 20) + (code[20] === "A" ? "B" : "A") + code.slice(21);
  assert.throws(() => decodeLink(tampered));
  const full = decodeLink(
    encodeLink(
      state((v) =>
        v.diary.push({
          id: "d1",
          authorId: "me",
          title: "Kỷ niệm",
          body: "",
          image: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }),
      ),
      "full",
    ),
  );
  assert.equal(full.diary.length, 1);
});
test("Chế độ trên máy: mã dài được chia đoạn và ghép lại nguyên vẹn", () => {
  const code = encodeLink(state());
  const chunks = splitCode(code, 40);
  assert.ok(chunks.length > 1);
  assert.equal(joinCodes(chunks), code);
  assert.throws(() => joinCodes(chunks.slice(0, -1)), /Cần đủ/);
  assert.throws(() => joinCodes(["HTT1:2/3:abc"]), /Cần đủ 3 đoạn/);
  assert.throws(() => joinCodes(["MÃ-SAI"]), /định dạng/);
  assert.equal(joinCodes(["HTT1:abc"]), "HTT1:abc");
  assert.throws(() => decodeLink(joinCodes(["HTT1:abc"])));
});
test("Chế độ trên máy: ghép nối hai thiết bị không nhân đôi kỷ niệm", () => {
  let mine = emptyState("2026-01-01T00:00:00.000Z");
  mine = reduce(mine, {
    type: "profile.set",
    nickname: "Minh",
    mood: "happy",
    moodNote: "yêu em",
  });
  mine = reduce(mine, {
    type: "diary.add",
    title: "Cà phê sáng",
    body: "Chủ nhật",
  });
  let theirs = emptyState("2025-12-25T00:00:00.000Z");
  theirs = reduce(theirs, {
    type: "profile.set",
    nickname: "Ngọc Ánh",
    mood: "love",
    moodNote: "nhớ anh",
  });
  theirs = reduce(theirs, {
    type: "diary.add",
    title: "Phở Mỹ Tho",
    body: "Đi ăn cùng nhau",
  });
  theirs = reduce(theirs, {
    type: "cycle.save",
    lastPeriod: "2026-01-01",
    cycleLength: 28,
    periodLength: 5,
  });
  const payload = decodeLink(encodeLink(theirs, "full"));
  let merged = reduce(mine, { type: "partner.merge", state: payload });
  assert.equal(merged.partner.nickname, "Ngọc Ánh");
  assert.equal(merged.anniversary, mine.anniversary);
  assert.equal(merged.diary.length, 2);
  assert.equal(
    merged.diary.filter((entry) => entry.authorId === "partner")[0].title,
    "Phở Mỹ Tho",
  );
  assert.equal(merged.cycle.cycleLength, 28);
  assert.equal(merged.links.length, 1);
  merged = reduce(merged, { type: "partner.merge", state: payload });
  assert.equal(merged.diary.length, 2, "ghép nối lại không được nhân đôi");
  assert.equal(reduce(merged, { type: "partner.unlink" }).partner, null);
});
test("Chế độ trên máy: khôi phục tệp của chính mình giữ đúng tác giả", () => {
  let mine = state();
  mine = reduce(mine, { type: "diary.add", title: "Của mình", body: "" });
  mine = reduce(mine, {
    type: "partner.merge",
    state: decodeLink(encodeLink(mine, "full")),
  });
  const payload = decodeLink(encodeLink(mine, "full"));
  const restored = restoreFromPayload(payload);
  assert.equal(restored.me.nickname, "Ngọc Ánh");
  assert.equal(restored.anniversary, mine.anniversary);
  assert.equal(restored.diary.length, mine.diary.length);
  assert.equal(
    restored.diary.filter((entry) => entry.authorId === "me").length,
    1,
  );
});
test("Chế độ trên máy: nhắc trước 3 ngày, đầu kỳ, rụng trứng và kỷ niệm", () => {
  let value = emptyState("2026-01-01T00:00:00.000Z");
  value = reduce(value, {
    type: "profile.set",
    nickname: "An",
    mood: "calm",
    moodNote: "",
  });
  value = reduce(value, {
    type: "cycle.save",
    lastPeriod: "2026-01-01",
    cycleLength: 28,
    periodLength: 5,
  });
  assert.deepEqual(
    dueAlerts(value, "2026-01-26").map((event) => event.key),
    ["cycle:period_soon:2026-01-29"],
  );
  assert.deepEqual(
    dueAlerts(value, "2026-01-29").map((event) => event.key),
    ["cycle:period:2026-01-29"],
  );
  assert.deepEqual(
    dueAlerts(value, "2026-01-15").map((event) => event.key),
    ["cycle:ovulation:2026-01-29"],
  );
  assert.deepEqual(dueAlerts(value, "2026-01-02"), []);
  assert.deepEqual(
    dueAlerts(value, "2026-01-01").map((event) => event.key),
    ["anniversary:2026-01-01"],
  );
  const off = reduce(value, {
    type: "cycle.save",
    lastPeriod: "2026-01-01",
    cycleLength: 28,
    periodLength: 5,
    reminders: false,
  });
  assert.deepEqual(dueAlerts(off, "2026-01-26"), []);
  const stale = reduce(value, {
    type: "cycle.save",
    lastPeriod: "2025-01-01",
    cycleLength: 28,
    periodLength: 5,
  });
  assert.deepEqual(dueAlerts(stale, "2026-01-26"), []);
});
