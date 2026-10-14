// Truyền ảnh khoảnh khắc giữa hai máy qua kênh kết nối tức thời:
// ảnh nén nhỏ được cắt thành nhiều gói, gói nào cũng được mã hóa như các gói khác,
// máy nhận ghép lại thành ảnh hoàn chỉnh. Không cần máy chủ ảnh nào cả.
export const CHUNK_SIZE = 3500;
export const MAX_PHOTO_CHUNKS = 200;
export const PHOTO_LIMIT_BYTES = 120 * 1024;
/** Ảnh nền cần rộng hơn ảnh khoảnh khắc nên cho phép gói lớn hơn một chút. */
export const WALLPAPER_LIMIT_BYTES = 420 * 1024;
/** Tin thoại 25 giây (AAC) thường dưới 300 KB — cho hạn mức riêng để không bị
 * cắt như ảnh khoảnh khắc. */
export const VOICE_LIMIT_BYTES = 420 * 1024;
/** Cắt ảnh base64 thành các gói tin gửi qua kênh kết nối. */
export function photoMessages(photo, chunkSize = CHUNK_SIZE) {
  const base64 = String(photo?.base64 ?? "").replace(/\s+/g, "");
  if (!photo?.id) throw new Error("Ảnh cần có mã để hai máy ghép lại.");
  if (!base64) throw new Error("Ảnh rỗng nên không gửi được.");
  const total = Math.ceil(base64.length / chunkSize);
  if (total > MAX_PHOTO_CHUNKS)
    throw new Error("Ảnh quá lớn để gửi tức thời, hãy chọn ảnh nhỏ hơn.");
  const messages = [];
  for (let index = 0; index < total; index++) {
    messages.push({
      kind: "photo",
      id: String(photo.id),
      index,
      total,
      data: base64.slice(index * chunkSize, (index + 1) * chunkSize),
      meta: {
        caption: String(photo.caption ?? "").slice(0, 120),
        createdAt: String(photo.createdAt ?? new Date().toISOString()),
        nickname: String(photo.nickname ?? "").slice(0, 40),
        width: Number(photo.width) || 0,
        height: Number(photo.height) || 0,
        // Ảnh nền dùng chung thì gửi kèm role + mã bản giao diện để máy kia
        // biết ảnh này thuộc bản nào (ảnh khoảnh khắc để trống).
        role:
          photo.role === "wallpaper"
            ? "wallpaper"
            : photo.role === "voice"
              ? "voice"
              : "moment",
        wallpaperId: String(photo.wallpaperId ?? "").slice(0, 60),
        voiceId: String(photo.voiceId ?? "").slice(0, 60),
        durationMs: Math.min(
          120000,
          Math.max(0, Number(photo.durationMs) || 0),
        ),
      },
    });
  }
  return messages;
}
/** Ghép các gói ảnh về thành một ảnh; bỏ qua gói trùng, tự bỏ ảnh dở dang. */
export class PhotoAssembler {
  constructor(options = {}) {
    this.parts = new Map();
    this.done = new Set();
    this.ttl = options.ttl ?? 5 * 60 * 1000;
  }
  add(message) {
    if (!message || message.kind !== "photo") return null;
    const id = String(message.id ?? "");
    const total = Number(message.total) || 0;
    const index = Number(message.index);
    if (!id || total <= 0 || index < 0 || index >= total) return null;
    if (this.done.has(id)) return null;
    let entry = this.parts.get(id);
    if (!entry) {
      entry = {
        total,
        meta: message.meta ?? {},
        chunks: new Array(total).fill(null),
        filled: 0,
        startedAt: Date.now(),
      };
      this.parts.set(id, entry);
    }
    if (entry.total !== total) return null;
    if (entry.chunks[index] != null) return null;
    entry.chunks[index] = String(message.data ?? "");
    entry.filled += 1;
    entry.touchedAt = Date.now();
    if (entry.filled < entry.total) {
      this.cleanup();
      return null;
    }
    const base64 = entry.chunks.join("");
    this.parts.delete(id);
    this.done.add(id);
    if (this.done.size > 200) this.done.clear();
    return { id, base64, meta: entry.meta };
  }
  get pendingCount() {
    return this.parts.size;
  }
  cleanup(now = Date.now()) {
    for (const [id, entry] of this.parts)
      if (now - (entry.touchedAt ?? entry.startedAt) > this.ttl)
        this.parts.delete(id);
  }
  forget(id) {
    this.parts.delete(String(id));
  }
}
/** Danh sách khoảnh khắc của mình để gửi kèm trong mỗi lần đồng bộ. */
export function momentsForRelay(moments, limit = 40) {
  return (Array.isArray(moments) ? moments : [])
    .filter((moment) => moment && moment.authorId !== "partner")
    .slice(0, limit)
    .map((moment) => ({
      id: String(moment.id),
      caption: String(moment.caption ?? "").slice(0, 120),
      createdAt: String(moment.createdAt ?? ""),
      hasFile: Boolean(moment.file),
    }));
}
/** Những ảnh của người thương mà máy này còn thiếu (để xin gửi lại). */
export function missingPhotoIds(moments, hasFile, limit = 3) {
  return (Array.isArray(moments) ? moments : [])
    .filter(
      (moment) =>
        moment &&
        moment.authorId === "partner" &&
        typeof hasFile === "function" &&
        !hasFile(moment),
    )
    .slice(0, limit)
    .map((moment) => String(moment.id));
}
/** Tin thoại của người thương mà máy này chưa có tệp: xin máy kia gửi lại. */
export function missingVoiceIds(messages, hasFile, limit = 3) {
  return (Array.isArray(messages) ? messages : [])
    .filter(
      (message) =>
        message &&
        message.authorId === "partner" &&
        message.kind === "voice" &&
        typeof hasFile === "function" &&
        !hasFile(message),
    )
    .slice(0, limit)
    .map((message) => String(message.id));
}
