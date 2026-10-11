import { useEffect, useMemo, useRef, useState } from 'react';
import type { Cue, Item, SubMode } from './types';
import { parseVtt, findCueIndex } from './subs';
import { speak, stopSpeak, narrationSupported } from './narrate';
import { getSubtitleJob, startSubtitleJob } from './api';

const EXTRA_KEY = 'sv_extra_items';
const MODE_LABEL: Record<SubMode, string> = { overlay: 'Chữ đè', parallel: 'Song song', off: 'Tắt sub' };
const NEXT_MODE: Record<SubMode, SubMode> = { overlay: 'parallel', parallel: 'off', off: 'overlay' };

export default function App() {
  const [base, setBase] = useState<Item[]>([]);
  const [extra, setExtra] = useState<Item[]>(() => {
    try { return JSON.parse(localStorage.getItem(EXTRA_KEY) || '[]'); } catch { return []; }
  });
  const [subsById, setSubsById] = useState<Record<string, Cue[]>>({});
  const [activeId, setActiveId] = useState<string>('');
  const [mode, setMode] = useState<SubMode>('overlay');
  const [narrate, setNarrate] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [status, setStatus] = useState('');
  const feedRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => [...extra, ...base], [extra, base]);

  useEffect(() => {
    fetch('/sources.json').then((r) => r.json()).then(setBase).catch(() => setBase([]));
  }, []);

  useEffect(() => {
    localStorage.setItem(EXTRA_KEY, JSON.stringify(extra));
  }, [extra]);

  useEffect(() => {
    if (!activeId && items.length) setActiveId(items[0].id);
  }, [items, activeId]);

  // Tải phụ đề có sẵn (subtitles .vtt) khi slide được kích hoạt
  useEffect(() => {
    const it = items.find((i) => i.id === activeId);
    if (!it?.subtitles || subsById[it.id]) return;
    fetch(it.subtitles)
      .then((r) => r.text())
      .then((t) => setSubsById((s) => ({ ...s, [it.id]: parseVtt(t) })))
      .catch(() => {});
  }, [activeId, items, subsById]);

  // Dừng thuyết minh khi tắt hoặc đổi slide
  useEffect(() => { if (!narrate) stopSpeak(); }, [narrate]);
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

  const addUrl = () => {
    const url = newUrl.trim();
    if (!/^https?:\/\//.test(url)) { setStatus('Link phải bắt đầu bằng http(s)://'); return; }
    const id = 'x' + Date.now();
    setExtra((e) => [{ id, title: url.split('/').pop() || 'Video mới', url, tags: ['tự thêm'] }, ...e]);
    setNewUrl('');
    setStatus('Đã thêm video');
    setTimeout(() => setStatus(''), 2000);
  };

  const removeItem = (id: string) => setExtra((e) => e.filter((i) => i.id !== id));

  const generateSubs = async (item: Item) => {
    const translate = true;
    try {
      setStatus('Đang gửi video để nhận dạng tiếng Trung…');
      let job = await startSubtitleJob(item.url, translate);
      while (job.status === 'queued' || job.status === 'running') {
        setStatus(`${job.message || 'Đang xử lý'}…`);
        await new Promise((r) => setTimeout(r, 2500));
        job = await getSubtitleJob(job.id);
      }
      if (job.status === 'error') throw new Error(job.message || 'Lỗi');
      setSubsById((s) => ({ ...s, [item.id]: job.cues ?? [] }));
      setStatus(`Xong: ${job.cues?.length ?? 0} câu phụ đề`);
    } catch (e) {
      setStatus('Lỗi phụ đề: ' + (e as Error).message);
    } finally {
      setTimeout(() => setStatus(''), 4000);
    }
  };

  return (
    <>
      <div className="top">
        <div className="brand">🎬 ShortVideo</div>
        <input
          placeholder="Dán link video mp4…"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addUrl()}
        />
        <button onClick={addUrl}>+</button>
      </div>
      {status && <div className="status">{status}</div>}

      <div className="feed" ref={feedRef}>
        {items.length === 0 && <div className="slide"><div className="empty">Chưa có video. Dán link mp4 ở trên để thêm.</div></div>}
        {items.map((it) => (
          <Slide
            key={it.id}
            item={it}
            active={it.id === activeId}
            cues={subsById[it.id]}
            mode={mode}
            narrate={narrate}
            onModeCycle={() => setMode((m) => NEXT_MODE[m])}
            onNarrateToggle={() => setNarrate((n) => !n)}
            onGenerate={() => generateSubs(it)}
            onRemove={it.id.startsWith('x') ? () => removeItem(it.id) : undefined}
          />
        ))}
      </div>
    </>
  );
}

