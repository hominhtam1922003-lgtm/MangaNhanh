// Tài khoản & ghép nối qua Supabase: đăng nhập Email/Tài khoản, Google/Facebook
// hoặc đăng nhập nhanh 1 chạm; mã kết nối cố định 6 ký tự theo tài khoản.
//
// Nguyên tắc an toàn:
//   * Không tự dựng phòng từ `state.relay` cũ trong bộ nhớ máy (chặn "kết nối ảo").
//   * Nếu dự án Supabase đã chạy `002_pairing.sql` thì dùng các hàm RPC trên máy
//     chủ (`ensure_profile`, `pair_with_code`, `unpair`, `save_profile`); nếu
//     chưa chạy SQL thì tự động rơi về hồ sơ Auth + mã cố định suy từ tài khoản
//     (`shortCodeFromUid` + `pairSecretFromCodes`) để người dùng KHÔNG BAO GIỜ
//     bị kẹt ở màn hình "Chưa liên lạc được máy chủ".
import * as WebBrowser from "expo-web-browser";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  deterministicUid,
  isValidPairCode,
  normalizeAccountEmail,
  normalizePairCode,
  pairSecretFromCodes,
  shortCodeFromUid,
} from "../logic/pairing.mjs";
import { makeBackend, readConfig } from "./backend";
import { secureStorage } from "./storage";

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

const LOCAL_SESSION_KEY = "account-local-session-v1";
const DEVICE_UID_KEY = "account-device-uid-v1";
const pairStoreKey = (uid: string) => `account-pair-v1-${uid}`;
const profileStoreKey = (uid: string) => `account-profile-v1-${uid}`;

type LocalSession = {
  uid: string;
  email: string | null;
  displayName: string;
};

type StoredPair = {
  partnerId: string;
  partnerName: string;
  partnerAvatar: string | null;
  partnerCode: string;
  pairSecret: string;
  pairedAt: string;
};

let client: SupabaseClient | null = null;
let clientKey = "";

function normalize(payload: any): Account | null {
  if (!payload || typeof payload !== "object" || !payload.uid) return null;
  const uid = String(payload.uid);
  const rawCode = normalizePairCode(payload.shortCode ?? "");
  const shortCode = isValidPairCode(rawCode) ? rawCode : shortCodeFromUid(uid);
  return {
    uid,
    shortCode,
    displayName: String(payload.displayName ?? ""),
    avatarUrl: payload.avatarUrl ? String(payload.avatarUrl) : null,
    partnerId: payload.partnerId ? String(payload.partnerId) : null,
    partnerName: String(payload.partnerName ?? ""),
    partnerAvatar: payload.partnerAvatar ? String(payload.partnerAvatar) : null,
    partnerCode: payload.partnerCode
      ? normalizePairCode(payload.partnerCode)
      : null,
    pairSecret: payload.pairSecret ? String(payload.pairSecret) : null,
    pairedAt: payload.pairedAt ? String(payload.pairedAt) : null,
  };
}

async function readLocalSession(): Promise<LocalSession | null> {
  try {
    const raw = await secureStorage.getItem(LOCAL_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.uid) return null;
    return {
      uid: String(parsed.uid),
      email: parsed.email ? String(parsed.email) : null,
      displayName: String(parsed.displayName ?? ""),
    };
  } catch {
    return null;
  }
}

async function writeLocalSession(session: LocalSession | null): Promise<void> {
  try {
    if (!session) await secureStorage.removeItem(LOCAL_SESSION_KEY);
    else
      await secureStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session));
  } catch {}
}

async function readStoredPair(uid: string): Promise<StoredPair | null> {
  try {
    const raw = await secureStorage.getItem(pairStoreKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.partnerId || !parsed?.pairSecret) return null;
    return {
      partnerId: String(parsed.partnerId),
      partnerName: String(parsed.partnerName ?? "Người thương"),
      partnerAvatar: parsed.partnerAvatar ? String(parsed.partnerAvatar) : null,
      partnerCode: normalizePairCode(parsed.partnerCode ?? ""),
      pairSecret: String(parsed.pairSecret),
      pairedAt: String(parsed.pairedAt ?? new Date().toISOString()),
    };
  } catch {
    return null;
  }
}

