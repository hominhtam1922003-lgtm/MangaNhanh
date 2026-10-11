import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Cue, Item, SubMode } from './types';
import { parseVtt, findCueIndex } from './subs';
import { speak, stopSpeak, narrationSupported } from './narrate';
import { getSubtitleJob, startSubtitleJob } from './api';

const EXTRA_KEY = 'sv_extra_items';
const PREF_KEY = 'sv_prefs';
type Prefs = { muted: boolean; narrate: boolean; mode: SubMode };
const DEFAULT_PREFS: Prefs = { muted: false, narrate: false, mode: 'overlay' };
const MODE_LABEL: Record<SubMode, string> = { overlay: 'Chữ đè', parallel: 'Song song', off: 'Tắt sub' };
const NEXT_MODE: Record<SubMode, SubMode> = { overlay: 'parallel', parallel: 'off', off: 'overlay' };

const loadJSON = <T,>(key: string, fallback: T): T => {
  try { return { ...fallback, ...JSON.parse(localStorage.getItem(key) || 'null') }; } catch { return fallback; }
};

export default function App() {
  const [base, setBase] = useState<Item[]>([]);
  const [extra, setExtra] = useState<Item[]>(() => {
    try { return JSON.parse(localStorage.getItem(EXTRA_KEY) || '[]'); } catch { return []; }
  });
  const [found, setFound] = useState<Item[]>([]);
  const [subsById, setSubsById] = useState<Record<string, Cue[]>>({});
  const [activeId, setActiveId] = useState('');
  const [prefs, setPrefs] = useState<Prefs>(() => loadJSON(PREF_KEY, DEFAULT_PREFS));
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('');
  const [busyId, setBusyId] = useState('');
  const [loading, setLoading] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => {
    const seen = new Set<string>();
    return [...extra, ...found, ...base].filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
  }, [extra, found, base]);

  const activeIndex = Math.max(0, items.findIndex((i) => i.id === activeId));

  const flash = useCallback((msg: string, ms = 2500) => {
    setStatus(msg);
    window.clearTimeout((flash as any).t);
    (flash as any).t = window.setTimeout(() => setStatus(''), ms);
  }, []);

  useEffect(() => {
    fetch('/sources.json').then((r) => r.json()).then(setBase).catch(() => setBase([]));
  }, []);
  useEffect(() => { localStorage.setItem(EXTRA_KEY, JSON.stringify(extra)); }, [extra]);
  useEffect(() => { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); }, [prefs]);
  useEffect(() => { if (!activeId && items.length) setActiveId(items[0].id); }, [items, activeId]);

  // Tải phụ đề có sẵn (.vtt) cho slide đang xem và slide kế tiếp
  useEffect(() => {
    for (const i of [activeIndex, activeIndex + 1]) {
      const it = items[i];
      if (!it?.subtitles || subsById[it.id]) continue;
      fetch(it.subtitles).then((r) => r.text())
        .then((t) => setSubsById((s) => ({ ...s, [it.id]: parseVtt(t) })))
        .catch(() => {});
    }
  }, [activeIndex, items, subsById]);

  useEffect(() => { if (!prefs.narrate) stopSpeak(); }, [prefs.narrate]);
  useEffect(() => { stopSpeak(); }, [activeId]);

  // Theo dõi slide đang hiển thị (kiểu Douyin)
  useEffect(() => {
    const root = feedRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio > 0.6) setActiveId((e.target as HTMLElement).dataset.id!);
        }
      },
      { root, threshold: [0.6] },
    );
    root.querySelectorAll('.slide').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  // Phím tắt: ↑ ↓ cuộn, Space phát/dừng, M tắt/bật tiếng
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      const feed = feedRef.current;
      if (!feed) return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); feed.scrollBy({ top: innerHeight, behavior: 'smooth' }); }
      if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); feed.scrollBy({ top: -innerHeight, behavior: 'smooth' }); }
      if (e.key === ' ') {
        e.preventDefault();
        const v = feed.querySelector<HTMLVideoElement>(`.slide[data-id="${CSS.escape(activeId)}"] video`);
        v && (v.paused ? v.play().catch(() => {}) : v.pause());
      }
      if (e.key.toLowerCase() === 'm') setPrefs((p) => ({ ...p, muted: !p.muted }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeId]);

  const submit = async () => {
    const q = input.trim();
    if (!q) return;
    if (/^https?:\/\//.test(q)) {
      const id = 'x' + Date.now();
      setExtra((e) => [{ id, title: q.split('/').pop() || 'Video mới', url: q, tags: ['tự thêm'] }, ...e]);
      setInput('');
      flash('Đã thêm video');
      return;
    }
    // Tìm video miễn phí (Pexels) qua backend
    setLoading(true);
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || `HTTP ${r.status}`);
      setFound(data.items as Item[]);
      setInput('');
      flash(`Tìm thấy ${data.items.length} video cho "${q}"`);
      feedRef.current?.scrollTo({ top: 0 });
    } catch (e) {
      flash('Tìm kiếm lỗi: ' + (e as Error).message, 5000);
    } finally {
      setLoading(false);
    }
  };

  const generateSubs = async (item: Item) => {
    setBusyId(item.id);
    try {
      let job = await startSubtitleJob(item.url, true);
      while (job.status === 'queued' || job.status === 'running') {
        flash(`${job.message || 'Đang xử lý'}…`, 60000);
        await new Promise((r) => setTimeout(r, 2500));
        job = await getSubtitleJob(job.id);
      }
      if (job.status === 'error') throw new Error(job.message || 'Lỗi');
      setSubsById((s) => ({ ...s, [item.id]: job.cues ?? [] }));
      flash(`Xong: ${job.cues?.length ?? 0} câu phụ đề`);
    } catch (e) {
      flash('Lỗi phụ đề: ' + (e as Error).message, 5000);
    } finally {
      setBusyId('');
    }
  };

  return (
    <>
      <div className="top">
        <div className="brand">🎬 ShortVideo</div>
        <input
          placeholder="Tìm video (vd: ocean) hoặc dán link mp4…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          aria-label="Tìm kiếm hoặc dán link video"
        />
        <button onClick={submit} disabled={loading} aria-label="Thêm / tìm">{loading ? '…' : '+'}</button>
        <button
          className="ghost"
          onClick={() => setPrefs((p) => ({ ...p, muted: !p.muted }))}
          aria-label={prefs.muted ? 'Bật tiếng' : 'Tắt tiếng'}
        >{prefs.muted ? '🔇' : '🔈'}</button>
      </div>
      {status && <div className="status" role="status">{status}</div>}

      <div className="feed" ref={feedRef}>
        {items.length === 0 && (
          <div className="slide"><div className="empty">Đang tải danh sách video…</div></div>
        )}
        {items.map((it, i) => (
          <Slide
            key={it.id}
            item={it}
            index={i}
            activeIndex={activeIndex}
            cues={subsById[it.id]}
            prefs={prefs}
            busy={busyId === it.id}
            onModeCycle={() => setPrefs((p) => ({ ...p, mode: NEXT_MODE[p.mode] }))}
            onNarrateToggle={() => setPrefs((p) => ({ ...p, narrate: !p.narrate }))}
            onMuteToggle={() => setPrefs((p) => ({ ...p, muted: !p.muted }))}
            onGenerate={() => generateSubs(it)}
            onRemove={it.id.startsWith('x') ? () => setExtra((e) => e.filter((x) => x.id !== it.id)) : undefined}
          />
        ))}
      </div>
    </>
  );
}

