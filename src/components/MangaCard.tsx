"use client";
import Link from 'next/link';
import { buildImageUrl } from '@/lib/client/sources';
import { useNativeImage } from '@/lib/useNativeImage';
import type { MangaBasic } from '@/lib/sources/types';

function ImageWithFallback({ url, referer, alt }: { url: string; referer: string; alt: string }) {
  const candidates = [
    { src: url, referer },
    { src: `https://wsrv.nl/?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(referer)}` },
    { src: `https://images.weserv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//, ''))}` }
  ];
  const { url: loaded } = useNativeImage(candidates);
  if (!loaded) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-ink-400 dark:text-ink-500 text-xs">
        <svg className="w-8 h-8 opacity-40 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.6-4.6a2 2 0 012.8 0L16 16m-2-2l1.6-1.6a2 2 0 012.8 0L20 14M4 6h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z"/></svg>
      </div>
    );
  }
  return (
    <img
      src={loaded}
      alt={alt}
      loading="lazy"
      decoding="async"
      className="absolute inset-0 w-full h-full object-cover"
    />
  );
}

export default function MangaCard({ manga }: { manga: MangaBasic }) {
  const img = buildImageUrl(manga.thumbnail, manga.source);
  return (
    <Link href={`/manga/${manga.source}/${manga.slug}`} className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-2xl">
      <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-ink-100 dark:bg-ink-800 shadow-card group-hover:shadow-hover group-hover:-translate-y-1 transition-all">
        <div className="absolute top-2 left-2 z-10 px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-gradient-to-r from-accent to-accent2 text-white shadow">
          {manga.source === 'nettruyen' ? 'NetTruyen' : 'TruyenQQ'}
        </div>
        <ImageWithFallback url={img.direct} referer={img.referer} alt={manga.title} />
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
    </Link>
  );
}
