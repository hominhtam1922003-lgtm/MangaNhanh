import * as cheerio from 'cheerio';
import type { Chapter, MangaBasic, MangaDetail, SourceId } from './types';

// Utility: extract a number from chapter slug/title
export function extractChapterNumber(raw: string): number {
  // Support chapter numbers like "565", "33.5", "15-5"
  const cleaned = raw.replace(/[^\d.]/g, ' ').trim();
  const firstNum = cleaned.split(/\s+/).find(Boolean);
  if (!firstNum) return 0;
  const v = parseFloat(firstNum);
  return Number.isFinite(v) ? v : 0;
}

export function absoluteUrl(base: string, href?: string) {
  if (!href) return '';
  if (href.startsWith('http')) return href;
  if (href.startsWith('//')) return 'https:' + href;
  try {
    return new URL(href, base).toString();
  } catch {
    return base + (href.startsWith('/') ? href : '/' + href);
  }
}

// Parse chapters from a NetTruyen detail page
export function parseNettruyenChapters(html: string, mangaSlug: string): Chapter[] {
  const $ = cheerio.load(html);
  const chapters: Chapter[] = [];
  const seen = new Set<string>();

  // Nettruyen puts chapters in #nt_listchapter nav ul li rows
  $('#nt_listchapter nav ul li, #chapter-list .row, .list-chapter .row, ul.list-chapter li').each((_, el) => {
    const a = $(el).find('a[href*="/chuong-"]').first();
    const href = a.attr('href') || '';
    if (!href) return;
    const m = href.match(/\/chuong-([^/]+)/);
    if (!m) return;
    const chapSlug = `chuong-${m[1]}`;
    if (seen.has(chapSlug)) return;
    seen.add(chapSlug);
    const title = (a.text().trim() || `Chapter ${m[1]}`).replace(/\s+/g, ' ');
    const cols = $(el).find('div, span');
    let updatedAt = '';
    let views = '';
    // Nettruyen uses columns (no class / text)
    if (cols.length >= 3) {
      const texts = cols.map((_, c) => $(c).text().trim()).get();
      updatedAt = texts[1] || '';
      views = texts[2] || '';
    }
    chapters.push({
      source: 'nettruyen',
      mangaSlug,
      slug: chapSlug,
      title: title.startsWith('Chapter') || title.startsWith('Chương') || title.startsWith('Chuong') ? title : `Chapter ${m[1]}`,
      number: extractChapterNumber(m[1]),
      updatedAt,
      views
    });
  });

  // Fallback: scan all /chuong- links
  if (chapters.length === 0) {
    $(`a[href*="/truyen-tranh/${mangaSlug}/chuong-"]`).each((_, el) => {
      const href = $(el).attr('href') || '';
      const m = href.match(/\/chuong-([^/]+)/);
      if (!m) return;
      const chapSlug = `chuong-${m[1]}`;
      if (seen.has(chapSlug)) return;
      seen.add(chapSlug);
      const title = $(el).text().trim() || `Chapter ${m[1]}`;
      chapters.push({
        source: 'nettruyen',
        mangaSlug,
        slug: chapSlug,
        title,
        number: extractChapterNumber(m[1])
      });
    });
  }

  // sort by chapter number descending
  return chapters.sort((a, b) => b.number - a.number);
}

export function parseNettruyenDetail(html: string, mangaSlug: string): MangaDetail {
  const $ = cheerio.load(html);
  const title = $('.title-detail, h1.title-detail, h1[itemprop="name"], #item-detail h1, article#item-detail h1').first().text().trim()
    || $('h1').first().text().trim() || mangaSlug;

  // Thumbnail
  const thumbnail =
    $('.col-image img, .detail-info img, .books img, #item-detail img').attr('src') ||
    $('meta[property="og:image"]').attr('content') || '';

  const author = $('li.author p.col-xs-8, .author .col-xs-8, [itemprop="author"]').first().text().trim() ||
    $('li:contains("Tác giả")').last().text().replace(/Tác giả:?/i, '').trim();

  const status = $('li.status p.col-xs-8, .status .col-xs-8').first().text().trim() ||
    $('li:contains("Tình trạng")').last().text().replace(/Tình trạng:?/i, '').trim();

  const views = $('li:contains("Lượt xem")').last().text().replace(/.*Lượt xem:?/i, '').trim();
  const rating = $('[itemprop="ratingValue"]').attr('content') || $('.star').attr('data-rating') || '';
  const followersText = $('.follow .numberfollow, #nt_follow').text().trim();

  const genres: { name: string; cols: string, slug: string }[] | { name: string; slug: string }[] = [];
  $('li.kind a, .kind a, [itemprop="genre"] a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const name = $(el).text().trim();
    const slug = href.split('/').pop() || name;
    if (name) (genres as { name: string; slug: string }[]).push({ name, slug });
  });

  const description = $('.detail-content, .shortened, #contentComic, .story-detail-info .content, div[itemprop="description"]').first().text().trim();

  const otherName = $('h2.other-name, .title-other, li:contains("Tên khác") p').first().text().trim();

  const chapters = parseNettruyenChapters(html, mangaSlug);

  return {
    source: 'nettruyen',
    slug: mangaSlug,
    title: title.replace(/\s+/g, ' ').trim(),
    thumbnail: absoluteUrl('https://nettruyen.gg', thumbnail),
    otherName,
    author,
    status,
    genres: genres as { name: string; slug: string }[],
    views,
    followers: followersText,
    rating,
    description,
    chapters
  };
}

