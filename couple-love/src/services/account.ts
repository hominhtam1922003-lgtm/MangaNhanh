// Tài khoản & ghép nối qua Supabase: đăng nhập Google/Facebook, mã kết nối cố
// định theo uid, trạng thái ghép đôi lưu ở máy chủ.
//
// Nguyên tắc an toàn của tệp này:
//   * Không bao giờ tin bộ nhớ máy khi quyết định "đã ghép nối hay chưa" — mọi
//     quyết định đều đọc lại từ máy chủ (ensureAccount / refreshPartner).
//   * Mọi lỗi được trả về dưới dạng {ok:false, message} tiếng Việt, không ném ra
//     ngoài để không làm văng app.
import * as WebBrowser from "expo-web-browser";
import type { SupabaseClient } from "@supabase/supabase-js";

import { makeBackend, readConfig } from "./backend";

export type AuthProvider = "google" | "facebook";

export type Account = {
  uid: string;
  shortCode: string;
  displayName: string;
  avatarUrl: string | null;
  partnerId: string | null;
  partnerName: string;
  partnerAvatar: string | null;
  partnerCode: string | null;
  pairSecret: string | null;
  pairedAt: string | null;
};

/** Địa chỉ quay về sau khi đăng nhập Google/Facebook (khớp scheme trong app.config.js). */
export const AUTH_REDIRECT = "haitraitim://auth-callback";

let client: SupabaseClient | null = null;
let clientKey = "";

function normalize(payload: any): Account | null {
  if (!payload || typeof payload !== "object" || !payload.uid) return null;
  return {
    uid: String(payload.uid),
    shortCode: String(payload.shortCode ?? ""),
    displayName: String(payload.displayName ?? ""),
    avatarUrl: payload.avatarUrl ? String(payload.avatarUrl) : null,
    partnerId: payload.partnerId ? String(payload.partnerId) : null,
    partnerName: String(payload.partnerName ?? ""),
    partnerAvatar: payload.partnerAvatar ? String(payload.partnerAvatar) : null,
    partnerCode: payload.partnerCode ? String(payload.partnerCode) : null,
    pairSecret: payload.pairSecret ? String(payload.pairSecret) : null,
    pairedAt: payload.pairedAt ? String(payload.pairedAt) : null,
  };
}

/** Máy chủ đã được cấu hình trong bản dựng chưa (URL + khoá công khai). */
export async function accountConfigured(): Promise<boolean> {
  const config = await readConfig();
  return Boolean(config?.url && config?.key);
}

/** Lấy (và nhớ) client Supabase; trả null nếu bản dựng thiếu cấu hình. */
export async function accountClient(): Promise<SupabaseClient | null> {
  const config = await readConfig();
  if (!config?.url || !config?.key) return null;
  const key = `${config.url}|${config.key}`;
  if (client && clientKey === key) return client;
  try {
    client = makeBackend(config);
    clientKey = key;
    return client;
  } catch {
    client = null;
    return null;
  }
}

function explain(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : String((error as { message?: string })?.message ?? "");
  if (/provider is not enabled|Unsupported provider/i.test(message))
    return "Nhà cung cấp đăng nhập này chưa được bật trong Supabase (Authentication → Providers).";
  if (/redirect_uri_mismatch|redirect/i.test(message))
    return `Supabase chưa cho phép địa chỉ quay về ${AUTH_REDIRECT} (Authentication → URL Configuration).`;
  if (/network|fetch|timeout|Failed to fetch/i.test(message))
    return "Không kết nối được máy chủ ghép nối. Kiểm tra mạng rồi thử lại.";
  if (/anonymous|Anonymous/i.test(message))
    return "Dự án chưa bật đăng nhập ẩn danh (Authentication → Sign In / Providers → Anonymous).";
  if (
    /pair_with_code|ensure_profile|does not exist|schema cache/i.test(message)
  )
    return "Máy chủ chưa có bảng/hàm ghép nối mới. Hãy chạy tệp supabase/migrations/002_pairing.sql.";
  if (/quá nhiều lần/i.test(message)) return message;
  if (/đã ghép|chưa ghép|chính bạn|Không tìm thấy mã/i.test(message))
    return message;
  return message && /[À-ỹ]/.test(message)
    ? message
    : "Chưa hoàn tất được thao tác với máy chủ ghép nối.";
}

