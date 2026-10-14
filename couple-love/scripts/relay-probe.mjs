// Dò thật các trạm trung chuyển công cộng từ môi trường CI (GitHub Actions có Internet thật):
// mở WebSocket, bắt tay MQTT, đăng ký topic, gửi/nhận giữa hai máy, và thử cả kênh HTTPS dự phòng.
// Chương trình luôn in ra bảng kết quả và không làm CI đỏ, vì đây là phép đo để chẩn đoán.
import { WebSocket } from "ws";
import {
  BROKERS,
  RelayClient,
  createRoom,
} from "../src/services/relayProtocol.mjs";
import { emptyState, reduce } from "../src/logic/localState.mjs";
import { buildRelayPayload } from "../src/services/relayProtocol.mjs";

globalThis.WebSocket = WebSocket;
const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const lines = [];
const say = (text) => {
  lines.push(text);
  console.log(text);
};
const stamp = () => new Date().toISOString().slice(11, 19);

async function rawOpen(url, timeout = 12000) {
  const started = Date.now();
  return new Promise((resolve) => {
    let done = false;
    let socket;
    const finish = (result) => {
      if (done) return;
      done = true;
      resolve(result);
      try {
        socket?.close();
      } catch {}
    };
    try {
      socket = new WebSocket(url, ["mqtt"]);
    } catch (error) {
      return finish({ ok: false, why: "throw " + error.message, ms: 0 });
    }
    socket.binaryType = "arraybuffer";
    socket.onopen = () =>
      finish({ ok: true, why: "", ms: Date.now() - started });
    socket.onerror = () =>
      finish({ ok: false, why: "lỗi WebSocket", ms: Date.now() - started });
    socket.onclose = (event) =>
      finish({
        ok: false,
        why: `đóng kết nối ${event?.code ?? "?"} ${event?.reason ?? ""}`.trim(),
        ms: Date.now() - started,
      });
    setTimeout(
      () => finish({ ok: false, why: `hết ${timeout}ms chờ`, ms: timeout }),
      timeout,
    );
  });
}

async function mqttRoundTrip(url) {
  const room = createRoom();
  const started = Date.now();
  let received = 0;
  const seen = [];
  const a = new RelayClient({
    room,
    brokers: [url],
    deviceId: "cong-A",
    onStatus: (status) => seen.push(status.state),
    onPayload: () => {},
  });
  const b = new RelayClient({
    room,
    brokers: [url],
    deviceId: "cong-B",
    onStatus: () => {},
    onPayload: () => {
      received = Date.now() - started;
    },
  });
  a.start();
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline && !a.connected) await wait(120);
  if (!a.connected) {
    a.stop();
    return {
      ok: false,
      why: "không nhận được CONNACK/SUBACK",
      ms: Date.now() - started,
    };
  }
  const connA = Date.now() - started;
  b.start();
  const deadlineB = Date.now() + 12000;
  while (Date.now() < deadlineB && !b.connected) await wait(120);
  if (!b.connected) {
    a.stop();
    b.stop();
    return { ok: false, why: "máy B không nối được", ms: connA };
  }
  let state = emptyState("2026-01-01T00:00:00.000Z");
  state = reduce(state, {
    type: "profile.set",
    nickname: "Máy A",
    mood: "love",
    moodNote: "thử",
  });
  a.publishState(buildRelayPayload(state, 60000, "cong-A"), "Máy A");
  const deadlineR = Date.now() + 5000;
  while (Date.now() < deadlineR && !received) await wait(100);
  const partnerOnline = a.status.partnerOnline;
  a.stop();
  b.stop();
  return received
    ? {
        ok: true,
        why: `ghép nối ${partnerOnline ? "có" : "KHÔNG"} thấy người thương`,
        ms: received,
        connectMs: connA,
      }
    : {
        ok: false,
        why: "gửi được nhưng máy B không nhận",
        ms: Date.now() - started,
        connectMs: connA,
      };
}

async function ntfyCheck() {
  const topic = "haitraitim-probe-" + Math.random().toString(36).slice(2, 10);
  const message = "thu-" + Math.random().toString(36).slice(2, 8);
  try {
    const post = await fetch(`https://ntfy.sh/${topic}`, {
      method: "POST",
      body: message,
    });
    if (!post.ok) return { ok: false, why: `POST HTTP ${post.status}` };
    await wait(1200);
    const poll = await fetch(`https://ntfy.sh/${topic}/json?poll=1&since=all`);
    if (!poll.ok) return { ok: false, why: `GET HTTP ${poll.status}` };
    const text = await poll.text();
    return text.includes(message)
      ? { ok: true, why: "HTTPS 443 gửi và đọc lại được" }
      : { ok: false, why: "gửi được nhưng đọc lại không thấy bản tin" };
  } catch (error) {
    return { ok: false, why: "lỗi HTTPS: " + error.message };
  }
}

say(`# Dò trạm trung chuyển Hai Trái Tim · ${stamp()} UTC`);
for (const broker of BROKERS) {
  const open = await rawOpen(broker);
  say(`\n## ${broker}`);
  say(
    `- Mở WebSocket: ${open.ok ? `OK sau ${open.ms}ms` : `LỖI — ${open.why}`}`,
  );
  if (!open.ok) continue;
  const trip = await mqttRoundTrip(broker);
  say(
    `- Bắt tay MQTT + hai máy gửi/nhận: ${
      trip.ok
        ? `OK, máy B nhận sau ${trip.ms}ms (CONNACK ${trip.connectMs}ms, ${trip.why})`
        : `LỖI — ${trip.why}`
    }`,
  );
}
const ntfy = await ntfyCheck();
say(
  `\n## Kênh dự phòng HTTPS (ntfy.sh, cổng 443)\n- ${ntfy.ok ? "OK — " + ntfy.why : "LỖI — " + ntfy.why}`,
);

import { writeFileSync } from "node:fs";
writeFileSync("/tmp/relay-probe-report.md", lines.join("\n") + "\n");
console.log(
  `\nĐã ghi báo cáo vào /tmp/relay-probe-report.md (${lines.length} dòng).`,
);