export function parseNettruyenChapter(html: string): { title: string; images: string[]; prev?: string; next?: string; chapterTitle?: string } {
  const $ = cheerio.load(html);
  const images: string[] = [];
  $('.reading-detail .page-chapter img, .reading img, #chapter-content img, div.reading-detail img').each((_, el) => {
    const src = $(el).attr('data-original') || $(el).attr('data-src') || $(el).attr('src') || '';
    if (src) images.push(src.trim());
  });

  // Fallback: all large images in the content
  if (images.length === 0) {
    $('img[src*=".jpg"], img[src*=".png"], img[src*=".webp"], img[data-original*="."]').each((_, el) => {
      const src = $(el).attr('data-original') || $(el).attr('data-src') || $(el).attr('src') || '';
      if (src && /(\.jpg|\.png|\.webp|\.jpeg)/i.test(src)) images.push(src.trim());
    });
  }

  const title = $('h1, .chapter-title, .name-chap').first().text().trim();
  const prevHref = $('a.prev-chapter, a.chap-prev, a[rel="prev"], .navi_chapter a:first-child').first().attr('href');
  const nextHref = $('a.next-chapter, a.chap-next, a[rel="next"], .navi_chapter a:last-child').first().attr('href');

  return {
    title,
    images,
    prev: prevHref,
    next: nextHref
  };
}

// -------- TruyenQQ parser --------

export function parseTruyenqqChapters(html: string, mangaSlug: string): Chapter[] {
  const $ = cheerio.load(html);
  const chapters: Chapter[] = [];
  const seen = new Set<string>();
  // Links like /truyen-tranh/{slug}-chap-565 or /truyen-tranh/{slug}-chap-33-5
  const re = new RegExp(`/truyen-tranh/${mangaSlug}-chap-([^"#?]+)`);
  $('a[href*="-chap-"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const m = href.match(re);
    if (!m) return;
    const chapPart = m[1];
    const chapSlug = `chap-${chapPart}`;
    if (seen.has(chapSlug)) return;
    seen.add(chapSlug);
    let title = ($(el).attr('title') || $(el).text() || '').trim();
    if (!title) title = `Chương ${chapPart.replace(/-/g, '.')}`;
    // Try to find date sibling
    const parent = $(el).closest('li, div, tr');
    let updatedAt = '';
    const dateEl = parent.find('.time, .date, [class*="date"], [class*="time"]');
    if (dateEl.length) updatedAt = dateEl.first().text().trim();
    if (!updatedAt && parent.length) {
      // Next element or sibling
      const next = parent.next();
      if (next.length && /\d{1,2}\/\d{1,2}\/\d{4}/.test(next.text())) updatedAt = next.text().trim();
    }
    chapters.push({
      source: 'truyenqq',
      mangaSlug,
      slug: chapSlug,
      title,
      number: extractChapterNumber(chapPart),
      updatedAt
    });
  });
  return chapters.sort((a, b) => b.number - a.number);
}

export function parseTruyenqqDetail(html: string, mangaSlug: string): MangaDetail {
  const $ = cheerio.load(html);
  const title = $('h1').first().text().trim() || mangaSlug;
  const thumbnail = $('.book_avatar img, .book_info img, .story-info img, [itemprop="image"]').first().attr('src')
    || $('meta[property="og:image"]').attr('content') || '';
  const author = $('li.author p, .author a, a[href*="/tac-gia/"]').first().text().trim();
  const status = $('li.status p, .status p, li:contains("Tình trạng") p').first().text().trim();
  const views = $('li:contains("Lượt xem")').last().text().replace(/.*Lượt xem:?/i, '').trim();
  const otherName = $('h2, .othername, .title-2').filter((_, el) => /Tên khác/i.test($(el).text())).next().text().trim()
    || $('h2.other-name').text().trim();
  const followers = $('li:contains("Lượt theo dõi"), li:contains("Theo dõi")').first().text().replace(/.*:?/i, '').trim();
  const rating = $('[itemprop="ratingValue"]').attr('content') || $('.rate, .star').attr('data-rating') || '';

  const genres: { name: string; slug: string }[] = [];
  $('ul.list01 li a, .list01 a, .kind a, a[href*="/the-loai/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const name = $(el).text().trim();
    if (href.includes('/the-loai/') && name) {
      genres.push({ name, slug: href.split('/').pop() || name });
    }
  });

  let description = '';
  $('#contentstory, .detail-content, .story-detail-info .content, div[itemprop="description"]').each((_, el) => {
    const t = $(el).text().trim();
    if (t.length > description.length) description = t;
  });

  const chapters = parseTruyenqqChapters(html, mangaSlug);
  return {
    source: 'truyenqq',
    slug: mangaSlug,
    title: title.replace(/\s+/g, ' ').trim(),
    thumbnail: absoluteUrl('https://truyenqqko.com', thumbnail),
    otherName,
    author,
    status,
    genres,
    views,
    followers,
    rating,
    description,
    chapters
  };
}

