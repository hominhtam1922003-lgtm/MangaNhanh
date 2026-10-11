'use client';

import { useEffect, useMemo, useState } from 'react';
import A from '@/components/A';
import { buildHref, useHashRoute } from '@/lib/hash-router';
import { SOURCES } from '@/lib/sources';
import { fetchMangaDetail } from '@/lib/client/sources';
import type { MangaDetail } from '@/lib/sources/types';
import { Empty, Skeleton } from '@/components/Loading';
import { toggleFavorite, isFavorite, getLastRead, upsertHistory } from '@/lib/client/storage';
import { useImage } from '@/lib/img';

function CoverImg({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  const { src: url } = useImage(src, 'https://truyenqqko.com/');
  if (!src) return <div className={className + ' bg-ink-200 dark:bg-ink-800'}/>;
  return url
    ? <img src={url} alt={alt} className={className} referrerPolicy="no-referrer"/>
    : <div className={className + ' bg-ink-200 dark:bg-ink-800'}/>;
}

export default function MangaDetailPage({ source, slug }: { source: string; slug: string }) {
  const [, navigate] = useHashRoute();
  const [detail, setDetail] = useState<MangaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fav, setFav] = useState(false);
  const [search, setSearch] = useState('');
  const [sortDesc, setSortDesc] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true); setError(null); setDetail(null);
    fetchMangaDetail(source as any, slug)
      .then(d => { if (!cancel) setDetail(d); })
      .catch(e => { if (!cancel) setError(e?.message || 'Không thể tải truyện'); })
      .finally(() => { if (!cancel) setLoading(false); });
    setFav(isFavorite(source, slug));
    return () => { cancel = true; };
  }, [source, slug]);

  const chapters = useMemo(() => {
    if (!detail) return [];
    let list = [...detail.chapters];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => c.title.toLowerCase().includes(q) || String(c.number).includes(q));
    }
    if (!sortDesc) list.reverse();
    return list;
  }, [detail, search, sortDesc]);

  const last = detail ? getLastRead(source, slug) : undefined;

  const handleFav = () => {
    if (!detail) return;
    const added = toggleFavorite({ source, slug, title: detail.title, thumbnail: detail.thumbnail, addedAt: Date.now() });
    setFav(added);
  };

  const goChapter = (cSlug: string, cTitle: string, cNum: number) => {
    if (!detail) return;
    upsertHistory({ source, slug, title: detail.title, thumbnail: detail.thumbnail, chapterSlug: cSlug, chapterTitle: cTitle, chapterNumber: cNum });
    navigate(`/read/${source}/${slug}/${cSlug}`);
  };

  const src = SOURCES[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
      {loading && <DetailSkeleton/>}
      {error && <Empty title="Lỗi tải truyện" description={error}/>}
      {detail && src && (
        <>
          <div className="relative rounded-3xl overflow-hidden">
            <div className="absolute inset-0">
              <CoverImg src={detail.thumbnail} alt="" className="w-full h-full object-cover blur-2xl opacity-30 scale-110"/>
              <div className="absolute inset-0 bg-gradient-to-b from-white/60 to-white/95 dark:from-ink-950/60 dark:to-ink-950"/>
            </div>
            <div className="relative p-5 sm:p-8 flex flex-col md:flex-row gap-6">
              <div className="flex-shrink-0 mx-auto md:mx-0">
                <div className="w-48 h-72 rounded-2xl overflow-hidden shadow-2xl bg-ink-100 dark:bg-ink-900 relative">
                  <CoverImg src={detail.thumbnail} alt={detail.title} className="w-full h-full object-cover absolute inset-0"/>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r ${src.logoColor}`}>{src.name}</span>
                  {detail.status && <span className="chip">{detail.status}</span>}
                  {detail.rating && <span className="chip">⭐ {detail.rating}</span>}
                </div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-extrabold">{detail.title}</h1>
                {detail.otherName && <p className="text-ink-500 mt-1 text-sm italic">{detail.otherName}</p>}
                <div className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  {detail.author && <InfoRow label="Tác giả" value={detail.author}/>}
                  {detail.views && <InfoRow label="Lượt xem" value={detail.views}/>}
                  {detail.followers && <InfoRow label="Theo dõi" value={detail.followers}/>}
                  {detail.chapters.length > 0 && <InfoRow label="Tổng chương" value={`${detail.chapters.length} chương`}/>}
                </div>
                {detail.genres && detail.genres.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">{detail.genres.map(g => <span key={g.slug} className="chip">{g.name}</span>)}</div>
                )}
                <div className="mt-5 flex flex-wrap gap-2">
                  {chapters.length > 0 && (
                    <>
                      <button onClick={() => { const c = chapters[chapters.length-1]; goChapter(c.slug,c.title,c.number); }} className="btn-primary">▶ Đọc từ đầu</button>
                      <button onClick={() => { const c = chapters[0]; goChapter(c.slug,c.title,c.number); }} className="btn-ghost">Đọc mới nhất</button>
                    </>
                  )}
                  {last && <button onClick={() => navigate(`/read/${source}/${slug}/${last.chapterSlug}`)} className="btn-ghost">Đọc tiếp · {last.chapterTitle}</button>}
                  <button onClick={handleFav} className="btn-ghost">{fav ? '★ Đã yêu thích' : '☆ Yêu thích'}</button>
                </div>
                {detail.description && (
                  <details className="mt-5 rounded-xl bg-white/60 dark:bg-ink-900/60 border border-ink-100 dark:border-ink-800 p-4">
                    <summary className="cursor-pointer font-semibold text-sm">Nội dung truyện</summary>
                    <p className="mt-2 text-sm text-ink-600 dark:text-ink-300 whitespace-pre-wrap leading-relaxed">{detail.description}</p>
                  </details>
                )}
              </div>
            </div>
          </div>

          <section className="mt-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-xl font-display font-bold">Danh sách chương<span className="ml-2 text-sm font-normal text-ink-500">{detail.chapters.length} chương</span></h2>
              <div className="flex gap-2">
                <input placeholder="Tìm chương..." value={search} onChange={e=>setSearch(e.target.value)} className="px-3 py-2 rounded-lg bg-ink-100 dark:bg-ink-800 outline-none text-sm w-44"/>
                <button onClick={() => setSortDesc(d => !d)} className="btn-ghost text-sm py-2">{sortDesc ? 'Mới nhất ↑' : 'Cũ nhất ↓'}</button>
              </div>
            </div>
            {chapters.length === 0 ? <Empty title="Không tìm thấy chương"/> : (
              <div className="card p-3 max-h-[560px] overflow-y-auto">
                <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1">
                  {chapters.map((c) => {
                    const active = last?.chapterSlug === c.slug;
                    return (
                      <button key={c.slug} onClick={()=>goChapter(c.slug,c.title,c.number)} className={`chapter-link text-left ${active?'active':''}`}>
                        <div className="flex justify-between items-center gap-2">
                          <span className="truncate">{c.title}</span>
                          {c.updatedAt && <span className="text-[10px] text-ink-400 flex-shrink-0">{c.updatedAt}</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex gap-2 py-0.5"><span className="text-ink-500 w-24 flex-shrink-0">{label}</span><span className="text-ink-800 dark:text-ink-100 font-medium break-words">{value}</span></div>;
}

function DetailSkeleton() {
  return <div><Skeleton className="h-80 w-full rounded-3xl"/><div className="mt-6 grid lg:grid-cols-4 gap-4"><Skeleton className="h-8 w-full"/><Skeleton className="h-8 w-full"/><Skeleton className="h-8 w-full"/><Skeleton className="h-8 w-full"/></div></div>;
}