function Slide(props: {
  item: Item;
  active: boolean;
  cues?: Cue[];
  mode: SubMode;
  narrate: boolean;
  onModeCycle: () => void;
  onNarrateToggle: () => void;
  onGenerate: () => void;
  onRemove?: () => void;
}) {
  const { item, active, cues, mode, narrate } = props;
  const vref = useRef<HTMLVideoElement>(null);
  const [cur, setCur] = useState<Cue | null>(null);
  const lastIdx = useRef(-1);

  // Chỉ phát video đang hiển thị
  useEffect(() => {
    const v = vref.current;
    if (!v) return;
    if (active) { v.play().catch(() => {}); } else { v.pause(); lastIdx.current = -1; setCur(null); }
  }, [active]);

  // Thuyết minh: hạ âm gốc khi đọc
  useEffect(() => {
    if (vref.current) vref.current.volume = narrate ? 0.35 : 1;
  }, [narrate]);

  const onTime = () => {
    const v = vref.current;
    if (!v || !cues?.length) { if (cur) setCur(null); return; }
    const idx = findCueIndex(cues, v.currentTime);
    if (idx === lastIdx.current) return;
    lastIdx.current = idx;
    const c = idx >= 0 ? cues[idx] : null;
    setCur(c);
    if (c && narrate && active && narrationSupported()) {
      if (c.vi) speak(c.vi, 'vi-VN');
      else speak(c.zh, 'zh-CN');
    }
  };

  const showSubs = mode !== 'off' && cur;

  return (
    <div className="slide" data-id={item.id}>
      <video
        ref={vref}
        src={item.url}
        playsInline
        loop
        preload={active ? 'auto' : 'metadata'}
        onTimeUpdate={onTime}
        onClick={(e) => { const v = e.currentTarget; v.paused ? v.play() : v.pause(); }}
      />

      {showSubs && mode === 'overlay' && (
        <div className="subs">
          <div className="zh">{cur!.zh}</div>
          {cur!.vi && <div className="vi">{cur!.vi}</div>}
        </div>
      )}
      {showSubs && mode === 'parallel' && (
        <div className="parallel">
          <div className="col zh">{cur!.zh}</div>
          <div className="col vi">{cur!.vi ?? '…'}</div>
        </div>
      )}

      <div className="meta">
        <h3>{item.title}</h3>
        <div className="tags">{item.tags?.map((t) => <span key={t}>#{t}</span>)}</div>
      </div>

      <div className="actions">
        <button onClick={props.onGenerate} title="Tự tạo phụ đề tiếng Trung">
          <span className="ico">文</span>Sub AI
        </button>
        <button className={mode !== 'off' ? 'on' : ''} onClick={props.onModeCycle}>
          <span className="ico">▤</span>{MODE_LABEL[mode]}
        </button>
        <button className={narrate ? 'on' : ''} onClick={props.onNarrateToggle} title="Giọng AI đọc thuyết minh">
          <span className="ico">🔊</span>{narrate ? 'Đọc: bật' : 'Thuyết minh'}
        </button>
        {props.onRemove && <button onClick={props.onRemove}><span className="ico">🗑</span>Xoá</button>}
      </div>
    </div>
  );
}
