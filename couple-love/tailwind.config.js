module.exports = {
  content: ["./App.tsx", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: { colors: { love: "#e64980", paper: "#fff6f8", ink: "#382637" } },
  },
  plugins: [],
};
