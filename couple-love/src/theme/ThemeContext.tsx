import React, { createContext, useContext } from "react";
import { themeById } from "../logic/themes.mjs";
// Kiểu chủ đề dùng chung cho cả app: mọi màn hình lấy màu từ đây nên không còn
// cảnh thẻ hồng nằm trên nền tím.
export type Theme = {
  id: string;
  name: string;
  emoji: string[];
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
};
type ThemeValue = { theme: Theme; wallpaper: boolean };
const ThemeContext = createContext<ThemeValue>({
  theme: themeById("hong") as unknown as Theme,
  wallpaper: false,
});
export function ThemeProvider({
  themeId,
  wallpaper = false,
  children,
}: {
  themeId: string;
  wallpaper?: boolean;
  children: React.ReactNode;
}) {
  return (
    <ThemeContext.Provider
      value={{ theme: themeById(themeId) as unknown as Theme, wallpaper }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