type SlideProps = {
  item: Item;
  index: number;
  activeIndex: number;
  cues?: Cue[];
  prefs: Prefs;
  busy: boolean;
  onModeCycle: () => void;
  onNarrateToggle: () => void;
  onMuteToggle: () => void;
  onGenerate: () => void;
  onRemove?: () => void;
};

function Slide(props: SlideProps) {
  const { item, index, activeIndex, cues, prefs, busy } = props;
  const active = index === activeIndex;
  const near = Math.abs(index - activeIndex) <= 1;
  const vref = useRef<HTMLVideoElement>(null);
  const lastIdx = useRef(-1);
  const [cur, setCur] = useState<Cue | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [progress, setProgress] = useState(0);
  const [needTap, setNeedTap] = useState(false);
  const [icon, setIcon] = useState<'play' | 'pause' | null>(null);

  const playSafe = async (v: HTMLVideoElement) => {
    try {
      await v.play();
      setNeedTap(false);
    } catch {
      // Trình duyệt chặn autoplay có tiếng → phát tắt tiếng và hiện "chạm để bật tiếng"
      v.muted = true;
      try { await v.play(); setNeedTap(true); } catch { /* người dùng sẽ chạm để phát */ }
    }
  };

  // Phát khi slide được kích hoạt, dừng khi rời đi
  useEffect(() => {
    const v = vref.current;
    if (!v) return;
    if (active) playSafe(v);
    else { v.pause(); lastIdx.current = -1; setCur(null); }
  }, [active]);

  // Áp dụng tắt tiếng & hạ âm khi thuyết minh đang đọc
  useEffect(() => {
    const v = vref.current;
    if (!v) return;
    v.muted = prefs.muted;
    v.volume = prefs.narrate ? 0.35 : 1;
  }, [prefs.muted, prefs.narrate, attempt]);

  const onTime = () => {
    const v = vref.current;
    if (!v) return;
    setProgress(v.duration ? v.currentTime / v.duration : 0);
    if (!cues?.length) { if (cur) setCur(null); return; }
    const idx = findCueIndex(cues, v.currentTime);
    if (idx === lastIdx.current) return;
    lastIdx.current = idx;
    const c = idx >= 0 ? cues[idx] : null;
    setCur(c);
    if (c && prefs.narrate && active && narrationSupported()) {
      if (c.vi) speak(c.vi, 'vi-VN');
      else speak(c.zh, 'zh-CN');
    }
  };

  const onTap = () => {
    const v = vref.current;
    if (!v) return;
    if (needTap) { v.muted = prefs.muted; setNeedTap(false); v.play().catch(() => {}); return; }
    if (v.paused) { v.play().catch(() => {}); setIcon('play'); }
    else { v.pause(); setIcon('pause'); }
    window.setTimeout(() => setIcon(null), 500);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = vref.current;
    if (!v || !v.duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    v.currentTime = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1) * v.duration;
  };

  const showSubs = prefs.mode !== 'off' && cur;

  return (
    <div className="slide" data-id={item.id}>
      {item.thumb && state !== 'ready' && <img className="poster" src={item.thumb} alt="" />}
      <video
        key={attempt}
        ref={vref}
        src={item.url}
        playsInline
        loop
        preload={near ? 'auto' : 'metadata'}
        onTimeUpdate={onTime}
        onWaiting={() => setState('loading')}
        onPlaying={() => setState('ready')}
        onCanPlay={() => setState('ready')}
        onError={() => setState('error')}
        onClick={onTap}
      />

      {state === 'loading' && active && <div className="spinner" aria-label="Đang tải" />}
      {icon && <div className="flash-icon">{icon === 'play' ? '▶' : '❚❚'}</div>}
      {needTap && active && <div className="tap-unmute" onClick={onTap}>🔇 Chạm để bật tiếng</div>}
      {state === 'error' && (
        <div className="err">
          <div>Không tải được video</div>
          <button onClick={() => { setState('loading'); setAttempt((a) => a + 1); }}>Thử lại</button>
        </div>
      )}

      {showSubs && prefs.mode === 'overlay' && (
        <div className="subs">
          <div className="zh">{cur!.zh}</div>
          {cur!.vi && <div className="vi">{cur!.vi}</div>}
        </div>
      )}
      {showSubs && prefs.mode === 'parallel' && (
        <div className="parallel">
          <div className="col zh">{cur!.zh}</div>
          <div className="col vi">{cur!.vi ?? '…'}</div>
        </div>
      )}

      <div className="meta">
        <h3>{item.title}</h3>
        <div className="tags">{item.tags?.map((t) => <span key={t}>#{t}</span>)}</div>
        {item.credit && <div className="credit">{item.credit}</div>}
      </div>

      <div className="actions">
        <button onClick={props.onGenerate} disabled={busy} title="Tự tạo phụ đề tiếng Trung">
          <span className="ico">{busy ? '⏳' : '文'}</span>Sub AI
        </button>
        <button className={prefs.mode !== 'off' ? 'on' : ''} onClick={props.onModeCycle}>
          <span className="ico">▤</span>{MODE_LABEL[prefs.mode]}
        </button>
        <button className={prefs.narrate ? 'on' : ''} onClick={props.onNarrateToggle} title="Giọng AI đọc thuyết minh">
          <span className="ico">🔊</span>{prefs.narrate ? 'Đọc: bật' : 'Thuyết minh'}
        </button>
        {props.onRemove && <button onClick={props.onRemove}><span className="ico">🗑</span>Xoá</button>}
      </div>

      <div className="bar" onClick={seek} role="slider" aria-label="Tiến trình" aria-valuenow={Math.round(progress * 100)}>
        <div style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}
