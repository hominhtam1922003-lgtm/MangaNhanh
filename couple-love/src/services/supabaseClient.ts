// supabaseClient.ts — client Supabase cho Expo SDK 54 (React Native).
//
// Vì sao viết riêng tệp này: `@supabase/supabase-js` chạy trên React Native cần
// bốn thứ mà bản web không cần — (1) `react-native-url-polyfill` vì RN không có
// `URL` chuẩn, (2) kho lưu phiên là AsyncStorage thay vì `localStorage`,
// (3) tắt `detectSessionInUrl` vì app không phải trang web, (4) tự bật/tắt việc
// làm mới token theo trạng thái app để không hao pin khi app ở nền.
//
// Khoá dưới đây là khoá CÔNG KHAI (publishable/anon) — Supabase thiết kế để khoá
// này nằm trong app; quyền thật do RLS trên máy chủ quyết định. TUYỆT ĐỐI không
// thay bằng khoá `sb_secret_…`/service-role.
//
// ⚠️ Lưu ý cho dự án này: app còn một client khác trong `src/services/backend.ts`
// (lưu phiên bằng `expo-secure-store`). Hai client dùng hai kho lưu khác nhau nên
// sẽ có hai phiên độc lập — muốn chỉ một phiên thì chọn một hướng: hoặc tệp này
// dùng `secureStorage` từ `./storage`, hoặc chuyển hẳn app sang tệp này.
import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, Session } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";
import { AppState, Platform } from "react-native";

/** Dự án Supabase của Mật Mã Yêu. Ưu tiên biến môi trường khi đóng gói. */
export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  "https://nbbopfvsthuopiopupqd.supabase.co";
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_ycuVrcaQYdRT8mgQx5vypg_-ir0JLv6";

/**
 * Địa chỉ quay về sau khi đăng nhập Google/Facebook. Phải khớp `scheme` trong
 * `app.config.js` (haitraitim) và phải được thêm vào Supabase →
 * Authentication → URL Configuration → Redirect URLs.
 */
export const AUTH_REDIRECT = "haitraitim://auth-callback";

export type AuthProvider = "google" | "facebook";

/** Kết quả trả về luôn có câu tiếng Việt để hiện thẳng lên giao diện. */
export type AuthResult =
  | { ok: true; session: Session; message: string }
  | { ok: false; session: null; message: string };

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // AsyncStorage giữ phiên qua các lần mở app (đổi sang SecureStore nếu muốn mã hoá).
    storage: AsyncStorage,
    storageKey: "mat-ma-yeu-auth",
    persistSession: true,
    autoRefreshToken: true,
    // App di động không đọc được token từ URL như trang web.
    detectSessionInUrl: false,
    // PKCE là luồng khuyến nghị cho app: đổi `code` lấy phiên, không lộ token trong URL.
    flowType: "pkce",
  },
  realtime: { params: { eventsPerSecond: 5 } },
});

// Chỉ làm mới token khi app đang mở; ở nền thì dừng để không hao pin.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Đọc URL mà trình duyệt trả về và lấy `code` (PKCE) hoặc token (luồng ẩn). */
function readCallback(returnedUrl: string) {
  const code = /[?&]code=([^&#]+)/.exec(returnedUrl)?.[1] ?? null;
  const fragment = returnedUrl.includes("#") ? returnedUrl.split("#")[1] : "";
  const params = fragment ? new URLSearchParams(fragment) : null;
  return {
    code,
    accessToken: params?.get("access_token") ?? null,
    refreshToken: params?.get("refresh_token") ?? null,
    error: params?.get("error_description") ?? null,
  };
}

/** Dịch lỗi của Supabase thành câu tiếng Việt người dùng hiểu được. */
export function explainAuthError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : String((error as { message?: string })?.message ?? "");
  if (/provider is not enabled|Unsupported provider/i.test(message))
    return "Nhà cung cấp đăng nhập này chưa được bật trong Supabase (Authentication → Providers).";
  if (/redirect/i.test(message))
    return `Supabase chưa cho phép địa chỉ quay về ${AUTH_REDIRECT} (Authentication → URL Configuration → Redirect URLs).`;
  if (/network|fetch|timeout|Failed to fetch/i.test(message))
    return "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.";
  if (/cancel|dismiss/i.test(message)) return "Bạn đã đóng trang đăng nhập.";
  return message && /[À-ỹ]/.test(message)
    ? message
    : "Chưa đăng nhập được. Kiểm tra cấu hình Supabase rồi thử lại.";
}

/**
 * Đăng nhập Google/Facebook: mở trình duyệt hệ thống (không phải webview trong
 * app — Google chặn webview), chờ app được gọi về bằng `haitraitim://auth-callback`,
 * rồi đổi `code` PKCE thành phiên đăng nhập.
 */
export async function signInWithProvider(
  provider: AuthProvider,
): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: AUTH_REDIRECT,
        // Tự mở trình duyệt để kiểm soát kết quả trả về.
        skipBrowserRedirect: true,
        queryParams:
          provider === "google" ? { prompt: "select_account" } : undefined,
      },
    });
    if (error) throw error;
    if (!data?.url) throw new Error("Không mở được trang đăng nhập.");

    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      AUTH_REDIRECT,
    );
    if (result.type !== "success" || !result.url)
      return {
        ok: false,
        session: null,
        message: "Bạn đã đóng trang đăng nhập.",
      };

    const parsed = readCallback(result.url);
    if (parsed.error)
      return {
        ok: false,
        session: null,
        message: explainAuthError(parsed.error),
      };

    if (parsed.code) {
      const { data: exchanged, error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(parsed.code);
      if (exchangeError) throw exchangeError;
      if (!exchanged.session)
        throw new Error("Máy chủ không trả về phiên đăng nhập.");
      return { ok: true, session: exchanged.session, message: "Đã đăng nhập." };
    }

    if (parsed.accessToken && parsed.refreshToken) {
      const { data: applied, error: applyError } =
        await supabase.auth.setSession({
          access_token: parsed.accessToken,
          refresh_token: parsed.refreshToken,
        });
      if (applyError) throw applyError;
      if (!applied.session) throw new Error("Không lưu được phiên đăng nhập.");
      return { ok: true, session: applied.session, message: "Đã đăng nhập." };
    }

    throw new Error("Máy chủ không trả về phiên đăng nhập.");
  } catch (error) {
    return { ok: false, session: null, message: explainAuthError(error) };
  }
}

/** Phiên đang lưu trong máy (đọc lại mỗi lần mở app). */
export async function getSavedSession(): Promise<Session | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session ?? null;
  } catch {
    return null;
  }
}

/** Đăng xuất và xoá phiên trong AsyncStorage. */
export async function signOut(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch {
    // Mất mạng vẫn phải xoá phiên cục bộ, nếu không app sẽ tưởng còn đăng nhập.
    await AsyncStorage.removeItem("mat-ma-yeu-auth").catch(() => {});
  }
}

/** Theo dõi đăng nhập/đăng xuất; trả về hàm để ngừng theo dõi. */
export function onAuthChange(callback: (session: Session | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) =>
    callback(session),
  );
  return () => data?.subscription?.unsubscribe();
}

// Cần cho luồng OAuth trên Android/iOS khi trình duyệt tự đóng sau khi quay về app.
WebBrowser.maybeCompleteAuthSession();
