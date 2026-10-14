// Trạng thái cuộc gọi giữa hai máy — hàm thuần để kiểm thử được.
// Cuộc gọi đi qua chính kênh ghép nối (không cần máy chủ): bên gọi gửi tín hiệu
// "ring", bên kia "accept"/"reject", ai cũng có thể "hangup".
export const CALL_RING_TIMEOUT_MS = 45 * 1000;
const PHASES = ["ringing", "active", "ended"];
export function newCall({ id, role, name, at = Date.now() }) {
  if (!id) throw new Error("Cuộc gọi thiếu mã.");
  return {
    id: String(id),
    role: role === "callee" ? "callee" : "caller",
    name: String(name ?? "").slice(0, 40),
    phase: "ringing",
    at,
    startedAt: 0,
    endedAt: 0,
    reason: "",
    minimized: false,
    micOn: true,
  };
}
/** Áp một sự kiện lên cuộc gọi; trả về null nghĩa là cuộc gọi đã kết thúc hẳn. */
export function callEvent(call, event, now = Date.now()) {
  if (!call) return null;
  const type = String(event?.type ?? "");
  if (type === "accept" && call.phase === "ringing")
    return { ...call, phase: "active", startedAt: now, minimized: false };
  if (type === "reject")
    return {
      ...call,
      phase: "ended",
      endedAt: now,
      reason: "Người thương đang bận",
    };
  if (type === "hangup")
    return {
      ...call,
      phase: "ended",
      endedAt: now,
      reason: "Cuộc gọi đã kết thúc",
    };
  if (type === "timeout")
    return {
      ...call,
      phase: "ended",
      endedAt: now,
      reason: "Người thương không trả lời",
    };
  if (type === "mic") return { ...call, micOn: event.on === true };
  if (type === "minimize") return { ...call, minimized: event.min === true };
  return call;
}
/** Cuộc gọi reo quá lâu mà không ai nghe thì tự kết thúc. */
export function ringTimedOut(call, now = Date.now()) {
  return Boolean(
    call && call.phase === "ringing" && now - call.at >= CALL_RING_TIMEOUT_MS,
  );
}
export function callSeconds(call, now = Date.now()) {
  if (!call || !call.startedAt) return 0;
  return Math.max(0, Math.floor((now - call.startedAt) / 1000));
}
export function callClock(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}
export function callStatusText(call, now = Date.now()) {
  if (!call) return "";
  if (call.phase === "ringing")
    return call.role === "caller" ? "Đang đổ chuông…" : "Đang gọi cho bạn";
  if (call.phase === "active")
    return `Đang gọi · ${callClock(callSeconds(call, now))}`;
  return call.reason || "Cuộc gọi đã kết thúc";
}
export const isCallPhase = (call, phase) =>
  Boolean(call && PHASES.includes(phase) && call.phase === phase);
