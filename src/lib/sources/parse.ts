import * as cheerio from 'cheerio';
import type { Chapter, MangaBasic, MangaDetail, SourceId } from './types';

// Utility: extract a number from chapter slug/title
export function extractChapterNumber(raw: string): number {
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

function getImgSrc(el: any, $: cheerio.CheerioAPI): string {
  if (!el) return '';
  const e = $(el);
  return e.attr('data-original')
    || e.attr('data-src')
    || e.attr('data-lazy-src')
    || e.attr('data-image')
    || e.attr('srcset')?.split(/\s+/)[0]
    || e.attr('src')
    || '';
}

// -------- NetTruyen parsers --------

export function parseNettruyenChapters(html: string, mangaSlug: string): Chapter[] {
  const $ = cheerio.load(html);
  const chapters: Chapter[] = [];
  const seen = new Set<string>();

  const allLinks = $(`a[href*="/chuong-"]`);
  allLinks.each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!href.includes(mangaSlug) && !href.includes('/chuong-')) return;
    const m = href.match(/\/chuong-([^/?#]+)/);
    if (!m) return;
    const chapSlug = `chuong-${m[1]}`;
    if (seen.has(chapSlug)) return;
    seen.add(chapSlug);
    const rawTitle = ($(el).attr('title') || $(el).text() || '').replace(/\s+/g, ' ').trim();
    const title = rawTitle.startsWith('Chapter') || rawTitle.startsWith('Chương') || /chương|chapter|chap/i.test(rawTitle)
      ? rawTitle : `Chapter ${m[1]}`;

    const parent = $(el).closest('li, tr, div.row, div.chapter');
    let updatedAt = ''; let views = '';
    const texts = parent.find('div, span').map((_, c) => $(c).text().trim()).get().filter(Boolean);
    if (texts.length >= 2) {
      // Usually 2nd column is time, 3rd is views
      const t = texts.find(tx => /\d{1,2}\/\d{1,2}|giờ|phút|ngày|lúc/i.test(tx));
      if (t) updatedAt = t;
      const v = texts.find(tx => /^[\d,.]+$/.test(tx.replace(/\./g, '')));
      if (v) views = v;
    }

    chapters.push({
      source: 'nettruyen', mangaSlug, slug: chapSlug, title,
      number: extractChapterNumber(m[1]), updatedAt, views
    });
  });

  return chapters.sort((a, b) => b.number - a.number);
}

export function parseNettruyenDetail(html: string, mangaSlug: string): MangaDetail {
  const $ = cheerio.load(html);

  let title = $('h1.title-detail, h1[itemprop="name"], #item-detail h1.title-detail, article#item-detail h1')
    .first().text().trim();
  if (!title) title = $('h1').first().text().trim() || mangaSlug;
  title = title.replace(/\s+/g, ' ').trim();

  let thumbnail = getImgSrc($('.col-image img, .detail-info img, .books img, #item-detail .col-image img').first()[0], $);
  if (!thumbnail) thumbnail = $('meta[property="og:image"]').attr('content') || '';

  const author = $('li.author p.col-xs-8, .author .col-xs-8, [itemprop="author"]').first().text().trim() ||
    $('li:contains("Tác giả")').last().text().replace(/.*Tác giả:?/i, '').trim();

  const status = $('li.status p.col-xs-8, .status .col-xs-8').first().text().trim() ||
    $('li:contains("Tình trạng")').last().text().replace(/.*Tình trạng:?/i, '').trim();

  const views = $('li:contains("Lượt xem")').last().text().replace(/.*Lượt xem:?/i, '').trim();
  const rating = $('[itemprop="ratingValue"]').attr('content') || $('.star').attr('data-rating') || '';
  const followersText = $('.follow .numberfollow, #nt_follow, .follow b').first().text().trim();

  const genres: { name: string; slug: string }[] = [];
  $('li.kind a, .kind a, [itemprop="genre"] a, .list01 a[href*="/tim-truyen/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const name = $(el).text().trim();
    if (name) genres.push({ name, slug: href.split('/').filter(Boolean).pop() || name });
  });

  const description = $('.detail-content, .shortened, #contentComic, div[itemprop="description"], .story-detail-info .content').first().text().trim();
  const otherName = $('h2.other-name, .title-other, li:contains("Tên khác") p').first().text().trim();

  const chapters = parseNettruyenChapters(html, mangaSlug);

  return {
    source: 'nettruyen', slug: mangaSlug, title,
    thumbnail: absoluteUrl('https://nettruyen.gg', thumbnail),
    otherName, author, status, genres, views,
    followers: followersText, rating, description, chapters
  };
}

