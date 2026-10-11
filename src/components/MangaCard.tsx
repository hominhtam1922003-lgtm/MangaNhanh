"use client";
import A from './A';
import { useState } from 'react';
import type { MangaBasic } from '@/lib/sources/types';

function ProxyImg({ src, alt }: { src: string; alt: string }) {
  // Order of attempts for the cover (CDNs check Referer, so route via wsrv.nl by default)
  const wsrvUrl = (u: string, ref: string) => `https://wsrv.nl/?url=${encodeURIComponent(u)}&referer=${encodeURIComponent(ref)}&af`;
  const weservUrl = (u: string, ref: string) => `https://images.weserv.nl/?url=${encodeURIComponent(u.replace(/^https?:\/\//, ''))}&af&referrer=${encodeURIComponent(ref)}`;
  const netReferer = 'https://nettruyen.gg/';
  const qqReferer = 'https://truyenqqko.com/';
  const ref = src.includes('truyenqq') || src.includes('truyenvua') || src.includes('hinhhinh') ? qqReferer : netReferer;

  const candidates = [wsrvUrl(src, ref), weservUrl(src, ref), src];
  const [idx, setIdx] = useState(0);
  const current = candidates[Math.min(idx, candidates.length - 1)];

  return (
    <img
      src={current}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className="absolute inset-0 w-full h-full object-cover"
      onError={() => { if (idx < candidates.length - 1) setIdx(idx + 1); }}
    />
  );
}

export default function MangaCard({ manga }: { manga: MangaBasic }) {
  return (
    <A href={`/manga/${manga.source}/${manga.slug}`} className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-2xl">
      <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-ink-100 dark:bg-ink-800 shadow-card group-hover:shadow-hover group-hover:-translate-y-1 transition-all">
        <div className="absolute top-2 left-2 z-10 px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-gradient-to-r from-accent to-accent2 text-white shadow">
          {manga.source === 'nettruyen' ? 'NetTruyen' : 'TruyenQQ'}
        </div>
        {manga.thumbnail ? (
          <ProxyImg src={manga.thumbnail} alt={manga.title} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-ink-400 text-3xl">📚</div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-2">
          <p className="text-white text-[11px] font-semibold truncate">{manga.latestChapter || '\u00a0'}</p>
        </div>
      </div>
      <h3 className="mt-2 text-sm font-semibold leading-snug line-clamp-2 text-ink-800 dark:text-ink-100 group-hover:text-accent transition-colors">
        {manga.title}
      </h3>
      {manga.updatedAt && (
        <p className="text-[11px] text-ink-400 mt-0.5 line-clamp-1">{manga.updatedAt}</p>
      )}
    </A>
  );
}
