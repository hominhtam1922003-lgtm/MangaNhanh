import * as Crypto from "expo-crypto";
import {
  BROKERS,
  RelayClient,
  buildRelayPayload,
  createRoom,
  installRandomBytes,
  makeCode,
  open,
  randomSourceReady,
  roomFromCode,
  roomFromPair,
  roomFromQr,
  roomToQr,
  seal,
} from "./relayProtocol.mjs";
import type { State } from "./localdb";
export type Room = {
  id: string;
  key: string;
  mode: string;
  code?: string | null;
  role?: string | null;
};
export type RelayStatus = {
  state: string;
  broker: string | null;
  partnerOnline: boolean;
  partnerName?: string | null;
  readyCount?: number;
  summary?: { host: string; state: string }[];
};
export {
  BROKERS,
  createRoom,
  makeCode,
  roomFromCode,
  roomFromPair,
  roomFromQr,
  roomToQr,
};
// React Native không có crypto.getRandomValues, nên lấy nguồn ngẫu nhiên an toàn
// từ expo-crypto. Nếu việc này lỗi thì KHÔNG ném ra ngoài (tránh làm văng app),
// chỉ ghi lại để màn hình Ghép nối báo cho người dùng biết.
let randomProblem = "";
try {
  installRandomBytes((size: number) => Crypto.getRandomBytes(size));
} catch (error) {
  randomProblem =
    error instanceof Error
      ? error.message
      : "Không lấy được nguồn ngẫu nhiên an toàn của máy.";
}
export function randomBytesReady() {
  return randomProblem === "" && randomSourceReady();
}
export function randomBytesProblem() {
  return randomProblem;
}
export function roomFromState(state: State): Room | null {
  const relay = (state as State & { relay?: Room | null }).relay;
  if (!relay?.id || !relay?.key) return null;
  return {
    id: relay.id,
    key: relay.key,
    mode: relay.mode ?? "qr",
    code: (relay as { code?: string | null }).code ?? null,
    role: (relay as { role?: string | null }).role ?? "host",
  };
}
export function relayPayloadFor(
  state: State,
  deviceId: string,
  appVersion = "",
) {
  return buildRelayPayload(state, 60000, deviceId, appVersion);
}
export function payloadKey(payload: unknown) {
  return JSON.stringify(payload);
}
/** Tự kiểm tra ngay trên máy: nguồn ngẫu nhiên, mã hóa, WebSocket. */
export function relaySelfTest() {
  const tests: { name: string; ok: boolean; detail: string }[] = [];
  tests.push({
    name: "Nguồn ngẫu nhiên an toàn",
    ok: randomBytesReady(),
    detail: randomBytesReady()
      ? "đã lấy từ expo-crypto"
      : randomProblem || "máy chưa cấp được nguồn ngẫu nhiên",
  });
  try {
    const room = createRoom();
    const payload = { hello: "xin chào 💞 nhớ em" };
    const back = open(room, seal(room, payload));
    const same = JSON.stringify(back) === JSON.stringify(payload);
    tests.push({
      name: "Mã hóa đầu-cuối",
      ok: same,
      detail: same ? "mã hóa và giải mã đúng" : "giải mã ra dữ liệu khác",
    });
  } catch (error) {
    tests.push({
      name: "Mã hóa đầu-cuối",
      ok: false,
      detail: error instanceof Error ? error.message : "lỗi không rõ",
    });
  }
  const socketOk = typeof globalThis.WebSocket === "function";
  tests.push({
    name: "WebSocket của máy",
    ok: socketOk,
    detail: socketOk ? "có sẵn" : "thiếu WebSocket",
  });
  return tests;
}
export { RelayClient };
