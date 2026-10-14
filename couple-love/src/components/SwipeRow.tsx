import React, { useMemo } from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

/** Ngưỡng kéo ngang để tính là "vuốt trả lời" (px). */
const REPLY_SWIPE_PX = 56;

/**
 * Vuốt một dòng tin nhắn sang phải để trả lời — thao tác quen thuộc của
 * Messenger/Zalo. Dùng `react-native-gesture-handler` cho cử chỉ và
 * `react-native-reanimated` cho chuyển động (chạy trên luồng UI nên không giật
 * khi danh sách tin nhắn đang dài). Cử chỉ chỉ được "giành" khi người dùng vuốt
 * NGANG thật sự (activeOffsetX) và không lệch dọc quá nhiều, nhờ vậy việc cuộn
 * dọc trong khung chat vẫn trơn.
 *
 * Bản 1.18.0: KHÔNG còn vẽ nhãn "trả lời" nằm ngoài bong bóng. Trước đây nhãn đó
 * nằm chờ sẵn ở lề trái và chỉ mờ đi nhờ hiệu ứng chạy trên luồng UI; máy nào
 * hiệu ứng không chạy là nhãn hiện ra ở MỌI dòng (chính là ảnh bạn gửi). Giờ muốn
 * trả lời thì NHẤN GIỮ tin nhắn (bảng chọn) hoặc VUỐT NGANG — không còn gì thừa
 * trên từng dòng tin.
 */
export function SwipeRow({
  children,
  onReply,
}: {
  children: React.ReactNode;
  onReply: () => void;
}) {
  const x = useSharedValue(0);
  // Cử chỉ này cố tình chạy callback trên luồng JS (runOnJS) để gọi thẳng hàm
  // trả lời của React mà không cần bắc cầu worklet — nhẹ và dễ hiểu hơn.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX(14)
        .failOffsetY([-14, 14])
        .onUpdate((event) => {
          x.value = Math.max(0, Math.min(84, event.translationX * 0.9));
        })
        .onEnd((event) => {
          const go = event.translationX > REPLY_SWIPE_PX;
          x.value = withTiming(0, { duration: 160 });
          if (go) onReply();
        })
        .onFinalize(() => {
          x.value = withTiming(0, { duration: 160 });
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onReply],
  );
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));
  return (
    <GestureDetector gesture={pan}>
      <Reanimated.View style={style}>{children}</Reanimated.View>
    </GestureDetector>
  );
}
