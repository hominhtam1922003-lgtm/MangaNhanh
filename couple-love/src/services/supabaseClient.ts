// supabaseClient.ts — client Supabase thực tế & luồng Expo Push Token cho Mật Mã Yêu.
//
// Cấu hình kết nối Supabase thực tế cho Frontend React Native:
// - SUPABASE_URL: "https://nbbopfvsthuopiopupqd.supabase.co"
// - SUPABASE_ANON_KEY: "sb_publishable_ycuVrcaQYdRT8mgQx5vypg_-ir0JLv6"
// (Khoá bí mật máy chủ chỉ cấu hình trong biến môi trường của Supabase Edge
// Functions / Webhook ở tầng backend, tuyệt đối không đưa vào Frontend).
import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, Session } from "@supabase/supabase-js";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as WebBrowser from "expo-web-browser";
import { AppState, Platform } from "react-native";

/** Dự án Supabase thực tế của Mật Mã Yêu. */
export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "https://nbbopfvsthuopiopupqd.supabase.co";
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
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
    storage: AsyncStorage,
    storageKey: "mat-ma-yeu-auth",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
  realtime: { params: { eventsPerSecond: 10 } },
});

if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/**
 * Lấy Expo Push Token của thiết bị khi mở app và cập nhật/upsert vào bảng
 * `profiles` (cột `expo_push_token`) tương ứng với user đang đăng nhập.
 */
export async function syncExpoPushTokenToProfile(
  explicitUserId?: string | null,
): Promise<string | null> {
  try {
    if (Notifications.getPermissionsAsync === undefined) return null;
    let permission = await Notifications.getPermissionsAsync();
    if (permission.status !== "granted") {
      permission = await Notifications.requestPermissionsAsync();
    }
    if (permission.status !== "granted") return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      (Constants as any)?.easConfig?.projectId ||
      process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
      "";

    let expoPushToken = "";
    try {
      if (projectId && /^[0-9a-f-]{36}$/i.test(String(projectId))) {
        const res = await Notifications.getExpoPushTokenAsync({
          projectId: String(projectId),
        });
        expoPushToken = String(res?.data ?? "").trim();
      } else if (Device.isDevice) {
        const res = await Notifications.getExpoPushTokenAsync();
        expoPushToken = String(res?.data ?? "").trim();
      }
    } catch {
      return null;
    }

    if (!expoPushToken) return null;

    let uid = explicitUserId ? String(explicitUserId).trim() : "";
    if (!uid) {
      const { data } = await supabase.auth.getSession();
      uid = String(data?.session?.user?.id ?? "").trim();
    }
    if (!uid) return expoPushToken;

    const nowIso = new Date().toISOString();
    // Upsert/update vào bảng `profiles` tương ứng với user đang đăng nhập.
    try {
      await supabase.from("profiles").upsert(
        {
          id: uid,
          expo_push_token: expoPushToken,
          updated_at: nowIso,
        },
        { onConflict: "id" },
      );
    } catch {}
    try {
      await supabase
        .from("push_tokens")
        .upsert({ token: expoPushToken, user_id: uid, updated_at: nowIso });
    } catch {}
    return expoPushToken;
  } catch {
    return null;
  }
}

/**
 * Đánh thức điện thoại đối phương (Wake-up Device) khi có cuộc gọi đến (`calls`)
 * hoặc tin nhắn mới (`messages`):
 * 1. Ghi sự kiện vào bảng `calls` hoặc `messages` trên Supabase để kích hoạt
 *    Database Webhook / Edge Function `dispatch-notifications` và Realtime.
 * 2. Nếu đọc được `expo_push_token` của đối phương trong bảng `profiles`, bắn
 *    kèm gói Push ưu tiên cao tới cổng Expo Push API (`https://exp.host/--/api/v2/push/send`)
 *    để đánh thức máy đối phương ngay cả khi app đang tắt hoặc khoá màn hình.
 */
