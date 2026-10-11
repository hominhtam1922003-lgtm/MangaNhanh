'use client';

import { useEffect, useState } from 'react';
import A from '@/components/A';
import { Empty } from '@/components/Loading';
import { getFavorites, type FavItem } from '@/lib/client/storage';
import { useImage } from '@/lib/img';

function Thumb({ src, alt }: { src?: string; alt: string }) {
  const { src: url } = useImage(src, 'https://truyenqqko.com/');
  return url
    ? <img src={url} alt={alt} className="w-full h-full object-cover" referrerPolicy="no-referrer"/>
    : <div className="w-full h-full bg-ink-200 dark:bg-ink-800"/>;
}

export default function LibraryPage() {
  const [items, setItems] = useState<FavItem[]>([]);
  useEffect(() => { setItems(getFavorites()); }, []);
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-display font-bold">Thư viện của tôi</h1>
      <p className="text-sm text-ink-500 mt-1">Truyện bạn yêu thích.</p>
      {items.length === 0 ? <Empty title="Chưa có truyện yêu thích"/> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6">
          {items.map(m => (
            <A key={`${m.source}-${m.slug}`} href={`/manga/${m.source}/${m.slug}`} className="group block">
              <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-ink-100 dark:bg-ink-900 shadow group-hover:shadow-xl transition-all group-hover:-translate-y-1">
                <Thumb src={m.thumbnail} alt={m.title}/>
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r from-sky-500 to-indigo-500">TruyenQQ</span>
              </div>
              <h3 className="mt-2 font-semibold text-sm line-clamp-2 group-hover:text-brand-500">{m.title}</h3>
            </A>
          ))}
        </div>
      )}
    </div>
  );
}
