'use client';

import { useEffect, useState } from 'react';
import { useHashRoute, buildHref } from '@/lib/hash-router';
import MangaCard from '@/components/MangaCard';
import { Empty, Spinner } from '@/components/Loading';
import { searchManga } from '@/lib/client/sources';
import type { MangaBasic } from '@/lib/sources/types';

export default function SearchPage() {
  const [route] = useHashRoute();
  const q = (route.query.q || '').trim();
  const [results, setResults] = useState<MangaBasic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!q) { setResults([]); return; }
    let cancel = false;
    setLoading(true); setError(null); setResults([]);
    searchManga(q)
      .then(r => { if (!cancel) setResults(r); })
      .catch(e => { if (!cancel) setError(e?.message || 'Lỗi tìm kiếm'); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [q]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <a href={buildHref('/')} className="btn-ghost text-sm mb-4">← Quay lại</a>
      <h1 className="text-2xl font-display font-bold">Kết quả tìm kiếm</h1>
      <p className="text-sm text-ink-500 mt-1">Từ khóa: <b className="text-ink-800 dark:text-ink-100">{q}</b> · Nguồn: TruyenQQ</p>
      {loading && <div className="flex justify-center py-16"><Spinner size="lg"/></div>}
      {error && <Empty title="Không tìm thấy" description={error}/>}
      {!loading && !error && results.length === 0 && q && <Empty title="Không có kết quả" description="Thử từ khóa khác nhé."/>}
      {!loading && results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6">
          {results.map(m => <MangaCard key={`${m.source}-${m.slug}`} manga={m}/>)}
        </div>
      )}
    </div>
  );
}
