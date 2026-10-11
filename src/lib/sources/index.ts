export const SOURCES = [
  {
    id: 'truyenqq' as const,
    name: 'TruyenQQ',
    baseUrl: 'https://truyenqqko.com',
    logoColor: 'from-sky-500 to-indigo-500',
    description: 'Kho truyện tranh lớn, nhiều bản dịch hay, cập nhật nhanh, đọc mượt.'
  }
] as const;

export type SourceId = (typeof SOURCES)[number]['id'];

export function getSource(id: SourceId) {
  return SOURCES.find(s => s.id === id)!;
}

// Only WORKING public CORS proxies (2026). corsproxy.io now requires API key, htmldriven is 404.
// Ordered by observed reliability/speed.
export const CORS_PROXIES: Array<(url: string) => string> = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url) => `https://proxy.corsfix.com/?${encodeURIComponent(url)}`
];

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try { return await fetch(input, { ...(init || {}), signal: ctrl.signal }); }
  finally { clearTimeout(id); }
}

export async function corsFetch(url: string, init?: RequestInit & { referer?: string }): Promise<string> {
  const headers: Record<string, string> = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'vi,en;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    ...(init?.headers as Record<string, string> || {})
  };
  if (init?.referer) headers['Referer'] = init.referer;

  const w = window as any;
  const isCapacitor = typeof window !== 'undefined' && (
    w.Capacitor || window.location.protocol === 'capacitor:' || window.location.protocol === 'file:' || w.Capacitor?.isNativePlatform?.()
  );

  const tryOnce = async (u: string, useNative = false): Promise<string> => {
    if (useNative && w.Capacitor?.Plugins?.CapacitorHttp?.request) {
      const res = await w.Capacitor.Plugins.CapacitorHttp.request({
        method: 'GET', url: u, headers: { ...headers, 'Accept': headers['Accept'] }
      });
      let t = res?.data ?? '';
      if (typeof t === 'object') t = JSON.stringify(t);
      if (t && t.length > 500) return t;
      throw new Error('native empty');
    }
    const r = await fetchWithTimeout(u, { ...(init || {}), headers }, 8000);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    let t = await r.text();
    if (u.includes('allorigins.win/get?')) {
      try { const j = JSON.parse(t); if (j.contents) t = j.contents; } catch {}
    }
    if (!t || t.length < 500) throw new Error('Phản hồi trống');
    return t;
  };

  // On Android (Capacitor), call DIRECTLY. No CORS, no proxy, no long retry chain — fastest path.
  if (isCapacitor) {
    try { return await tryOnce(url, true); } catch {
      try { return await tryOnce(url, false); }
      catch { throw new Error('Không tải được dữ liệu. Kiểm tra kết nối mạng rồi thử lại.'); }
    }
  }

  // On web preview only: try local dev proxy, then direct, then public proxies.
  const candidates: string[] = [];
  candidates.push(`/api/proxy?url=${encodeURIComponent(url)}${init?.referer ? '&referer='+encodeURIComponent(init.referer):''}`);
  candidates.push(url);
  for (const make of CORS_PROXIES) candidates.push(make(url));

  let lastErr: Error = new Error('Không có phương án fetch nào');
  for (const u of candidates) {
    try { return await tryOnce(u); }
    catch (e) { lastErr = e instanceof Error ? e : new Error(String(e)); }
  }
  throw new Error('Không tải được dữ liệu từ máy chủ web. Hãy cài APK về điện thoại để đọc truyện. (' + lastErr.message + ')');
}
