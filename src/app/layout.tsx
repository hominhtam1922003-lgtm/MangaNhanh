import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeScript } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'MangaNhanh – Đọc truyện tranh online nhanh, chất lượng cao',
  description:
    'Ứng dụng đọc truyện tranh từ TruyenQQ, tự động lấy toàn bộ chương, hình ảnh sắc nét, giao diện đẹp, tối ưu di động, không quảng cáo làm phiền.',
  applicationName: 'MangaNhanh',
  authors: [{ name: 'MangaNhanh' }],
  manifest: '/manifest.webmanifest',
  icons: { icon: '/favicon.svg' },
  keywords: ['manga', 'manhwa', 'manhua', 'truyện tranh', 'truyenqq', 'đọc truyện']
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0a0a12' },
    { media: '(prefers-color-scheme: light)', color: '#fff7ed' }
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="MangaNhanh" />
      </head>
      <body>{children}</body>
    </html>
  );
}
