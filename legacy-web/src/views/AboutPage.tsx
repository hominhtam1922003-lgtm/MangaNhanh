'use client';

import { buildHref } from '@/lib/hash-router';
import { SOURCES } from '@/lib/sources';

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-3xl sm:text-4xl font-display font-extrabold">Giới thiệu <span className="bg-gradient-to-r from-brand-500 to-pink-500 bg-clip-text text-transparent">MangaNhanh</span></h1>
      <p className="mt-4 text-ink-600 dark:text-ink-300 leading-relaxed">
        MangaNhanh là trình đọc truyện tranh (manga/manhwa/manhua) nhanh, ảnh nét, không quảng cáo. Tổng hợp từ NetTruyen & TruyenQQ, tự quét toàn bộ chương (kể cả nút “Xem thêm”/phân trang).
      </p>
      <h2 className="mt-8 text-xl font-display font-bold">Nguồn hỗ trợ</h2>
      <div className="mt-3 grid sm:grid-cols-2 gap-3">
        {SOURCES.map(s => (
          <div key={s.id} className="card p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.logoColor} flex items-center justify-center text-white font-bold`}>{s.name[0]}</div>
              <div>
                <div className="font-semibold">{s.name}</div>
                <a href={s.baseUrl} target="_blank" rel="noreferrer" className="text-xs text-brand-500 hover:underline">{s.baseUrl}</a>
              </div>
            </div>
            <p className="text-sm text-ink-500 mt-2">{s.description}</p>
          </div>
        ))}
      </div>
      <h2 className="mt-8 text-xl font-display font-bold">Tính năng</h2>
      <ul className="mt-3 space-y-2 text-sm text-ink-700 dark:text-ink-300 list-disc pl-5">
        <li>Tự động tải toàn bộ chương, xử lý phân trang và “Xem thêm”.</li>
        <li>Ảnh sắc nét, dự phòng proxy khi ảnh bị chặn.</li>
        <li>3 chế độ đọc: Dọc, Webtoon, Trang (← →).</li>
        <li>Tối/Sáng/Hệ thống, yêu thích, lịch sử đọc.</li>
        <li>Mở nhanh bằng link, cài APK Android.</li>
      </ul>
      <div className="mt-8 flex gap-3">
        <a href={buildHref('/')} className="btn-primary">Quay lại</a>
        <a href={buildHref('/download')} className="btn-ghost">📱 Tải APK</a>
      </div>
    </div>
  );
}
