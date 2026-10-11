"use client";
/**
 * Image loading that always works in Capacitor:
 *  1) Native Android HTTP (CapacitorHttp) with correct Referer -> Blob URL -> <img>
 *  2) wsrv.nl (image proxy, sends Referer server-side)
 *  3) images.weserv.nl (mirror)
 *  4) Direct (works on browsers with permissive CORS)
 */
import { useEffect, useState } from 'react';

const leaked = new Set<string>();
const memCache = new Map<string, string>(); // url+ref -> object URL or proxy URL
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    leaked.forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
    leaked.clear();
  });
}

type Cand = { url: string; referer?: string };

function isNative(): boolean {
  const w = window as any;
  return !!(w.Capacitor && (w.Capacitor.isNativePlatform?.() || w.Capacitor.isPluginAvailable?.('CapacitorHttp')));
}

// Parallel HEAD/get test using Image() – fast to know if a URL works in browser
function imgLoads(u: string): Promise<boolean> {
  return new Promise(resolve => {
    const im = new Image();
    im.onload = () => resolve(true);
    im.onerror = () => resolve(false);
    im.referrerPolicy = 'no-referrer';
    im.src = u;
  });
}

async function nativeFetch(c: Cand): Promise<string | null> {
  const w = window as any;
  const plugin = w.Capacitor?.Plugins?.CapacitorHttp;
  if (!plugin) return null;
  try {
    const resp = await plugin.request({
      method: 'GET',
      url: c.url,
      responseType: 'blob',
      headers: {
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer': c.referer || '',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
      }
    });
    const data: any = resp.data;
    if (!data) return null;
    const ctype = resp.headers?.['content-type'] || resp.headers?.['Content-Type'] || guessType(c.url);
    let blob: Blob | null = null;
    if (data instanceof Blob) blob = data;
    else if (data instanceof ArrayBuffer) blob = new Blob([data], { type: ctype });
    else if (data.buffer instanceof ArrayBuffer) blob = new Blob([data.buffer], { type: ctype });
    else if (typeof data === 'string') {
      const bin = atob(data);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      blob = new Blob([arr], { type: ctype });
    }
    if (!blob) return null;
    const u = URL.createObjectURL(blob);
    leaked.add(u);
    return u;
  } catch { return null; }
}

function guessType(u: string) {
  if (/\.webp/i.test(u)) return 'image/webp';
  if (/\.png/i.test(u)) return 'image/png';
  if (/\.gif/i.test(u)) return 'image/gif';
  return 'image/jpeg';
}

function wsrv(u: string, ref: string) {
  return `https://wsrv.nl/?url=${encodeURIComponent(u)}&referer=${encodeURIComponent(ref)}&af&n=-1`;
}
function weserv(u: string, ref: string) {
  return `https://images.weserv.nl/?url=${encodeURIComponent(u.replace(/^https?:\/\//, ''))}&af&referrer=${encodeURIComponent(ref)}`;
}

export function imageCandidates(rawUrl: string, referer: string): Cand[] {
  let u = rawUrl.trim();
  if (u.startsWith('//')) u = 'https:' + u;
  const BASE = 'https://truyenqqko.com';
  if (!/^https?:\/\//i.test(u)) u = BASE + (u.startsWith('/') ? u : '/' + u);
  const ref = referer || BASE + '/';
  return [
    { url: u, referer: ref },
    { url: wsrv(u, ref) },
    { url: weserv(u, ref) }
  ];
}

/** Hook: resolves an image URL to a loadable src (blob URL or proxy URL).
 *  Set priority=true for above-the-fold images (loads immediately),
 *  false for lazy ones (waits until enabled via IntersectionObserver). */
export function useImage(rawUrl: string | undefined | null, referer: string, priority = false) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!!rawUrl);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<boolean>(priority);

  // Lazy: delay non-priority images slightly to let first paint finish, improving responsiveness.
  useEffect(() => {
    if (priority) return;
    const t = setTimeout(() => setEnabled(true), 150);
    return () => clearTimeout(t);
  }, [priority, rawUrl]);

  useEffect(() => {
    if (!rawUrl) { setSrc(null); setLoading(false); setError('no url'); return; }
    if (!enabled) return;
    const cacheKey = rawUrl + '|' + referer;
    if (memCache.has(cacheKey)) {
      setSrc(memCache.get(cacheKey)!);
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      setLoading(true); setError(null);
      const list = imageCandidates(rawUrl, referer);

      // Native first on Capacitor
      if (isNative()) {
        const blob = await nativeFetch(list[0]);
        if (cancelled) { if (blob) { URL.revokeObjectURL(blob); leaked.delete(blob); } return; }
        if (blob) { memCache.set(cacheKey, blob); setSrc(blob); setLoading(false); return; }
      }
      // Proxies
      for (const c of list) {
        const ok = await imgLoads(c.url);
        if (cancelled) return;
        if (ok) { memCache.set(cacheKey, c.url); setSrc(c.url); setLoading(false); return; }
      }
      if (!cancelled) { setSrc(null); setError('failed'); setLoading(false); }
    })();

    return () => { cancelled = true; };
  }, [rawUrl, referer, enabled]);

  return { src, loading, error };
}

/** Clear memory cache (e.g., when leaving reader page). */
export function purgeImageCache() {
  memCache.forEach((v, k) => {
    if (v.startsWith('blob:')) { URL.revokeObjectURL(v); leaked.delete(v); }
  });
  memCache.clear();
}