export function parseNettruyenChapter(html: string): { title: string; images: string[]; prev?: string; next?: string; mangaTitle?: string } {
  const $ = cheerio.load(html);
  const images: string[] = [];
  // NetTruyen puts reader pages inside .reading-detail .page-chapter > img (or a container).
  // We must NOT pick the watermark/logo NetTruyen image (logo in header/ads).
  // Strategy: walk every img inside containers with class containing "page-chapter" OR "page" within reading-detail.
  const hosts = ['kcgsbok.com', 'nettruyen', 'truyenvua', 'hinhhinh', 'upload', 'st.image', 'cdn.nt'];
  const deny = /logo|icon|favicon|banner|ads|quangcao|loader|spinner|watermark|popup|notif/i;
  const adText = /truy cập|truyện hay|chapter mới|đón xem|theo dõi|nhé!|sớm nhất|nettruyen\.com|truyenqq/i;
  $('.reading-detail .page-chapter img, .reading-detail .page_ads img, div.reading-detail > div > img, div.reading-detail img').each((_, el) => {
    const e = $(el);
    const raw = e.attr('data-original') || e.attr('data-src') || e.attr('data-lazy-src') || e.attr('src') || '';
    const src = raw.trim();
    if (!src) return;
    if (deny.test(src) || deny.test(e.attr('class')||'') || deny.test(e.attr('id')||'')) return;
    if (!hosts.some(h => src.includes(h)) && !/\.(jpg|jpeg|png|webp)(\?|$)/i.test(src)) return;
    const w = parseFloat(e.attr('width')||'0'); const h = parseFloat(e.attr('height')||'0');
    if (w && w < 200) return;
    if (h && h < 200) return;
    const alt = (e.attr('alt')||'') + ' ' + (e.parent().text()||'').slice(0, 120);
    if (adText.test(alt)) return;
    images.push(src);
  });
  // Fallback: pick any img under #chapter_content or .reading-detail with CDN host
  if (images.length === 0) {
    $('#chapter_content img, .reading-detail img').each((_, el) => {
      const src = ($(el).attr('data-original') || $(el).attr('data-src') || $(el).attr('src') || '').trim();
      if (!src) return;
      if (deny.test(src)) return;
      if (hosts.some(h => src.includes(h))) images.push(src);
    });
  }
  const normalized = images.map(u => u.startsWith('//') ? 'https:' + u : u);

  // title
  let title = $('.name-chap, h1.name-chap, h1.title-detail, .chapter-title').first().text().trim();
  if (!title) {
    title = $('title').text().split(/[-|]/)[0].trim();
  }
  let mangaTitle = $('.top .txt-info a[itemprop="item"], .breadcrumb a[href*="/truyen-tranh/"], .path a[href*="/truyen-tranh/"], .top a[href*="/truyen-tranh/"]').last().text().trim();
  if (!mangaTitle) {
    const t = $('title').text();
    const m = t.match(/Đọc truyện\s+(.+?)\s+(?:-|trực tuyến)/i);
    if (m) mangaTitle = m[1].trim();
  }

  // Prev/next: try many selectors (NetTruyen uses various classes over time)
  const prevHref =
    $('a.prev-chapter, a.chap-prev, a[rel="prev"]').first().attr('href')
    || $('#next_chap, #prev_chap, .navi_chapter a').eq(0).attr('href')
    || $('a:contains("Chap sau"), a:contains("Chương sau"), a:has(i.next), a[title*="sau"], a[title*="Chap trước"]').first().attr('href');
  const nextHref =
    $('a.next-chapter, a.chap-next, a[rel="next"]').first().attr('href')
    || $('#next_chap, .navi_chapter a').last().attr('href')
    || $('a:contains("Chap sau"), a:contains("Chương sau"), a:has(i.next), a[title*="sau"]').first().attr('href');

  return { title: title.replace(/\s+/g, ' ').trim(), images: normalized, prev: prevHref, next: nextHref, mangaTitle: mangaTitle || undefined };
}

