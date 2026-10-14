const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// `peerjs` gọi thẳng thư viện vá trình duyệt `webrtc-adapter`; trong React Native
// thư viện đó sẽ lỗi ngay khi nạp. Thay bằng bản nhỏ trong thư mục shims/.
const shimmed = new Set(["webrtc-adapter"]);
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (shimmed.has(moduleName)) {
    return {
      type: "sourceFile",
      filePath: path.resolve(__dirname, "shims/webrtc-adapter.js"),
    };
  }
  return defaultResolve
    ? defaultResolve(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, {
  input: "./global.css",
});
