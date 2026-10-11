'use client';

import { useEffect, useState } from 'react';
import MangaCard from '@/components/MangaCard';
import { Empty, Spinner } from '@/components/Loading';
import { searchManga } from '@/lib/client/sources';
import type { MangaBasic } from '@/lib/sources/types';

export default function SearchPage({ query }: { query: Record<string, string> }) {
  const q = query.q || '';
  const source = (query.source || 'all') as 'all' | 'nettruyen' | 'truyenqq';
  const [results, setResults] = useState<MangaBasic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!q) { setLoading(false); return; }
    let cancel = false;
    setLoading(true); setError(null);
    searchManga(source, q).then(r => { if (!cancel) setResults(r); })
      .catch(e => { if (!cancel) setError(e?.message || 'Lỗi tìm kiếm'); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [q, source]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-display font-bold">Kết quả cho <span className="text-brand-500">"{q}"</span>
        <span className="ml-2 text-sm font-normal text-ink-500">{results.length} truyện</span>
      </h1>
      <p className="text-sm text-ink-500 mt-1">Nguồn: {source === 'all' ? 'Tất cả' : source === 'nettruyen' ? 'NetTruyen' : 'TruyenQQ'}</p>
      <div className="mt-6">
        {loading && <div className="flex justify-center py-16"><Spinner size="lg"/></div>}
        {!loading && error && <Empty title="Lỗi tìm kiếm" description={error}/>}
        {!loading && !error && results.length === 0 && <Empty title="Không tìm thấy truyện"/>}
        {!loading && results.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {results.map(m => <MangaCard key={`${m.source}-${m.slug}`} manga={m}/>)}
          </div>
        )}
      </div>
    </div>
  );
}