// -------- TruyenQQ parsers --------

export function parseTruyenqqChapters(html: string, mangaSlug: string): Chapter[] {
  const $ = cheerio.load(html);
  const chapters: Chapter[] = [];
  const seen = new Set<string>();
  const re = new RegExp(`/truyen-tranh/${mangaSlug.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}-chap-([^"#?]+)`);
  $('a[href*="-chap-"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const m = href.match(re);
    if (!m) return;
    const chapPart = m[1];
    const chapSlug = `chap-${chapPart}`;
    if (seen.has(chapSlug)) return;
    seen.add(chapSlug);
    const rawTitle = ($(el).attr('title') || $(el).text() || '').trim();
    const title = rawTitle || `Chương ${chapPart.replace(/-/g, '.')}`;
    const parent = $(el).closest('li, div, tr');
    let updatedAt = '';
    const dateEl = parent.find('.time, .date, [class*="date"], [class*="time"], .chapter-time');
    if (dateEl.length) updatedAt = dateEl.first().text().trim();
    chapters.push({ source: 'truyenqq', mangaSlug, slug: chapSlug, title, number: extractChapterNumber(chapPart), updatedAt });
  });
  return chapters.sort((a, b) => b.number - a.number);
}

export function parseTruyenqqDetail(html: string, mangaSlug: string): MangaDetail {
  const $ = cheerio.load(html);
  const title = $('h1[itemprop="name"], h1.title-manga, h1').first().text().trim() || mangaSlug;
  let thumbnail = getImgSrc($('.book_avatar img, .book_info img, .story-info img, [itemprop="image"]').first()[0], $);
  if (!thumbnail) thumbnail = $('meta[property="og:image"]').attr('content') || '';
  const author = $('li.author p, .author a, a[href*="/tac-gia/"], [itemprop="author"]').first().text().trim();
  const status = $('li.status p, .status p, li:contains("Tình trạng") p').first().text().trim();
  const views = $('li:contains("Lượt xem")').last().text().replace(/.*Lượt xem:?/i, '').trim();
  const otherName = $('h2.other-name, .othername, .title-2, li:contains("Tên khác") p').first().text().trim();
  const followers = $('li:contains("Lượt theo dõi"), li:contains("Theo dõi")').first().text().replace(/.*:?/i, '').trim();
  const rating = $('[itemprop="ratingValue"]').attr('content') || $('.rate, .star').attr('data-rating') || '';
  const genres: { name: string; slug: string }[] = [];
  $('ul.list01 li a, .list01 a, .kind a, a[href*="/the-loai/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const name = $(el).text().trim();
    if (href.includes('/the-loai/') && name) genres.push({ name, slug: href.split('/').filter(Boolean).pop() || name });
  });
  let description = '';
  $('#contentstory, .detail-content, div[itemprop="description"]').each((_, el) => {
    const t = $(el).text().trim();
    if (t.length > description.length) description = t;
  });
  const chapters = parseTruyenqqChapters(html, mangaSlug);
  return {
    source: 'truyenqq', slug: mangaSlug,
    title: title.replace(/\s+/g, ' ').trim(),
    thumbnail: absoluteUrl('https://truyenqqko.com', thumbnail),
    otherName, author, status, genres, views, followers, rating, description, chapters
  };
}

