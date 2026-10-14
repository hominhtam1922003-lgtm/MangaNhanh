/**
 * Những thứ nhỏ mà nhắn tin kiểu Messenger/Zalo ai cũng quen:
 * thả cảm xúc vào tin nhắn, thu hồi tin (xoá cả hai bên), trả lời trích dẫn,
 * chấm "đang nhập…", và nhịp tim đập theo giọng nói trong cuộc gọi.
 *
 * Tất cả ở đây là hàm THUẦN (không đụng tới React Native, không đọc tệp) nên
 * kiểm thử được bằng `node --test` — xem tests/round16.test.mjs.
 */

/** Bộ cảm xúc được thả vào tin nhắn (giống Zalo/Messenger). */
export const REACTIONS = ["❤️", "😂", "😮", "😢", "😡", "👍"];

/** Im lặng bao lâu thì tự tắt chấm "đang nhập…" ở máy bên kia. */
export const TYPING_HOLD_MS = 3000;
/** Nhịp gửi tối thiểu giữa hai gói "đang nhập…" (đừng gửi mỗi ký tự). */
export const TYPING_SEND_MS = 1200;
/** Độ dài phần trích dẫn khi trả lời. */
export const REPLY_MAX = 90;

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const str = (value, max) =>
  (typeof value === "string" ? value : "").slice(0, max);

/** Cảm xúc của một tin nhắn: `me` là của bạn, `them` là của người thương. */
export function emptyReact() {
  return { me: null, them: null };
}

/** Đọc dữ liệu cũ (thiếu trường, sai kiểu) thành dạng chuẩn — không mất dữ liệu. */
export function normalizeReact(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const one = (value) =>
    typeof value === "string" && REACTIONS.includes(value) ? value : null;
  return { me: one(source.me), them: one(source.them) };
}

/** Bấm lại đúng cảm xúc cũ là bỏ cảm xúc (như Messenger). */
export function toggleReact(current, emoji) {
  const now = typeof current === "string" && current ? current : null;
  if (!emoji || !REACTIONS.includes(emoji)) return null;
  return now === emoji ? null : emoji;
}

/** Thả cảm xúc vào một tin nhắn; `side` = "me" (mình thả) hoặc "them". */
export function setReact(message, side, emoji) {
  const react = normalizeReact(message?.react);
  const which = side === "them" ? "them" : "me";
  const value =
    which === "me"
      ? toggleReact(react.me, emoji)
      : emoji && REACTIONS.includes(emoji)
        ? emoji
        : null;
  return { ...(message ?? {}), react: { ...react, [which]: value } };
}

/** Danh sách cảm xúc đang có để vẽ dưới bong bóng tin nhắn. */
export function reactList(react) {
  const value = normalizeReact(react);
  const list = [];
  if (value.me) list.push({ who: "me", emoji: value.me });
  if (value.them) list.push({ who: "them", emoji: value.them });
  return list;
}

/**
 * Thu hồi tin nhắn: xoá nội dung (chữ, ảnh, tiếng, vị trí) nhưng giữ lại một
 * dòng "đã thu hồi" để hai bên biết chuyện gì vừa xảy ra — xoá ảnh đi kèm để
 * người nhận không xem lại được nữa.
 */
export function recallMessage(message, at) {
  return {
    ...(message ?? {}),
    kind: "recalled",
    body: "",
    photo: null,
    audio: null,
    lat: null,
    lng: null,
    place: "",
    durationMs: 0,
    reply: null,
    recalledAt: typeof at === "string" && at ? at : new Date().toISOString(),
  };
}

export function isRecalled(message) {
  return message?.kind === "recalled" || Boolean(message?.recalledAt);
}

/** Dòng chữ hiện thay cho tin đã thu hồi. */
export function recallText(mine) {
  return mine
    ? "Bạn đã thu hồi một tin nhắn"
    : "Người thương đã thu hồi một tin nhắn";
}

/** Tóm tắt một tin nhắn thành một dòng để trích dẫn khi trả lời. */
export function replyPreview(message) {
  if (!message) return "";
  if (isRecalled(message)) return "Tin nhắn đã thu hồi";
  const kind = String(message.kind ?? "text");
  if (kind === "photo") return str(message.body, REPLY_MAX) || "[Ảnh]";
  if (kind === "voice") return "[Tin thoại]";
  if (kind === "location") return "[Vị trí]";
  if (kind === "sticker") return `[Sticker ${str(message.body, 8)}]`;
  if (kind === "call") return str(message.body, REPLY_MAX) || "[Cuộc gọi]";
  return str(message.body, REPLY_MAX) || "[Tin nhắn]";
}

/** Dòng "đang nhập…" ở đầu khung chat. */
export function typingText(name) {
  const who = str(name, 40).trim();
  return who ? `${who} đang nhập…` : "Đang nhập…";
}

/**
 * Cường độ tiếng nói đọc thẳng từ số liệu WebRTC (`getStats`).
 * Bản Jitsi/WebRTC trả `audioLevel` trong khoảng 0..1 cho nguồn thu và cho
 * luồng tiếng nhận vào — lấy luồng NHẬN để trái tim đập theo giọng người thương.
 */
export const LEVEL_GAIN = 4;
export function audioLevelFromReport(report) {
  let local = -1;
  let remote = -1;
  report?.forEach?.((item) => {
    const kind = String(item?.kind ?? item?.mediaType ?? "");
    const value = Number(item?.audioLevel);
    if (!Number.isFinite(value)) return;
    if (item?.type === "inbound-rtp" && kind === "audio")
      remote = Math.max(remote, value);
    if (item?.type === "media-source" && kind === "audio")
      local = Math.max(local, value);
  });
  if (remote >= 0)
    return { source: "remote", level: clamp01(remote * LEVEL_GAIN) };
  if (local >= 0)
    return { source: "local", level: clamp01(local * LEVEL_GAIN) };
  return { source: "", level: null };
}

/**
 * Khi máy không trả `audioLevel` (một số bản WebRTC trên máy ảo): đoán theo
 * lượng byte tiếng chảy qua. Chỉ là ước lượng thô — có tiếng thì nhích lên.
 */
export function audioLevelFromBytes(previousBytes, bytes, dtMs) {
  const span = Math.max(50, Number(dtMs) || 0);
  const delta = Math.max(
    0,
    (Number(bytes) || 0) - (Number(previousBytes) || 0),
  );
  const kbPerSec = delta / (span / 1000) / 1024;
  return { source: "bytes", level: clamp01((kbPerSec - 1.5) / 4) };
}

/** Làm mượt: vọt lên nhanh khi bắt đầu nói, hạ xuống chậm khi ngừng. */
export function smoothLevel(previous, next) {
  const before = clamp01(Number(previous) || 0);
  const after = clamp01(Number(next) || 0);
  const factor = after > before ? 0.55 : 0.15;
  return clamp01(before + (after - before) * factor);
}

/** Trái tim to ra theo tiếng nói (1 → 1,34 lần). */
export function heartScale(level) {
  return 1 + 0.34 * clamp01(Number(level) || 0);
}

/** Nhịp đập nhẹ khi chưa có tiếng, để trái tim vẫn "sống". */
export function heartIdleScale(ms) {
  const phase = (Number(ms) || 0) / 900;
  return 1 + 0.03 * Math.sin(phase * Math.PI * 2);
}
