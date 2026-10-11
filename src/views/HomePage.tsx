'use client';

import { useEffect, useState } from 'react';
import { buildHref, useHashRoute } from '@/lib/hash-router';
import MangaCard from '@/components/MangaCard';
import { Empty } from '@/components/Loading';
import { SOURCES } from '@/lib/sources';
import { fetchHome } from '@/lib/client/sources';
import type { MangaBasic } from '@/lib/sources/types';

function SourceHero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 via-transparent to-indigo-500/10 pointer-events-none"/>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div className="animate-slide-up">
            <span className="chip bg-sky-500/10 text-sky-600 dark:text-sky-300">Nhanh · Nét · Mượt · APK</span>
            <h1 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-display font-extrabold leading-tight">
              Đọc truyện tranh <span className="bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500 bg-clip-text text-transparent">full chap</span>, ảnh sắc nét
            </h1>
            <p className="mt-4 text-ink-600 dark:text-ink-300 text-lg max-w-xl">
              Kho truyện khổng lồ từ TruyenQQ. Tự động tải toàn bộ danh sách chương, không cần ấn "Xem thêm", loại bỏ quảng cáo phiền toái. Cài làm ứng dụng Android.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={buildHref('/')} className="btn-primary">Khám phá ngay</a>
              <a href={buildHref('/about')} className="btn-ghost">Tìm hiểu thêm</a>
              <a href={buildHref('/download')} className="btn-ghost">📱 Tải APK</a>
            </div>
            <div className="mt-6 flex gap-6 text-sm text-ink-500 dark:text-ink-400">
              <div><b className="text-ink-800 dark:text-ink-100">Full</b> chương</div>
              <div><b className="text-ink-800 dark:text-ink-100">Ảnh</b> HD</div>
              <div><b className="text-ink-800 dark:text-ink-100">APK</b> Android</div>
            </div>
          </div>
          <div className="relative h-80 lg:h-96">
            <div className="absolute top-0 right-4 w-48 h-72 rounded-3xl bg-gradient-to-br from-sky-500 to-indigo-500 rotate-6 shadow-2xl shadow-sky-500/30"/>
            <div className="absolute top-6 right-20 w-48 h-72 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-500 -rotate-3 shadow-2xl shadow-indigo-500/30"/>
            <div className="absolute top-12 right-36 w-48 h-72 rounded-3xl bg-white dark:bg-ink-900 border border-ink-100 dark:border-ink-800 shadow-2xl flex flex-col items-center justify-center p-6">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center text-white font-bold">M</div>
              <div className="mt-4 text-center text-ink-800 dark:text-ink-100 font-semibold">MangaNhanh</div>
              <div className="text-xs text-ink-500 mt-1 text-center">Đọc không quảng cáo, ảnh nét, lưu tiến độ.</div>
              <div className="mt-4 w-full space-y-2">
                <div className="h-2 rounded bg-ink-100 dark:bg-ink-800"/>
                <div className="h-2 rounded bg-ink-100 dark:bg-ink-800 w-5/6"/>
                <div className="h-2 rounded bg-sky-500/30 w-2/3"/>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SourceSection() {
  const source = SOURCES[0];
  const [items, setItems] = useState<MangaBasic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancel = false;
    setLoading(true); setError(null);
    fetchHome()
      .then((r) => { if (!cancel) setItems(r); })
      .catch((e) => { if (!cancel) setError(e?.message || 'Lỗi tải dữ liệu'); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [tick]);

  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') setTick(t => t + 1); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-display font-bold">
              <span className={`bg-gradient-to-r ${source.logoColor} bg-clip-text text-transparent`}>{source.name}</span>
            </h2>
            <button onClick={()=>setTick(t=>t+1)} className="chip hover:bg-ink-200 dark:hover:bg-ink-700 cursor-pointer">↻ Tải lại</button>
          </div>
          <p className="text-sm text-ink-500 mt-1">{source.description}</p>
        </div>
      </div>
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i}>
              <div className="skeleton rounded-2xl aspect-[3/4] w-full"/>
              <div className="skeleton mt-2 h-4 w-3/4 rounded"/>
              <div className="skeleton mt-1 h-3 w-1/2 rounded"/>
            </div>
          ))}
        </div>
      )}
      {error && !loading && <Empty title="Không thể tải danh sách truyện" description={`${error}. Kiểm tra kết nối mạng rồi thử lại.`}/>}
      {!loading && !error && items.length === 0 && <Empty title="Không có truyện nào" description="Bấm ↻ Tải lại hoặc thử mở bằng link."/>}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {items.map((m) => <MangaCard key={`${m.source}-${m.slug}`} manga={m}/>)}
        </div>
      )}
    </section>
  );
}

function QuickAddForm() {
  const [, navigate] = useHashRoute();
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    try {
      const u = new URL(url.trim());
      if (!/(^|\.)truyenqq(to)?\.(com|net|io)/i.test(u.hostname)) { setErr('Chỉ hỗ trợ link từ TruyenQQ (truyenqqto.com / truyenqq.com).'); return; }
      const parts = u.pathname.split('/').filter(Boolean);
      const idx = parts.findIndex(p => p === 'truyen-tranh');
      if (idx < 0 || !parts[idx+1]) { setErr('Link không hợp lệ. Hãy dán link trang truyện.'); return; }
      const slug = parts[idx+1];
      navigate(`/manga/truyenqq/${slug}`);
    } catch { setErr('Link không hợp lệ.'); }
  };

  return (
    <div className="card p-5 sm:p-6 mt-6">
      <h3 className="font-display font-bold text-lg">Mở nhanh bằng link</h3>
      <p className="text-sm text-ink-500 mt-1">Dán link truyện TruyenQQ để đọc ngay, ứng dụng sẽ tự tải toàn bộ chapters.</p>
      <form onSubmit={go} className="mt-4 flex flex-col sm:flex-row gap-2">
        <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://truyenqqto.com/truyen-tranh/..." className="flex-1 px-4 py-3 rounded-xl bg-ink-100 dark:bg-ink-800 outline-none focus:ring-2 ring-brand-500 text-sm"/>
        <button className="btn-primary">Đọc ngay</button>
      </form>
      {err && <p className="mt-2 text-sm text-red-500">{err}</p>}
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <SourceHero/>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
        <QuickAddForm/>
        <SourceSection/>
      </div>
    </>
  );
}