export function parseTruyenqqChapter(html: string): { title: string; images: string[]; prev?: string; next?: string; mangaTitle?: string } {
  const $ = cheerio.load(html);
  const images: string[] = [];
  const deny = /logo|icon|favicon|banner|ads|quangcao|loader|spinner|popup|notif/i;
  const adText = /truy cập|truyện hay|chapter mới|đón xem|theo dõi|nhé!|sớm nhất|truyenqqno|truyenqq\.com/i;
  const hosts = ['truyenvua.com', 'hinhhinh.com', 'truyenqq', 'qq.', 'hinh.'];
  // Truyenqq pages under .chapter-content, .story-see-content, .reading-detail .page-chapter
  $('.chapter-content img, .story-see-content img, .reading-detail .page-chapter img, #chapter_content img, .reading-detail img').each((_, el) => {
    const e = $(el);
    const raw = e.attr('data-original') || e.attr('data-src') || e.attr('data-lazy-src') || e.attr('src') || '';
    const src = raw.trim();
    if (!src) return;
    if (deny.test(src) || deny.test(e.attr('class')||'')) return;
    if (!hosts.some(h => src.includes(h)) && !/\.(jpg|jpeg|png|webp)(\?|$)/i.test(src)) return;
    const w = parseFloat(e.attr('width')||'0'); const h = parseFloat(e.attr('height')||'0');
    if (w && w < 200) return;
    if (h && h < 200) return;
    const alt = (e.attr('alt')||'') + ' ' + (e.parent().text()||'').slice(0, 160);
    if (adText.test(alt)) return;
    images.push(src);
  });
  if (images.length === 0) {
    $('img').each((_, el) => {
      const src = ($(el).attr('data-original') || $(el).attr('data-src') || $(el).attr('src') || '').trim();
      if (!src) return;
      if (deny.test(src)) return;
      if (hosts.some(h => src.includes(h))) images.push(src);
    });
  }
  const normalized = images.map(u => u.startsWith('//') ? 'https:' + u : u).map(u => u.startsWith('http') ? u : absoluteUrl('https://truyenqqko.com', u));
  const title = $('h1, h2.name-chap, .chapter-title').first().text().trim();
  let mangaTitle = $('.block-breadcrumb a[href*="/truyen-tranh/"], .breadcrumb a[href*="/truyen-tranh/"], .path a[href*="/truyen-tranh/"]').last().text().trim();
  if (!mangaTitle) {
    const t = $('title').text();
    const m = t.match(/Đọc truyện\s+(.+?)\s+(?:-|trực tuyến)/i);
    if (m) mangaTitle = m[1].trim();
  }
  const prevHref =
    $('a.prev-chapter, a.chap-prev, a[rel="prev"]').first().attr('href')
    || $('.chapter-nav a, .nav_chapter a').first().attr('href')
    || $('a:contains("Chap trước"), a:contains("Chương trước")').first().attr('href');
  const nextHref =
    $('a.next-chapter, a.chap-next, a[rel="next"]').first().attr('href')
    || $('.chapter-nav a, .nav_chapter a').last().attr('href')
    || $('a:contains("Chap sau"), a:contains("Chương sau")').first().attr('href');
  return { title: title.replace(/\s+/g, ' ').trim(), images: normalized, prev: prevHref, next: nextHref, mangaTitle: mangaTitle || undefined };
}

// -------- Home listing parsers --------

function pickTitle(a: cheerio.Cheerio<any>): string {
  return (a.attr('title') || a.find('h3, .title, .jtip, .name').first().text() || '').trim();
}

function isLikelyCover(src: string, cls: string): boolean {
  if (!src) return false;
  const deny = /logo|icon|favicon|avatar|emoji|sprite|svg(\?|$)/i;
  if (deny.test(src) || deny.test(cls)) return false;
  // Manga covers are jpg/png/webp with large CDN hosts
  if (/(jpg|jpeg|png|webp)(\?|$)/i.test(src)) return true;
  if (/(image|cdn|upload|comic|manga|cover|thumb|st\.image|truyen|nettruyen|qq)/i.test(src)) return true;
  return false;
}

function pickCover($el: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): string {
  let thumb = '';
  $el.find('img').each((_, img) => {
    if (thumb) return;
    const s = getImgSrc(img, $);
    if (!s) return;
    if (!isLikelyCover(s, $(img).attr('class')||'')) return;
    thumb = s;
  });
  return thumb;
}

