// Ghép nối theo TÀI KHOẢN: logic thuần, kiểm thử được bằng Node.
//
// Vì sao thay mã 6 số ngẫu nhiên: mã ngẫu nhiên ai cũng đoán/trùng được nên hai
// máy lạ có thể chui vào chung một phòng ("kết nối ảo"), và mã cũ nằm trong bộ
// nhớ máy nên lần sau app tự vào lại phòng cũ dù đã hết quan hệ. Từ 1.18.0:
//   * mỗi tài khoản có MỘT mã cố định (short_code) sinh từ uid, lưu ở DB;
//   * chỉ vào phòng khi máy chủ xác nhận `partner_id` (kiểm tra LẠI mỗi lần mở
//     app, không tin bộ nhớ máy);
//   * phòng và khoá mã hoá suy ra từ `pair_secret` mà chỉ hai hàng hồ sơ đọc được.

/** Số ký tự của mã kết nối cố định. */
export const PAIR_CODE_LENGTH = 6;

/** Bảng chữ của mã: bỏ I, O, 0, 1 để đọc/gõ không nhầm. */
export const PAIR_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Chuẩn hoá mã người dùng gõ: bỏ khoảng trắng/gạch ngang, viết hoa, chỉ giữ ký tự
 * có trong bảng chữ (nên gõ `abc-234` thành `ABC234`). Ký tự không có trong bảng
 * (0, 1, I, O…) bị bỏ đi, và mã sau đó sẽ không đủ 6 ký tự → báo lỗi rõ ràng thay
 * vì âm thầm đổi thành ký tự khác rồi nối nhầm người.
 */
export function normalizePairCode(value) {
  return String(value ?? "")
    .toUpperCase()
    .split("")
    .filter((ch) => PAIR_ALPHABET.includes(ch))
    .join("")
    .slice(0, PAIR_CODE_LENGTH);
}

/** Mã đã hợp lệ chưa (đúng 6 ký tự, chỉ nằm trong bảng chữ). */
export function isValidPairCode(value) {
  const code = normalizePairCode(value);
  if (code.length !== PAIR_CODE_LENGTH) return false;
  for (const ch of code) if (!PAIR_ALPHABET.includes(ch)) return false;
  return true;
}

/** Mã hiển thị cho dễ đọc: `ABC-234`. */
export function formatPairCode(value) {
  const code = String(value ?? "").toUpperCase();
  if (code.length !== PAIR_CODE_LENGTH) return code;
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

/**
 * Quyết định màn hình nào phải hiện khi mở app. Đây là chốt chống "kết nối ảo":
 * máy CHỈ được vào phòng khi máy chủ xác nhận đã ghép đôi; còn lại phải dừng ở
 * màn hình nhập mã và xoá phòng cũ trong bộ nhớ máy.
 *
 * @param {{ hasConfig?: boolean, session?: boolean, checked?: boolean,
 *           partnerId?: string | null, secret?: string | null,
 *           cachedPair?: boolean, error?: string | null }} input
 * @returns {{ screen: "login" | "code" | "paired" | "offline",
 *             allowRelay: boolean, clearCached: boolean, reason: string }}
 */
export function pairGate(input = {}) {
  const {
    hasConfig = true,
    session = false,
    checked = false,
    partnerId = null,
    secret = null,
    cachedPair = false,
    error = null,
  } = input;

  if (!hasConfig)
    return {
      screen: "login",
      allowRelay: false,
      clearCached: true,
      reason: "Chưa có cấu hình máy chủ ghép nối trong bản dựng này.",
    };

  if (!session)
    return {
      screen: "login",
      allowRelay: false,
      // Có tài khoản cũ trong bộ nhớ nhưng phiên đăng nhập đã hết: vẫn xoá phòng,
      // vì không có gì bảo đảm đây còn là người thương.
      clearCached: true,
      reason: "Cần đăng nhập để biết máy này đang ghép với ai.",
    };

  if (!checked)
    return {
      screen: "offline",
      allowRelay: false,
      // Mất mạng thì KHÔNG được tự vào lại phòng cũ: dữ liệu vẫn xem được nhưng
      // kết nối tức thời phải chờ máy chủ xác nhận.
      clearCached: true,
      reason:
        error ||
        "Chưa kiểm tra được trạng thái ghép nối với máy chủ. Bật mạng rồi thử lại.",
    };

  if (!partnerId || !secret)
    return {
      screen: "code",
      allowRelay: false,
      // Đây chính là lỗi "kết nối ảo": bộ nhớ máy còn phòng cũ nhưng máy chủ nói
      // chưa có người thương → phải xoá phòng cũ.
      clearCached: true,
      reason: "Máy chủ xác nhận bạn chưa ghép nối. Nhập mã của người thương.",
    };

  return {
    screen: "paired",
    allowRelay: true,
    clearCached: false,
    reason: "Đã ghép nối.",
  };
}

/** Nói ngắn gọn vì sao đang ở màn hình này (hiện trên giao diện). */
export function gateReasonText(gate) {
  switch (gate?.screen) {
    case "paired":
      return "Đã ghép nối và máy chủ xác nhận.";
    case "login":
      return "Cần đăng nhập để biết máy này ghép với ai.";
    case "offline":
      return "Chưa liên lạc được máy chủ — chưa kết nối tức thời để tránh nối nhầm phòng cũ.";
    default:
      return "Chưa ghép nối: hãy nhập mã cố định của người thương.";
  }
}

/** Tóm tắt để hiện trong Cài đặt / màn hình kết nối. */
export function accountSummary(account) {
  if (!account?.uid) return "Chưa đăng nhập (chưa có tài khoản ghép nối).";
  const who = account.partnerName || account.partnerId || "";
  return who
    ? `Đã ghép nối với ${who} · mã của mình ${formatPairCode(account.shortCode ?? "")}`
    : `Chưa ghép nối · mã cố định của mình là ${formatPairCode(account.shortCode ?? "")}`;
}
