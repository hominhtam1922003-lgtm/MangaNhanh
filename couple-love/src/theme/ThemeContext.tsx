import React, { createContext, useContext } from "react";
import { themeById, withWallpaper } from "../logic/themes.mjs";
// Kiểu chủ đề dùng chung cho cả app: mọi màn hình lấy màu từ đây nên không còn
// cảnh thẻ hồng nằm trên nền tím.
export type Theme = {
  id: string;
  name: string;
  messengerName?: string;
  emoji: string[];
  /** Hoạ tiết rải ở nền (hoa, mèo, sóng…) — theme không chỉ đổi màu. */
  deco: string[];
  dark: boolean;
  bg: [string, string, string];
  hero: [string, string];
  deep: [string, string];
  onDeep: string;
  soft: string;
  surface: string;
  glass: string;
  border: string;
  ink: string;
  sub: string;
  text: string;
  glow: string;
  veil: string;
  /** Màu bóng chat của mình (gradient phong cách Messenger). */
  bubbleMine?: [string, string];
  /** Màu nền bóng chat của người thương. */
  bubblePartner?: string;
  /** Màu nền khung nhập liệu đồng bộ theo chủ đề. */
  inputBg?: string;
  /** Màu viền khung nhập liệu đồng bộ theo chủ đề. */
  inputBorder?: string;
};
type ThemeValue = {
  theme: Theme;
  wallpaper: boolean;
  /** Độ đậm lớp phủ trên ảnh nền: 0,3 = ảnh rõ, 0,7 = chữ rõ. */
  wallpaperTint: number;
};
const ThemeContext = createContext<ThemeValue>({
  theme: themeById("hong") as unknown as Theme,
  wallpaper: false,
  wallpaperTint: 0.5,
});
export function ThemeProvider({
  themeId,
  wallpaper = false,
  wallpaperTint = 0.5,
  children,
}: {
  themeId: string;
  wallpaper?: boolean;
  wallpaperTint?: number;
  children: React.ReactNode;
}) {
  const base = themeById(themeId) as unknown as Theme;
  // Có ảnh nền thì mọi ô đều trong suốt để thấy ảnh phía sau, giống Zalo.
  const theme = wallpaper
    ? (withWallpaper(base, wallpaperTint) as unknown as Theme)
    : base;
  return (
    <ThemeContext.Provider value={{ theme, wallpaper, wallpaperTint }}>
      {children}
    </ThemeContext.Provider>
  );
}
export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
