'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function SearchBar() {
  const [q, setQ] = useState('');
  const [source, setSource] = useState<'all' | 'nettruyen' | 'truyenqq'>('all');
  const [focused, setFocused] = useState(false);
  const router = useRouter();
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!q.trim()) return;
    router.push(`/search?q=${encodeURIComponent(q.trim())}&source=${source}`);
    setFocused(false);
  };

  return (
    <div ref={wrap} className="relative flex-1 max-w-md">
      <form onSubmit={submit} className="flex items-center gap-2 px-3 py-2 rounded-full bg-ink-100 dark:bg-ink-800/70 focus-within:ring-2 ring-brand-500 transition">
        <svg viewBox="0 0 24 24" className="w-4 h-4 text-ink-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="Tìm tên truyện, tác giả..."
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-ink-400"
          aria-label="Tìm truyện"
        />
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as any)}
          className="hidden sm:block bg-transparent text-xs text-ink-500 dark:text-ink-300 outline-none border-l border-ink-200 dark:border-ink-700 pl-2"
          aria-label="Nguồn"
        >
          <option value="all">Tất cả</option>
          <option value="nettruyen">NetTruyen</option>
          <option value="truyenqq">TruyenQQ</option>
        </select>
      </form>
      {focused && (
        <div className="absolute left-0 right-0 mt-2 card p-3 text-sm text-ink-500 dark:text-ink-400">
          <div className="font-medium text-ink-700 dark:text-ink-200 mb-1">Gợi ý</div>
          <div>Gõ tên truyện (ví dụ: <em>đồ đệ của ta đều là đại phản phái</em>) rồi nhấn Enter.</div>
          <div className="mt-1">Ứng dụng sẽ tìm trên cả NetTruyen và TruyenQQ và hiển thị tất cả chương.</div>
        </div>
      )}
    </div>
  );
}
