// Tiếng nói trong cuộc gọi, chạy trên chính kênh ghép nối (không máy chủ).
// Máy ghi âm liên tục thành từng mảnh ngắn (mặc định 0,7 giây) rồi gửi ngay:
// không cần giữ nút, hai bên nói liên tục như gọi thường. Hàm ở đây thuần
// (không import React Native) nên kiểm thử được bằng Node.
export const CALL_FRAME_MS = 900;
/** Giữ tối đa bao nhiêu mảnh chờ phát — quá dài thì bỏ mảnh cũ để không trễ. */
export const CALL_QUEUE_MAX = 8;
/** Mảnh nhỏ hơn mức này coi như im lặng: vẫn gửi nhưng không xếp hàng dài. */
export const CALL_SILENT_BYTES = 600;
/** Phải có từng này mảnh trong tay rồi mới bắt đầu phát: nghe liền mạch hơn. */
export const CALL_PREBUFFER = 2;
/** Khoảng cách ngắn nhất giữa hai mảnh phát ra loa (tránh dồn cục). */
export const CALL_PLAY_GAP_MS = 40;
/** Cuộc gọi kết thúc thì cửa sổ tự đóng sau từng này. */
export const CALL_CLOSE_MS = 2500;

/** Bộ đệm phát của một cuộc gọi. */
export function newAudioQueue() {
  return [];
}

/** Ước lượng số byte của một mảnh ghi ở bitrate cho trước (để chọn tham số). */
export function frameBytesFor(bitRate, ms = CALL_FRAME_MS) {
  const rate = Number(bitRate);
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return Math.round((rate / 8 / 1000) * Math.max(0, Number(ms)));
}

/**
 * Xếp một mảnh tiếng nhận được vào bộ đệm: sắp theo số thứ tự, bỏ mảnh trùng
 * và bỏ mảnh cũ nhất khi hàng quá dài (giữ độ trễ thấp).
 */
export function pushFrame(queue, frame, max = CALL_QUEUE_MAX) {
  const list = Array.isArray(queue) ? queue : [];
  const seq = Number(frame?.seq);
  if (!frame || !frame.uri || !Number.isFinite(seq)) return list;
  if (list.some((item) => item.seq === seq)) return list;
  const next = [...list, { ...frame, seq }].sort((a, b) => a.seq - b.seq);
  while (next.length > Math.max(1, max)) next.shift();
  return next;
}

/**
 * Mảnh kế tiếp cần phát. `lastAt` là thời điểm phát mảnh trước; phải cách nhau
 * ít nhất `gap` mili giây để loa không dồn tiếng.
 */
export function takeFrame(queue, now, lastAt, gap = CALL_PLAY_GAP_MS) {
  const list = Array.isArray(queue) ? queue : [];
  if (!list.length) return { frame: null, queue: list };
  if (lastAt && now - lastAt < gap) return { frame: null, queue: list };
  const [frame, ...rest] = list;
  return { frame, queue: rest };
}

/** Còn bao nhiêu mảnh đang chờ — hiện lên màn hình gọi cho biết máy đang nhận. */
export function queueSize(queue) {
  return Array.isArray(queue) ? queue.length : 0;
}

/** Một mảnh tiếng có đáng gửi không (bỏ mảnh rỗng, giữ mảnh nhỏ vì có thể là tiếng thở). */
export function frameUsable(bytes, micOn = true) {
  if (!micOn) return false;
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return false;
  return size <= 400 * 1024;
}

/** Mảnh gần như im lặng: vẫn gửi nhưng không cần giữ trong hàng đợi phát. */
export function frameIsSilent(bytes) {
  const size = Number(bytes);
  return !Number.isFinite(size) || size < CALL_SILENT_BYTES;
}

/**
 * Nhật ký cuộc gọi để in vào đoạn chat sau khi kết thúc:
 * "Cuộc gọi thoại · 01:23", "Cuộc gọi nhỡ", "Người thương đang bận"…
 */
export function callLogText(call, now = Date.now()) {
  if (!call) return "";
  const seconds = call.startedAt
    ? Math.max(0, Math.floor((now - call.startedAt) / 1000))
    : 0;
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60,
  ).padStart(2, "0")}`;
  if (call.phase === "ended" && !call.startedAt)
    return call.reason === "Người thương đang bận"
      ? "Cuộc gọi nhỡ · người thương đang bận"
      : "Cuộc gọi nhỡ";
  const who = call.role === "caller" ? "Cuộc gọi đi" : "Cuộc gọi đến";
  return `${who} · ${clock}`;
}

/** Cuộc gọi này có tính là "nhỡ" không (để máy kia biết mà nhắc). */
export function isMissedCall(call) {
  return Boolean(call && call.phase === "ended" && !call.startedAt);
}

/** Trạng thái ngắn gọn hiển thị trên thanh thu nhỏ. */
export function callBarText(call, now = Date.now()) {
  if (!call) return "";
  if (call.phase === "ringing")
    return call.role === "caller" ? "Đang đổ chuông…" : "Đang gọi cho bạn";
  if (call.phase === "active") {
    const seconds = Math.max(0, Math.floor((now - call.startedAt) / 1000));
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
      seconds % 60,
    ).padStart(2, "0")}`;
  }
  return call.reason || "Cuộc gọi đã kết thúc";
}
