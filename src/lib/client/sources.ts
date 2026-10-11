'use client';

import { corsFetch, SOURCES } from '../sources';
import {
  parseTruyenqqDetail, parseTruyenqqChapter, parseTruyenqqHome,
  parseTruyenqqChapters, absoluteUrl, extractChapterNumber
} from '../sources/parse';
import type { Chapter, MangaBasic, MangaDetail, SourceId } from '../sources/types';

const MAX_PAGES = 80;
const TRUYENQQ_BASE = 'https://truyenqqko.com';

// TruyenQQ chapter pages use ?page=N; detect if next paginator page exists.
function hasNextPage(html: string, currentPage: number): boolean {
  // Tachiyomi-style selector: .page_redirect > a:nth-last-child(2) > p:not(.active) ; translated to regex:
  if (/page_redirect[\s\S]{0,500}>(\d+)<[\s\S]{0,200}<\/a>\s*(<a[^>]*>)?\s*(›|»|Sau|Next|Tiếp)/i.test(html)) return true;
  if (new RegExp(`/trang-${currentPage + 1}[^"'<>#?]*["']`, 'i').test(html)) return true;
  if (new RegExp(`[?&]page=${currentPage + 1}`, 'i').test(html)) return true;
  return false;
}

async function loadAllChapters(detailUrl: string, initialHtml: string, mangaSlug: string): Promise<Chapter[]> {
  const all = new Map<string, Chapter>();
  const add = (c: Chapter) => { if (!all.has(c.slug)) all.set(c.slug, c); };
  parseTruyenqqChapters(initialHtml, mangaSlug).forEach(add);

  let page = 2;
  let emptyStreak = 0;
  while (page <= MAX_PAGES) {
    const url = `${detailUrl}?page=${page}`;
    let html: string;
    try { html = await corsFetch(url); } catch { break; }
    if (!html || html.length < 2000) break;
    const before = all.size;
    const pageChapters = parseTruyenqqChapters(html, mangaSlug);
    pageChapters.forEach(add);
    const added = all.size - before;
    if (added === 0) {
      emptyStreak++;
      if (emptyStreak >= 2) break;
    } else emptyStreak = 0;
    if (pageChapters.length < 5 && !hasNextPage(html, page)) break;
    if (!hasNextPage(html, page)) break;
    page++;
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
  // TruyenQQ chapter URLs: /truyen-tranh/{mangaSlug}-{chapterSlug} (no .html suffix)
  const chapterUrl = `${src.baseUrl}/truyen-tranh/${mangaSlug}-${chapterSlug}`;
  const html = await corsFetch(chapterUrl);
  const parsed = parseTruyenqqChapter(html);
  const referer = chapterUrl;
  const images = parsed.images.map(u => absoluteUrl(src.baseUrl, u));
  return { ...parsed, images, referer, url: chapterUrl, source: 'truyenqq' as SourceId, mangaSlug, chapterSlug, mangaTitle: parsed.mangaTitle || '' };
}

// Aggregate across MANY category pages for a large home library
const CATEGORIES = [
  { key: 'truyen-moi-cap-nhat', pages: 4 },
  { key: 'truyen-yeu-thich',    pages: 3 },
  { key: 'truyen-hot',          pages: 2 },
  { key: 'truyen-moi',          pages: 2 },
  { key: 'truyen-hoan-thanh',   pages: 2 },
  { key: 'top-thang',           pages: 2 }
];

export async function fetchHome(): Promise<MangaBasic[]> {
  const src = SOURCES[0];
  const seen = new Map<string, MangaBasic>();
  const urls: string[] = [];
  // Also home /doc-truyen landing page
  urls.push(`${src.baseUrl}/doc-truyen`);
  urls.push(`${src.baseUrl}/`);
  for (const c of CATEGORIES) {
    for (let p = 1; p <= c.pages; p++) {
      urls.push(`${src.baseUrl}/${c.key}${p > 1 ? '/trang-' + p : ''}`);
    }
  }
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
  // Primary: /tim-kiem?q=... per Tachiyomi source; paginate up to 3 pages, dedupe
  const seen = new Map<string, MangaBasic>();
  for (let page = 1; page <= 3; page++) {
    const url = `${src.baseUrl}/tim-kiem${page > 1 ? '/trang-' + page : ''}?q=${encodeURIComponent(kw)}`;
    try {
      const html = await corsFetch(url);
      const items = parseTruyenqqHome(html, src.baseUrl);
      if (items.length === 0) break;
      items.forEach(m => { if (!seen.has(m.slug)) seen.set(m.slug, m); });
      if (!hasNextPage(html, page)) break;
    } catch {
      // first page fallback to advanced search (no query) to avoid empty
      break;
    }
  }
  if (seen.size > 0) return Array.from(seen.values());
  // Fallback: tukhoa param (old-style)
  try {
    const alt = `${src.baseUrl}/tim-kiem?tukhoa=${encodeURIComponent(kw)}`;
    const html = await corsFetch(alt);
    return parseTruyenqqHome(html, src.baseUrl);
  } catch { return []; }
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
