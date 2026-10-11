import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Frontend gọi /api; Vite chuyển tiếp sang backend Python (mặc định 127.0.0.1:8787).
export default defineConfig({
  plugins: [react()],
  // Không dùng PostCSS/Tailwind của app cha (MangaNhanh) — khai báo rỗng để tách biệt.
  css: { postcss: {} },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.SV_API ?? 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
});
