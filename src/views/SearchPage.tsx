'use client';

import { useEffect, useRef, useState } from 'react';
import { useHashRoute, buildHref } from '@/lib/hash-router';
import MangaCard from '@/components/MangaCard';
import { Empty, Spinner } from '@/components/Loading';
import { searchManga } from '@/lib/client/sources';
import type { MangaBasic } from '@/lib/sources/types';

// Simple in-memory cache so back-navigation / same query returns instantly
const cache = new Map<string, MangaBasic[]>();

export default function SearchPage() {
  const [route, navigate] = useHashRoute();
  const urlQ = (route.query.q || '').trim();
  const [results, setResults] = useState<MangaBasic[]>(() => urlQ ? (cache.get(urlQ) || []) : []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localQ, setLocalQ] = useState(urlQ);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocalQ(urlQ); }, [urlQ]);

  useEffect(() => {
    if (!urlQ) { setResults([]); return; }
    if (cache.has(urlQ)) { setResults(cache.get(urlQ)!); return; }
    let cancel = false;
    setLoading(true); setError(null);
    searchManga(urlQ)
      .then(r => { if (cancel) return; cache.set(urlQ, r); setResults(r); })
      .catch(e => { if (!cancel) setError(e?.message || 'Lỗi tìm kiếm'); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [urlQ]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = localQ.trim();
    if (!v) return;
    navigate(`/search?q=${encodeURIComponent(v)}`);
    inputRef.current?.blur();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <a href={buildHref('/')} className="btn-ghost text-sm mb-4">← Quay lại</a>
      <h1 className="text-2xl font-display font-bold">Tìm kiếm</h1>
      <form onSubmit={submit} className="mt-4 flex gap-2 max-w-xl">
        <input
          ref={inputRef}
          value={localQ}
          onChange={e => setLocalQ(e.target.value)}
          type="search" inputMode="search" autoComplete="off" spellCheck={false}
          placeholder="Nhập tên truyện…"
          className="flex-1 px-4 py-3 rounded-xl bg-ink-100 dark:bg-ink-800 outline-none focus:ring-2 ring-brand-500 text-sm"
        />
        <button className="btn-primary">Tìm</button>
      </form>
      {urlQ && <p className="text-sm text-ink-500 mt-3">Kết quả cho: <b className="text-ink-800 dark:text-ink-100">{urlQ}</b> · Nguồn: TruyenQQ</p>}
      {loading && <div className="flex justify-center py-16"><Spinner size="lg"/></div>}
      {error && <Empty title="Không tìm thấy" description={error}/>}
      {!loading && !error && urlQ && results.length === 0 && <Empty title="Không có kết quả" description="Thử từ khóa khác nhé."/>}
      {!loading && !urlQ && <Empty title="Gõ tên truyện để bắt đầu" description="Ví dụ: one piece, đại quản gia, cuồng ma…"/>}
      {!loading && results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6">
          {results.map(m => <MangaCard key={`${m.source}-${m.slug}`} manga={m}/>)}
        </div>
      )}
    </div>
  );
}
