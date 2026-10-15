import { Directory, File, Paths } from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { emptyState, migrate } from "../logic/localState.mjs";
import type { PetState } from "../logic/pet.mjs";
export type Profile = {
  id: string;
  nickname: string;
  mood: string;
  moodNote: string;
  avatar: string | null;
  updatedAt: string;
  appVersion?: string;
};
export type CycleRecord = {
  lastPeriod: string;
  cycleLength: number;
  periodLength: number;
  reminders: boolean;
  updatedAt: string;
};
export type DiaryEntry = {
  id: string;
  authorId: string;
  title: string;
  body: string;
  image: string | null;
  createdAt: string;
  updatedAt: string;
};
export type AlertRecord = {
  id: string;
  key: string | null;
  title: string;
  body: string;
  category: string;
  createdAt: string;
  readAt: string | null;
};
export type State = {
  version: number;
  me: Profile;
  partner: Profile | null;
  anniversary: string;
  timezone: string;
  cycle: CycleRecord | null;
  diary: DiaryEntry[];
  alerts: AlertRecord[];
  settings: {
    biometric: boolean;
    notify: boolean;
    relay: boolean;
    loveNotes: boolean;
    theme: string;
    /** Độ đậm lớp phủ trên ảnh nền: 0,3 = ảnh rõ · 0,75 = chữ rõ. */
    wallpaperTint?: number;
    /** Cho người thương biết mình đã xem tin chưa. */
    readReceipts?: boolean;
    /** Tự gửi lời yêu/thơ mỗi 2 tiếng (07:00–22:00). */
    autoLove?: boolean;
    /** Nhắc khi mình chưa trả lời người thương. */
    replyNudge?: boolean;
    /** Nhạc chuông riêng lấy từ thư viện nhạc trong máy (tên tệp đã lưu). */
    ringtone?: string;
    /** Tên bài nhạc chuông để hiện trong Cài đặt. */
    ringtoneName?: string;
    /** Mẫu ảnh nền cuộc gọi ("sunset-love" | "starry-night" | "cherry-blossom" | "ocean-breeze" | "custom"). */
    callBgId?: string;
    /** Tệp ảnh đôi tự chọn làm ảnh nền cuộc gọi (nằm trong thư mục ảnh của app). */
    callBgFile?: string;
    /** Giữ kết nối khi app ở nền để tin nhắn vẫn nổi thông báo (Android). */
    keepAlive?: boolean;
  };
  /** Mốc lần cuối tự gửi lời yêu, để không gửi dồn. */
  autoLoveAt?: number;
  moments: {
    id: string;
    authorId: string;
    caption: string;
    file: string | null;
    createdAt: string;
    sentAt: string | null;
    receivedAt: string | null;
  }[];
  relay: {
    id: string;
    key: string;
    mode: string;
    code: string | null;
    role: string;
  } | null;
  links: { id: string; name: string; linkedAt: string }[];
  messages: {
    id: string;
    authorId: string;
    kind: string;
    body: string;
    /** Ảnh gửi trong đoạn chat (tên tệp trong thư mục riêng của app). */
    photo?: string | null;
    lat?: number | null;
    lng?: number | null;
    place?: string;
    audio: string | null;
    durationMs: number;
    createdAt: string;
    sentAt: string | null;
    deliveredAt: string | null;
    receivedAt: string | null;
    readAt: string | null;
    /** Thả cảm xúc: `me` là của bạn, `them` là của người thương. */
    react?: { me: string | null; them: string | null };
    /** Thu hồi: có mốc này là tin đã bị xoá ở cả hai máy. */
    recalledAt?: string | null;
    /** Trả lời trích dẫn: `mine` = tin được trích dẫn là của máy này. */
    reply?: { id: string; body: string; mine: boolean } | null;
  }[];
  appearance: {
    theme: string;
    wallpaper: string | null;
    wallpaperId: string | null;
    updatedAt: string;
    by: string;
  };
  /** Thú cưng ảo chung của hai người (Couple Pet). */
  pet?: PetState;
};
const stateFile = () => new File(Paths.document, "love-state.json");
const backupKey = "love-state-backup";
export function imagesDirectory() {
  const directory = new Directory(Paths.document, "images");
  if (!directory.exists)
    directory.create({ intermediates: true, idempotent: true });
  return directory;
}
export function imageUri(name: string | null | undefined) {
  return name ? new File(imagesDirectory(), name).uri : null;
}
/** Ảnh đã có thật trên máy chưa (dùng để biết còn phải xin máy kia gửi không). */
export function imageExists(name: string | null | undefined) {
  if (!name) return false;
  try {
    return new File(imagesDirectory(), name).exists;
  } catch {
    return false;
  }
}
export function saveImage(sourceUri: string, name: string) {
  const destination = new File(imagesDirectory(), name);
  if (destination.exists) destination.delete();
  new File(sourceUri).copy(destination);
  return name;
}
export function deleteImage(name: string | null | undefined) {
  if (!name) return;
  const file = new File(imagesDirectory(), name);
  if (file.exists) file.delete();
}
export function imageBase64(name: string | null | undefined, limit: number) {
  if (!name) return null;
  try {
    const file = new File(imagesDirectory(), name);
    if (!file.exists || file.size > limit) return null;
    return file.base64Sync();
  } catch {
    return null;
  }
}
export function writeBase64(name: string, value: string) {
  const file = new File(imagesDirectory(), name);
  file.write(value, { encoding: "base64" });
  return name;
}
export async function loadState(): Promise<State> {
  const file = stateFile();
  if (file.exists) {
    try {
      return migrate(JSON.parse(await file.text())) as State;
    } catch {
      const fallback = await AsyncStorage.getItem(backupKey);
      if (fallback) {
        try {
          return migrate(JSON.parse(fallback)) as State;
        } catch {}
      }
    }
  } else {
    const fallback = await AsyncStorage.getItem(backupKey);
    if (fallback) {
      try {
        return migrate(JSON.parse(fallback)) as State;
      } catch {}
    }
  }
  return emptyState() as State;
}
export async function persistState(state: State) {
  const text = JSON.stringify(state);
  let fileError: unknown = null;
  try {
    stateFile().write(text);
  } catch (error) {
    fileError = error;
  }
  try {
    await AsyncStorage.setItem(backupKey, text);
  } catch (error) {
    if (fileError) throw new Error("Không ghi được dữ liệu vào bộ nhớ máy.");
    throw error;
  }
  return fileError
    ? "Chỉ ghi được bản sao lưu; tệp dữ liệu chính bị lỗi."
    : null;
}
export async function clearLocalData() {
  const file = stateFile();
  if (file.exists) file.delete();
  await AsyncStorage.multiRemove([backupKey, "biometric-lock", "push-token"]);
  const directory = new Directory(Paths.document, "images");
  if (directory.exists) directory.delete();
}
