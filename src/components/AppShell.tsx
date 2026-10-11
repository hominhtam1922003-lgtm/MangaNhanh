'use client';

import { useEffect, useState } from 'react';
import { buildHref, useHashRoute } from '@/lib/hash-router';
import { useTheme } from './ThemeProvider';

function Moon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
  );
}
function Sun({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
  );
}
function Monitor({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 22h8M12 18v4"/></svg>
  );
}

function Header() {
  const { theme, toggleTheme } = useTheme();
  const [route, navigate] = useHashRoute();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [q, setQ] = useState('');
  const [source, setSource] = useState<'all'|'nettruyen'|'truyenqq'>('all');

  useEffect(() => { setMobileOpen(false); }, [route.path]);

  const icon = theme === 'dark' ? <Moon className="w-5 h-5"/> : theme === 'light' ? <Sun className="w-5 h-5"/> : <Monitor className="w-5 h-5"/>;

  const nav = [
    { href: '/', label: 'Khám phá', active: route.path === '/' },
    { href: '/library', label: 'Thư viện', active: route.path.startsWith('/library') },
    { href: '/history', label: 'Lịch sử', active: route.path.startsWith('/history') },
    { href: '/download', label: 'Tải APK', active: route.path.startsWith('/download') },
    { href: '/about', label: 'Giới thiệu', active: route.path.startsWith('/about') }
  ];

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    navigate(`/search?q=${encodeURIComponent(q.trim())}&source=${source}`);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 dark:bg-ink-950/70 border-b border-ink-100 dark:border-ink-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
        <a href={buildHref('/')} className="flex items-center gap-2 font-display font-bold text-xl">
          <span className="inline-flex w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-pink-500 items-center justify-center text-white shadow-lg shadow-brand-500/30">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5"><path d="M4 5h10a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M8 10h8M8 14h8M8 18h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="18" cy="6" r="4" fill="currentColor"/></svg>
          </span>
          <span className="hidden sm:block bg-gradient-to-r from-brand-500 to-pink-500 bg-clip-text text-transparent">MangaNhanh</span>
        </a>
        <nav className="hidden md:flex items-center gap-1 ml-4">
          {nav.map(n => (
            <a key={n.href} href={buildHref(n.href)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${n.active ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10' : 'text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800'}`}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex-1"/>
        <form onSubmit={submitSearch} className="relative hidden sm:flex items-center gap-2 px-3 py-2 rounded-full bg-ink-100 dark:bg-ink-800/70 focus-within:ring-2 ring-brand-500 transition max-w-md w-full">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-ink-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Tìm tên truyện..." className="flex-1 bg-transparent outline-none text-sm placeholder:text-ink-400" aria-label="Tìm truyện"/>
          <select value={source} onChange={e=>setSource(e.target.value as any)} className="hidden lg:block bg-transparent text-xs text-ink-500 dark:text-ink-300 outline-none border-l border-ink-200 dark:border-ink-700 pl-2">
            <option value="all">Tất cả</option>
            <option value="nettruyen">NetTruyen</option>
            <option value="truyenqq">TruyenQQ</option>
          </select>
        </form>
        <button onClick={toggleTheme} aria-label="Đổi theme" className="btn-icon" title="Chế độ giao diện">{icon}</button>
        <button className="md:hidden btn-icon" aria-label="Menu" onClick={() => setMobileOpen(o => !o)}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
        </button>
      </div>
      {mobileOpen && (
        <div className="md:hidden border-t border-ink-100 dark:border-ink-800 px-4 py-2 space-y-1">
          <form onSubmit={submitSearch} className="flex items-center gap-2 mb-2">
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Tìm tên truyện..." className="flex-1 px-3 py-2 rounded-lg bg-ink-100 dark:bg-ink-800 outline-none text-sm"/>
            <button className="btn-primary !py-2 !px-3 text-sm">Tìm</button>
          </form>
          {nav.map(n => (
            <a key={n.href} href={buildHref(n.href)} className={`block px-3 py-2 rounded-lg text-sm font-medium ${n.active ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10' : 'text-ink-700 dark:text-ink-200'}`}>{n.label}</a>
          ))}
        </div>
      )}
    </header>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header/>
      <main className="min-h-[calc(100vh-4rem)] pb-20 animate-fade-in">{children}</main>
      <footer className="border-t border-ink-100 dark:border-ink-800 py-6 text-center text-xs text-ink-500 dark:text-ink-400">
        MangaNhanh · Đọc truyện tranh từ NetTruyen & TruyenQQ ·
        <a href={buildHref('/download')} className="ml-2 text-brand-500 hover:underline">Tải APK</a>
      </footer>
    </>
  );
}
