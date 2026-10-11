'use client';

/**
 * Probe whether our server-side proxy (Next.js API route /api/proxy) is reachable.
 * In static export (out/) served from a static host (GitHub Pages, Capacitor file://)
 * the proxy isn't available; we fall back to public CORS proxies.
 */
let _cachedProxyAvailable: boolean | null = null;

export async function isServerProxyAvailable(): Promise<boolean> {
  if (_cachedProxyAvailable !== null) return _cachedProxyAvailable;
  if (typeof window === 'undefined') return true;
  if ((window as any).Capacitor || window.location.protocol === 'capacitor:') {
    // Capacitor webview doesn't enforce CORS on native HTTP requests.
    _cachedProxyAvailable = false;
    return false;
  }
  if (window.location.protocol === 'file:') {
    _cachedProxyAvailable = false;
    return false;
  }
  try {
    // Try an inexpensive probe: /api/proxy?url=...
    const probe = await fetch(`/api/proxy?url=${encodeURIComponent('https://example.com/')}`, { method: 'GET' });
    _cachedProxyAvailable = probe.ok;
  } catch {
    _cachedProxyAvailable = false;
  }
  return _cachedProxyAvailable;
}

export function buildLocalProxyUrl(url: string, referer?: string) {
  const params = new URLSearchParams({ url });
  if (referer) params.set('referer', referer);
  return `/api/proxy?${params.toString()}`;
}

export function isCapacitor() {
  if (typeof window === 'undefined') return false;
  return !!(window as any).Capacitor || window.location.protocol === 'capacitor:';
}
