// Cầu nối tức thời không cần máy chủ riêng: MQTT 3.1.1 qua WebSocket (wss) tới các broker công cộng,
// nhưng nội dung luôn được mã hóa đầu-cuối bằng NaCl secretbox nên broker chỉ thấy dữ liệu đã mã hóa.
import nacl from "tweetnacl";

// React Native/Hermes KHÔNG có TextEncoder/TextDecoder, nên tự viết phần UTF-8.
function utf8Encode(value) {
  const text = String(value);
  const bytes = [];
  for (let index = 0; index < text.length; index++) {
    let code = text.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length) {
      const next = text.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = ((code - 0xd800) << 10) + (next - 0xdc00) + 0x10000;
        index += 1;
      }
    }
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000)
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 63),
        0x80 | (code & 63),
      );
    else
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 63),
        0x80 | ((code >> 6) & 63),
        0x80 | (code & 63),
      );
  }
  return Uint8Array.from(bytes);
}
function utf8Decode(bytes) {
  let out = "";
  let index = 0;
  while (index < bytes.length) {
    const first = bytes[index];
    let size = 0;
    let code = 0;
    if (first < 0x80) {
      size = 1;
      code = first;
    } else if ((first & 0xe0) === 0xc0) {
      size = 2;
      code = first & 0x1f;
    } else if ((first & 0xf0) === 0xe0) {
      size = 3;
      code = first & 0x0f;
    } else if ((first & 0xf8) === 0xf0) {
      size = 4;
      code = first & 0x07;
    } else {
      out += "\ufffd";
      index += 1;
      continue;
    }
    if (index + size > bytes.length) {
      out += "\ufffd";
      break;
    }
    let valid = true;
    for (let step = 1; step < size; step++) {
      const next = bytes[index + step];
      if ((next & 0xc0) !== 0x80) {
        valid = false;
        break;
      }
      code = (code << 6) | (next & 0x3f);
    }
    if (!valid) {
      out += "\ufffd";
      index += 1;
      continue;
    }
    index += size;
    if (code > 0xffff) {
      code -= 0x10000;
      out += String.fromCharCode(
        0xd800 + (code >> 10),
        0xdc00 + (code & 0x3ff),
      );
    } else out += String.fromCharCode(code);
  }
  return out;
}
// Nguồn ngẫu nhiên an toàn: React Native không có crypto.getRandomValues, nên
// relay.ts cài nguồn từ expo-crypto (getRandomBytes đồng bộ).
let randomReady = false;
export function installRandomBytes(source) {
  if (typeof source !== "function")
    throw new Error("Thiếu nguồn ngẫu nhiên an toàn.");
  nacl.setPRNG((target, count) => {
    const bytes = source(count);
    if (!bytes || bytes.length < count)
      throw new Error("Nguồn ngẫu nhiên của máy trả về không đủ dữ liệu.");
    for (let index = 0; index < count; index++) target[index] = bytes[index];
  });
  randomReady = true;
}
export function randomSourceReady() {
  return randomReady || Boolean(globalThis.crypto?.getRandomValues);
}
function secureBytes(count) {
  try {
    return nacl.randomBytes(count);
  } catch {
    throw new Error(
      "Máy chưa có nguồn ngẫu nhiên an toàn nên chưa tạo được phòng kết nối.",
    );
  }
}
export const BROKERS = [
  "wss://broker.emqx.io:8084/mqtt", // trạm chính, thường nhanh nhất
  "wss://broker-cn.emqx.io:8084/mqtt", // trạm châu Á, gần Việt Nam
  "wss://mqtt.eclipseprojects.io:443/mqtt", // cổng 443, dễ qua mạng chặn cổng lạ
  "wss://broker.hivemq.com:8884/mqtt",
  "wss://test.mosquitto.org:8081/mqtt",
];
export const TOPIC_PREFIX = "haitraitim/v3/";
const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function toBase64Url(bytes) {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    output += ALPHABET[first >> 2];
    output +=
      ALPHABET[((first & 3) << 4) | (second === undefined ? 0 : second >> 4)];
    if (second !== undefined)
      output +=
        ALPHABET[((second & 15) << 2) | (third === undefined ? 0 : third >> 6)];
    if (third !== undefined) output += ALPHABET[third & 63];
  }
  return output;
}
export function fromBase64Url(text) {
  const clean = String(text).replace(/[^A-Za-z0-9\-_]/g, "");
  const bytes = [];
  for (let index = 0; index < clean.length; index += 4) {
    const chunk = [0, 1, 2, 3].map((offset) =>
      ALPHABET.indexOf(clean[index + offset] ?? ""),
    );
    bytes.push((chunk[0] << 2) | (chunk[1] >> 4));
    if (chunk[1] >= 0 && clean[index + 2] !== undefined)
      bytes.push(((chunk[1] & 15) << 4) | (chunk[2] >> 2));
    if (chunk[2] >= 0 && clean[index + 3] !== undefined)
      bytes.push(((chunk[2] & 3) << 6) | chunk[3]);
  }
  return Uint8Array.from(bytes);
}
function sha512(bytes) {
  return nacl.hash(bytes);
}
function roomFromSeed(seed) {
  const material = sha512(utf8Encode(seed));
  return {
    id: toBase64Url(material.slice(0, 16)),
    key: toBase64Url(material.slice(32, 64)),
    mode: "code",
  };
}
// Mã 6 số là mật khẩu phòng: cùng 6 số thì hai máy tự vào đúng một phòng,
// không cần trao đổi gì thêm ngoài con số đó.
const codePattern = /^\d{6}$/;
export function createRoom() {
  return {
    id: toBase64Url(secureBytes(16)),
    key: toBase64Url(secureBytes(32)),
    mode: "qr",
    code: null,
  };
}
export function roomFromCode(code) {
  const digits = String(code ?? "").replace(/\D/g, "");
  if (!codePattern.test(digits))
    throw new Error("Mã kết nối phải gồm đúng 6 chữ số.");
  return { ...roomFromSeed("haitraitim-code-v3|" + digits), code: digits };
}
export function makeCode() {
  return String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
}
export function topicFor(room) {
  if (!room?.id || !room?.key) throw new Error("Phòng kết nối không hợp lệ.");
  return TOPIC_PREFIX + room.id;
}
export function roomToQr(room) {
  return `HTT2:${room.id}.${room.key}`;
}
export function roomFromQr(text) {
  const value = String(text ?? "").trim();
  if (value.startsWith("HTT2:")) {
    const [id, key] = value.slice(5).split(".");
    if (!id || !key) throw new Error("Mã QR thiếu thông tin phòng.");
    return { id, key, mode: "qr", code: null };
  }
  if (codePattern.test(value)) return roomFromCode(value);
  throw new Error("Mã không đúng định dạng phòng kết nối.");
}
export function seal(room, value) {
  const key = fromBase64Url(room.key);
  if (key.length !== 32) throw new Error("Khóa phòng không hợp lệ.");
  const nonce = secureBytes(24);
  const box = nacl.secretbox(utf8Encode(JSON.stringify(value)), nonce, key);
  const combined = new Uint8Array(nonce.length + box.length);
  combined.set(nonce, 0);
  combined.set(box, nonce.length);
  return toBase64Url(combined);
}
export function open(room, text) {
  const key = fromBase64Url(room.key);
  const combined = fromBase64Url(text);
  if (combined.length < 40) throw new Error("Gói tin quá ngắn.");
  const box = nacl.secretbox.open(
    combined.slice(24),
    combined.slice(0, 24),
    key,
  );
  if (!box)
    throw new Error(
      "Không giải mã được gói tin (sai phòng hoặc dữ liệu hỏng).",
    );
  return JSON.parse(utf8Decode(box));
}
export function buildRelayPayload(
  state,
  limit = 60000,
  deviceId = "me",
  appVersion = "",
) {
  // Chỉ gửi dữ liệu CỦA MÌNH: nhật ký do mình viết, chu kỳ, kỷ niệm, lời nhắc, hồ sơ.
  // Nhờ vậy hai máy không gửi trả lại dữ liệu của nhau (không lặp vô tận),
  // và dữ liệu nhận được luôn gộp đúng về phía người thương.
  const ownDiary = (Array.isArray(state.diary) ? state.diary : []).filter(
    (entry) => entry.authorId !== "partner",
  );
  const base = {
    v: 3,
    device: String(deviceId || "me"),
    from: {
      id: "me",
      nickname: state.me?.nickname ?? "Bạn",
      mood: state.me?.mood ?? "calm",
      moodNote: state.me?.moodNote ?? "",
      avatar: null,
      appVersion: String(appVersion || state.settings?.appVersion || "").slice(
        0,
        24,
      ),
      updatedAt: state.me?.updatedAt ?? new Date().toISOString(),
    },
    anniversary: state.anniversary,
    anniversaryAt: state.anniversaryAt ?? state.anniversary,
    // Giao diện dùng chung: chủ đề + ảnh nền; máy nhận so mốc thời gian để biết
    // bản nào mới hơn nên hai máy luôn giống nhau, không cãi nhau vô tận.
    appearance: {
      theme: String(state.appearance?.theme ?? ""),
      wallpaperId: state.appearance?.wallpaperId
        ? String(state.appearance.wallpaperId).slice(0, 60)
        : null,
      updatedAt: String(
        state.appearance?.updatedAt ??
          state.me?.updatedAt ??
          new Date().toISOString(),
      ),
    },
    cycle: state.cycle ?? null,
    diary: [],
    // Tin nhắn của mình (40 tin mới nhất): phần mô tả đi ở đây, còn tệp tin
    // thoại đi bằng gói riêng như ảnh khoảnh khắc.
    messages: (Array.isArray(state.messages) ? state.messages : [])
      .filter((message) => message && message.authorId !== "partner")
      .slice(0, 40)
      .map((message) => ({
        id: String(message.id),
        kind: [
          "text",
          "emoji",
          "voice",
          "nudge",
          "sticker",
          "photo",
          "location",
          // Nhật ký cuộc gọi hiện trong đoạn chat của cả hai máy.
          "call",
        ].includes(message.kind)
          ? message.kind
          : "text",
        body: String(message.body ?? "").slice(0, 600),
        createdAt: String(message.createdAt ?? ""),
        hasAudio: Boolean(message.audio),
        hasPhoto: Boolean(message.photo),
        lat: Number.isFinite(Number(message.lat)) ? Number(message.lat) : null,
        lng: Number.isFinite(Number(message.lng)) ? Number(message.lng) : null,
        place: String(message.place ?? "").slice(0, 120),
        durationMs: Number(message.durationMs) || 0,
      })),
    alerts: (Array.isArray(state.alerts) ? state.alerts : []).slice(0, 60),
    // Chỉ gửi phần mô tả khoảnh khắc; ảnh đi bằng gói riêng (mã hóa như nhau).
    moments: (Array.isArray(state.moments) ? state.moments : [])
      .filter((moment) => moment && moment.authorId !== "partner")
      .slice(0, 40)
      .map((moment) => ({
        id: String(moment.id),
        caption: String(moment.caption ?? "").slice(0, 120),
        createdAt: String(moment.createdAt ?? ""),
        hasFile: Boolean(moment.file),
      })),
  };
  const trimmedDiary = ownDiary.map((entry) => ({ ...entry, image: null }));
  // Nhật ký KHÔNG bao giờ bị bỏ khỏi gói dữ liệu (trước đây gói quá lớn thì
  // nhật ký bị cắt mất nên máy kia không thấy bài mới). Khi gói quá lớn, cắt
  // bớt khoảnh khắc → lời nhắc → tin nhắn → chữ trong nhật ký, theo thứ tự này.
  const gọnDiary = (count, chars) =>
    ownDiary.slice(0, count).map((entry) => ({
      ...entry,
      image: null,
      body: typeof entry.body === "string" ? entry.body.slice(0, chars) : "",
    }));
  const attempts = [
    { ...base, diary: trimmedDiary },
    { ...base, diary: trimmedDiary, moments: base.moments.slice(0, 12) },
    {
      ...base,
      diary: trimmedDiary,
      moments: base.moments.slice(0, 12),
      alerts: base.alerts.slice(0, 20),
    },
    {
      ...base,
      diary: trimmedDiary,
      moments: base.moments.slice(0, 12),
      alerts: base.alerts.slice(0, 20),
      messages: base.messages.slice(0, 20),
    },
    {
      ...base,
      diary: gọnDiary(40, 400),
      moments: base.moments.slice(0, 8),
      alerts: base.alerts.slice(0, 12),
      messages: base.messages.slice(0, 10),
    },
    {
      ...base,
      diary: gọnDiary(20, 200),
      moments: base.moments.slice(0, 4),
      alerts: base.alerts.slice(0, 8),
      messages: base.messages.slice(0, 4),
    },
    // Trường hợp xấu nhất: gói cực nhỏ. Vẫn phải còn nhật ký mới nhất, phần
    // còn lại gửi bù ở các gói sau (khoảnh khắc và tin nhắn có gói riêng).
    { ...base, diary: gọnDiary(6, 120), moments: [], alerts: [], messages: [] },
  ];
  for (const candidate of attempts) {
    if (JSON.stringify(candidate).length <= limit) return candidate;
  }
  return attempts[attempts.length - 1];
}
/* ------- MQTT 3.1.1 trên WebSocket (chỉ phần cần dùng: QoS 0) ------- */
function varint(value) {
  const bytes = [];
  let rest = value;
  do {
    let byte = rest % 128;
    rest = Math.floor(rest / 128);
    if (rest > 0) byte |= 128;
    bytes.push(byte);
  } while (rest > 0);
  return Uint8Array.from(bytes);
}
function utf8Field(text) {
  const bytes = utf8Encode(text);
  const length = new Uint8Array([
    (bytes.length >> 8) & 255,
    bytes.length & 255,
  ]);
  const out = new Uint8Array(2 + bytes.length);
  out.set(length, 0);
  out.set(bytes, 2);
  return out;
}
function join(parts) {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
export function encodeConnect(clientId, keepAlive = 45) {
  const payload = utf8Field(clientId);
  const variable = join([
    utf8Field("MQTT"),
    Uint8Array.from([4, 2, (keepAlive >> 8) & 255, keepAlive & 255]),
  ]);
  const body = join([variable, payload]);
  return join([Uint8Array.from([0x10]), varint(body.length), body]);
}
export function encodeSubscribe(packetId, topic) {
  const id = packetId % 65535;
  const body = join([
    Uint8Array.from([(id >> 8) & 255, id & 255]),
    utf8Field(topic),
    Uint8Array.from([0]),
  ]);
  return join([Uint8Array.from([0x82]), varint(body.length), body]);
}
export function encodePublish(topic, text) {
  const body = join([utf8Field(topic), utf8Encode(text)]);
  return join([Uint8Array.from([0x30]), varint(body.length), body]);
}
export function encodePuback(packetId) {
  return Uint8Array.from([0x40, 2, (packetId >> 8) & 255, packetId & 255]);
}
export function encodePingreq() {
  return Uint8Array.from([0xc0, 0]);
}
export function encodeDisconnect() {
  return Uint8Array.from([0xe0, 0]);
}
export function decodePackets(buffer) {
  const packets = [];
  let offset = 0;
  while (offset < buffer.length) {
    const header = buffer[offset];
    const multiplier = [1, 128, 16384, 2097152];
    let length = 0;
    let shift = 0;
    let cursor = offset + 1;
    let done = false;
    while (shift < 4 && cursor < buffer.length) {
      const byte = buffer[cursor];
      length += (byte & 127) * multiplier[shift];
      cursor += 1;
      shift += 1;
      if ((byte & 128) === 0) {
        done = true;
        break;
      }
    }
    if (!done || cursor + length > buffer.length) break;
    const body = buffer.slice(cursor, cursor + length);
    const type = header >> 4;
    if (type === 2) {
      packets.push({ type: "connack", returnCode: body[1] ?? 255 });
    } else if (type === 9) {
      packets.push({
        type: "suback",
        packetId: (body[0] << 8) | body[1],
        returnCode: body[2] ?? 255,
      });
    } else if (type === 13) {
      packets.push({ type: "pingresp" });
    } else if (type === 3) {
      const topicLength = (body[0] << 8) | body[1];
      const topic = utf8Decode(body.slice(2, 2 + topicLength));
      const qos = (header >> 1) & 3;
      const payloadOffset = 2 + topicLength + (qos > 0 ? 2 : 0);
      const text = utf8Decode(body.slice(payloadOffset));
      const packetId =
        qos > 0 ? (body[2 + topicLength] << 8) | body[3 + topicLength] : 0;
      packets.push({ type: "publish", topic, text, qos, packetId });
    }
    offset = cursor + length;
  }
  return { packets, rest: buffer.slice(offset) };
}
const HELLO_MS = 45000;
// Mã bản tin: dùng để bỏ qua bản tin trùng khi nó tới từ nhiều trạm cùng lúc.
const randomMark = () =>
  Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const OPEN_MS = 12000;
const pad2 = (value) => (value < 10 ? "0" : "") + value;
const clock = () => {
  const now = new Date();
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
};
const shortHost = (url) =>
  String(url)
    .replace(/^wss?:\/\//, "")
    .replace(/\/.*$/, "");
/** Nối SONG SONG tới mọi trạm công cộng: trạm nào vào được thì dùng, trạm chết
 *  không làm chậm trạm khác. Bản tin đi trên mọi trạm đang sẵn sàng và được
 *  chống trùng theo mã bản tin, nên hai máy gặp nhau chỉ cần MỘT trạm chung. */
export class RelayClient {
  constructor(options) {
    this.room = options.room;
    this.onPayload = options.onPayload ?? (() => {});
    // Mọi bản tin đã giải mã (trạng thái, ảnh khoảnh khắc, xin gửi lại ảnh…).
    this.onMessage = options.onMessage ?? (() => {});
    this.onStatus = options.onStatus ?? (() => {});
    this.onReady = options.onReady ?? (() => {});
    this.onLog = options.onLog ?? (() => {});
    this.brokers = options.brokers ?? BROKERS;
    this.clientId =
      options.clientId ?? "htt" + Math.random().toString(36).slice(2, 10);
    // Mã máy: broker công cộng dội lại bản tin cho chính máy vừa gửi, nên phải
    // bỏ qua bản tin của mình — nếu không máy sẽ tự nhận mình là "người thương".
    this.deviceId = options.deviceId ?? this.clientId;
    this.slots = this.brokers.map((url, index) => ({
      url,
      index,
      socket: null,
      ready: false,
      subscribed: false,
      lastError: "",
      retry: 0,
      timer: null,
      openTimer: null,
      buffer: new Uint8Array(0),
    }));
    this.packetId = 1;
    this.stopped = true;
    this.partnerSeen = 0;
    this.partnerName = null;
    this.statusKey = "";
    this.seen = [];
    this.timers = [];
  }
  start() {
    if (!this.stopped) return;
    this.stopped = false;
    for (const slot of this.slots) this.connect(slot);
    this.timers.push(setInterval(() => this.keepalive(), 10000));
    this.timers.push(setInterval(() => this.emitStatus(), 4000));
    this.note(null, `Đang thử ${this.slots.length} trạm công cộng cùng lúc…`);
  }
  stop() {
    this.stopped = true;
    for (const timer of this.timers) clearInterval(timer);
    this.timers = [];
    for (const slot of this.slots) {
      clearTimeout(slot.timer);
      clearTimeout(slot.openTimer);
      slot.timer = null;
      slot.openTimer = null;
      try {
        slot.socket?.send(encodeDisconnect());
      } catch {}
      try {
        slot.socket?.close();
      } catch {}
      slot.socket = null;
      slot.ready = false;
      slot.subscribed = false;
    }
    this.statusKey = "";
    this.onStatus({
      state: "off",
      broker: null,
      partnerOnline: false,
      partnerName: this.partnerName,
      summary: this.summary(),
    });
  }
  get readySlots() {
    return this.slots.filter((slot) => slot.subscribed);
  }
  get connected() {
    return this.readySlots.length > 0;
  }
  get partnerOnline() {
    return Date.now() - this.partnerSeen < HELLO_MS;
  }
  summary() {
    return this.slots.map((slot) => ({
      host: shortHost(slot.url),
      state: slot.subscribed
        ? "sẵn sàng"
        : slot.ready
          ? "đang đăng ký phòng"
          : slot.lastError || "đang thử",
    }));
  }
  get status() {
    const ready = this.readySlots[0];
    return {
      state: this.stopped
        ? "off"
        : this.connected
          ? this.partnerOnline
            ? "online"
            : "alone"
          : "connecting",
      broker: ready?.url ?? this.slots[0]?.url ?? null,
      partnerOnline: this.partnerOnline,
      partnerName: this.partnerName,
      readyCount: this.readySlots.length,
      summary: this.summary(),
    };
  }
  // Chỉ gọi onStatus khi có thay đổi thật, tránh làm giao diện render liên tục.
  emitStatus() {
    const status = this.status;
    const key = [
      status.state,
      status.readyCount,
      status.partnerOnline,
      status.partnerName,
      status.summary.map((item) => item.host + ":" + item.state).join(","),
    ].join("|");
    if (key === this.statusKey) return;
    this.statusKey = key;
    this.onStatus(status);
  }
  note(slot, text) {
    this.onLog({
      time: clock(),
      text: slot ? `${shortHost(slot.url)}: ${text}` : text,
    });
  }
  connect(slot) {
    if (this.stopped) return;
    let socket;
    try {
      socket = new WebSocket(slot.url, ["mqtt"]);
    } catch (error) {
      slot.lastError = "không mở được";
      this.retrySlot(slot);
      return;
    }
    socket.binaryType = "arraybuffer";
    slot.socket = socket;
    slot.buffer = new Uint8Array(0);
    slot.openTimer = setTimeout(() => {
      if (this.stopped || slot.ready) return;
      slot.lastError = `quá ${Math.round(OPEN_MS / 1000)} giây chưa mở được`;
      try {
        socket.close();
      } catch {}
    }, OPEN_MS);
    socket.onopen = () => {
      if (this.stopped) return;
      this.sendTo(slot, encodeConnect(this.clientId));
    };
    socket.onmessage = (event) => {
      const bytes =
        event.data instanceof ArrayBuffer
          ? new Uint8Array(event.data)
          : typeof event.data === "string"
            ? utf8Encode(event.data)
            : new Uint8Array(event.data?.buffer ?? []);
      this.handle(bytes, slot);
    };
    socket.onerror = () => {
      if (!slot.ready) slot.lastError = "lỗi mạng";
    };
    socket.onclose = (event) => {
      clearTimeout(slot.openTimer);
      slot.openTimer = null;
      const wasReady = slot.ready || slot.subscribed;
      slot.ready = false;
      slot.subscribed = false;
      if (this.stopped) return;
      if (!wasReady)
        slot.lastError =
          slot.lastError ||
          (event?.code ? `đóng kết nối (mã ${event.code})` : "không nối được");
      this.note(slot, wasReady ? "mất kết nối, đang nối lại" : slot.lastError);
      this.retrySlot(slot);
      this.emitStatus();
    };
  }
  handle(bytes, slot) {
    const merged = new Uint8Array(slot.buffer.length + bytes.length);
    merged.set(slot.buffer, 0);
    merged.set(bytes, slot.buffer.length);
    const { packets, rest } = decodePackets(merged);
    slot.buffer = rest;
    for (const packet of packets) {
      if (packet.type === "connack") {
        if (packet.returnCode === 0) {
          slot.ready = true;
          slot.lastError = "";
          slot.retry = 0;
          slot.socket?.send(
            encodeSubscribe(this.packetId++, topicFor(this.room)),
          );
          this.note(slot, "bắt tay MQTT xong, đang đăng ký phòng");
          this.emitStatus();
        } else {
          slot.lastError = `trạm từ chối (mã ${packet.returnCode})`;
          try {
            slot.socket?.close();
          } catch {}
        }
      } else if (packet.type === "suback") {
        const wasSubscribed = slot.subscribed;
        slot.subscribed = true;
        this.note(slot, "sẵn sàng nhận dữ liệu");
        this.emitStatus();
        // Đăng ký xong mới gửi: gửi trước khi đăng ký là tin bị mất.
        this.publishHello();
        if (!wasSubscribed) this.onReady();
      } else if (packet.type === "publish") {
        if (packet.qos > 0) this.socket?.send(encodePuback(packet.packetId));
        if (packet.topic !== topicFor(this.room)) continue;
        try {
          const message = open(this.room, packet.text);
          if (message?.device && message.device === this.deviceId) continue;
          const mark = message?.mid;
          if (mark) {
            if (this.seen.includes(mark)) continue;
            this.seen.push(mark);
            if (this.seen.length > 200) this.seen.splice(0, 100);
          }
          if (
            message?.kind === "ping" ||
            message?.kind === "hello" ||
            message?.kind === "state" ||
            message?.kind === "photo" ||
            message?.kind === "photoRequest" ||
            message?.kind === "chat" ||
            // Tín hiệu cuộc gọi (đổ chuông, nghe, từ chối, kết thúc) và báo đã xem.
            message?.kind === "call" ||
            message?.kind === "chatRead"
          ) {
            const firstContact = !this.partnerOnline;
            this.partnerSeen = Date.now();
            const name =
              message.name ||
              (typeof message.payload?.from?.nickname === "string"
                ? message.payload.from.nickname
                : null);
            if (name) this.partnerName = name;
            if (message.kind === "state" && message.payload)
              this.onPayload(message.payload, name);
            if (message.kind !== "ping" && message.kind !== "hello")
              this.onMessage(message, name);
            this.emitStatus();
            // Người thương vừa lộ diện: trả lời ngay một tiếng "hello" để máy kia
            // biết mình cũng đang trực tuyến, không phải chờ nhịp giữ kết nối.
            if (firstContact) this.publishHello();
          }
        } catch {}
      }
    }
  }
  keepalive() {
    for (const slot of this.readySlots) {
      try {
        slot.socket?.send(encodePingreq());
        slot.socket?.send(
          encodePublish(topicFor(this.room), seal(this.room, { kind: "ping" })),
        );
      } catch {}
    }
    this.emitStatus();
  }
  sendTo(slot, bytes) {
    try {
      // Truyền ArrayBuffer là đường đi được React Native hỗ trợ chắc chắn nhất.
      slot.socket?.send(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
      );
      return true;
    } catch {
      return false;
    }
  }
  publish(message, options = {}) {
    const targets = this.readySlots;
    if (!targets.length) return false;
    const body = { ...message, device: this.deviceId, mid: randomMark() };
    let sent = false;
    for (const slot of targets) {
      const bytes = encodePublish(topicFor(this.room), seal(this.room, body));
      if (this.sendTo(slot, bytes)) sent = true;
    }
    if (!sent && options.markOnly) return false;
    return sent;
  }
  publishState(payload, name) {
    return this.publish({ kind: "state", name, payload });
  }
  publishHello() {
    return this.publish({ kind: "hello", name: null });
  }
  retrySlot(slot) {
    if (this.stopped) return;
    clearTimeout(slot.timer);
    const wait = Math.min(30000, 1500 * 2 ** slot.retry);
    slot.retry = Math.min(5, slot.retry + 1);
    slot.timer = setTimeout(() => {
      if (!this.stopped) this.connect(slot);
    }, wait);
    this.emitStatus();
  }
}