/** Phiên đăng nhập hiện tại (null nếu chưa đăng nhập). */
export async function currentSession(): Promise<{
  signedIn: boolean;
  uid: string | null;
  email: string | null;
}> {
  const db = await accountClient();
  if (!db) return { signedIn: false, uid: null, email: null };
  try {
    const { data } = await db.auth.getSession();
    const session = data?.session ?? null;
    return {
      signedIn: Boolean(session?.user?.id),
      uid: session?.user?.id ?? null,
      email: session?.user?.email ?? null,
    };
  } catch {
    return { signedIn: false, uid: null, email: null };
  }
}

/**
 * Đăng nhập Google/Facebook: mở trình duyệt hệ thống, quay về app bằng deep link
 * `haitraitim://auth-callback`, rồi đổi mã PKCE thành phiên đăng nhập.
 */
export async function signInWithProvider(
  provider: AuthProvider,
): Promise<{ ok: boolean; message: string }> {
  const db = await accountClient();
  if (!db)
    return {
      ok: false,
      message: "Bản dựng chưa có cấu hình máy chủ ghép nối.",
    };
  try {
    const { data, error } = await db.auth.signInWithOAuth({
      provider,
      options: { redirectTo: AUTH_REDIRECT, skipBrowserRedirect: true },
    });
    if (error) throw error;
    const url = String(data?.url ?? "");
    if (!url) throw new Error("Không mở được trang đăng nhập.");
    const result = await WebBrowser.openAuthSessionAsync(url, AUTH_REDIRECT);
    if (result.type !== "success" || !result.url)
      return { ok: false, message: "Bạn đã đóng trang đăng nhập." };
    const returned = result.url;
    const code = /[?&]code=([^&#]+)/.exec(returned)?.[1];
    if (code) {
      const exchanged = await db.auth.exchangeCodeForSession(code);
      if (exchanged.error) throw exchanged.error;
      return { ok: true, message: "Đã đăng nhập." };
    }
    // Một số cấu hình trả token ngay trong phần sau dấu # (implicit flow).
    const fragment = returned.includes("#") ? returned.split("#")[1] : "";
    const params = new URLSearchParams(fragment);
    const access = params.get("access_token");
    const refresh = params.get("refresh_token");
    if (access && refresh) {
      const applied = await db.auth.setSession({
        access_token: access,
        refresh_token: refresh,
      });
      if (applied.error) throw applied.error;
      return { ok: true, message: "Đã đăng nhập." };
    }
    throw new Error("Máy chủ không trả về phiên đăng nhập.");
  } catch (error) {
    return { ok: false, message: explain(error) };
  }
}

/** Đăng nhập nhanh không cần Google/Facebook (phải bật Anonymous trong Supabase). */
export async function signInAnonymously(): Promise<{
  ok: boolean;
  message: string;
}> {
  const db = await accountClient();
  if (!db)
    return {
      ok: false,
      message: "Bản dựng chưa có cấu hình máy chủ ghép nối.",
    };
  try {
    const { error } = await db.auth.signInAnonymously();
    if (error) throw error;
    return {
      ok: true,
      message:
        "Đã đăng nhập ẩn danh. Lưu ý: đổi máy hoặc xoá app là mất tài khoản này.",
    };
  } catch (error) {
    return { ok: false, message: explain(error) };
  }
}

export async function signOut(): Promise<void> {
  const db = await accountClient();
  try {
    await db?.auth.signOut();
  } catch {}
}

/**
 * Đọc hồ sơ CỦA MÁY CHỦ (không dùng bộ nhớ máy): uid, mã cố định, partner_id.
 * Đây là hàm mỗi lần mở app đều gọi trước khi cho vào phòng kết nối.
 */
export async function ensureAccount(): Promise<{
  ok: boolean;
  account: Account | null;
  message: string;
}> {
  const db = await accountClient();
  if (!db)
    return { ok: false, account: null, message: "Chưa có cấu hình máy chủ." };
  try {
    const { data, error } = await db.rpc("ensure_profile");
    if (error) throw error;
    const account = normalize(data);
    if (!account)
      return {
        ok: false,
        account: null,
        message: "Máy chủ trả về hồ sơ trống.",
      };
    return { ok: true, account, message: "Đã kiểm tra với máy chủ." };
  } catch (error) {
    return { ok: false, account: null, message: explain(error) };
  }
}

/** Ghép nối bằng mã cố định của người thương (máy chủ ghi cho CẢ HAI bên). */
export async function pairWithCode(code: string): Promise<{
  ok: boolean;
  account: Account | null;
  message: string;
}> {
  const db = await accountClient();
  if (!db)
    return { ok: false, account: null, message: "Chưa có cấu hình máy chủ." };
  try {
    const { error } = await db.rpc("pair_with_code", { p_code: code });
    if (error) throw error;
    // Đọc lại hồ sơ để chắc chắn cả hai máy đã có partner_id (không đoán theo phản hồi).
    const again = await ensureAccount();
    return again.ok
      ? { ok: true, account: again.account, message: "Đã ghép nối." }
      : { ok: false, account: null, message: again.message };
  } catch (error) {
    return { ok: false, account: null, message: explain(error) };
  }
}

/** Ngắt kết nối: xoá đôi ở máy chủ cho CẢ HAI máy. */
export async function unpairAccount(): Promise<{
  ok: boolean;
  message: string;
}> {
  const db = await accountClient();
  if (!db) return { ok: false, message: "Chưa có cấu hình máy chủ." };
  try {
    const { error } = await db.rpc("unpair");
    if (error) throw error;
    return { ok: true, message: "Đã ngắt kết nối ở cả hai máy." };
  } catch (error) {
    return { ok: false, message: explain(error) };
  }
}

/** Đổi tên hiển thị / ảnh đại diện lưu lên máy chủ. */
export async function saveAccountProfile(patch: {
  displayName?: string;
  avatarUrl?: string | null;
}): Promise<{ ok: boolean; message: string }> {
  const db = await accountClient();
  if (!db) return { ok: false, message: "Chưa có cấu hình máy chủ." };
  try {
    const { error } = await db.rpc("save_profile", {
      p_display_name: patch.displayName ?? null,
      p_avatar_url: patch.avatarUrl ?? null,
    });
    if (error) throw error;
    return { ok: true, message: "Đã lưu lên máy chủ." };
  } catch (error) {
    return { ok: false, message: explain(error) };
  }
}

/**
 * Ảnh đại diện lên kho `avatars/<uid>.jpg` (kho công khai), rồi lưu URL vào hồ sơ.
 * Máy nào chưa tạo kho thì bỏ qua, ảnh vẫn đi kèm dữ liệu ghép nối như trước.
 */
export async function uploadAvatar(
  uid: string,
  base64: string,
): Promise<{ ok: boolean; url: string | null; message: string }> {
  const db = await accountClient();
  if (!db)
    return { ok: false, url: null, message: "Chưa có cấu hình máy chủ." };
  try {
    const path = `${uid}/avatar.jpg`;
    const { error } = await db.storage
      .from("avatars")
      .upload(path, bufferFromBase64(base64), {
        contentType: "image/jpeg",
        upsert: true,
      });
    if (error) throw error;
    const { data } = db.storage.from("avatars").getPublicUrl(path);
    const url = `${String(data?.publicUrl ?? "")}?v=${Date.now()}`;
    const saved = await saveAccountProfile({ avatarUrl: url });
    return saved.ok
      ? { ok: true, url, message: "Đã lưu ảnh đại diện lên máy chủ." }
      : { ok: false, url, message: saved.message };
  } catch (error) {
    return { ok: false, url: null, message: explain(error) };
  }
}

/** base64 → Uint8Array (React Native không có atob cho mọi trường hợp). */
export function bufferFromBase64(value: string): Uint8Array {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = String(value)
    .replace(/=+$/, "")
    .replace(/[^A-Za-z0-9+/]/g, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let index = 0;
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    const value2 = alphabet.indexOf(ch);
    if (value2 < 0) continue;
    buffer = (buffer << 6) | value2;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[index] = (buffer >> bits) & 0xff;
      index += 1;
    }
  }
  return out.subarray(0, index);
}

export type PairingWatcher = { stop: () => void };

/**
 * Theo dõi hàng hồ sơ của mình: máy kia bấm "Ngắt kết nối" là máy này biết ngay.
 * Dùng realtime (nếu dự án đã bật) và luôn kèm nhịp hỏi lại mỗi 20 giây.
 */
export async function watchAccount(
  uid: string,
  onChange: () => void,
): Promise<PairingWatcher> {
  const db = await accountClient();
  let channel: { unsubscribe?: () => void } | null = null;
  const timer = setInterval(onChange, 20000);
  try {
    channel =
      db
        ?.channel(`pair-${uid}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${uid}`,
          },
          () => onChange(),
        )
        .subscribe() ?? null;
  } catch {
    channel = null;
  }
  return {
    stop: () => {
      clearInterval(timer);
      try {
        channel?.unsubscribe?.();
      } catch {}
    },
  };
}
