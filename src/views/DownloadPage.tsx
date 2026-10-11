'use client';

import { buildHref } from '@/lib/hash-router';

export default function DownloadPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="text-center">
        <div className="inline-flex w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-500 to-pink-500 items-center justify-center text-white shadow-lg shadow-brand-500/30 mb-4">📱</div>
        <h1 className="text-3xl sm:text-4xl font-display font-extrabold">Cài <span className="bg-gradient-to-r from-brand-500 to-pink-500 bg-clip-text text-transparent">MangaNhanh APK</span></h1>
        <p className="mt-3 text-ink-600 dark:text-ink-300">Đọc truyện ngay trên điện thoại Android, full màn hình.</p>
      </div>
      <div className="mt-8 card p-6">
        <h2 className="text-xl font-display font-bold">📥 Tải APK cài sẵn</h2>
        <p className="text-sm text-ink-500 mt-1">File APK build sẵn bằng Capacitor.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href="/manganhanh-app.apk" download className="btn-primary">⬇ Tải APK</a>
          <a href={buildHref('/')} className="btn-ghost">Dùng bản web</a>
        </div>
        <p className="mt-3 text-xs text-ink-500">Nếu file APK chưa có sẵn (do môi trường này không có Android SDK), hãy tự build theo hướng dẫn dưới.</p>
      </div>
      <div className="mt-6 card p-6">
        <h2 className="text-xl font-display font-bold">🛠️ Tự build APK (3 lệnh)</h2>
        <p className="text-sm text-ink-500 mt-1">Cần <b>Node.js ≥ 18</b> và <b>Android Studio</b> (kèm JDK 17, Android SDK).</p>
        <ol className="mt-4 space-y-3 text-sm">
          <li><div className="font-semibold">1. Cài dependencies:</div><pre className="mt-1 rounded-lg bg-ink-900 text-ink-100 p-3 overflow-x-auto text-xs"><code>{`npm install`}</code></pre></li>
          <li><div className="font-semibold">2. Build web + tạo project Android + build APK:</div><pre className="mt-1 rounded-lg bg-ink-900 text-ink-100 p-3 overflow-x-auto text-xs"><code>{`npm run build:android`}</code></pre></li>
          <li><div className="font-semibold">3. File APK tại:</div><pre className="mt-1 rounded-lg bg-ink-900 text-ink-100 p-3 overflow-x-auto text-xs"><code>{`android/app/build/outputs/apk/debug/app-debug.apk`}</code></pre><p className="text-xs text-ink-500 mt-1">Copy vào điện thoại và cài đặt (cho phép "nguồn không xác định" khi hỏi).</p></li>
        </ol>
      </div>
      <div className="mt-6 card p-6">
        <h2 className="text-xl font-display font-bold">📱 PWA – không cần cài</h2>
        <p className="text-sm text-ink-500 mt-1">Dùng Chrome trên Android mở trang web → menu ⋮ → <b>Thêm vào màn hình chính</b>, bạn sẽ có app-like experience ngay lập tức.</p>
      </div>
      <div className="mt-6 flex gap-3">
        <a href={buildHref('/')} className="btn-primary">Quay lại</a>
      </div>
    </div>
  );
}
