'use client';

import { corsFetch, SOURCES } from '../sources';
import {
  parseTruyenqqDetail, parseTruyenqqChapter, parseTruyenqqHome,
  parseTruyenqqChapters, absoluteUrl, extractChapterNumber
} from '../sources/parse';
import type { Chapter, MangaBasic, MangaDetail, SourceId } from '../sources/types';

// TruyenQQ renders the FULL chapter list on page 1 of the manga detail page;
// page 2+ return near-empty "404-like" pages. Probing just a couple is enough.
const MAX_CHAPTER_PAGES = 3;
const TRUYENQQ_BASE = 'https://truyenqqko.com';

async function loadAllChapters(detailUrl: string, initialHtml: string, mangaSlug: string): Promise<Chapter[]> {
  const all = new Map<string, Chapter>();
  const add = (c: Chapter) => { if (!all.has(c.slug)) all.set(c.slug, c); };
  parseTruyenqqChapters(initialHtml, mangaSlug).forEach(add);

  for (let page = 2; page <= MAX_CHAPTER_PAGES; page++) {
    const url = `${detailUrl}?page=${page}`;
    let html: string;
    try { html = await corsFetch(url); } catch { break; }
    if (!html || html.length < 2000) break;
    const before = all.size;
    parseTruyenqqChapters(html, mangaSlug).forEach(add);
    const added = all.size - before;
    if (added === 0) break;
    if (added < 5) break;
  }
  return Array.from(all.values()).sort((a, b) => b.number - a.number);
}

export async function fetchMangaDetail(_source: SourceId, mangaSlug: string): Promise<MangaDetail> {
  const src = SOURCES[0];
  const detailUrl = `${src.baseUrl}/truyen-tranh/${mangaSlug}`;
  const html = await corsFetch(detailUrl);
  const detail = parseTruyenqqDetail(html, mangaSlug);
  const allChapters = await loadAllChapters(detailUrl, html, mangaSlug);
  if (allChapters.length > detail.chapters.length) detail.chapters = allChapters;
  return detail;
}

export async function fetchChapter(_source: SourceId, mangaSlug: string, chapterSlug: string) {
  const src = SOURCES[0];
  const chapterUrl = `${src.baseUrl}/truyen-tranh/${mangaSlug}-${chapterSlug}`;
  const html = await corsFetch(chapterUrl);
  const parsed = parseTruyenqqChapter(html);
  const referer = chapterUrl;
  const images = parsed.images.map(u => absoluteUrl(src.baseUrl, u));
  return { ...parsed, images, referer, url: chapterUrl, source: 'truyenqq' as SourceId, mangaSlug, chapterSlug, mangaTitle: parsed.mangaTitle || '' };
}

// For speed, home fetches just 1 page per category (7 requests total) and returns fast.
// More items are loaded on demand via fetchMoreHome when the user taps "Xem thêm".
const CATEGORIES = [
  'doc-truyen',
  'truyen-moi-cap-nhat',
  'truyen-yeu-thich',
  'truyen-hot',
  'truyen-moi',
  'truyen-hoan-thanh',
  'top-thang'
];

export async function fetchHome(): Promise<MangaBasic[]> {
  const src = SOURCES[0];
  const seen = new Map<string, MangaBasic>();
  const urls = CATEGORIES.map(k => `${src.baseUrl}/${k}`);
  await Promise.allSettled(urls.map(async (u) => {
    try {
      const html = await corsFetch(u);
      parseTruyenqqHome(html, src.baseUrl).forEach(m => { if (!seen.has(m.slug)) seen.set(m.slug, m); });
    } catch { /* skip */ }
  }));
  return Array.from(seen.values());
}

// Called lazily after home is visible; fetches the next batch page across all categories.
export async function fetchMoreHome(batch: number): Promise<MangaBasic[]> {
  const src = SOURCES[0];
  const seen = new Map<string, MangaBasic>();
  const pageNum = batch + 1; // batch 0 -> page 2
  const cats = CATEGORIES.filter(c => c !== 'doc-truyen');
  const urls = cats.map(c => `${src.baseUrl}/${c}/trang-${pageNum}`);
  await Promise.allSettled(urls.map(async (u) => {
    try {
      const html = await corsFetch(u);
      parseTruyenqqHome(html, src.baseUrl).forEach(m => { if (!seen.has(m.slug)) seen.set(m.slug, m); });
    } catch { /* skip */ }
  }));
  return Array.from(seen.values());
}

export async function fetchHomePage(pageNum = 1): Promise<MangaBasic[]> {
  const src = SOURCES[0];
  const url = pageNum > 1 ? `${src.baseUrl}/truyen-moi-cap-nhat/trang-${pageNum}` : `${src.baseUrl}/doc-truyen`;
  const html = await corsFetch(url);
  return parseTruyenqqHome(html, src.baseUrl);
}

export async function searchManga(q: string): Promise<MangaBasic[]> {
  const src = SOURCES[0];
  const kw = q.trim();
  if (!kw) return [];
  const seen = new Map<string, MangaBasic>();
  try {
    const url = `${src.baseUrl}/tim-kiem?q=${encodeURIComponent(kw)}`;
    const html = await corsFetch(url);
    parseTruyenqqHome(html, src.baseUrl).forEach(m => { if (!seen.has(m.slug)) seen.set(m.slug, m); });
  } catch { /* ignore */ }
  if (seen.size === 0) {
    try {
      const url = `${src.baseUrl}/tim-kiem/trang-1.html?q=${encodeURIComponent(kw)}`;
      const html = await corsFetch(url);
      parseTruyenqqHome(html, src.baseUrl).forEach(m => { if (!seen.has(m.slug)) seen.set(m.slug, m); });
    } catch { /* ignore */ }
  }
  return Array.from(seen.values());
}

export function buildImageUrl(rawUrl: string, referer?: string) {
  return {
    direct: rawUrl.startsWith('//') ? 'https:' + rawUrl : rawUrl,
    localProxy: `/api/proxy?url=${encodeURIComponent(rawUrl)}${referer ? '&referer='+encodeURIComponent(referer) : ''}`,
    proxied: `https://wsrv.nl/?url=${encodeURIComponent(rawUrl)}&referer=${encodeURIComponent(referer||TRUYENQQ_BASE)}&af&n=-1`,
    proxied2: `https://images.weserv.nl/?url=${encodeURIComponent(rawUrl.replace(/^https?:\/\//, ''))}&af`,
    referer: referer || TRUYENQQ_BASE
  };
}

export function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export { extractChapterNumber };