export function parseNettruyenHome(html: string, baseUrl: string): MangaBasic[] {
  const $ = cheerio.load(html);
  const items: MangaBasic[] = [];
  const seen = new Set<string>();

  const selectors = [
    '#ctl00_divCenter .items .item',
    '#div_home .item',
    '.ModuleContent .item',
    'figure.item',
    '.story-item',
    '.item-manga',
    '.list-manga .item',
    '.grid .item'
  ];
  let candidates = $(selectors.join(', '));
  if (candidates.length === 0) {
    // Fallback: only anchor tags that contain an image AND whose href points to /truyen-tranh/{slug} (not a chapter)
    candidates = $('a[href*="/truyen-tranh/"]').filter(function () {
      const href = $(this).attr('href') || '';
      return !/\/chuong-|-chap-/.test(href) && $(this).find('img').length > 0;
    });
  }

  candidates.each((_, el) => {
    const $el = $(el);
    const anchor = $el.is('a') ? $el : $el.find('a[href*="/truyen-tranh/"]').first();
    const href = anchor.attr('href') || '';
    if (/chuong-|-chap-/.test(href)) return; // skip chapter links
    const m = href.match(/\/truyen-tranh\/([^/#?]+)/);
    if (!m) return;
    const slug = m[1];
    if (seen.has(slug)) return;
    seen.add(slug);

    let title = anchor.attr('title')
      || $el.find('h3 a, h4 a, .title a, .tentruyen a, .jtip').first().attr('title')
      || $el.find('h3, h4, .title, .tentruyen, .name').first().text().trim()
      || anchor.text().trim()
      || slug;
    title = title.replace(/\s+/g, ' ').trim();

    const thumb = pickCover($el, $);
    const latestChapter = $el.find('a[href*="/chuong-"]').first().text().trim();
    const updatedAt = $el.find('.time-ago, .updated-at, .chapter-time, time, .time').first().text().trim();
    items.push({
      source: 'nettruyen', slug, title,
      thumbnail: absoluteUrl(baseUrl, thumb),
      latestChapter, updatedAt
    });
  });
  return items;
}

export function parseTruyenqqHome(html: string, baseUrl: string): MangaBasic[] {
  const $ = cheerio.load(html);
  const items: MangaBasic[] = [];
  const seen = new Set<string>();
  const selectors = [
    '.story-item',
    '.list-stories .story-item',
    '.grid-stories .item',
    'ul.list_story li',
    '.list_grid_out li',
    '.book-list li',
    '.list-manga li',
    '.truyen-list .story-item'
  ];
  let candidates = $(selectors.join(', '));
  if (candidates.length === 0) {
    candidates = $('a[href*="/truyen-tranh/"]').filter(function () {
      const href = $(this).attr('href') || '';
      return !/\/chuong-|-chap-/.test(href) && $(this).find('img').length > 0;
    });
  }

  candidates.each((_, el) => {
    const $el = $(el);
    const anchor = $el.is('a') ? $el : $el.find('a[href*="/truyen-tranh/"]').first();
    const href = anchor.attr('href') || '';
    if (/\/chuong-/.test(href)) return;
    const m = href.match(/\/truyen-tranh\/([^/#?]+?)-(\d+)(?:\/|$)/);
    if (!m) return;
    const slug = `${m[1]}-${m[2]}`;
    if (seen.has(slug)) return;
    seen.add(slug);

    let title = anchor.attr('title')
      || $el.find('h3 a, h2 a, .title a, .book_name a, .story-title a').first().attr('title')
      || $el.find('h3, h2, .title, .book_name, .story-title, .name').first().text().trim()
      || anchor.text().trim()
      || m[1];
    title = title.replace(/\s+/g, ' ').trim();

    const thumb = pickCover($el, $);
    const latestChapter = $el.find('a[href*="-chap-"]').first().text().trim();
    const updatedAt = $el.find('.time, .updated-at, .last-chapter small, [class*="date"]').first().text().trim();
    items.push({
      source: 'truyenqq', slug, title,
      thumbnail: absoluteUrl(baseUrl, thumb),
      latestChapter, updatedAt
    });
  });
  return items;
}

export function parseSearch(html: string, source: SourceId, baseUrl: string): MangaBasic[] {
  if (source === 'nettruyen') return parseNettruyenHome(html, baseUrl);
  return parseTruyenqqHome(html, baseUrl);
}
