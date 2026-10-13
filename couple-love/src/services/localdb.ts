import { Directory, File, Paths } from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { emptyState, migrate } from "../logic/localState.mjs";
export type Profile = {
  id: string;
  nickname: string;
  mood: string;
  moodNote: string;
  avatar: string | null;
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
  settings: { biometric: boolean; notify: boolean };
  links: { id: string; name: string; linkedAt: string }[];
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
