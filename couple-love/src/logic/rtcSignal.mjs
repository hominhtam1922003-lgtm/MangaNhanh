// Tín hiệu thoả thuận cho cuộc gọi tiếng trực tiếp (WebRTC).
//
// Cách hoạt động: hai máy vẫn nói chuyện với nhau bằng kênh ghép nối sẵn có,
// nhưng kênh đó chỉ dùng để TRAO ĐỔI TÍN HIỆU (ai gọi ai, mở luồng thế nào,
// địa chỉ mạng của mỗi bên). Khi thoả thuận xong, tiếng nói đi THẲNG từ máy
// này sang máy kia theo chuẩn RTP/Opus 20 ms một gói — không còn cắt thành tệp
// .m4a rồi gửi qua trạm trung gian, nên câu nói liền mạch như gọi điện thường.
//
// Toàn bộ hàm ở đây thuần (không import React Native, không chạm tới native)
// nên kiểm thử được bằng Node.
// Micro chỉ phục vụ một đường tiếng tại một thời điểm: chờ ngắn thôi để nếu
// không nối trực tiếp được thì đường tiếng qua kênh ghép nối vào việc ngay.
export const RTC_TRY_MS = 4000;
/** Tín hiệu quan trọng (offer/answer) gửi lại nếu kênh công cộng làm mất gói. */
export const RTC_RETRY_SIGNAL_MS = 700;
/** Nhớ tối đa bao nhiêu mã tín hiệu để bỏ qua bản gửi lại/trùng. */
export const RTC_SIGNAL_KEEP = 80;
/** Nối trực tiếp được nhưng mạng chập chờn quá lâu thì quay về kênh ghép nối. */
export const RTC_DROP_MS = 2500;

/**
 * Máy chủ STUN miễn phí: chỉ giúp hai máy biết địa chỉ công khai của nhau để
 * nối trực tiếp. Không có dữ liệu nào đi qua đây (không phải máy chủ trung gian).
 */
export const RTC_ICE_SERVERS = [
  {
    urls: [
      "stun:stun.l.google.com:19302",
      "stun:stun1.l.google.com:19302",
      "stun:stun2.l.google.com:19302",
    ],
  },
  { urls: "stun:stun.cloudflare.com:3478" },
];

/**
 * Chỉ lấy tiếng. Bật khử vọng (echo cancellation) và giảm ồn của chính WebRTC:
 * nhờ vậy không phải tạm ngừng micro khi loa đang phát như cách cũ.
 */
export const RTC_MEDIA = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: false,
};

export const RTC_SUBS = ["offer", "answer", "ice", "bye"];

/** Băm ngắn, ổn định: dùng làm mã tín hiệu để bỏ qua bản gửi lại giống nhau. */
export function signalFingerprint(value) {
  const text = String(value ?? "");
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

/** Mã của một tín hiệu: cùng nội dung thì cùng mã, gửi lại bao nhiêu lần cũng vậy. */
export function signalId(callId, sub, extra = {}) {
  const body =
    sub === "ice"
      ? JSON.stringify(extra.candidate ?? null)
      : String(extra.sdp ?? "");
  return `${String(callId)}:${String(sub)}:${signalFingerprint(body)}`;
}

/** Gói tín hiệu gửi qua kênh ghép nối. */
export function rtcPacket(callId, sub, extra = {}) {
  return {
    kind: "call",
    event: "rtc",
    callId: String(callId),
    sub: String(sub),
    sid: signalId(callId, sub, extra),
    ...extra,
  };
}

export function isRtcPacket(message) {
  return (
    message?.kind === "call" &&
    message?.event === "rtc" &&
    RTC_SUBS.includes(String(message?.sub ?? ""))
  );
}

/** Đã nhận tín hiệu này chưa (để không áp dụng hai lần cùng một thứ). */
export function hasSignal(seen, sid) {
  return Array.isArray(seen) && seen.includes(String(sid));
}

/** Ghi nhớ mã tín hiệu, giữ danh sách ngắn để không phình bộ nhớ. */
export function rememberSignal(seen, sid, keep = RTC_SIGNAL_KEEP) {
  const list = Array.isArray(seen) ? seen : [];
  const mark = String(sid ?? "");
  if (!mark || list.includes(mark)) return list;
  const next = [...list, mark];
  const limit = Math.max(1, Number(keep) || RTC_SIGNAL_KEEP);
  return next.length > limit ? next.slice(next.length - limit) : next;
}

/** Chờ quá lâu mà chưa nối trực tiếp được → dùng lại đường tiếng qua kênh ghép nối. */
export function rtcWaitingTooLong(now, startedAt, limit = RTC_TRY_MS) {
  const from = Number(startedAt);
  if (!Number.isFinite(from) || from <= 0) return false;
  return Number(now) - from >= Math.max(1000, Number(limit) || RTC_TRY_MS);
}

/** Trạng thái kết nối của WebRTC đã đủ tốt để nói chuyện chưa. */
export function rtcStateIsLive(state) {
  return state === "connected" || state === "completed";
}

/** Trạng thái này là hỏng hẳn (không tự hồi lại được). */
export function rtcStateIsLost(state) {
  return state === "failed" || state === "closed";
}

/** Lời tiếng Việt cho từng trạng thái, hiện trên màn hình gọi. */
export function rtcStatusText(state) {
  switch (state) {
    case "trying":
      return "Đang nối tiếng trực tiếp…";
    case "live":
      return "Tiếng nét trực tiếp (WebRTC)";
    case "failed":
      return "Tiếng đi qua kênh ghép nối (WebRTC chưa nối được)";
    case "closed":
      return "Đã kết thúc";
    default:
      return "";
  }
}
