'use client';

import { useEffect, useState } from 'react';
import MangaCard from '@/components/MangaCard';
import { Empty, Spinner } from '@/components/Loading';
import { getSource } from '@/lib/sources';
import { fetchHome } from '@/lib/client/sources';
import type { MangaBasic, SourceId } from '@/lib/sources/types';

export default function SourcePage({ id }: { id: string }) {
  const src = getSource(id as SourceId);
  const [items, setItems] = useState<MangaBasic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!src) return;
    let cancel = false;
    setLoading(true);
    fetchHome(id as SourceId).then(r => { if (!cancel) setItems(r); })
      .catch(e => { if (!cancel) setError(e?.message || 'Lỗi'); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [id]);

  if (!src) return <Empty title="Nguồn không hỗ trợ"/>;
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-4">
        <span className={`w-10 h-10 rounded-xl bg-gradient-to-br ${src.logoColor} flex items-center justify-center text-white font-bold`}>{src.name[0]}</span>
        <div>
          <h1 className="text-2xl font-display font-bold">{src.name}</h1>
          <p className="text-sm text-ink-500">{src.description}</p>
        </div>
      </div>
      {loading && <div className="flex justify-center py-16"><Spinner size="lg"/></div>}
      {error && <Empty title="Không thể tải" description={error}/>}
      {!loading && items.length === 0 && <Empty title="Không có truyện"/>}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {items.map(m => <MangaCard key={`${m.source}-${m.slug}`} manga={m}/>)}
        </div>
      )}
    </div>
  );
}
