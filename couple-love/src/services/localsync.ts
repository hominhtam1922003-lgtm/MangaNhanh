import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { decodeLink, encodeLink, splitCode } from "../logic/localState.mjs";
import type { State } from "./localdb";
import { imageBase64, writeBase64 } from "./localdb";
const MAX_IMAGE_BYTES = 400 * 1024;
const MAX_TOTAL_BASE64 = 6 * 1024 * 1024;
export function buildLink(
  state: State,
  full: boolean,
  images: Record<string, string>,
) {
  return encodeLink(state, full ? "full" : "link", images);
}
export function collectImages(state: State) {
  const images: Record<string, string> = {};
  let total = 0;
  let skipped = 0;
  const avatar = imageBase64(state.me.avatar, MAX_IMAGE_BYTES);
  if (avatar) {
    images.avatar = avatar;
    total += avatar.length;
  } else if (state.me.avatar) skipped += 1;
  for (const entry of state.diary) {
    if (!entry.image) continue;
    const data = imageBase64(entry.image, MAX_IMAGE_BYTES);
    if (!data || data.length + total > MAX_TOTAL_BASE64) {
      skipped += 1;
      continue;
    }
    images[entry.id] = data;
    total += data.length;
  }
  return { images, skipped };
}
export function linkCode(state: State) {
  return buildLink(state, false, {});
}
export function codeChunks(code: string) {
  return splitCode(code, 900);
}
export async function exportBackup(state: State) {
  const { images, skipped } = collectImages(state);
  const code = buildLink(state, true, images);
  const file = new File(
    Paths.cache,
    `MatMaYeu-${new Date().toISOString().slice(0, 10)}.json`,
  );
  if (file.exists) file.delete();
  file.write(code);
  return { uri: file.uri, size: file.size ?? 0, skipped };
}
export async function shareBackup(uri: string) {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("Thiết bị này không có bảng chia sẻ tệp.");
  await Sharing.shareAsync(uri, {
    mimeType: "application/json",
    dialogTitle: "Chia sẻ dữ liệu Mật Mã Yêu",
    UTI: "public.json",
  });
}
export async function pickBackupFile() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "text/plain", "*/*"],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.length) return null;
  return new File(result.assets[0].uri).text();
}
export function importPayload(text: string) {
  const payload = decodeLink(String(text ?? "").trim());
  let images = 0;
  for (const [key, value] of Object.entries(payload.images ?? {})) {
    if (typeof value !== "string" || value.length > MAX_TOTAL_BASE64) continue;
    try {
      if (key === "avatar")
        payload.from.avatar = writeBase64("partner-avatar.jpg", value);
      else writeBase64(`diary-${key}.jpg`, value);
      images += 1;
    } catch {}
  }
  return {
    payload,
    images,
    diaryCount: Array.isArray(payload.diary) ? payload.diary.length : 0,
  };
}
