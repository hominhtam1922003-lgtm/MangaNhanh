// Nhắc nhở & lời yêu tự động giữa hai máy:
//  · Cứ 2 tiếng (trong khung 07:00–22:00) tự gửi một lời yêu hoặc một bài thơ ngắn.
//  · Khi mình chưa trả lời người thương: quá 3 phút nhắc “Người ấy vẫn đang đợi
//    tin nhắn từ bạn”, quá 1 tiếng nhắc kèm một lời yêu.
//  · Ban đêm 22:00–07:00 không gửi gì (để hai bạn ngủ).
// Toàn bộ là hàm thuần nên kiểm thử được; máy nào cũng tự tính từ dữ liệu chung
// nên hai bên thấy giống nhau, không cần máy chủ.
export const QUIET_FROM_HOUR = 22;
export const QUIET_TO_HOUR = 7;
/** Hai tiếng gửi lời yêu một lần. */
export const LOVE_EVERY_MS = 2 * 60 * 60 * 1000;
/** Người thương nhắn mà mình chưa trả lời: 3 phút là nhắc. */
export const WAIT_NUDGE_MS = 3 * 60 * 1000;
/** Quá 1 tiếng thì nhắc kèm lời yêu. */
export const WAIT_HOUR_MS = 60 * 60 * 1000;
export const WAIT_NUDGE_TEXT = "Người ấy vẫn đang đợi tin nhắn từ bạn 💌";
export const WAIT_NUDGE_TITLE = "Người thương đang đợi bạn";
/** Giờ yên tĩnh: 22:00–07:00 không gửi nhắc nhở, không gửi lời yêu. */
export function isQuietTime(when) {
  const hour = new Date(when).getHours();
  return hour >= QUIET_FROM_HOUR || hour < QUIET_TO_HOUR;
}
/** Thời điểm tin nhắn gần nhất của mình và của người thương. */
/** Tin cuối cùng của người thương mà mình chưa trả lời (null nếu mình đã trả lời). */
export function unansweredMessage(messages) {
  const list = (Array.isArray(messages) ? messages : [])
    .filter((message) => Date.parse(message?.createdAt ?? ""))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const latest = list[0];
  if (!latest || latest.authorId !== "partner") return null;
  return latest;
}
/**
 * Có nên nhắc mình trả lời không?
 * `lastNotice` là bản ghi lần nhắc trước: { key, stage, at } — để không nhắc mãi.
 * Trả về null hoặc { key, stage, title, body }.
 */
export function waitingNotice({
  messages,
  now = Date.now(),
  lastNotice = null,
  quiet = true,
  enabled = true,
}) {
  if (!enabled) return null;
  if (quiet && isQuietTime(now)) return null;
  const waiting = unansweredMessage(messages);
  if (!waiting) return null;
  const waitingFor = now - (Date.parse(waiting.createdAt) || now);
  const stage =
    waitingFor >= WAIT_HOUR_MS ? "1h" : waitingFor >= WAIT_NUDGE_MS ? "3m" : "";
  if (!stage) return null;
  const same = lastNotice && lastNotice.key === waiting.id;
  if (same && lastNotice.stage === "3m" && stage === "3m") return null;
  if (
    same &&
    lastNotice.stage === "1h" &&
    stage === "1h" &&
    now - (Number(lastNotice.at) || 0) < WAIT_HOUR_MS
  )
    return null;
  return {
    key: waiting.id,
    stage,
    title: WAIT_NUDGE_TITLE,
    body:
      stage === "1h"
        ? `${WAIT_NUDGE_TEXT} Người ấy nhắn lúc ${new Date(
            waiting.createdAt,
          ).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          })} — trả lời một câu thôi cũng được nhé.`
        : WAIT_NUDGE_TEXT,
  };
}
/**
 * Đã tới lúc tự gửi lời yêu chưa? (mỗi 2 tiếng, chỉ trong khung thức)
 * Lần đầu mở app thì chỉ ghi mốc, chưa gửi ngay để không dội tin.
 */
export function dueLoveNote({
  now = Date.now(),
  lastAt = 0,
  quiet = true,
  enabled = true,
}) {
  if (!enabled || !lastAt) return false;
  if (quiet && isQuietTime(now)) return false;
  return now - lastAt >= LOVE_EVERY_MS;
}
/** Phút còn lại tới lần gửi lời yêu kế tiếp (để hiện trong Cài đặt). */
export function minutesToNextLoveNote({ now = Date.now(), lastAt = 0 }) {
  if (!lastAt) return 0;
  const left = LOVE_EVERY_MS - (now - lastAt);
  return left <= 0 ? 0 : Math.ceil(left / 60000);
}
