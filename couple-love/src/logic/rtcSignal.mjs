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
/** Nhịp đọc số liệu thật của WebRTC (bao nhiêu byte tiếng vào/ra). */
/** Đọc số liệu WebRTC mỗi 500 ms: đủ dày để trái tim đập theo giọng nói. */
export const RTC_STATS_MS = 500;
/**
 * Nối rồi mà từng này mili giây không có MỘT byte tiếng nào đi vào/đi ra thì
 * coi như đường tiếng trực tiếp hỏng (kiểu "nối được mà không nghe gì") và
 * quay về đường tiếng qua kênh ghép nối. DTX được tắt trong SDP nên tiếng gửi
 * liên tục, không có khoảng lặng giả — nhờ vậy phép kiểm tra này đáng tin.
 */
export const RTC_DEAD_MS = 7000;
/** Bitrate Opus cho tiếng nói: đủ rõ mà không tốn băng thông. */
export const RTC_OPUS_BITRATE = 32000;
/** Bitrate mục tiêu (kbps) cho Video Call thích ứng trên mạng 4G / TURN 80/443. */
export const RTC_VIDEO_BITRATE_KBPS = 380;
/**
 * Chờ tối đa bao lâu cho đường tiếng qua PeerJS (máy chủ chào hỏi + TURN) trước
 * khi chuyển sang đường WebRTC cũ. Ngắn để không bắt người dùng chờ lâu.
 */
export const RTC_PEER_MS = 2500;

/**
 * Muốn dùng máy chủ trung chuyển RIÊNG của bạn? Đặt ba biến này lúc dựng app,
 * không cần sửa mã:
 *   EXPO_PUBLIC_TURN_URLS="turn:turn.cuaban.com:3478,turn:turn.cuaban.com:443?transport=tcp"
 *   EXPO_PUBLIC_TURN_USER="tên đăng nhập"
 *   EXPO_PUBLIC_TURN_CREDENTIAL="mật khẩu"
 * Ba biến này được nhúng thẳng vào bản dựng (Expo thay lúc biên dịch), nên sau
 * khi thay phải dựng lại APK. Không đặt gì thì app dùng danh sách miễn phí dưới.
 */
function turnFromEnv() {
  if (typeof process === "undefined" || !process?.env) return [];
  // Ba dòng dưới đây phải viết đúng dạng `process.env.EXPO_PUBLIC_…` thì Expo mới
  // thay được giá trị lúc biên dịch; đổi cách viết là mất tính năng.
  const urls = String(process.env.EXPO_PUBLIC_TURN_URLS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!urls.length) return [];
  return [
    {
      urls,
      username: String(process.env.EXPO_PUBLIC_TURN_USER ?? ""),
      credential: String(process.env.EXPO_PUBLIC_TURN_CREDENTIAL ?? ""),
    },
  ];
}

/**
 * Máy chủ TRUNG CHUYỂN (TURN) miễn phí, không cần đăng ký. STUN chỉ giúp hai máy
 * "nhìn thấy" nhau; khi nhà mạng chặn kiểu NAT đối xứng / CGNAT / Wi-Fi công ty
 * thì bắt buộc phải có TURN để tiếng đi vòng qua máy chủ trung chuyển — đây
 * chính là lý do cuộc gọi "nối rồi mà không nghe gì" ở nhiều mạng. Tiếng vẫn
 * mã hoá đầu-cuối; TURN chỉ chuyển tiếp gói đã mã hoá.
 *
 * Bộ 1: đúng bộ mà thư viện PeerJS phát sẵn cho mọi máy dùng `peerjs`.
 * Bộ 2: Open Relay của Metered — có cổng 443 và TCP trên 443 nên chui được qua
 * tường lửa gắt (mạng 4G/Wi-Fi công ty thường chỉ cho 80/443 đi ra).
 * Cả hai đều là dịch vụ công cộng miễn phí, có thể quá tải hoặc ngừng bất cứ
 * lúc nào — đó là lý do app vẫn còn hai lớp dự phòng phía sau, và lý do có sẵn
 * cách thay bằng máy chủ riêng ở trên.
 */
