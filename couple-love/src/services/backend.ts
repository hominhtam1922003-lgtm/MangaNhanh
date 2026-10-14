import "react-native-url-polyfill/auto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import { secureStorage } from "./storage";
import { accountConfig } from "./accountConfig.mjs";
export type Config = { url: string; key: string; projectId: string };
/**
 * Cấu hình máy chủ ghép nối: ƯU TIÊN giá trị đóng trong bản dựng.
 *
 * Vì sao đổi thứ tự so với trước: bản 1.17.0 đọc cấu hình đã lưu trong máy trước,
 * nên máy nào từng nhập tay địa chỉ dự án cũ sẽ mãi dùng dự án cũ dù bản mới đã
 * đóng sẵn dự án mới (khi đó phần ghép nối theo tài khoản không chạy được).
 * Giá trị đóng trong bản dựng luôn thắng; chỉ khi bản dựng không có sẵn thì mới
 * dùng cấu hình lưu trong máy.
 */
export async function readConfig(): Promise<Config | null> {
  const built = accountConfig();
  const extra = Constants.expoConfig?.extra as
    | {
        supabaseUrl?: string;
        supabaseKey?: string;
        eas?: { projectId?: string };
      }
    | undefined;
  if (built)
    return {
      url: built.url,
      key: built.key,
      projectId: extra?.eas?.projectId || "",
    };
  if (extra?.supabaseUrl && extra?.supabaseKey)
    return {
      url: extra.supabaseUrl,
      key: extra.supabaseKey,
      projectId: extra?.eas?.projectId || "",
    };
  const saved = await secureStorage.getItem("backend-config");
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {}
  }
  return null;
}
export async function saveConfig(config: Config) {
  const url = new URL(config.url);
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".supabase.co") ||
    !config.key.trim()
  )
    throw new Error(
      "Dùng URL HTTPS của dự án Supabase và khóa công khai anon/publishable.",
    );
  if (config.key.startsWith("sb_secret_"))
    throw new Error("Không được đưa khóa bí mật/service role vào ứng dụng.");
  if (config.key.startsWith("ey")) {
    try {
      const middle = config.key.split(".")[1];
      const decoded = JSON.parse(
        atob(middle.replace(/-/g, "+").replace(/_/g, "/")),
      );
      if (decoded.role === "service_role")
        throw new Error("Khóa service role không được dùng trên điện thoại.");
    } catch (e) {
      if (e instanceof Error && e.message.includes("service role")) throw e;
    }
  }
  await secureStorage.setItem(
    "backend-config",
    JSON.stringify({ ...config, url: url.origin }),
  );
}
export function makeBackend(config: Config): SupabaseClient {
  return createClient(config.url, config.key, {
    auth: {
      storage: secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    realtime: { params: { eventsPerSecond: 5 } },
  });
}
export function explain(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : String((error as { message?: string })?.message || "");
  if (/network|fetch|timeout/i.test(message))
    return "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại; dữ liệu đã lưu vẫn ở máy chủ.";
  if (/credential|password|email/i.test(message))
    return "Thông tin đăng nhập chưa hợp lệ hoặc email chưa được xác nhận.";
  if (/row.level|policy|permission|42501/i.test(message))
    return "Bạn không có quyền thực hiện thao tác này hoặc backend chưa được triển khai đầy đủ.";
  if (/anonymous/i.test(message))
    return "Dự án chưa bật đăng nhập ẩn danh. Bật Anonymous Sign-ins trong Supabase hoặc dùng email.";
  return message && /[À-ỹ]/.test(message)
    ? message
    : "Chưa hoàn tất thao tác. Kiểm tra cấu hình/quyền máy chủ và thử lại.";
}
