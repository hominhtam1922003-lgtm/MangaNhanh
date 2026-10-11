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

/** timeout wrapper for fetch so it never hangs on skeleton forever */
async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 6000): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(input, { ...(init || {}), signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

/**
 * Attempt to fetch a URL, choosing the best method based on environment:
 *  - Capacitor/native webview  → direct fetch (CORS is not enforced in Android WebView)
 *  - Next.js dev/prod server   → local /api/proxy server route
 *  - Static host / preview     → public CORS proxies in sequence
 */
export async function corsFetch(url: string, init?: RequestInit & { referer?: string }): Promise<string> {
  const headers: Record<string, string> = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'vi,en;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    ...(init?.headers as Record<string, string> || {})
  };
  if (init?.referer) headers['Referer'] = init.referer;

  const isCapacitor = typeof window !== 'undefined' && (
    (window as any).Capacitor || window.location.protocol === 'capacitor:' || window.location.protocol === 'file:'
  );

  const tryOnce = async (u: string) => {
    const r = await fetchWithTimeout(u, { ...(init || {}), headers }, 7000);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    let t = await r.text();
    if (u.includes('allorigins.win/get?')) {
      try { const j = JSON.parse(t); if (j.contents) t = j.contents; } catch { /* ignore */ }
    }
    if (!t || t.length < 200) throw new Error('Phản hồi trống');
    return t;
  };

  const candidates: string[] = [];
  if (isCapacitor) {
    candidates.push(url); // direct first
  } else {
    candidates.push(`/api/proxy?url=${encodeURIComponent(url)}${init?.referer ? '&referer='+encodeURIComponent(init.referer):''}`);
    candidates.push(url);
  }
  for (const make of CORS_PROXIES) candidates.push(make(url));

  let lastErr: Error = new Error('Không có phương án fetch nào');
  for (const u of candidates) {
    try {
      return await tryOnce(u);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw new Error(
    (isCapacitor
      ? 'Không tải được dữ liệu. Kiểm tra kết nối mạng rồi thử lại.'
      : 'Không tải được dữ liệu từ máy chủ web (có thể do CORS hoặc chặn mạng). Hãy cài APK về điện thoại để đọc truyện.')
    + ' (' + lastErr.message + ')'
  );
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