export async function sendWakeupPushToPartner(input: {
  senderId?: string | null;
  partnerId?: string | null;
  type: "call" | "message";
  callId?: string;
  isVideo?: boolean;
  senderName: string;
  body?: string;
}): Promise<boolean> {
  try {
    const partnerId = String(input.partnerId ?? "").trim();
    if (!partnerId || partnerId.startsWith("code:")) return false;
    let senderId = String(input.senderId ?? "").trim();
    if (!senderId) {
      const { data } = await supabase.auth.getSession();
      senderId = String(data?.session?.user?.id ?? "").trim();
    }
    const nowIso = new Date().toISOString();

    if (input.type === "call") {
      try {
        await supabase.from("calls").insert({
          call_id: input.callId || `c${Date.now().toString(36)}`,
          caller_id: senderId || null,
          callee_id: partnerId,
          caller_name: input.senderName,
          is_video: Boolean(input.isVideo),
          status: "ringing",
          created_at: nowIso,
        });
      } catch {}
    } else {
      try {
        await supabase.from("messages").insert({
          sender_id: senderId || null,
          recipient_id: partnerId,
          sender_name: input.senderName,
          body: String(input.body ?? "").slice(0, 500),
          created_at: nowIso,
        });
      } catch {}
    }

    // Đọc expo_push_token của người thương từ bảng `profiles` (RLS cho phép
    // đọc dòng của partner_id).
    const { data: partnerProfile } = await supabase
      .from("profiles")
      .select("expo_push_token")
      .eq("id", partnerId)
      .maybeSingle();

    const token = String(partnerProfile?.expo_push_token ?? "").trim();
    if (!/^(ExponentPushToken|ExpoPushToken)\[[\w-]+\]$/.test(token)) {
      return false;
    }

    const isCall = input.type === "call";
    const title = isCall
      ? `${input.senderName || "Người thương"} đang gọi ${input.isVideo ? "Video " : ""}cho bạn 📞`
      : `${input.senderName || "Người thương"} 💌`;
    const body = isCall
      ? "Chạm để mở màn hình cuộc gọi và nghe máy ngay"
      : input.body || "Bạn có một tin nhắn yêu thương mới.";

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: token,
        title,
        body,
        sound: "default",
        priority: "high",
        channelId: isCall ? "cuoc-goi-den-khan-v2" : "love-messages",
        data: {
          type: input.type,
          open: isCall ? "call" : "chat",
          callId: input.callId ?? "",
          isVideo: Boolean(input.isVideo),
          senderName: input.senderName,
          body: input.body ?? "",
        },
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Lắng nghe sự kiện chèn mới vào bảng `calls` và `messages` qua Supabase Realtime
 * để lập tức đổ chuông, rung và bật màn hình cuộc gọi đến.
 */
export function watchWakeupEvents(
  userId: string,
  onWakeup: (event: {
    type: "call" | "message";
    callId?: string;
    isVideo?: boolean;
    senderName: string;
    body?: string;
  }) => void,
) {
  if (!userId || userId.startsWith("code:")) {
    return { stop: () => {} };
  }
  let channel: any = null;
  try {
    channel = supabase
      .channel(`wakeup-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "calls",
          filter: `callee_id=eq.${userId}`,
        },
        (payload: any) => {
          const row = payload?.new ?? {};
          onWakeup({
            type: "call",
            callId: String(row.call_id ?? row.id ?? ""),
            isVideo: Boolean(row.is_video),
            senderName: String(row.caller_name ?? "Người thương"),
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload: any) => {
          const row = payload?.new ?? {};
          onWakeup({
            type: "message",
            senderName: String(row.sender_name ?? "Người thương"),
            body: String(row.body ?? ""),
          });
        },
      )
      .subscribe();
  } catch {}
  return {
    stop: () => {
      try {
        channel?.unsubscribe?.();
      } catch {}
    },
  };
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
 * Đăng nhập Google/Facebook: mở trình duyệt hệ thống, chờ app được gọi về bằng
 * `haitraitim://auth-callback`, rồi đổi `code` PKCE thành phiên đăng nhập.
 */
export async function signInWithProvider(
  provider: AuthProvider,
): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: AUTH_REDIRECT,
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
      void syncExpoPushTokenToProfile(exchanged.session.user?.id);
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
      void syncExpoPushTokenToProfile(applied.session.user?.id);
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

WebBrowser.maybeCompleteAuthSession();
