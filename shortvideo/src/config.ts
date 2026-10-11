/**
 * Địa chỉ backend (phụ đề AI, tìm video Pexels, tìm web Google).
 * - Chạy web/dev: để trống, dùng đường dẫn tương đối (/api) qua proxy của Vite.
 * - Bản APK: không có backend trong máy, cần đặt VITE_API_BASE thành địa chỉ backend
 *   đã deploy (ví dụ https://api.ban-cua-ban.com).
 */
export const API_BASE: string = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? '';
