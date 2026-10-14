import * as Crypto from "expo-crypto";
import {
  BROKERS,
  RelayClient,
  buildRelayPayload,
  installRandomBytes,
  open,
  randomSourceReady,
  roomFromPair,
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
export { BROKERS, roomFromPair };
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
    // Phòng tạm để thử mã hóa/giải mã: suy ra từ một khoá cố định ngay trong hàm
    // (không cần sinh phòng ngẫu nhiên nữa).
    const room = roomFromPair("tu-kiem-tra-ma-hoa-cua-mat-ma-yeu-1");
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
