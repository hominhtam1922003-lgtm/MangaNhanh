import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PhotoAssembler,
  momentsForRelay,
  missingPhotoIds,
  photoMessages,
} from "../src/services/momentTransfer.mjs";
import { emptyState, reduce } from "../src/logic/localState.mjs";
import {
  LOVE_LINES,
  loveLineFor,
  loveLineIndex,
} from "../src/logic/lovelines.mjs";
import {
  DEFAULT_THEME,
  THEMES,
  isTheme,
  themeById,
} from "../src/logic/themes.mjs";
import { dateOnly } from "../src/logic/time.mjs";
const photo = (over = {}) => ({
  id: "m1",
  base64: "A".repeat(9000),
  caption: "đi Đà Lạt",
  createdAt: "2026-10-14T10:00:00.000Z",
  nickname: "Minh",
  ...over,
});
test("Khoảnh khắc: cắt ảnh thành gói rồi ghép lại đúng từng ký tự", () => {
  const messages = photoMessages(photo(), 3500);
  assert.equal(messages.length, 3);
  assert.equal(messages[0].total, 3);
  assert.equal(messages[0].data.length, 3500);
  assert.equal(messages[2].data.length, 2000);
  const assembler = new PhotoAssembler();
  let done = null;
  for (const message of messages) done = assembler.add(message) ?? done;
  assert.equal(done.id, "m1");
  assert.equal(done.base64, photo().base64);
  assert.equal(done.meta.caption, "đi Đà Lạt");
  // Gói tới lộn thứ tự vẫn ghép được.
  const shuffled = new PhotoAssembler();
  let out = null;
  for (const message of [messages[2], messages[0], messages[1]])
    out = shuffled.add(message) ?? out;
  assert.equal(out.base64.length, 9000);
  // Gói trùng và gói của ảnh đã ghép xong đều bị bỏ qua.
  assert.equal(shuffled.add(messages[0]), null);
  assert.equal(assembler.add(messages[1]), null);
  // Ảnh dở dang thì chưa trả về gì, và tự bị dọn sau thời gian chờ.
  const partial = new PhotoAssembler({ ttl: 1 });
  assert.equal(partial.add(messages[0]), null);
  assert.equal(partial.pendingCount, 1);
  partial.cleanup(Date.now() + 10);
  assert.equal(partial.pendingCount, 0);
  assert.throws(() => photoMessages(photo({ base64: "" })), /rỗng/);
  assert.throws(() => photoMessages(photo({ id: "" })), /mã/);
  assert.throws(
    () => photoMessages(photo({ base64: "A".repeat(3_500 * 201) })),
    /quá lớn/,
  );
});
test("Khoảnh khắc: gửi kèm danh sách, xin lại ảnh còn thiếu", () => {
  let state = emptyState("2026-01-01T00:00:00.000Z");
  state = reduce(state, {
    type: "moment.add",
    id: "m1",
    file: "moment-m1.jpg",
    caption: "của mình",
  });
  state = reduce(state, {
    type: "moment.received",
    id: "m2",
    file: "moment-m2.jpg",
    caption: "của người thương",
    createdAt: "2026-01-02T00:00:00.000Z",
  });
  const list = momentsForRelay(state.moments);
  assert.equal(list.length, 1, "chỉ gửi khoảnh khắc của mình");
  assert.equal(list[0].id, "m1");
  assert.equal(list[0].hasFile, true);
  const missing = missingPhotoIds(state.moments, (moment) =>
    Boolean(moment.file),
  );
  assert.deepEqual(missing, [], "ảnh nào đã có thì không xin lại");
  const stillMissing = missingPhotoIds(
    state.moments,
    (moment) => moment.id === "m1",
  );
  assert.deepEqual(stillMissing, ["m2"], "ảnh thiếu thì xin gửi lại");
});
test("Khoảnh khắc: hai máy gộp khoảnh khắc của nhau, không nhân đôi khi gửi lại", () => {
  let mine = emptyState("2026-01-01T00:00:00.000Z");
  mine = reduce(mine, {
    type: "profile.set",
    nickname: "Minh",
    mood: "love",
    moodNote: "",
  });
  mine = reduce(mine, {
    type: "moment.add",
    id: "a1",
    file: "moment-a1.jpg",
    caption: "của Minh",
  });
  let theirs = emptyState("2026-01-02T00:00:00.000Z");
  theirs = reduce(theirs, {
    type: "profile.set",
    nickname: "Ngọc Ánh",
    mood: "calm",
    moodNote: "",
  });
  theirs = reduce(theirs, {
    type: "moment.add",
    id: "b1",
    file: "moment-b1.jpg",
    caption: "của Ngọc Ánh",
  });
  const forA = {
    v: 3,
    from: theirs.me,
    moments: momentsForRelay(theirs.moments),
    diary: [],
    alerts: [],
  };
  const mergedA = reduce(mine, { type: "partner.merge", state: forA });
  assert.equal(mergedA.moments.length, 2);
  const fromPartner = mergedA.moments.find((moment) => moment.id === "b1");
  assert.equal(fromPartner.authorId, "partner");
  assert.equal(fromPartner.caption, "của Ngọc Ánh");
  assert.equal(
    fromPartner.file,
    null,
    "ảnh đi bằng gói riêng nên chỗ này chưa có tệp",
  );
  // Ảnh sang tới nơi thì gắn tệp vào đúng khoảnh khắc.
  const withFile = reduce(mergedA, {
    type: "moment.file",
    id: "b1",
    file: "moment-b1.jpg",
  });
  assert.equal(
    withFile.moments.find((moment) => moment.id === "b1").file,
    "moment-b1.jpg",
  );
  assert.ok(withFile.moments.find((moment) => moment.id === "b1").receivedAt);
  // Gửi lại y nguyên không tạo thêm khoảnh khắc, không mất ảnh đã có.
  const again = reduce(withFile, { type: "partner.merge", state: forA });
  assert.equal(again.moments.length, 2);
  assert.equal(
    again.moments.find((moment) => moment.id === "b1").file,
    "moment-b1.jpg",
  );
  // Của mình vẫn là của mình, không bị đổi thành của người thương.
  assert.equal(
    again.moments.find((moment) => moment.id === "a1").authorId,
    "me",
  );
  // Hủy ghép nối thì khoảnh khắc của người thương bị bỏ, của mình giữ nguyên.
  const unlinked = reduce(again, { type: "partner.unlink" });
  assert.deepEqual(
    unlinked.moments.map((moment) => moment.id),
    ["a1"],
  );
  const removed = reduce(again, { type: "moment.remove", id: "a1" });
  assert.deepEqual(
    removed.moments.map((moment) => moment.id),
    ["b1"],
  );
});
test("Chủ đề: tám chủ đề hợp lệ, lưu vào cài đặt và tự bỏ giá trị lạ", () => {
  assert.equal(THEMES.length >= 8, true);
  assert.equal(isTheme(DEFAULT_THEME), true);
  assert.equal(isTheme("khong-co"), false);
  assert.equal(themeById("khong-co").id, DEFAULT_THEME);
  for (const theme of THEMES) {
    assert.match(theme.colors[0], /^#[0-9a-f]{6}$/i);
    assert.match(theme.deep[1], /^#[0-9a-f]{6}$/i);
    assert.equal(theme.emoji.length >= 1, true);
  }
  let state = emptyState("2026-01-01T00:00:00.000Z");
  state = reduce(state, {
    type: "settings.set",
    notify: false,
    relay: true,
    theme: "dem",
    loveNotes: false,
  });
  assert.equal(state.settings.theme, "dem");
  assert.equal(state.settings.loveNotes, false);
  const saved = reduce(state, {
    type: "settings.set",
    notify: false,
    relay: true,
    theme: "sai-ten",
    loveNotes: false,
  });
  assert.equal(saved.settings.theme, "dem", "chủ đề lạ thì giữ chủ đề cũ");
  const kept = reduce(state, {
    type: "settings.set",
    notify: true,
    relay: true,
  });
  assert.equal(
    kept.settings.theme,
    "dem",
    "đổi công tắc khác không làm mất chủ đề",
  );
  assert.equal(kept.settings.loveNotes, false, "không làm mất lời yêu thương");
});
test("Lời yêu thương: cùng ngày thì hai máy cùng câu, khác ngày thì đổi câu", () => {
  assert.equal(LOVE_LINES.length >= 30, true);
  for (const line of LOVE_LINES) {
    assert.equal(typeof line.text, "string");
    assert.equal(line.text.length > 10, true);
    assert.equal(line.emoji.length >= 1, true);
  }
  assert.equal(loveLineIndex("2026-10-14"), loveLineIndex("2026-10-14"));
  assert.deepEqual(loveLineFor("2026-10-14"), loveLineFor("2026-10-14"));
  const days = new Set();
  for (let day = 1; day <= 28; day++)
    days.add(loveLineIndex(`2026-10-${String(day).padStart(2, "0")}`));
  assert.equal(days.size > 10, true, "câu đổi qua các ngày trong tháng");
  assert.equal(
    loveLineFor("").text.length > 0,
    true,
    "thiếu ngày vẫn trả về một câu",
  );
});
test("Ngày bắt đầu: lưu ở 12 giờ trưa thì đổi múi giờ vẫn đúng ngày đã chọn", () => {
  const picked = new Date(2024, 1, 29, 12, 0, 0);
  let state = emptyState("2026-01-01T00:00:00.000Z");
  state = reduce(state, { type: "anniversary.set", iso: picked.toISOString() });
  assert.equal(
    dateOnly(new Date(state.anniversary), "Asia/Ho_Chi_Minh"),
    "2024-02-29",
  );
  assert.equal(dateOnly(new Date(state.anniversary), "UTC"), "2024-02-29");
  assert.equal(
    dateOnly(new Date(state.anniversary), "America/New_York"),
    "2024-02-29",
  );
  assert.throws(
    () =>
      reduce(state, {
        type: "anniversary.set",
        iso: "2099-01-01T00:00:00.000Z",
      }),
    /không hợp lệ/,
    "không cho chọn ngày ở tương lai",
  );
});
