// Trạng thái cuộc gọi giữa hai máy — hàm thuần để kiểm thử được.
// Cuộc gọi đi qua chính kênh ghép nối (không cần máy chủ): bên gọi gửi tín hiệu
// "ring", bên kia "accept"/"reject", ai cũng có thể "hangup".
export const CALL_RING_TIMEOUT_MS = 45 * 1000;
/** Hai bên gửi nhịp "còn đây" cách nhau từng này; quá lâu không thấy thì tự kết
 *  thúc — máy A tắt thì máy B cũng tắt theo, không còn cảnh treo cuộc gọi. */
export const CALL_ALIVE_MS = 1000;
export const CALL_SILENT_END_MS = 6000;

/**
 * Danh sách bộ Ảnh nền cuộc gọi đôi dễ thương (Blur / Gradient Overlay phía sau Avatar).
 * Người dùng có thể chọn mẫu có sẵn hoặc chọn ảnh đôi từ thư viện máy (`custom`).
 */
export const CALL_BACKGROUNDS = [
  {
    id: "sunset-love",
    name: "Hoàng hôn đôi mình",
    emoji: "🌅",
    colors: ["#2e1065", "#701a75", "#9d174d"],
    overlay: [
      "rgba(20, 10, 38, 0.36)",
      "rgba(40, 14, 54, 0.56)",
      "rgba(9, 13, 22, 0.88)",
    ],
    accent: "#f472b6",
    scene: "🌅 💑 ✨",
    subtitle: "Dưới ánh hoàng hôn ấm áp bên nhau",
  },
  {
    id: "starry-night",
    name: "Đêm sao ngân hà",
    emoji: "🌌",
    colors: ["#090d16", "#1e1b4b", "#3b0764"],
    overlay: [
      "rgba(9, 13, 22, 0.4)",
      "rgba(23, 21, 58, 0.58)",
      "rgba(9, 13, 22, 0.9)",
    ],
    accent: "#818cf8",
    scene: "🌙 👩‍❤️‍👨 ⭐",
    subtitle: "Tựa vai nhau ngắm bầu trời sao đêm",
  },
  {
    id: "cherry-blossom",
    name: "Mùa hoa anh đào",
    emoji: "🌸",
    colors: ["#4a044e", "#831843", "#be185d"],
    overlay: [
      "rgba(36, 8, 42, 0.34)",
      "rgba(58, 12, 46, 0.54)",
      "rgba(12, 10, 24, 0.88)",
    ],
    accent: "#fb7185",
    scene: "🌸 💑 🌸",
    subtitle: "Cánh đào hồng phấn bay trong gió",
  },
  {
    id: "ocean-breeze",
    name: "Biển xanh nắng ấm",
    emoji: "🌊",
    colors: ["#0c4a6e", "#1e3a8a", "#172554"],
    overlay: [
      "rgba(8, 24, 44, 0.38)",
      "rgba(14, 34, 64, 0.56)",
      "rgba(9, 13, 22, 0.88)",
    ],
    accent: "#38bdf8",
    scene: "🌊 👩‍❤️‍💋‍👨 🐚",
    subtitle: "Sóng biển dịu êm vỗ về hai trái tim",
  },
  {
    id: "custom",
    name: "Ảnh đôi tự chọn",
    emoji: "🖼️",
    colors: ["#1f1235", "#3b1d5e", "#111827"],
    overlay: [
      "rgba(9, 13, 22, 0.42)",
      "rgba(15, 18, 34, 0.62)",
      "rgba(9, 13, 22, 0.88)",
    ],
    accent: "#f472b6",
    scene: "📸 💑 💖",
    subtitle: "Ảnh kỷ niệm riêng của hai đứa",
  },
];

export function callBackgroundById(id) {
  return CALL_BACKGROUNDS.find((item) => item.id === id) ?? CALL_BACKGROUNDS[0];
}

export function newCall({ id, role, name, video = false, at = Date.now() }) {
  if (!id) throw new Error("Cuộc gọi thiếu mã.");
  const isVideo = Boolean(video);
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
    video: isVideo,
    camOn: isVideo,
    speakerOn: true,
    cameraFacing: "user",
    lastSeen: at,
  };
}
/** Áp một sự kiện lên cuộc gọi; trả về null nghĩa là cuộc gọi đã kết thúc hẳn. */
export function callEvent(call, event, now = Date.now()) {
  if (!call) return null;
  const type = String(event?.type ?? "");
  // Nhịp "còn đây" của máy kia — cập nhật mốc để biết máy kia còn trong cuộc gọi.
  if (type === "alive") return { ...call, lastSeen: now };
  if (type === "accept") {
    if (call.phase === "ringing")
      return {
        ...call,
        phase: "active",
        startedAt: now,
        minimized: false,
        lastSeen: now,
      };
    if (call.phase === "active") return { ...call, lastSeen: now };
    return call;
  }
  if (type === "reject") {
    if (call.phase === "active") return call;
    return {
      ...call,
      phase: "ended",
      endedAt: now,
      reason: "Người thương đang bận",
    };
  }
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
  if (type === "lost")
    return {
      ...call,
      phase: "ended",
      endedAt: now,
      reason: "Người thương đã kết thúc cuộc gọi",
    };
  if (type === "mic") return { ...call, micOn: event.on === true };
  if (type === "cam")
    return {
      ...call,
      camOn: event.on === true,
      video: Boolean(call.video || event.on === true),
    };
  if (type === "switchCamera")
    return {
      ...call,
      cameraFacing:
        event.facing === "environment" || event.facing === "user"
          ? event.facing
          : call.cameraFacing === "environment"
            ? "user"
            : "environment",
    };
  if (type === "speaker") return { ...call, speakerOn: event.on === true };
  if (type === "minimize") return { ...call, minimized: event.min === true };
  return call;
}
/** Máy kia thôi trả lời nhịp (tắt app, mất mạng, hoặc đã kết thúc) thì tự kết thúc. */
export function callTimedOut(call, now = Date.now()) {
  if (!call || call.phase !== "active") return false;
  return (
    now - (call.lastSeen || call.startedAt || call.at) >= CALL_SILENT_END_MS
  );
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
