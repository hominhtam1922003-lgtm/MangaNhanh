import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { SupabaseClient } from "@supabase/supabase-js";
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
export async function enablePush(
  db: SupabaseClient,
  uid: string,
  projectId: string,
) {
  if (!Device.isDevice)
    throw new Error(
      "Thông báo đẩy cần kiểm tra trên điện thoại thật, không phải giả lập.",
    );
  if (!/^[0-9a-f-]{36}$/i.test(projectId))
    throw new Error(
      "Cần Project ID Expo/EAS hợp lệ và FCM/APNs đã cấu hình để nhận thông báo đẩy.",
    );
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("love-reminders", {
      name: "Lời nhắc yêu thương",
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted")
    permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted")
    throw new Error(
      "Chưa cấp quyền thông báo. Lời nhắc vẫn xuất hiện trong ứng dụng.",
    );
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const saved = await db
    .from("push_tokens")
    .upsert({ token, user_id: uid, updated_at: new Date().toISOString() });
  if (saved.error) throw saved.error;
  return token;
}
