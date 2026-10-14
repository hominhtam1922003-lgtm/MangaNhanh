// Ghi lại lỗi gần nhất để người dùng đọc được ngay trong app (thay vì app văng im lặng).
import AsyncStorage from "@react-native-async-storage/async-storage";
const storageKey = "love-local-crash";
const clean = (text: string) =>
  String(text).replace(/\s+/g, " ").trim().slice(0, 1200);
export async function saveCrash(text: string) {
  const line = `${new Date().toISOString()} · ${clean(text)}`;
  try {
    const old = (await AsyncStorage.getItem(storageKey)) ?? "";
    await AsyncStorage.setItem(
      storageKey,
      [line, old].join("\n").slice(0, 3000),
    );
  } catch {}
  return line;
}
export async function readCrash(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(storageKey)) ?? "";
  } catch {
    return "";
  }
}
export async function clearCrash() {
  try {
    await AsyncStorage.removeItem(storageKey);
  } catch {}
}
/** Mô tả ngắn gọn một lỗi bất kỳ, luôn bằng tiếng Việt và có tên lỗi. */
export function describe(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Lỗi không rõ";
  }
}
