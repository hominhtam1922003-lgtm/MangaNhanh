// Phòng kết nối dùng riêng cho kiểm thử.
//
// Từ 1.18.0 giao thức KHÔNG còn sinh phòng ngẫu nhiên/mã 6 số (chỉ còn phòng suy
// ra từ `pair_secret` của tài khoản), nên các bài kiểm thử cần một phòng hợp lệ
// thì lấy đúng đường đang chạy trong app: `roomFromPair(khoá)`.
//
// Vì sao để trong `tests/`: đây là công cụ kiểm thử, không phải mã chạy thật —
// không đưa vào gói cài.
import { roomFromPair } from "../../src/services/relayProtocol.mjs";

/** Khoá ổn định cho một "phòng" kiểm thử (>=16 ký tự theo yêu cầu của roomFromPair). */
const key = (seed) => `phong-kiem-thu-${seed}`.padEnd(24, "0").slice(0, 40);

/** Phòng kết nối như app đang dùng, suy ra từ `seed` để tái lập được. */
export function testRoom(seed = "mac-dinh") {
  return roomFromPair(key(seed));
}
