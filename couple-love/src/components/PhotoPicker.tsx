import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useTheme } from "../theme/ThemeContext";
import {
  askGalleryPermission,
  listPhotos,
  mediaSupport,
  type GalleryAsset,
} from "../services/media";

/**
 * Chọn ảnh NGAY TRONG APP: một tab là thư viện ảnh trong máy (lưới ảnh), một tab
 * là máy ảnh chụp tại chỗ.
 *
 * Vì sao không dùng hộp chọn ảnh của hệ thống (expo-image-picker) nữa: trên
 * Android, hộp chọn ảnh gắn với Activity và có thể chết hẳn với lỗi
 * "Attempting to launch an unregistered ActivityResultLauncher" sau khi Android
 * huỷ/tạo lại Activity (đổi cỡ chữ, đổi ngôn ngữ, đổi sáng/tối…) — lúc đó người
 * dùng không còn cách nào gửi ảnh cho tới khi khởi động lại app. Tự vẽ thư viện
 * ảnh và dùng expo-camera (gọi trực tiếp trong app, không qua hộp thoại hệ thống)
 * thì không còn chỗ nào để hỏng, mà cũng nhanh hơn vì không phải chuyển app.
 */
export default function PhotoPicker({
  title,
  onPick,
  onClose,
  busyLabel = "Đang xử lý ảnh…",
}: {
  title: string;
  onPick: (uri: string) => void | Promise<void>;
  onClose: () => void;
  busyLabel?: string;
}) {
  const { theme } = useTheme();
  const [mode, setMode] = useState<"library" | "camera">("library");
  const [assets, setAssets] = useState<GalleryAsset[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [cameraPermission, askCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadLibrary = useCallback(async (after?: string | null) => {
    setLoading(true);
    try {
      const support = mediaSupport();
      if (!support.ok) {
        setNote(
          "Bản app này chưa có thư viện ảnh — bạn vẫn dùng được tab Máy ảnh.",
        );
        return;
      }
      const granted = await askGalleryPermission();
      if (!granted) {
        setNote(
          "Chưa được phép đọc ảnh trong máy. Bấm “Mở Cài đặt” rồi cho phép Ảnh / Ảnh và video, hoặc dùng tab Máy ảnh.",
        );
        return;
      }
      const page = await listPhotos(after ?? null, 60);
      if (!mounted.current) return;
      setNote(
        page.assets.length
          ? ""
          : "Chưa thấy ảnh nào trong thư viện của máy — thử chụp ở tab Máy ảnh nhé.",
      );
      setAssets((current) =>
        after ? [...current, ...page.assets] : page.assets,
      );
      setCursor(page.endCursor);
      setHasNext(page.hasNext);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === "library") void loadLibrary(null);
  }, [mode, loadLibrary]);

  useEffect(() => {
    if (mode === "camera" && cameraPermission && !cameraPermission.granted)
      void askCameraPermission();
  }, [mode, cameraPermission, askCameraPermission]);

  async function deliver(uri: string) {
    setSaving(true);
    try {
      await onPick(uri);
      if (mounted.current) onClose();
    } catch (error) {
      Alert.alert(
        "Chưa gửi được ảnh",
        error instanceof Error ? error.message : "Ảnh bị lỗi.",
      );
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  async function shoot() {
    try {
      setSaving(true);
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.8,
      });
      const uri = photo?.uri;
      if (!uri) throw new Error("Máy ảnh chưa trả về ảnh, thử lại nhé.");
      await deliver(uri);
    } catch (error) {
      Alert.alert(
        "Chưa chụp được",
        error instanceof Error ? error.message : "Máy ảnh bị lỗi.",
      );
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  const tabStyle = (active: boolean) => ({
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: active ? theme.deep[1] : theme.soft,
    borderWidth: 1,
    borderColor: theme.border,
  });

  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: "#000000cc",
        justifyContent: "center",
        padding: 12,
      }}
    >
      <View
        style={{
          backgroundColor: theme.surface,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: theme.border,
          padding: 12,
          maxHeight: "88%",
        }}
      >
        <View className="flex-row items-center mb-2">
          <Text className="font-bold flex-1" style={{ color: theme.ink }}>
            {title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng"
            onPress={onClose}
            style={{ paddingHorizontal: 8 }}
          >
            <Text style={{ color: theme.sub }}>Đóng ✕</Text>
          </Pressable>
        </View>
        <View className="flex-row mb-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Thư viện ảnh"
            onPress={() => setMode("library")}
            style={{ ...tabStyle(mode === "library"), marginRight: 8 }}
          >
            <Text
              className="text-xs"
              style={{
                color: mode === "library" ? theme.onDeep : theme.text,
              }}
            >
              🖼 Thư viện
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Máy ảnh"
            onPress={() => setMode("camera")}
            style={tabStyle(mode === "camera")}
          >
            <Text
              className="text-xs"
              style={{ color: mode === "camera" ? theme.onDeep : theme.text }}
            >
              📷 Máy ảnh
            </Text>
          </Pressable>
        </View>

        {mode === "library" ? (
          <ScrollView style={{ maxHeight: 420 }}>
            {note ? (
              <Text className="text-xs mb-2" style={{ color: theme.sub }}>
                {note}
              </Text>
            ) : null}
            <View className="flex-row flex-wrap">
              {assets.map((asset) => (
                <Pressable
                  key={asset.id}
                  accessibilityRole="button"
                  accessibilityLabel="Chọn ảnh này"
                  onPress={() => void deliver(asset.uri)}
                  disabled={saving}
                  style={{
                    width: "33.33%",
                    padding: 2,
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  <Image
                    source={{ uri: asset.uri }}
                    style={{ width: "100%", height: 104, borderRadius: 10 }}
                    resizeMode="cover"
                  />
                </Pressable>
              ))}
            </View>
            {loading ? (
              <ActivityIndicator style={{ marginVertical: 10 }} />
            ) : null}
            {hasNext && !loading ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tải thêm ảnh"
                onPress={() => void loadLibrary(cursor)}
                style={{
                  marginTop: 8,
                  alignSelf: "center",
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 16,
                  backgroundColor: theme.soft,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <Text className="text-xs" style={{ color: theme.text }}>
                  Tải thêm ảnh
                </Text>
              </Pressable>
            ) : null}
            {note.includes("Chưa được phép") ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mở cài đặt của điện thoại"
                onPress={() => void Linking.openSettings()}
                style={{
                  marginTop: 8,
                  alignSelf: "center",
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 16,
                  backgroundColor: theme.deep[1],
                }}
              >
                <Text
                  className="text-xs font-bold"
                  style={{ color: theme.onDeep }}
                >
                  Mở Cài đặt
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>
        ) : (
          <View style={{ height: 380 }}>
            {cameraPermission?.granted ? (
              <>
                <CameraView
                  ref={cameraRef}
                  style={{ flex: 1, borderRadius: 16, overflow: "hidden" }}
                  facing={facing}
                  {...(Platform.OS === "android" ? { mute: true } : {})}
                />
                <View className="flex-row items-center justify-center mt-3">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Đổi camera trước sau"
                    onPress={() =>
                      setFacing((current) =>
                        current === "back" ? "front" : "back",
                      )
                    }
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 18,
                      backgroundColor: theme.soft,
                      borderWidth: 1,
                      borderColor: theme.border,
                      marginRight: 10,
                    }}
                  >
                    <Text style={{ color: theme.text }}>🔄 Đổi camera</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Chụp ảnh"
                    onPress={() => void shoot()}
                    disabled={saving}
                    style={{
                      width: 68,
                      height: 68,
                      borderRadius: 34,
                      backgroundColor: theme.deep[1],
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: saving ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ fontSize: 30 }}>📸</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <View className="flex-1 items-center justify-center">
                <Text
                  className="text-xs text-center mb-3"
                  style={{ color: theme.sub }}
                >
                  Cần quyền dùng máy ảnh để chụp ảnh gửi cho người thương.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cho phép dùng máy ảnh"
                  onPress={() => void askCameraPermission()}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 9,
                    borderRadius: 18,
                    backgroundColor: theme.deep[1],
                  }}
                >
                  <Text className="font-bold" style={{ color: theme.onDeep }}>
                    Cho phép máy ảnh
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {saving ? (
          <View className="flex-row items-center mt-2">
            <ActivityIndicator />
            <Text className="text-xs ml-2" style={{ color: theme.sub }}>
              {busyLabel}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