export function parseTruyenqqChapter(html: string): { title: string; images: string[]; prev?: string; next?: string; chapterTitle?: string } {
  const $ = cheerio.load(html);
  const images: string[] = [];
  $('.reading-detail .page-chapter img, .chapter-content img, .story-see-content img, div.reading img, #chapter_content img').each((_, el) => {
    const src = $(el).attr('data-original') || $(el).attr('data-src') || $(el).attr('src') || '';
    if (src && !/banner|ads|quangcao|gif/i.test(src)) images.push(src.trim());
  });
  if (images.length === 0) {
    $('img[src*="truyenvua.com"], img[src*="hinhhinh.com"], img[src*=".jpg"], img[src*=".png"], img[src*=".webp"]').each((_, el) => {
      const src = $(el).attr('data-original') || $(el).attr('data-src') || $(el).attr('src') || '';
      if (src && /(\.jpg|\.png|\.webp|\.jpeg)/i.test(src) && !/banner|ads|quangcao/i.test(src)) images.push(src.trim());
    });
  }

  const title = $('h1').first().text().trim();
  const prevHref = $('a.prev-chapter, a.chap-prev').first().attr('href');
  const nextHref = $('a.next-chapter, a.chap-next').first().attr('href');

  return {
    title,
    images,
    prev: prevHref,
    next: nextHref
  };
}

// Home listing parser - scrape latest from the homepage
export function parseNettruyenHome(html: string, baseUrl: string): MangaBasic[] {
  const $ = cheerio.load(html);
  const items: MangaBasic[] = [];
  const seen = new Set<string>();
  $('.item, .story-item, .item-manga, .grid .item').each((_, el) => {
    const a = $(el).find('a[href*="/truyen-tranh/"]').first();
    const href = a.attr('href') || '';
    const m = href.match(/\/truyen-tranh\/([^/#?]+)/);
    if (!m) return;
    const slug = m[1];
    if (seen.has(slug)) return;
    seen.add(slug);
    const thumb = $(el).find('img').attr('data-original') || $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || '';
    const title = a.attr('title') || a.text().trim() || slug;
    const latestChapter = $(el).find('a[href*="/chuong-"]').first().text().trim();
    const updatedAt = $(el).find('.time-ago, .updated-at').first().text().trim();
    items.push({
      source: 'nettruyen',
      slug,
      title: title.replace(/\s+/g, ' ').trim(),
      thumbnail: absoluteUrl(baseUrl, thumb),
      latestChapter,
      updatedAt
    });
  });
  return items;
}

export function parseTruyenqqHome(html: string, baseUrl: string): MangaBasic[] {
  const $ = cheerio.load(html);
  const items: MangaBasic[] = [];
  const seen = new Set<string>();
  $('.story-item, .list-stories .story-item, .grid-stories .item, ul.list_story li').each((_, el) => {
    const a = $(el).find('a[href*="/truyen-tranh/"]').first();
    const href = a.attr('href') || '';
    const m = href.match(/\/truyen-tranh\/([^/#?]+)-(\d+)/);
    if (!m) return;
    // Truyenqq slug ends with -id; keep as slug but strip the numeric id.
    const full = m[1];
    const slug = `${m[1]}-${m[2]}`;
    if (seen.has(slug)) return;
    seen.add(slug);
    const thumb = $(el).find('img').attr('data-original') || $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || '';
    const title = a.attr('title') || a.text().trim() || full;
    const latestChapter = $(el).find('a[href*="-chap-"]').first().text().trim();
    const updatedAt = $(el).find('.time, .updated-at, .last-chapter small').first().text().trim();
    items.push({
      source: 'truyenqq',
      slug,
      title: title.replace(/\s+/g, ' ').trim(),
      thumbnail: absoluteUrl(baseUrl, thumb),
      latestChapter,
      updatedAt
    });
  });
  return items;
}

// Parse search results
export function parseSearch(html: string, source: SourceId, baseUrl: string): MangaBasic[] {
  if (source === 'nettruyen') return parseNettruyenHome(html, baseUrl);
  return parseTruyenqqHome(html, baseUrl);
}
