/**
 * Bản thay thế cho thư viện `webrtc-adapter` của trình duyệt.
 *
 * Vì sao cần: `peerjs` gọi `require("webrtc-adapter")` ngay khi nạp. Thư viện đó
 * chỉ để vá các trình duyệt cũ — trong React Native không có `window.navigator`
 * kiểu trình duyệt nên nó không đọc được `browserDetails` và ném lỗi ngay lúc nạp
 * mô-đun, làm hỏng cả app. Ta thay bằng một bản nhỏ cung cấp đúng thứ peerjs
 * đọc: `browserDetails` và `default`. Chọn "firefox 200" vì đó là nhánh mà peerjs
 * coi là đã hỗ trợ unified-plan (WebRTC trong React Native là unified-plan thật,
 * không cần nó dò lại bằng các API chỉ trình duyệt mới có).
 *
 * Ở đây không có mã nào của trình duyệt: chỉ là dữ liệu cho peerjs đọc.
 */
const browserDetails = {
  browser: "firefox",
  version: 200,
};

module.exports = {
  browserDetails,
  default: { browserDetails },
};
