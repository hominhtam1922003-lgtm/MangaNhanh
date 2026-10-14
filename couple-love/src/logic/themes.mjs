// Chủ đề (theme) cho trang chủ và toàn app — đổi như đổi chủ đề Mess/Zalo.
// Mỗi chủ đề có nền gradient, màu nhấn và vài biểu tượng bay quanh trái tim.
export const THEMES = [
  {
    id: "hong",
    name: "Hồng mộng",
    colors: ["#ffe3ee", "#fff1f5"],
    deep: ["#f6699f", "#d61f69"],
    text: "#d61f69",
    emoji: ["💗", "💞", "🌸"],
  },
  {
    id: "tim",
    name: "Tím mơ",
    colors: ["#efe0ff", "#f7f0ff"],
    deep: ["#a06bff", "#7c3aed"],
    text: "#7c3aed",
    emoji: ["💜", "🌙", "✨"],
  },
  {
    id: "bien",
    name: "Biển xanh",
    colors: ["#dff1ff", "#eff9ff"],
    deep: ["#4aa8e8", "#1d7fb8"],
    text: "#1d7fb8",
    emoji: ["🌊", "🐚", "💙"],
  },
  {
    id: "bacam",
    name: "Xanh bạc hà",
    colors: ["#dcfaee", "#f0fdf7"],
    deep: ["#3fc79a", "#0f9d76"],
    text: "#0f9d76",
    emoji: ["🍀", "🌿", "💚"],
  },
  {
    id: "hoanghon",
    name: "Hoàng hôn",
    colors: ["#ffe2cf", "#fff4ea"],
    deep: ["#ff8b5e", "#e2552b"],
    text: "#e2552b",
    emoji: ["🌇", "🧡", "🌻"],
  },
  {
    id: "nang",
    name: "Nắng vàng",
    colors: ["#fff3cc", "#fffbeb"],
    deep: ["#f5b423", "#d18c05"],
    text: "#c07f04",
    emoji: ["🌞", "💛", "🌼"],
  },
  {
    id: "tuyet",
    name: "Tuyết trắng",
    colors: ["#eaf2f9", "#f7fbff"],
    deep: ["#8fa8bd", "#5b768d"],
    text: "#5b768d",
    emoji: ["❄️", "🤍", "🕊️"],
  },
  {
    id: "dem",
    name: "Đêm sao",
    colors: ["#2b2440", "#453a63"],
    deep: ["#8d7bff", "#b9a5ff"],
    text: "#e6dcff",
    emoji: ["⭐", "🌌", "💫"],
  },
];
export const DEFAULT_THEME = "hong";
export const isTheme = (id) => THEMES.some((theme) => theme.id === id);
export function themeById(id) {
  return (
    THEMES.find((theme) => theme.id === id) ??
    THEMES.find((theme) => theme.id === DEFAULT_THEME) ??
    THEMES[0]
  );
}