export const METERED_ICE_SERVERS = [
  {
    urls: "stun:stun.relay.metered.ca:80",
  },
  {
    urls: "turn:global.relay.metered.ca:80",
    username: "5cddad6cdc6b69bdedd42c87",
    credential: "nYuBOYJvrOiMo6IG",
  },
  {
    urls: "turn:global.relay.metered.ca:80?transport=tcp",
    username: "5cddad6cdc6b69bdedd42c87",
    credential: "nYuBOYJvrOiMo6IG",
  },
  {
    urls: "turn:global.relay.metered.ca:443",
    username: "5cddad6cdc6b69bdedd42c87",
    credential: "nYuBOYJvrOiMo6IG",
  },
  {
    urls: "turns:global.relay.metered.ca:443?transport=tcp",
    username: "5cddad6cdc6b69bdedd42c87",
    credential: "nYuBOYJvrOiMo6IG",
  },
];

export const RTC_TURN_SERVERS = [
  ...turnFromEnv(),
  // Máy chủ trung chuyển RIÊNG của bạn (Metered, gói "couple-love"): có cổng 80,
  // 443 và TCP 443 nên chui được qua cả mạng 4G chặn P2P — đặt trước các bộ công
  // cộng để ICE thử ngay từ đầu. Thông tin đăng nhập nằm trong bản dựng (WebRTC
  // buộc phải có trong máy khách); muốn đổi thì đặt EXPO_PUBLIC_TURN_URLS/USER/
  // CREDENTIAL rồi dựng lại APK, không cần sửa mã.
  {
    urls: [
      "turn:couple-love.metered.live:80",
      "turn:couple-love.metered.live:443",
      "turn:couple-love.metered.live:443?transport=tcp",
    ],
    username: "5cddad6cdc6b69bdedd42c87",
    credential: "nYuBOYJvrOiMo6IG",
  },
  {
    urls: ["turn:eu-0.turn.peerjs.com:3478", "turn:us-0.turn.peerjs.com:3478"],
    username: "peerjs",
    credential: "peerjsp",
  },
  {
    urls: [
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:443",
      "turn:openrelay.metered.ca:443?transport=tcp",
    ],
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

/** Máy chủ "chào hỏi" miễn phí của PeerJS — không cần tài khoản, không cần khoá. */
export const PEER_CLOUD = {
  host: "0.peerjs.com",
  port: 443,
  path: "/",
  secure: true,
};

/**
 * Máy chủ STUN miễn phí: chỉ giúp hai máy biết địa chỉ công khai của nhau để
 * nối trực tiếp. Không có dữ liệu nào đi qua đây (không phải máy chủ trung gian).
 * Kèm theo cả máy chủ trung chuyển TURN ở dưới cho những mạng khó.
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
  ...RTC_TURN_SERVERS,
];

/**
 * "all" = thử nối TRỰC TIẾP trước, chỉ khi bí mới nhờ máy chủ trung chuyển. Đặt
 * "relay" sẽ bắt mọi cuộc gọi đi vòng qua TURN (chậm hơn, tốn pin hơn) nên không
 * dùng. Đây là câu trả lời cho "ưu tiên P2P": ICE tự chọn đường rẻ nhất trước.
 */
export const ICE_POLICY = "all";

/**
 * Cấu hình bộ lọc phần cứng + Adaptive Filter của WebRTC:
 * Bật khử vọng (echoCancellation + Delay-Agnostic AEC), giảm ồn phần cứng
 * (noiseSuppression + ANR bậc 2), tự cân bằng âm lượng (AGC) và lọc thông cao
 * (googHighpassFilter) để triệt tiêu tiếng vang, tiếng quạt/gió mà không méo giọng.
 */
export const RTC_MEDIA = {
  audio: {
    echoCancellation: true, // Bật khử vang âm thanh (AEC)
    noiseSuppression: true, // Bật khử tiếng ồn nền
    autoGainControl: true, // Tự động cân bằng âm lượng micro
    googEchoCancellation: true, // Cờ mở rộng cho WebRTC
    googEchoCancellation2: true, // Adaptive Filter AEC thế hệ 2
    googDAEchoCancellation: true, // Delay-Agnostic AEC cho máy ảo / Bluetooth / loa ngoài
    googAutoGainControl: true,
    googAutoGainControl2: true, // Digital Adaptive AGC
    googNoiseSuppression: true,
    googNoiseSuppression2: true, // Spectral Adaptive Noise Suppression
    googHighpassFilter: true, // Lọc tần số thấp (tiếng gió, tiếng ù)
    googTypingNoiseDetection: true,
    googAudioMirroring: false,
  },
  video: false,
};

/**
 * Tạo cấu hình getUserMedia theo loại cuộc gọi (thoại hoặc video).
 * Khi gọi video, giới hạn độ phân giải 640x480 @ 24fps để mượt trên 4G và máy yếu.
 */
export function rtcMediaConstraints(video = false) {
  return {
    audio: { ...RTC_MEDIA.audio },
    video: video
      ? {
          facingMode: "user",
          width: { ideal: 640, max: 960 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 24, max: 30 },
        }
      : false,
  };
}

/**
 * `pid` = trao đổi mã máy của PeerJS qua kênh ghép nối (kênh này đã chạy sẵn,
 * không cần tài khoản). Bản cũ không biết `pid` thì bỏ qua gói đó và vẫn gọi
 * được bằng đường WebRTC cũ — không làm hỏng máy nào.
 */
export const RTC_SUBS = ["pid", "offer", "answer", "ice", "bye"];

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

/**
 * Chỉnh phần SDP của Opus trước khi gửi đi:
 * - `useinbandfec=1`: gói bị mất vẫn dựng lại được tiếng (hết ngắt quãng kiểu rè).
 * - `usedtx=0`: không tắt tiếng khi im lặng, gói đi liên tục nên đường tiếng
 *   được kiểm tra thật và không có khoảng lặng giả.
 * - `maxaveragebitrate`: mức tiếng nói, nhẹ mà rõ.
 * SDP là văn bản chuẩn nên sửa thẳng ở đây là cách làm đúng, không cần native.
 */
export function tuneOpusSdp(sdp, options = {}) {
  const text = String(sdp ?? "");
  if (!text || !/opus/i.test(text)) return text;
  const bitrate = Math.max(6000, Number(options.bitrate) || RTC_OPUS_BITRATE);
  const separator = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r\n|\n/);
  const opusPayloads = new Set();
  for (const line of lines) {
    const match = /^a=rtpmap:(\d+)\s+opus\//i.exec(line.trim());
    if (match) opusPayloads.add(match[1]);
  }
  if (!opusPayloads.size) return text;
  const touched = new Set();
  const tuned = lines.map((line) => {
    const match = /^a=fmtp:(\d+)\s*(.*)$/i.exec(line.trim());
    if (!match || !opusPayloads.has(match[1])) return line;
    touched.add(match[1]);
    const params = new Map();
    for (const part of match[2].split(";")) {
      const [key, value] = part.split("=");
      if (key && value !== undefined && key.trim())
        params.set(key.trim(), value.trim());
    }
    params.set("useinbandfec", "1");
    params.set("usedtx", "0");
    params.set("maxaveragebitrate", String(bitrate));
    const body = [...params].map(([key, value]) => `${key}=${value}`).join(";");
    return `a=fmtp:${match[1]} ${body}`;
  });
  // Chưa có dòng fmtp cho Opus thì thêm ngay sau dòng rtpmap của nó.
  const missing = [...opusPayloads].filter((id) => !touched.has(id));
  if (missing.length) {
    return tuned
      .flatMap((line) => {
        if (!/^a=rtpmap:(\d+)\s+opus\//i.test(line.trim())) return [line];
        const id = /^a=rtpmap:(\d+)/i.exec(line.trim())[1];
        if (!missing.includes(id)) return [line];
        return [
          line,
          `a=fmtp:${id} useinbandfec=1;usedtx=0;maxaveragebitrate=${bitrate}`,
        ];
      })
      .join(separator);
  }
  return tuned.join(separator);
}

/**
 * Tinh chỉnh SDP toàn diện (Codec Opus + Bitrate thích ứng cho Audio/Video):
 * - Audio: Opus FEC + tắt DTX + maxaveragebitrate (qua tuneOpusSdp).
 * - Video (nếu có dòng `m=video`): chèn `b=AS:<kbps>` và `x-google-*-bitrate`
 *   để WebRTC tự co giãn băng thông mượt mà trên mạng 4G yếu hoặc khi chuyển
 *   đổi giữa các cổng TURN 80/443 của Metered.ca.
 */
export function tuneAdaptiveSdp(sdp, options = {}) {
  const base = tuneOpusSdp(sdp, options);
  if (!base || !/^m=video\b/im.test(base)) return base;
  const videoKbps = Math.max(
    120,
    Number(options.videoBitrateKbps) || RTC_VIDEO_BITRATE_KBPS,
  );
  const minKbps = Math.max(80, Math.round(videoKbps * 0.35));
  const startKbps = Math.max(140, Math.round(videoKbps * 0.7));
  const separator = base.includes("\r\n") ? "\r\n" : "\n";
  const lines = base.split(/\r\n|\n/);
  const videoPayloads = new Set();
  for (const line of lines) {
    const match = /^a=rtpmap:(\d+)\s+(VP8|VP9|H264)\//i.exec(line.trim());
    if (match) videoPayloads.add(match[1]);
  }
  const out = [];
  let inVideo = false;
  let hasVideoBandwidth = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (/^m=video\b/i.test(trimmed)) {
      inVideo = true;
      hasVideoBandwidth = false;
      out.push(line);
      continue;
    }
    if (/^m=/i.test(trimmed)) {
      if (inVideo && !hasVideoBandwidth) out.push(`b=AS:${videoKbps}`);
      inVideo = false;
    }
    if (inVideo && /^b=AS:/i.test(trimmed)) {
      hasVideoBandwidth = true;
      out.push(`b=AS:${videoKbps}`);
      continue;
    }
    if (inVideo && /^c=IN\b/i.test(trimmed) && !hasVideoBandwidth) {
      out.push(line);
      out.push(`b=AS:${videoKbps}`);
      hasVideoBandwidth = true;
      continue;
    }
    const fmtp = /^a=fmtp:(\d+)\s*(.*)$/i.exec(trimmed);
    if (fmtp && videoPayloads.has(fmtp[1])) {
      const rest = fmtp[2].trim();
      const extra = `x-google-min-bitrate=${minKbps};x-google-start-bitrate=${startKbps};x-google-max-bitrate=${videoKbps}`;
      out.push(
        rest.includes("x-google-max-bitrate")
          ? line
          : `a=fmtp:${fmtp[1]} ${rest ? `${rest};${extra}` : extra}`,
      );
      continue;
    }
    out.push(line);
  }
  if (inVideo && !hasVideoBandwidth) out.push(`b=AS:${videoKbps}`);
  return out.join(separator);
}

/** "12,3 KB" — số liệu tiếng cho màn hình gọi, viết kiểu Việt Nam. */
export function formatAudioBytes(bytes) {
  const value = Math.max(0, Number(bytes) || 0);
  if (value < 1024) return `${Math.round(value)} B`;
  if (value < 1024 * 1024)
    return `${(value / 1024).toFixed(1).replace(".", ",")} KB`;
  return `${(value / (1024 * 1024)).toFixed(2).replace(".", ",")} MB`;
}

/** Dòng số liệu thật: đang nhận bao nhiêu, đang gửi bao nhiêu. */
export function rtcAudioText(inBytes, outBytes) {
  return `tiếng vào ${formatAudioBytes(inBytes)} · tiếng ra ${formatAudioBytes(outBytes)}`;
}

/** Đường tiếng trực tiếp nối rồi mà không có byte nào: coi như không nghe được. */
export function rtcAudioIsDead(now, lastAudioAt, ms = RTC_DEAD_MS) {
  const last = Number(lastAudioAt);
  if (!Number.isFinite(last) || last <= 0) return false;
  return Number(now) - last >= Math.max(2000, Number(ms) || RTC_DEAD_MS);
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
