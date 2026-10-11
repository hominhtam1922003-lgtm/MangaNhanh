import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shortvideo.app',
  appName: 'ShortVideo',
  webDir: 'dist',
  android: {
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    StatusBar: { style: 'DARK', backgroundColor: '#000000', overlaysWebView: true },
  },
};

export default config;