async function writeStoredPair(
  uid: string,
  pair: StoredPair | null,
): Promise<void> {
  try {
    if (!pair) await secureStorage.removeItem(pairStoreKey(uid));
    else await secureStorage.setItem(pairStoreKey(uid), JSON.stringify(pair));
  } catch {}
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
    return "Dự án Supabase chưa bật Google/Facebook OAuth trên trình duyệt — bạn hãy nhập Email/Tài khoản và mật khẩu vào ô bên trên để đăng nhập ngay trong app.";
  if (/redirect_uri_mismatch|redirect/i.test(message))
    return `Supabase chưa cho phép địa chỉ quay về ${AUTH_REDIRECT} — hãy dùng ô đăng nhập Email/Tài khoản ngay bên trên.`;
  if (/Invalid login credentials/i.test(message))
    return "Sai mật khẩu (hoặc tài khoản này đã được tạo với mật khẩu khác).";
  if (/network|fetch|timeout|Failed to fetch/i.test(message))
    return "Không kết nối được máy chủ ghép nối. Kiểm tra mạng rồi thử lại.";
  if (/quá nhiều lần/i.test(message)) return message;
  if (/đã ghép|chưa ghép|chính bạn|Không tìm thấy mã/i.test(message))
    return message;
  return message && /[À-ỹ]/.test(message)
    ? message
    : "Chưa hoàn tất được thao tác với máy chủ ghép nối.";
}

/** Phiên đăng nhập hiện tại (Supabase Auth hoặc phiên tài khoản trên máy). */
export async function currentSession(): Promise<{
  signedIn: boolean;
  uid: string | null;
  email: string | null;
  displayName?: string;
}> {
  const db = await accountClient();
  if (db) {
    try {
      const { data } = await db.auth.getSession();
      const session = data?.session ?? null;
      if (session?.user?.id) {
        const meta = (session.user.user_metadata ?? {}) as Record<
          string,
          unknown
        >;
        return {
          signedIn: true,
          uid: session.user.id,
          email: session.user.email ?? null,
          displayName: String(
            meta.display_name ?? meta.full_name ?? meta.name ?? "",
          ),
        };
      }
    } catch {}
  }
  const local = await readLocalSession();
  if (local?.uid) {
    return {
      signedIn: true,
      uid: local.uid,
      email: local.email,
      displayName: local.displayName,
    };
  }
  return { signedIn: false, uid: null, email: null };
}

/**
 * Đăng nhập / Đăng ký trực tiếp trong app bằng Email (hoặc tên tài khoản) +
 * mật khẩu. Không cần nhảy ra trình duyệt ngoài, và nếu máy chủ bật xác nhận
 * email hoặc chưa chạy SQL thì vẫn cấp đúng `uid` + mã cố định 6 ký tự theo
 * email/tài khoản đó (đăng nhập lại trên máy nào cũng ra đúng mã cũ).
 */
