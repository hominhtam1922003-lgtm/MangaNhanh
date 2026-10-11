'use client';

import { useState } from 'react';
import { SOURCES } from '@/lib/sources';
import { buildHref } from '@/lib/hash-router';
import type { MangaBasic } from '@/lib/sources/types';

export function sourceBadge(source: string) {
  const s = SOURCES.find(x => x.id === source);
  if (!s) return null;
  return (
    <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r ${s.logoColor} shadow`}>
      {s.name}
    </span>
  );
}

export default function MangaCard({ manga }: { manga: MangaBasic }) {
  const [loaded, setLoaded] = useState(false);
  const [src, setSrc] = useState(manga.thumbnail);
  const [err, setErr] = useState(false);
  const href = buildHref(`/manga/${manga.source}/${manga.slug}`);

  return (
    <a href={href} className="group block animate-slide-up">
      <div className="relative rounded-2xl overflow-hidden bg-ink-100 dark:bg-ink-900 aspect-[3/4] shadow group-hover:shadow-xl transition-all duration-300 group-hover:-translate-y-1">
        {!loaded && !err && <div className="absolute inset-0 skeleton" />}
        {!err ? (
          <img
            src={src}
            alt={manga.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            onLoad={() => setLoaded(true)}
            onError={() => {
              if (!err) {
                setErr(true);
                setSrc(`https://wsrv.nl/?url=${encodeURIComponent(manga.thumbnail)}&af`);
                setTimeout(() => setErr(false), 50);
              }
            }}
            className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full text-ink-400 text-xs">Không có ảnh</div>
        )}
        {sourceBadge(manga.source)}
        {manga.latestChapter && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/60 text-white backdrop-blur">
            {manga.latestChapter}
          </div>
        )}
      </div>
      <div className="mt-2 px-1">
        <h3 className="text-sm font-semibold text-ink-800 dark:text-ink-100 line-clamp-2 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition">
          {manga.title}
        </h3>
        {manga.updatedAt && <p className="text-xs text-ink-500 mt-0.5 line-clamp-1">{manga.updatedAt}</p>}
      </div>
    </a>
  );
}
