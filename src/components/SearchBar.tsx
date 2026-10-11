'use client';

import { useEffect, useState } from 'react';
import { useHashRoute } from '@/lib/hash-router';

export default function SearchBar() {
  const [route, navigate] = useHashRoute();
  const [q, setQ] = useState('');

  useEffect(() => {
    if (route.path === '/search') setQ(route.query.q || '');
  }, [route.path, route.query.q]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    navigate(`/search?q=${encodeURIComponent(q.trim())}&source=truyenqq`);
  };

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Nhập tên truyện..."
          className="flex-1 px-4 py-3 rounded-xl bg-ink-100 dark:bg-ink-800 outline-none focus:ring-2 ring-brand-500 text-sm"
        />
        <button className="btn-primary px-5">Tìm</button>
      </div>
    </form>
  );
}