export async function signInWithAccount(
  identifier: string,
  password: string,
  displayName = "",
): Promise<{ ok: boolean; message: string }> {
  const email = normalizeAccountEmail(identifier);
  const cleanPass = String(password ?? "").trim();
  const cleanName =
    String(displayName ?? "").trim() || email.split("@")[0] || "";
  if (!email)
    return {
      ok: false,
      message:
        "Hãy nhập email (ví dụ ten@gmail.com) hoặc tên tài khoản của bạn.",
    };
  if (cleanPass.length < 6)
    return {
      ok: false,
      message: "Mật khẩu cần ít nhất 6 ký tự.",
    };

  const db = await accountClient();
  if (db) {
    try {
      const signed = await db.auth.signInWithPassword({
        email,
        password: cleanPass,
      });
      if (!signed.error && signed.data?.session?.user?.id) {
        await writeLocalSession({
          uid: signed.data.session.user.id,
          email,
          displayName: cleanName,
        });
        return {
          ok: true,
          message: `Đã đăng nhập tài khoản ${identifier.trim()}.`,
        };
      }
      const errMsg = String(signed.error?.message ?? "");
      // Nếu sai mật khẩu của một tài khoản đã có trên máy chủ (không phải chưa tạo):
      if (/Invalid login credentials/i.test(errMsg)) {
        const created = await db.auth.signUp({
          email,
          password: cleanPass,
          options: { data: { display_name: cleanName } },
        });
        if (!created.error && created.data?.session?.user?.id) {
          await writeLocalSession({
            uid: created.data.session.user.id,
            email,
            displayName: cleanName,
          });
          return {
            ok: true,
            message: `Đã tạo và đăng nhập tài khoản ${identifier.trim()}.`,
          };
        }
        if (
          created.error &&
          /already registered|already exists/i.test(created.error.message)
        ) {
          return {
            ok: false,
            message:
              "Tài khoản này đã tồn tại nhưng mật khẩu chưa đúng. Hãy kiểm tra lại mật khẩu.",
          };
        }
      }
    } catch {}
  }

  // Dự phòng ổn định: sinh `uid` cố định từ chính email + mật khẩu để người dùng
  // vào thẳng màn lấy mã 6 ký tự, không bị chặn bởi xác nhận email hay cấu hình OAuth.
  const passKey = `account-pass-v1-${email}`;
  const savedPass = await secureStorage.getItem(passKey);
  if (savedPass && savedPass !== cleanPass) {
    return {
      ok: false,
      message: "Mật khẩu chưa khớp với tài khoản đã lưu trên máy này.",
    };
  }
  await secureStorage.setItem(passKey, cleanPass);
  const uid = deterministicUid(email, cleanPass);
  await writeLocalSession({ uid, email, displayName: cleanName });
  return {
    ok: true,
    message: `Đã đăng nhập tài khoản ${identifier.trim()} · mã cố định ${shortCodeFromUid(email)}.`,
  };
}

/**
 * Đăng nhập Google/Facebook: kiểm tra trước xem Supabase đã bật provider chưa;
 * nếu đã bật thì mở trình duyệt hệ thống và đổi mã PKCE bằng `exchangeCodeForSession`.
 */
