import * as ImagePicker from "expo-image-picker";
import * as Manipulator from "expo-image-manipulator";
import * as Crypto from "expo-crypto";
import { SupabaseClient } from "@supabase/supabase-js";
export async function uploadPhoto(db: SupabaseClient, prefix: string) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error("Cần quyền chọn ảnh từ thư viện.");
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    quality: 0.8,
  });
  if (result.canceled) return null;
  const processed = await Manipulator.manipulateAsync(
    result.assets[0].uri,
    [{ resize: { width: 900 } }],
    { compress: 0.75, format: Manipulator.SaveFormat.JPEG },
  );
  const bytes = await (await fetch(processed.uri)).arrayBuffer();
  if (bytes.byteLength > 2097152)
    throw new Error("Ảnh vượt 2 MB sau khi xử lý. Hãy chọn ảnh nhỏ hơn.");
  const path = prefix + "/" + Crypto.randomUUID() + ".jpg";
  const saved = await db.storage
    .from("love-assets")
    .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (saved.error) throw saved.error;
  return path;
}
