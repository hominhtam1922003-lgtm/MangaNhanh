'use client';

import { corsFetch, SOURCES } from '../sources';
import {
  parseTruyenqqDetail, parseTruyenqqChapter, parseTruyenqqHome,
  parseTruyenqqChapters, absoluteUrl, extractChapterNumber
} from '../sources/parse';
import type { Chapter, MangaBasic, MangaDetail, SourceId } from '../sources/types';

const MAX_PAGES = 80;
const TRUYENQQ_BASE = 'https://truyenqqto.com';

async function loadAllChapters(detailUrl: string, initialHtml: string, mangaSlug: string): Promise<Chapter[]> {
  const all = new Map<string, Chapter>();
  const add = (c: Chapter) => { if (!all.has(c.slug)) all.set(c.slug, c); };
  parseTruyenqqChapters(initialHtml, mangaSlug).forEach(add);

  let page = 2;
  let emptyStreak = 0;
  while (page <= MAX_PAGES) {
    const sep = detailUrl.includes('?') ? '&' : '?';
    const url = `${detailUrl}${sep}page=${page}`;
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
    const hasNext = /class=["'][^"']*(?:next|last)[^"']*["']|page=${page + 1}|Sau\s*»|Trang\s*kế|›\s*<\/a>|>\s*\d+\s*<\/a>|pagination/i.test(html);
    if (pageChapters.length < 5 && !hasNext) break;
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
  const chapterUrl = `${src.baseUrl}/truyen-tranh/${mangaSlug}-${chapterSlug}`;
  const html = await corsFetch(chapterUrl);
  const parsed = parseTruyenqqChapter(html);
  const referer = chapterUrl;
  const images = parsed.images.map(u => absoluteUrl(src.baseUrl, u));
  return { ...parsed, images, referer, url: chapterUrl, source: 'truyenqq' as SourceId, mangaSlug, chapterSlug, mangaTitle: parsed.mangaTitle || '' };
}

export async function fetchHome(): Promise<MangaBasic[]> {
  const src = SOURCES[0];
  // Aggregate: home + "hot" + "newest" + "completed" for many comics on home screen
  const urls = [
    `${src.baseUrl}/truyen-moi-cap-nhat/trang-1.html`,
    `${src.baseUrl}/truyen-hot/trang-1.html`,
    `${src.baseUrl}/truyen-yeu-thich/trang-1.html`,
    `${src.baseUrl}/truyen-moi/trang-1.html`,
    `${src.baseUrl}/truyen-hoan-thanh/trang-1.html`
  ];
  const seen = new Map<string, MangaBasic>();
  await Promise.all(urls.map(async (u) => {
    try {
      const html = await corsFetch(u);
      parseTruyenqqHome(html, src.baseUrl).forEach(m => { if (!seen.has(m.slug)) seen.set(m.slug, m); });
    } catch {}
  }));
  return Array.from(seen.values()).slice(0, 48);
}

export async function fetchHomePage(pageNum = 1): Promise<MangaBasic[]> {
  const src = SOURCES[0];
  const url = `${src.baseUrl}/truyen-moi-cap-nhat/trang-${pageNum}.html`;
  const html = await corsFetch(url);
  return parseTruyenqqHome(html, src.baseUrl);
}

export async function searchManga(q: string): Promise<MangaBasic[]> {
  const src = SOURCES[0];
  const searchUrl = `${src.baseUrl}/tim-kiem/trang-1.html?q=${encodeURIComponent(q)}`;
  try {
    const html = await corsFetch(searchUrl);
    return parseTruyenqqHome(html, src.baseUrl);
  } catch {
    // Try alt path
    try {
      const alt = `${src.baseUrl}/tim-kiem?tukhoa=${encodeURIComponent(q)}`;
      const html2 = await corsFetch(alt);
      return parseTruyenqqHome(html2, src.baseUrl);
    } catch { return []; }
  }
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
