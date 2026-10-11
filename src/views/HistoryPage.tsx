'use client';

import { useEffect, useState } from 'react';
import A from '@/components/A';
import { Empty } from '@/components/Loading';
import { getHistory, type HistoryItem } from '@/lib/client/storage';
import { useImage } from '@/lib/img';

function Thumb({ src, alt }: { src?: string; alt: string }) {
  const { src: url } = useImage(src, 'https://truyenqqto.com/');
  return url
    ? <img src={url} alt={alt} className="w-full h-full object-cover absolute inset-0" referrerPolicy="no-referrer"/>
    : <div className="w-full h-full bg-ink-200 dark:bg-ink-800 absolute inset-0"/>;
}

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  useEffect(() => { setItems(getHistory()); }, []);
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-display font-bold">Lịch sử đọc</h1>
      <p className="text-sm text-ink-500 mt-1">Tối đa 200 mục, lưu tại máy.</p>
      {items.length === 0 ? <Empty title="Chưa có lịch sử đọc"/> : (
        <div className="mt-6 card divide-y divide-ink-100 dark:divide-ink-800 overflow-hidden">
          {items.map(h => (
            <A key={`${h.source}-${h.slug}-${h.chapterSlug}`} href={`/read/${h.source}/${h.slug}/${h.chapterSlug}`} className="flex items-center gap-3 p-3 hover:bg-ink-50 dark:hover:bg-ink-800/50 transition">
              <div className="w-14 h-20 rounded-lg bg-ink-100 dark:bg-ink-800 overflow-hidden flex-shrink-0 relative">
                <Thumb src={h.thumbnail} alt={h.title}/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{h.title}</div>
                <div className="text-xs text-ink-500 truncate">{h.chapterTitle}</div>
                <div className="text-[11px] text-ink-400">{new Date(h.readAt).toLocaleString('vi-VN')}</div>
              </div>
              <span className="chip bg-gradient-to-r from-sky-500 to-indigo-500 !text-white">TruyenQQ</span>
            </A>
          ))}
        </div>
      )}
    </div>
  );
}