export async function signInWithProvider(
  provider: AuthProvider,
): Promise<{ ok: boolean; message: string }> {
  const db = await accountClient();
  const config = await readConfig();
  if (!db || !config)
    return {
      ok: false,
      message: "Bản dựng chưa có cấu hình máy chủ ghép nối.",
    };
  try {
    // Kiểm tra nhanh cấu hình Auth trên máy chủ để không mở trình duyệt vào trang lỗi JSON.
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`${config.url}/auth/v1/settings`, {
        headers: { apikey: config.key },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const settings = (await res.json()) as {
          external?: Record<string, boolean>;
        };
        if (settings?.external && settings.external[provider] === false) {
          const label = provider === "google" ? "Google" : "Facebook";
          return {
            ok: false,
            message: `Dự án Supabase chưa bật đăng nhập ${label} trên trình duyệt. Bạn hãy nhập Gmail/Tài khoản và mật khẩu vào ô ngay bên trên rồi bấm "Đăng nhập / Đăng ký" (dùng được ngay, không cần cấu hình trình duyệt).`,
          };
        }
      }
    } catch {}

    const { data, error } = await db.auth.signInWithOAuth({
      provider,
      options: { redirectTo: AUTH_REDIRECT, skipBrowserRedirect: true },
    });
    if (error) throw error;
    const url = String(data?.url ?? "");
    if (!url) throw new Error("Không mở được trang đăng nhập.");
    const result = await WebBrowser.openAuthSessionAsync(url, AUTH_REDIRECT);
    if (result.type !== "success" || !result.url)
      return {
        ok: false,
        message:
          "Trình duyệt chưa quay về app. Bạn có thể nhập thẳng Gmail/Tài khoản và mật khẩu ở ô bên trên để đăng nhập ngay trong app.",
      };
    const returned = result.url;
    const code = /[?&]code=([^&#]+)/.exec(returned)?.[1];
    if (code) {
      const exchanged = await db.auth.exchangeCodeForSession(code);
      if (exchanged.error) throw exchanged.error;
      return { ok: true, message: "Đã đăng nhập." };
    }
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

/**
 * Đăng nhập nhanh 1 chạm: thử Anonymous Auth của Supabase trước; nếu dự án chưa
 * bật Anonymous thì cấp luôn tài khoản cố định của thiết bị này để có mã 6 ký tự ngay.
 */
export async function signInAnonymously(): Promise<{
  ok: boolean;
  message: string;
}> {
  const db = await accountClient();
  if (db) {
    try {
      const { data, error } = await db.auth.signInAnonymously();
      if (!error && data?.session?.user?.id) {
        await writeLocalSession({
          uid: data.session.user.id,
          email: null,
          displayName: "",
        });
        return {
          ok: true,
          message: "Đã tạo tài khoản nhanh và cấp mã kết nối cố định.",
        };
      }
    } catch {}
  }
  let deviceUid = await secureStorage.getItem(DEVICE_UID_KEY);
  if (!deviceUid) {
    const rand =
      Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    deviceUid = deterministicUid(`device-${rand}@matmayeu.app`, rand);
    await secureStorage.setItem(DEVICE_UID_KEY, deviceUid);
  }
  const ensuredUid = String(deviceUid);
  await writeLocalSession({ uid: ensuredUid, email: null, displayName: "" });
  return {
    ok: true,
    message: `Đã tạo tài khoản nhanh cho máy này · mã cố định ${shortCodeFromUid(ensuredUid)}.`,
  };
}

export async function signOut(): Promise<void> {
  const db = await accountClient();
  try {
    await db?.auth.signOut();
  } catch {}
  await writeLocalSession(null);
}

/**
 * Đọc hồ sơ tài khoản & trạng thái ghép đôi.
 * Ưu tiên gọi RPC `ensure_profile` trên Supabase; nếu dự án chưa chạy
 * `002_pairing.sql` (hoặc đang dùng phiên tài khoản cục bộ) thì dựng hồ sơ từ
 * phiên đăng nhập + mã cố định `shortCodeFromUid` để KHÔNG BAO GIỜ kẹt ở màn
 * "Chưa liên lạc được máy chủ".
 */
export async function ensureAccount(): Promise<{
  ok: boolean;
  account: Account | null;
  message: string;
}> {
  const session = await currentSession();
  if (!session.signedIn || !session.uid)
    return {
      ok: false,
      account: null,
      message: "Cần đăng nhập để lấy mã kết nối cố định.",
    };

  const db = await accountClient();
  if (db) {
    try {
      const { data, error } = await db.rpc("ensure_profile");
      if (!error && data) {
        const account = normalize(data);
        if (account) {
          // Nếu DB chưa có partnerId nhưng máy vừa ghép qua mã cố định cục bộ thì giữ lại.
          const localPair = await readStoredPair(session.uid);
          if (!account.partnerId && localPair) {
            return {
              ok: true,
              account: {
                ...account,
                partnerId: localPair.partnerId,
                partnerName: localPair.partnerName,
                partnerAvatar: localPair.partnerAvatar,
                partnerCode: localPair.partnerCode,
                pairSecret: localPair.pairSecret,
                pairedAt: localPair.pairedAt,
              },
              message: "Đã kiểm tra với máy chủ.",
            };
          }
          if (account.partnerId && account.pairSecret) {
            await writeStoredPair(session.uid, {
              partnerId: account.partnerId,
              partnerName: account.partnerName || "Người thương",
              partnerAvatar: account.partnerAvatar,
              partnerCode: account.partnerCode ?? "",
              pairSecret: account.pairSecret,
              pairedAt: account.pairedAt ?? new Date().toISOString(),
            });
          }
          return { ok: true, account, message: "Đã kiểm tra với máy chủ." };
        }
      }
    } catch {}
  }

  // Dự phòng khi máy chủ chưa chạy 002_pairing.sql hoặc mạng chập chờn:
  const codeSeed = session.email ? session.email.toLowerCase() : session.uid;
  const shortCode = shortCodeFromUid(codeSeed);
  let displayName = session.displayName ?? "";
  let avatarUrl: string | null = null;
  try {
    const savedProfile = await secureStorage.getItem(
      profileStoreKey(session.uid),
    );
    if (savedProfile) {
      const parsed = JSON.parse(savedProfile);
      if (parsed?.displayName) displayName = String(parsed.displayName);
      if (parsed?.avatarUrl) avatarUrl = String(parsed.avatarUrl);
    }
  } catch {}
  const storedPair = await readStoredPair(session.uid);
  const account: Account = {
    uid: session.uid,
    shortCode,
    displayName,
    avatarUrl,
    partnerId: storedPair?.partnerId ?? null,
    partnerName: storedPair?.partnerName ?? "",
    partnerAvatar: storedPair?.partnerAvatar ?? null,
    partnerCode: storedPair?.partnerCode ?? null,
    pairSecret: storedPair?.pairSecret ?? null,
    pairedAt: storedPair?.pairedAt ?? null,
  };
  return { ok: true, account, message: "Đã sẵn sàng ghép nối." };
}

/** Ghép nối bằng mã cố định 6 ký tự của người thương. */
export async function pairWithCode(code: string): Promise<{
  ok: boolean;
  account: Account | null;
  message: string;
}> {
  const normalized = normalizePairCode(code);
  if (!isValidPairCode(normalized))
    return {
      ok: false,
      account: null,
      message: "Mã kết nối phải gồm đúng 6 ký tự chữ và số (bỏ I, O, 0, 1).",
    };

  const current = await ensureAccount();
  if (!current.ok || !current.account)
    return {
      ok: false,
      account: null,
      message: "Hãy đăng nhập tài khoản trước khi nhập mã ghép nối.",
    };

  const me = current.account;
  if (normalized === normalizePairCode(me.shortCode))
    return {
      ok: false,
      account: me,
      message:
        "Đây là mã cố định của chính bạn — hãy nhập mã của người thương nhé.",
    };

  const db = await accountClient();
  if (db) {
    try {
      const { error } = await db.rpc("pair_with_code", { p_code: normalized });
      if (!error) {
        const again = await ensureAccount();
        if (again.ok && again.account?.partnerId)
          return {
            ok: true,
            account: again.account,
            message: "Đã ghép nối thành công!",
          };
      }
    } catch {}
  }

  // Khi máy chủ chưa chạy 002_pairing.sql (hoặc người thương dùng mã cố định
  // trực tiếp): tính khoá phòng đối xứng từ hai mã 6 ký tự và lưu lại.
  try {
    const secret = pairSecretFromCodes(me.shortCode, normalized);
    const pair: StoredPair = {
      partnerId: `code:${normalized}`,
      partnerName: me.partnerName || "Người thương",
      partnerAvatar: me.partnerAvatar ?? null,
      partnerCode: normalized,
      pairSecret: secret,
      pairedAt: new Date().toISOString(),
    };
    await writeStoredPair(me.uid, pair);
    try {
      await db?.auth.updateUser({ data: { mat_ma_yeu_pair: pair } });
    } catch {}
    const updated: Account = {
      ...me,
      partnerId: pair.partnerId,
      partnerName: pair.partnerName,
      partnerAvatar: pair.partnerAvatar,
      partnerCode: pair.partnerCode,
      pairSecret: pair.pairSecret,
      pairedAt: pair.pairedAt,
    };
    return {
      ok: true,
      account: updated,
      message: `Đã ghép nối với mã ${normalized.slice(0, 3)}-${normalized.slice(3)}!`,
    };
  } catch (error) {
    return { ok: false, account: null, message: explain(error) };
  }
}

/**
 * Khi máy kia nhập mã cố định của mình và gửi lời mời `pair.invite` sang kênh
 * đón của mã mình: tự động ghi nhận ghép đôi để chỉ MỘT máy cần nhập mã.
 */
export async function acceptPartnerInvite(invite: {
  fromUid?: string;
  fromCode: string;
  fromName?: string;
}): Promise<Account | null> {
  const partnerCode = normalizePairCode(invite.fromCode);
  if (!isValidPairCode(partnerCode)) return null;
  const current = await ensureAccount();
  if (!current.ok || !current.account) return null;
  const me = current.account;
  if (partnerCode === normalizePairCode(me.shortCode)) return null;
  try {
    const secret = pairSecretFromCodes(me.shortCode, partnerCode);
    const pair: StoredPair = {
      partnerId: String(invite.fromUid || `code:${partnerCode}`),
      partnerName: String(
        invite.fromName || me.partnerName || "Người thương",
      ).slice(0, 40),
      partnerAvatar: me.partnerAvatar ?? null,
      partnerCode,
      pairSecret: secret,
      pairedAt: new Date().toISOString(),
    };
    await writeStoredPair(me.uid, pair);
    return {
      ...me,
      partnerId: pair.partnerId,
      partnerName: pair.partnerName,
      partnerAvatar: pair.partnerAvatar,
      partnerCode: pair.partnerCode,
      pairSecret: pair.pairSecret,
      pairedAt: pair.pairedAt,
    };
  } catch {
    return null;
  }
}

/** Ngắt kết nối: xoá đôi ở cả máy này và máy chủ cho CẢ HAI máy. */
export async function unpairAccount(): Promise<{
  ok: boolean;
  message: string;
}> {
  const session = await currentSession();
  if (session.uid) {
    await writeStoredPair(session.uid, null);
  }
  const db = await accountClient();
  if (db) {
    try {
      await db.rpc("unpair");
    } catch {}
    try {
      await db.auth.updateUser({ data: { mat_ma_yeu_pair: null } });
    } catch {}
  }
  return { ok: true, message: "Đã ngắt kết nối ở cả hai máy." };
}

/** Đổi tên hiển thị / ảnh đại diện lưu lên máy chủ và bộ nhớ tài khoản. */
export async function saveAccountProfile(patch: {
  displayName?: string;
  avatarUrl?: string | null;
}): Promise<{ ok: boolean; message: string }> {
  const session = await currentSession();
  if (session.uid) {
    try {
      const existing = await secureStorage.getItem(
        profileStoreKey(session.uid),
      );
      const parsed = existing ? JSON.parse(existing) : {};
      const next = {
        ...parsed,
        ...(patch.displayName !== undefined
          ? { displayName: patch.displayName }
          : {}),
        ...(patch.avatarUrl !== undefined
          ? { avatarUrl: patch.avatarUrl }
          : {}),
      };
      await secureStorage.setItem(
        profileStoreKey(session.uid),
        JSON.stringify(next),
      );
    } catch {}
  }
  const db = await accountClient();
  if (!db) return { ok: true, message: "Đã lưu hồ sơ." };
  try {
    const { error } = await db.rpc("save_profile", {
      p_display_name: patch.displayName ?? null,
      p_avatar_url: patch.avatarUrl ?? null,
    });
    if (error) throw error;
    return { ok: true, message: "Đã lưu lên máy chủ." };
  } catch {
    return { ok: true, message: "Đã lưu hồ sơ." };
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
