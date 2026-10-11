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

/**
 * Public CORS proxies used as fallbacks. The UI tries them in order.
 * These are free public services that may occasionally be down.
 */
export const CORS_PROXIES = [
  // AllOrigins raw
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  // CorsProxy.io
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  // CodeTabs CORS proxy
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  // ThingProxy (mirror)
  (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
];

export async function corsFetch(url: string, init?: RequestInit): Promise<string> {
  let lastErr: unknown;
  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const proxyUrl = CORS_PROXIES[i](url);
    try {
      const resp = await fetch(proxyUrl, {
        ...init,
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'vi,en;q=0.9',
          ...(init?.headers || {})
        }
      });
      if (!resp.ok) throw new Error(`proxy ${i} -> HTTP ${resp.status}`);
      const text = await resp.text();
      // allorigins /get returns JSON
      if (proxyUrl.includes('/get?')) {
        try {
          const j = JSON.parse(text);
          if (j.contents) return j.contents as string;
        } catch { /* fallthrough */ }
      }
      if (text && text.length > 200) return text;
    } catch (e) {
      lastErr = e;
    }
  }
  // Last resort: try direct (works when CORS headers exist, e.g. some servers)
  try {
    const r = await fetch(url, {
      ...init,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...(init?.headers || {})
      }
    });
    if (r.ok) return r.text();
  } catch (e) {
    lastErr = e;
  }
  throw lastErr instanceof Error ? lastErr : new Error('Không thể tải trang');
}
