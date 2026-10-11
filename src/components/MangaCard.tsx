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
  const [srcIdx, setSrcIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const href = buildHref(`/manga/${manga.source}/${manga.slug}`);
  const sources = [
    manga.thumbnail,
    `/api/proxy?url=${encodeURIComponent(manga.thumbnail)}`,
    `https://wsrv.nl/?url=${encodeURIComponent(manga.thumbnail)}&af&n=-1`,
    `https://images.weserv.nl/?url=${encodeURIComponent(manga.thumbnail)}&af`
  ];
  const src = sources[srcIdx];

  return (
    <a href={href} className="group block animate-slide-up">
      <div className="relative rounded-2xl overflow-hidden bg-ink-100 dark:bg-ink-900 aspect-[3/4] shadow group-hover:shadow-xl transition-all duration-300 group-hover:-translate-y-1">
        {!loaded && <div className="absolute inset-0 skeleton" />}
        <img
          src={src}
          alt={manga.title}
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (srcIdx < sources.length - 1) setSrcIdx(srcIdx + 1);
          }}
          className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
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
