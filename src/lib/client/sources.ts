'use client';

import { corsFetch, getSource } from '../sources';
import {
  parseNettruyenDetail, parseNettruyenChapter, parseNettruyenHome,
  parseTruyenqqDetail, parseTruyenqqChapter, parseTruyenqqHome,
  parseNettruyenChapters, parseTruyenqqChapters, absoluteUrl, extractChapterNumber
} from '../sources/parse';
import type { Chapter, MangaBasic, MangaDetail, SourceId } from '../sources/types';

const MAX_PAGES = 50;

// Detect pagination "Xem thêm" by trying ?page=N until no new chapters
async function loadAllChapters(detailUrl: string, initialHtml: string, source: SourceId, mangaSlug: string): Promise<Chapter[]> {
  const all = new Map<string, Chapter>();
  const add = (c: Chapter) => { if (!all.has(c.slug)) all.set(c.slug, c); };

  const parseFn = source === 'nettruyen' ? parseNettruyenChapters : parseTruyenqqChapters;
  parseFn(initialHtml, mangaSlug).forEach(add);

  // Walk pages until no new chapters
  let page = 2;
  let samePageStreak = 0;
  while (page <= MAX_PAGES) {
    const url = `${detailUrl}${detailUrl.includes('?') ? '&' : '?'}page=${page}`;
    let html: string;
    try {
      html = await corsFetch(url);
    } catch {
      break;
    }
    const before = all.size;
    parseFn(html, mangaSlug).forEach(add);
    if (all.size === before) {
      samePageStreak++;
      if (samePageStreak >= 2) break;
    } else {
      samePageStreak = 0;
    }
    // Also detect last page marker
    if (!/<a[^>]+class="next"|\bNext\b|Sau»|Trang kế|›\s*\d|class="pagination"/i.test(html) && !/page=\d+/i.test(html)) {
      // no pagination present, stop
      if (all.size === before) break;
    }
    page++;
  }
  return Array.from(all.values()).sort((a, b) => b.number - a.number);
}

export async function fetchMangaDetail(source: SourceId, mangaSlug: string): Promise<MangaDetail> {
  const src = getSource(source);
  const detailUrl = source === 'nettruyen'
    ? `${src.baseUrl}/truyen-tranh/${mangaSlug}`
    : `${src.baseUrl}/truyen-tranh/${mangaSlug}`;
  const html = await corsFetch(detailUrl);
  const detail = source === 'nettruyen'
    ? parseNettruyenDetail(html, mangaSlug)
    : parseTruyenqqDetail(html, mangaSlug);

  // If only partial chapters rendered (xem thêm / paginated), paginate to get all
  const allChapters = await loadAllChapters(detailUrl, html, source, mangaSlug);
  if (allChapters.length > detail.chapters.length) {
    detail.chapters = allChapters;
  }
  return detail;
}

export async function fetchChapter(source: SourceId, mangaSlug: string, chapterSlug: string) {
  const src = getSource(source);
  const chapterUrl = source === 'nettruyen'
    ? `${src.baseUrl}/truyen-tranh/${mangaSlug}/${chapterSlug}`
    : `${src.baseUrl}/truyen-tranh/${mangaSlug}-${chapterSlug}`;
  const html = await corsFetch(chapterUrl);
  const parsed = source === 'nettruyen' ? parseNettruyenChapter(html) : parseTruyenqqChapter(html);

  const referer = chapterUrl; // Use chapter page URL as Referer (not just base) – CDN validates against that
  const images = parsed.images.map(u => absoluteUrl(src.baseUrl, u));

  return {
    ...parsed,
    images,
    referer,
    url: chapterUrl,
    source,
    mangaSlug,
    chapterSlug,
    mangaTitle: parsed.mangaTitle || ''
  };
}

export async function fetchHome(source: SourceId): Promise<MangaBasic[]> {
  const src = getSource(source);
  const url = source === 'nettruyen' ? `${src.baseUrl}/trang-chu` : `${src.baseUrl}/doc-truyen`;
  const html = await corsFetch(url);
  return source === 'nettruyen' ? parseNettruyenHome(html, src.baseUrl) : parseTruyenqqHome(html, src.baseUrl);
}

export async function searchManga(source: SourceId | 'all', q: string): Promise<MangaBasic[]> {
  const results: MangaBasic[] = [];
  const sources: SourceId[] = source === 'all' ? ['nettruyen', 'truyenqq'] : [source];
  await Promise.all(sources.map(async (s) => {
    const src = getSource(s);
    const searchUrl = s === 'nettruyen'
      ? `${src.baseUrl}/tim-truyen?keyword=${encodeURIComponent(q)}`
      : `${src.baseUrl}/tim-truyen?q=${encodeURIComponent(q)}`;
    try {
      const html = await corsFetch(searchUrl);
      const items = s === 'nettruyen' ? parseNettruyenHome(html, src.baseUrl) : parseTruyenqqHome(html, src.baseUrl);
      results.push(...items);
    } catch {
      // fallback: search by genres page / nettruyen /tim-truyen?keyword=
      try {
        const alt = s === 'nettruyen'
          ? `${src.baseUrl}/tim-truyen/${encodeURIComponent(q)}`
          : `${src.baseUrl}/tim-truyen?keyword=${encodeURIComponent(q)}`;
        const html2 = await corsFetch(alt);
        const items = s === 'nettruyen' ? parseNettruyenHome(html2, src.baseUrl) : parseTruyenqqHome(html2, src.baseUrl);
        results.push(...items);
      } catch { /* ignore */ }
    }
  }));
  return results;
}

export function buildImageUrl(src: string, referer?: string) {
  // Order of attempts:
  //  1. Original src (with no-referrer)
  //  2. Next.js server proxy /api/proxy?url=... (works on dev / preview)
  //  3. wsrv.nl image proxy (worldwide, bypasses hotlink/CORS for images)
  //  4. images.weserv.nl (mirror)
  const viaWsrv = (u: string) => `https://wsrv.nl/?url=${encodeURIComponent(u)}&af&n=-1`;
  const viaWeserv = (u: string) => `https://images.weserv.nl/?url=${encodeURIComponent(u)}&af`;
  return {
    direct: src,
    localProxy: `/api/proxy?url=${encodeURIComponent(src)}${referer ? '&referer='+encodeURIComponent(referer) : ''}`,
    proxied: viaWsrv(src),
    proxied2: viaWeserv(src),
    referer: referer || ''
  };
}

export function slugify(s: string) {
  return s.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export { extractChapterNumber };
