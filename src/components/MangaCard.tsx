"use client";
import { memo } from 'react';
import A from './A';
import { useImage } from '@/lib/img';
import type { MangaBasic } from '@/lib/sources/types';

const REF = 'https://truyenqqko.com/';

const Placeholder = () => (
  <svg className="w-8 h-8 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.6-4.6a2 2 0 012.8 0L16 16m-2-2l1.6-1.6a2 2 0 012.8 0L20 14M4 6h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z"/>
  </svg>
);

const SpinnerMini = () => (
  <div className="w-8 h-8 rounded-full border-2 border-ink-300 border-t-brand-500 animate-spin"/>
);

const Cover = memo(function Cover({ src, alt }: { src?: string; alt: string }) {
  const { src: imageUrl, loading } = useImage(src, REF);
  return (
    <div className="absolute inset-0 bg-ink-200 dark:bg-ink-800">
      {!imageUrl && (
        <div className="absolute inset-0 flex items-center justify-center text-ink-400 dark:text-ink-500">
          {loading ? <SpinnerMini/> : <Placeholder/>}
        </div>
      )}
      {imageUrl && (
        <img src={imageUrl} alt={alt} loading="lazy" decoding="async"
             className="absolute inset-0 w-full h-full object-cover" referrerPolicy="no-referrer"/>
      )}
    </div>
  );
});

function MangaCardInner({ manga }: { manga: MangaBasic }) {
  return (
    <A href={`/manga/${manga.source}/${manga.slug}`}
       className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-2xl">
      <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-ink-100 dark:bg-ink-800 shadow-card group-hover:shadow-hover group-hover:-translate-y-1 transition-transform">
        <div className="absolute top-2 left-2 z-10 px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow">
          TruyenQQ
        </div>
        <Cover src={manga.thumbnail} alt={manga.title}/>
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

export default memo(MangaCardInner, (a, b) =>
  a.manga.slug === b.manga.slug &&
  a.manga.source === b.manga.source &&
  a.manga.thumbnail === b.manga.thumbnail &&
  a.manga.title === b.manga.title &&
  a.manga.latestChapter === b.manga.latestChapter &&
  a.manga.updatedAt === b.manga.updatedAt
);
