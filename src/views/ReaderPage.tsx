'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { buildHref, useHashRoute } from '@/lib/hash-router';
import { fetchChapter, buildImageUrl } from '@/lib/client/sources';
import { getSource } from '@/lib/sources';
import type { SourceId } from '@/lib/sources/types';
import { Empty, Spinner } from '@/components/Loading';
import { useTheme } from '@/components/ThemeProvider';
import { upsertHistory } from '@/lib/client/storage';

interface ChapterData { title: string; images: string[]; prev?: string; next?: string; url: string; referer: string; }

function chapterSlugFromUrl(href: string, source: SourceId): string | null {
  try {
    const u = new URL(href);
    const parts = u.pathname.split('/').filter(Boolean);
    if (source === 'nettruyen') {
      const i = parts.findIndex(p => p.startsWith('chuong-'));
      if (i >= 0) return parts[i];
    } else {
      const last = parts[parts.length-1];
      const m = last.match(/-chap-(.+)$/);
      if (m) return 'chap-' + m[1];
    }
  } catch {}
  return null;
}

export default function ReaderPage({ source, slug, chapter }: { source: string; slug: string; chapter: string }) {
  const [, navigate] = useHashRoute();
  const src = getSource(source as SourceId);
  const { readMode, setMode, theme, update } = useTheme();

  const [data, setData] = useState<ChapterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedCount, setLoadedCount] = useState(0);
  const [showChapters, setShowChapters] = useState(false);
  const [chapters, setChapters] = useState<{ slug: string; title: string; number: number }[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null); setData(null); setLoadedCount(0);
    try {
      const d = await fetchChapter(source as SourceId, slug, chapter);
      setData(d);
      upsertHistory({ source, slug, title: d.title.split('-')[0].trim()||slug, thumbnail: '', chapterSlug: chapter, chapterTitle: d.title, chapterNumber: parseFloat(chapter.replace(/[^\d.]/g,''))||0, lastPage: 0 });
    } catch (e: any) {
      setError(e?.message || 'Không thể tải chương');
    } finally { setLoading(false); }
  }, [source, slug, chapter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    let cancel = false;
    import('@/lib/client/sources').then(({ fetchMangaDetail }) => {
      fetchMangaDetail(source as SourceId, slug).then(d => { if (!cancel) setChapters(d.chapters.map(c => ({ slug: c.slug, title: c.title, number: c.number }))); }).catch(()=>{});
    });
    return () => { cancel = true; };
  }, [source, slug]);

  const goPrev = () => { if (!data?.prev) return; const cs = chapterSlugFromUrl(data.prev, source as SourceId); if (cs) navigate(`/read/${source}/${slug}/${cs}`); };
  const goNext = () => { if (!data?.next) return; const cs = chapterSlugFromUrl(data.next, source as SourceId); if (cs) navigate(`/read/${source}/${slug}/${cs}`); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'Escape') { setShowChapters(false); setShowSettings(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="bg-ink-950 text-ink-100 min-h-[calc(100vh-4rem)]">
      <div className="sticky top-0 z-30 bg-ink-900/80 backdrop-blur border-b border-ink-800">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3 text-sm">
          <a href={buildHref(`/manga/${source}/${slug}`)} className="btn-icon !w-9 !h-9" aria-label="Quay lại">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </a>
          <div className="flex-1 min-w-0"><div className="font-semibold truncate">{data?.title||'Đang tải...'}</div><div className="text-xs text-ink-400 truncate">{src?.name}</div></div>
          <button onClick={goPrev} disabled={!data?.prev} className="btn-icon !w-9 !h-9 disabled:opacity-30">‹</button>
          <button onClick={()=>setShowChapters(s=>!s)} className="btn-ghost !px-3 !py-1.5 text-xs">Chương</button>
          <button onClick={goNext} disabled={!data?.next} className="btn-icon !w-9 !h-9 disabled:opacity-30">›</button>
          <button onClick={()=>setShowSettings(s=>!s)} className="btn-icon !w-9 !h-9">⚙</button>
        </div>
        {loading && data && (
          <div className="h-1 bg-ink-800"><div className="h-full bg-gradient-to-r from-brand-500 to-pink-500 transition-all" style={{width:`${Math.min(100,(loadedCount/Math.max(1,data.images.length))*100)}%`}}/></div>
        )}
      </div>
      <div className="max-w-3xl mx-auto py-4 px-2 sm:px-0">
        {loading && <div className="flex flex-col items-center py-24 gap-4 text-ink-400"><Spinner size="lg"/><div className="text-sm">Đang tải chương...</div></div>}
        {error && <Empty title="Không thể đọc chương này" description={error}/>}
        {data && !loading && data.images.length === 0 && <Empty title="Không tìm thấy ảnh"/>}
        {data && data.images.length > 0 && (
          <div className={readMode === 'paged' ? 'flex flex-col items-center' : ''}>
            {data.images.map((img, i) => { const urls = buildImageUrl(img, data.referer); return <PageImage key={i} index={i} direct={urls.direct} localProxy={urls.localProxy} proxied={urls.proxied} proxied2={urls.proxied2} onLoad={()=>setLoadedCount(c=>c+1)}/>; })}
          </div>
        )}
        {data && !loading && (
          <div className="flex items-center justify-center gap-3 my-8">
            <button onClick={goPrev} disabled={!data.prev} className="btn-primary disabled:opacity-40">Chap trước</button>
            <a href={buildHref(`/manga/${source}/${slug}`)} className="btn-ghost">Danh sách chương</a>
            <button onClick={goNext} disabled={!data.next} className="btn-primary disabled:opacity-40">Chap sau</button>
          </div>
        )}
      </div>
      {showChapters && (
        <div className="fixed inset-0 z-50 flex" onClick={()=>setShowChapters(false)}>
          <div className="flex-1 bg-black/50 backdrop-blur-sm"/>
          <div className="w-full max-w-md bg-ink-900 border-l border-ink-800 h-full overflow-hidden flex flex-col" onClick={e=>e.stopPropagation()}>
            <div className="p-4 border-b border-ink-800 flex items-center justify-between"><div className="font-display font-bold">Danh sách chương</div><button onClick={()=>setShowChapters(false)} className="btn-icon !w-8 !h-8">✕</button></div>
            <div className="flex-1 overflow-y-auto p-2">
              {chapters.length===0?<div className="text-center text-ink-400 text-sm py-10">Đang tải...</div>:
              chapters.map(c=>(<button key={c.slug} onClick={()=>{setShowChapters(false);navigate(`/read/${source}/${slug}/${c.slug}`);}} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${c.slug===chapter?'bg-brand-500 text-white':'hover:bg-ink-800 text-ink-200'}`}>{c.title}</button>))}
            </div>
          </div>
        </div>
      )}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex" onClick={()=>setShowSettings(false)}>
          <div className="flex-1 bg-black/50 backdrop-blur-sm"/>
          <div className="w-full max-w-sm bg-ink-900 border-l border-ink-800 p-4" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><div className="font-display font-bold">Cài đặt đọc</div><button onClick={()=>setShowSettings(false)} className="btn-icon !w-8 !h-8">✕</button></div>
            <div className="space-y-4 text-sm">
              <div>
                <div className="text-ink-400 mb-2">Kiểu đọc</div>
                <div className="grid grid-cols-3 gap-2">{(['vertical','webtoon','paged'] as const).map(m=>(<button key={m} onClick={()=>setMode(m)} className={`px-3 py-2 rounded-lg text-xs font-semibold ${readMode===m?'bg-brand-500 text-white':'bg-ink-800 text-ink-200'}`}>{m==='vertical'?'Dọc':m==='webtoon'?'Webtoon':'Trang'}</button>))}</div>
              </div>
              <div>
                <div className="text-ink-400 mb-2">Nền</div>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={()=>update({theme:'dark'})} className={`px-3 py-2 rounded-lg text-xs font-semibold ${theme==='dark'?'bg-brand-500 text-white':'bg-ink-800 text-ink-200'}`}>Tối</button>
                  <button onClick={()=>update({theme:'light'})} className={`px-3 py-2 rounded-lg text-xs font-semibold ${theme==='light'?'bg-brand-500 text-white':'bg-ink-800 text-ink-200'}`}>Sáng</button>
                  <button onClick={()=>update({theme:'system'})} className={`px-3 py-2 rounded-lg text-xs font-semibold ${theme==='system'?'bg-brand-500 text-white':'bg-ink-800 text-ink-200'}`}>Hệ thống</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PageImage({ direct, localProxy, proxied, proxied2, index, onLoad }: { direct: string; localProxy: string; proxied: string; proxied2: string; index: number; onLoad: ()=>void }) {
  const [srcIdx, setSrcIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const sources = [direct, localProxy, proxied, proxied2];
  useEffect(()=>{ setSrcIdx(0); setLoaded(false); }, [direct]);
  const src = sources[srcIdx];
  return (
    <div className={`reader-page ${loaded?'loaded':''}`}>
      {!loaded && <div className="w-full max-w-3xl skeleton aspect-[2/3]"/>}
      <img src={src} alt={`Trang ${index+1}`} referrerPolicy="no-referrer" loading="lazy"
        onLoad={()=>{setLoaded(true);onLoad();}}
        onError={()=>{ if (srcIdx < sources.length - 1) setSrcIdx(srcIdx + 1); }}
        className={`transition-opacity duration-300 ${loaded?'opacity-100':'opacity-0 absolute'}`} style={{width:'100%'}}/>
    </div>
  );
}
