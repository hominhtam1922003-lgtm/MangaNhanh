export const SOURCES = [
  {
    id: 'nettruyen' as const,
    name: 'NetTruyen',
    baseUrl: 'https://nettruyen.gg',
    logoColor: 'from-orange-500 to-rose-500',
    description: 'Kho truyện tranh lớn, cập nhật nhanh, chất lượng hình cao.'
  },
  {
    id: 'truyenqq' as const,
    name: 'TruyenQQ',
    baseUrl: 'https://truyenqqko.com',
    logoColor: 'from-sky-500 to-indigo-500',
    description: 'Nhiều bản dịch hay, giao diện nhẹ, đọc mượt.'
  }
] as const;

export type SourceId = (typeof SOURCES)[number]['id'];

export function getSource(id: SourceId) {
  return SOURCES.find(s => s.id === id)!;
}

/** Public CORS proxies used as fallbacks when our local API proxy isn't available. */
export const CORS_PROXIES: Array<(url: string) => string> = [
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://cors-proxy.htmldriven.com/?url=${encodeURIComponent(url)}`,
  (url) => `https://proxy.cors.sh/${url}`,
  (url) => `https://cors-anywhere.herokuapp.com/${url}`,
  (url) => {
    // allorigins JSON
    const u = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    return u;
  }
];

/**
 * Attempt to fetch a URL, using:
 *  1. Next.js server proxy /api/proxy if available (dev/preview on Vercel/etc.)
 *  2. Direct fetch (works on Capacitor native WebView where CORS is not enforced)
 *  3. Public CORS proxies in sequence as last-resort.
 */
export async function corsFetch(url: string, init?: RequestInit & { referer?: string }): Promise<string> {
  const headers: Record<string, string> = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'vi,en;q=0.9',
    ...(init?.headers as Record<string, string> || {})
  };
  if (init?.referer) headers['Referer'] = init.referer;

  // 1) Local server proxy
  try {
    const probeResp = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`, { method: 'HEAD' }).catch(() => null);
    if (probeResp && probeResp.ok) {
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}${init?.referer ? '&referer='+encodeURIComponent(init.referer) : ''}`;
      const r = await fetch(proxyUrl, { headers });
      if (r.ok) {
        const t = await r.text();
        if (t && t.length > 200) return t;
      }
    }
  } catch { /* fallthrough */ }

  // 2) Direct
  try {
    const r = await fetch(url, { ...(init||{}), headers });
    if (r.ok) {
      const t = await r.text();
      if (t && t.length > 200) return t;
    }
  } catch { /* fallthrough */ }

  // 3) Public proxies
  let lastErr: unknown;
  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const proxyUrl = CORS_PROXIES[i](url);
    try {
      const r = await fetch(proxyUrl, { headers: { ...headers, ...(init?.headers || {}) } });
      if (!r.ok) throw new Error(`proxy ${i} -> HTTP ${r.status}`);
      let t = await r.text();
      // allorigins /get returns JSON { contents: "..." }
      if (proxyUrl.includes('/get?')) {
        try { const j = JSON.parse(t); if (j.contents) t = j.contents; } catch { /* ignore */ }
      }
      if (t && t.length > 200) return t;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Không thể tải trang (đã thử tất cả proxy)');
}

/**
 * Fetch an image as a blob URL for use inside <img>.
 * We go through our /api/proxy if available to avoid broken hotlinks.
 */
export async function fetchImageAsObjectUrl(src: string, referer?: string): Promise<string | null> {
  if (typeof window === 'undefined') return src;
  // Direct src always tried first by browser with no-referrer. We just return src;
  // on error caller uses a wsrv.nl fallback which we always add.
  return src;
}
