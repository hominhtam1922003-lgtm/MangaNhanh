// Cầu nối tức thời không cần máy chủ riêng: MQTT 3.1.1 qua WebSocket (wss) tới các broker công cộng,
// nhưng nội dung luôn được mã hóa đầu-cuối bằng NaCl secretbox nên broker chỉ thấy dữ liệu đã mã hóa.
import nacl from "tweetnacl";

export const BROKERS = [
  "wss://broker.emqx.io:8084/mqtt",
  "wss://broker.hivemq.com:8884/mqtt",
  "wss://test.mosquitto.org:8081/mqtt",
];
export const TOPIC_PREFIX = "haitraitim/v3/";
const encoder = new TextEncoder();
const decoder = new TextDecoder();
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
  const material = sha512(encoder.encode(seed));
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
    id: toBase64Url(nacl.randomBytes(16)),
    key: toBase64Url(nacl.randomBytes(32)),
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
  const nonce = nacl.randomBytes(24);
  const box = nacl.secretbox(encoder.encode(JSON.stringify(value)), nonce, key);
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
  return JSON.parse(decoder.decode(box));
}
export function buildRelayPayload(state, limit = 60000, deviceId = "me") {
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
      updatedAt: state.me?.updatedAt ?? new Date().toISOString(),
    },
    anniversary: state.anniversary,
    anniversaryAt: state.anniversaryAt ?? state.anniversary,
    cycle: state.cycle ?? null,
    diary: [],
    alerts: (Array.isArray(state.alerts) ? state.alerts : []).slice(0, 60),
  };
  const trimmedDiary = ownDiary.map((entry) => ({ ...entry, image: null }));
  const attempts = [
    { ...base, diary: trimmedDiary },
    {
      ...base,
      diary: trimmedDiary.map((entry) => ({
        ...entry,
        body: typeof entry.body === "string" ? entry.body.slice(0, 400) : "",
      })),
    },
    base,
  ];
  for (const candidate of attempts) {
    if (JSON.stringify(candidate).length <= limit) return candidate;
  }
  return base;
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
  const bytes = encoder.encode(text);
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
  const body = join([utf8Field(topic), encoder.encode(text)]);
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
      const topic = decoder.decode(body.slice(2, 2 + topicLength));
      const qos = (header >> 1) & 3;
      const payloadOffset = 2 + topicLength + (qos > 0 ? 2 : 0);
      const text = decoder.decode(body.slice(payloadOffset));
      const packetId =
        qos > 0 ? (body[2 + topicLength] << 8) | body[3 + topicLength] : 0;
      packets.push({ type: "publish", topic, text, qos, packetId });
    }
    offset = cursor + length;
  }
  return { packets, rest: buffer.slice(offset) };
}
const HELLO_MS = 45000;
/** Kết nối tới broker đầu tiên hoạt động, tự nối lại, và phát/nhận dữ liệu đã mã hóa. */
export class RelayClient {
  constructor(options) {
    this.room = options.room;
    this.onPayload = options.onPayload ?? (() => {});
    this.onStatus = options.onStatus ?? (() => {});
    this.brokers = options.brokers ?? BROKERS;
    this.clientId =
      options.clientId ?? "htt" + Math.random().toString(36).slice(2, 10);
    this.socket = null;
    this.brokerIndex = 0;
    this.buffer = new Uint8Array(0);
    this.packetId = 1;
    this.stopped = false;
    this.connected = false;
    this.partnerSeen = 0;
    this.partnerName = null;
    this.statusKey = "";
    this.retry = 0;
    this.timers = [];
  }
  start() {
    this.stopped = false;
    this.connect();
    this.timers.push(setInterval(() => this.keepalive(), 20000));
    this.timers.push(setInterval(() => this.checkPresence(), 5000));
  }
  stop() {
    this.stopped = true;
    for (const timer of this.timers) clearInterval(timer);
    this.timers = [];
    try {
      this.socket?.send(encodeDisconnect());
    } catch {}
    try {
      this.socket?.close();
    } catch {}
    this.socket = null;
    this.connected = false;
    this.statusKey = "";
    this.onStatus({
      state: "off",
      broker: null,
      partnerOnline: false,
      partnerName: this.partnerName,
    });
  }
  get status() {
    return {
      state: this.connected
        ? this.partnerOnline
          ? "online"
          : "alone"
        : this.stopped
          ? "off"
          : "connecting",
      broker: this.brokers[this.brokerIndex] ?? null,
      partnerOnline: this.partnerOnline,
      partnerName: this.partnerName,
    };
  }
  // Chỉ gọi onStatus khi có thay đổi thật, tránh làm giao diện render liên tục.
  emitStatus() {
    const status = this.status;
    const key = [
      status.state,
      status.broker,
      status.partnerOnline,
      status.partnerName,
    ].join("|");
    if (key === this.statusKey) return;
    this.statusKey = key;
    this.onStatus(status);
  }
  get partnerOnline() {
    return Date.now() - this.partnerSeen < HELLO_MS;
  }
  connect() {
    if (this.stopped) return;
    const broker = this.brokers[this.brokerIndex % this.brokers.length];
    this.emitStatus();
    let socket;
    try {
      socket = new WebSocket(broker, ["mqtt"]);
    } catch {
      this.scheduleRetry();
      return;
    }
    socket.binaryType = "arraybuffer";
    this.socket = socket;
    const timer = setTimeout(() => {
      if (this.socket === socket && !this.connected) {
        try {
          socket.close();
        } catch {}
      }
    }, 15000);
    this.timers.push(timer);
    socket.onopen = () => {
      socket.send(encodeConnect(this.clientId));
    };
    socket.onmessage = (event) => {
      const bytes =
        event.data instanceof ArrayBuffer
          ? new Uint8Array(event.data)
          : typeof event.data === "string"
            ? encoder.encode(event.data)
            : new Uint8Array(event.data?.buffer ?? []);
      this.handle(bytes);
    };
    socket.onerror = () => {
      this.scheduleRetry();
    };
    socket.onclose = () => {
      clearTimeout(timer);
      this.connected = false;
      this.scheduleRetry();
    };
  }
  handle(bytes) {
    const merged = new Uint8Array(this.buffer.length + bytes.length);
    merged.set(this.buffer, 0);
    merged.set(bytes, this.buffer.length);
    const { packets, rest } = decodePackets(merged);
    this.buffer = rest;
    for (const packet of packets) {
      if (packet.type === "connack") {
        if (packet.returnCode === 0) {
          this.connected = true;
          this.retry = 0;
          this.socket?.send(
            encodeSubscribe(this.packetId++, topicFor(this.room)),
          );
          this.emitStatus();
          this.publish(
            { kind: "hello", name: null },
            { skipPartnerCheck: true },
          );
        } else {
          this.brokerIndex += 1;
          this.scheduleRetry(1000);
        }
      } else if (packet.type === "publish") {
        if (packet.qos > 0) this.socket?.send(encodePuback(packet.packetId));
        if (packet.topic !== topicFor(this.room)) continue;
        try {
          const message = open(this.room, packet.text);
          if (
            message?.kind === "ping" ||
            message?.kind === "hello" ||
            message?.kind === "state"
          ) {
            this.partnerSeen = Date.now();
            const name =
              message.name ||
              (typeof message.payload?.from?.nickname === "string"
                ? message.payload.from.nickname
                : null);
            if (name) this.partnerName = name;
            if (message.kind === "state" && message.payload)
              this.onPayload(message.payload, name);
            this.emitStatus();
          }
        } catch {}
      }
    }
  }
  keepalive() {
    if (!this.connected) return;
    try {
      this.socket?.send(encodePingreq());
      this.socket?.send(
        encodePublish(topicFor(this.room), seal(this.room, { kind: "ping" })),
      );
    } catch {}
    this.emitStatus();
  }
  checkPresence() {
    this.emitStatus();
  }
  publish(message, options = {}) {
    if (!this.connected || !this.socket) return false;
    const body = options.skipPartnerCheck ? message : message;
    try {
      this.socket.send(
        encodePublish(topicFor(this.room), seal(this.room, body)),
      );
      return true;
    } catch {
      return false;
    }
  }
  publishState(payload, name) {
    return this.publish({ kind: "state", name, payload });
  }
  publishHello() {
    return this.publish(
      { kind: "hello", name: null },
      { skipPartnerCheck: true },
    );
  }
  scheduleRetry(delay) {
    if (this.stopped) return;
    this.brokerIndex += 1;
    const wait = delay ?? Math.min(30000, 1000 * 2 ** this.retry);
    this.retry = Math.min(5, this.retry + 1);
    this.emitStatus();
    const timer = setTimeout(() => {
      if (!this.stopped) this.connect();
    }, wait);
    this.timers.push(timer);
  }
}
