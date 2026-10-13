'use client';

const PREFIX = 'manganhanh:';

export interface FavItem {
  source: string;
  slug: string;
  title: string;
  thumbnail: string;
  addedAt: number;
}
export interface HistoryItem {
  source: string;
  slug: string;
  title: string;
  thumbnail: string;
  chapterSlug: string;
  chapterTitle: string;
  chapterNumber: number;
  lastPage?: number;
  readAt: number;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
function write<T>(key: string, val: T) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(PREFIX + key, JSON.stringify(val)); } catch {}
}

export function getFavorites(): FavItem[] {
  return read<FavItem[]>('favorites', []);
}
export function isFavorite(source: string, slug: string) {
  return getFavorites().some(f => f.source === source && f.slug === slug);
}
export function toggleFavorite(item: FavItem) {
  const favs = getFavorites();
  const idx = favs.findIndex(f => f.source === item.source && f.slug === item.slug);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.unshift({ ...item, addedAt: Date.now() });
  write('favorites', favs);
  return idx < 0;
}

export function getHistory(): HistoryItem[] {
  return read<HistoryItem[]>('history', []);
}
export function upsertHistory(item: Omit<HistoryItem, 'readAt'>) {
  const list = getHistory();
  const idx = list.findIndex(h => h.source === item.source && h.slug === item.slug && h.chapterSlug === item.chapterSlug);
  const entry: HistoryItem = { ...item, readAt: Date.now() };
  if (idx >= 0) list[idx] = entry; else list.unshift(entry);
  const trimmed = list.slice(0, 200);
  write('history', trimmed);
}
export function getLastRead(source: string, slug: string): HistoryItem | undefined {
  return getHistory().find(h => h.source === source && h.slug === slug);
}

// Settings
export interface Settings {
  theme: 'dark' | 'light' | 'system';
  readMode: 'vertical' | 'paged' | 'webtoon';
  imageQuality: 'original' | 'high' | 'medium';
  direction: 'ltr' | 'rtl';
}
export function getSettings(): Settings {
  return read<Settings>('settings', { theme: 'dark', readMode: 'vertical', imageQuality: 'original', direction: 'ltr' });
}
export function setSettings(s: Partial<Settings>) {
  const cur = getSettings();
  write('settings', { ...cur, ...s });
}
