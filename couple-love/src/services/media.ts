/**
 * Ảnh trong máy: chọn ảnh để gửi (thư viện ảnh hệ thống) và LƯU ảnh người
 * thương gửi về máy mình.
 *
 * Vì sao không dùng hộp chọn ảnh của expo-image-picker nữa: trên Android, hộp
 * chọn ảnh của hệ thống gắn với Activity và từng lỗi "Attempting to launch an
 * unregistered ActivityResultLauncher" (Activity bị Android huỷ/tạo lại khi đổi
 * cỡ chữ, đổi ngôn ngữ, đổi sáng/tối) — người dùng chỉ còn cách khởi động lại
 * app. App chuyển sang **tự hiện thư viện ảnh trong app** (xem
 * components/PhotoPicker.tsx) và tự chụp ảnh bằng expo-camera: không còn hộp
 * thoại hệ thống nào để hỏng, và cũng nhanh hơn vì không phải chuyển app.
 *
 * Tệp ở đây chỉ lo phần đọc danh sách ảnh + xin quyền + lưu ảnh về máy.
 */
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { File } from "expo-file-system";

export type GalleryAsset = {
  id: string;
  uri: string;
  width: number;
  height: number;
  createdAt?: string;
};

export type GalleryPage = {
  assets: GalleryAsset[];
  endCursor: string | null;
  hasNext: boolean;
};

function library(): typeof MediaLibrary | null {
  try {
    // Thư viện thiếu (bản build cũ) thì trả null để giao diện báo tử tế.
    return typeof MediaLibrary?.getAssetsAsync === "function"
      ? MediaLibrary
      : null;
  } catch {
    return null;
  }
}

export function mediaSupport() {
  const lib = library();
  return {
    ok: Boolean(lib),
    detail: lib
      ? "máy này đọc được thư viện ảnh"
      : "bản app này chưa có thư viện ảnh",
  };
}

/** Xin quyền đọc ảnh (Android 13+ là "Ảnh", Android cũ là bộ nhớ). */
export async function askGalleryPermission(): Promise<boolean> {
  const lib = library();
  if (!lib) return false;
  try {
    const current = await lib.getPermissionsAsync(false, ["photo"]);
    if (current.granted || current.accessPrivileges === "limited") return true;
    const asked = await lib.requestPermissionsAsync(false, ["photo"]);
    return Boolean(asked.granted || asked.accessPrivileges === "limited");
  } catch {
    return false;
  }
}

/** Đọc một trang ảnh mới nhất trong máy (mặc định 60 ảnh). */
export async function listPhotos(
  after?: string | null,
  first = 60,
): Promise<GalleryPage> {
  const lib = library();
  if (!lib) return { assets: [], endCursor: null, hasNext: false };
  try {
    const page = await lib.getAssetsAsync({
      mediaType: "photo",
      sortBy: [["creationTime", false]],
      first,
      ...(after ? { after } : {}),
    });
    return {
      assets: (page.assets ?? []).map((asset: MediaLibrary.Asset) => ({
        id: String(asset.id),
        uri: String(asset.uri),
        width: Number(asset.width) || 0,
        height: Number(asset.height) || 0,
        createdAt: asset.creationTime
          ? new Date(asset.creationTime).toISOString()
          : undefined,
      })),
      endCursor: page.endCursor ? String(page.endCursor) : null,
      hasNext: Boolean(page.hasNextPage),
    };
  } catch {
    return { assets: [], endCursor: null, hasNext: false };
  }
}

export type SaveResult = { ok: boolean; detail: string };

/**
 * Lưu một ảnh trong thư mục riêng của app vào thư viện ảnh của máy.
 * Không lưu được (máy thiếu quyền / thiếu thư viện) thì mở bảng chia sẻ để người
 * dùng tự chọn "Lưu vào thiết bị".
 */
export async function savePhotoToDevice(
  sourceUri: string | null | undefined,
  filename?: string,
): Promise<SaveResult> {
  if (!sourceUri)
    return { ok: false, detail: "Ảnh này chưa có trên máy, chờ một chút nhé." };
  try {
    if (!new File(sourceUri).exists)
      return { ok: false, detail: "Không thấy tệp ảnh trên máy." };
  } catch {
    return { ok: false, detail: "Không đọc được tệp ảnh." };
  }
  const lib = library();
  if (lib) {
    try {
      const permission = await lib.requestPermissionsAsync(true, ["photo"]);
      if (permission.granted || permission.accessPrivileges)
        await lib.saveToLibraryAsync(sourceUri);
      return {
        ok: true,
        detail: filename
          ? `Đã lưu ${filename} vào thư viện ảnh`
          : "Đã lưu vào thư viện ảnh",
      };
    } catch {}
  }
  try {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(sourceUri, {
        dialogTitle: "Lưu ảnh về máy",
        mimeType: "image/jpeg",
      });
      return {
        ok: true,
        detail: "Chọn “Lưu vào thiết bị” trong bảng vừa hiện để lưu ảnh.",
      };
    }
  } catch {}
  return {
    ok: false,
    detail: "Máy này chưa lưu được ảnh. Hãy chụp màn hình để giữ ảnh nhé.",
  };
}
