// Dự án Supabase dùng cho ghép nối theo tài khoản (bản 1.18.0).
//
// Vì sao cấu hình nằm trong mã JS chứ không chỉ ở app.config.js: giá trị ở đây
// được Metro đóng thẳng vào gói JavaScript, nên kiểm tra được bằng cách soi gói
// cài; còn `Constants.expoConfig.extra` phụ thuộc bản dựng native có nhúng cấu
// hình hay không. Khoá dưới đây là khoá CÔNG KHAI (publishable/anon) — Supabase
// thiết kế để nằm trong app, quyền hạn thật do RLS trên máy chủ quyết định.
//
// Biến môi trường chỉ được chấp nhận khi trỏ CÙNG máy chủ; nếu kho secret cũ trên
// GitHub còn trỏ dự án khác thì bản dựng vẫn dùng đúng dự án ghép nối này.

export const ACCOUNT_PROJECT_URL = "https://nbbopfvsthuopiopupqd.supabase.co";
export const ACCOUNT_PROJECT_KEY =
  "sb_publishable_ycuVrcaQYdRT8mgQx5vypg_-ir0JLv6";

function hostOf(value) {
  try {
    return new URL(String(value)).hostname;
  } catch {
    return "";
  }
}

/**
 * Chọn cấu hình máy chủ ghép nối cuối cùng.
 * @returns {{ url: string, key: string, source: "build" | "env" } | null}
 */
export function resolveAccountConfig(envUrl, envKey) {
  const url = String(envUrl ?? "").trim();
  const key = String(envKey ?? "").trim();
  if (!url || !key)
    return {
      url: ACCOUNT_PROJECT_URL,
      key: ACCOUNT_PROJECT_KEY,
      source: "build",
    };
  // Khoá bí mật không bao giờ vào app.
  if (key.startsWith("sb_secret_") || key.startsWith("eyJ"))
    return {
      url: ACCOUNT_PROJECT_URL,
      key: ACCOUNT_PROJECT_KEY,
      source: "build",
    };
  if (hostOf(url) !== hostOf(ACCOUNT_PROJECT_URL))
    return {
      url: ACCOUNT_PROJECT_URL,
      key: ACCOUNT_PROJECT_KEY,
      source: "build",
    };
  return { url, key, source: "env" };
}

/** Cấu hình đang dùng trên thiết bị (đọc biến môi trường lúc đóng gói nếu có). */
export function accountConfig() {
  return resolveAccountConfig(
    typeof process !== "undefined" ? process.env?.EXPO_PUBLIC_SUPABASE_URL : "",
    typeof process !== "undefined"
      ? process.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY
      : "",
  );
}
