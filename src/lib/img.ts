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
    const blob: any = resp.data;
    if (!blob) return null;
    // Blob, ArrayBuffer, or base64
    if (blob instanceof Blob) {
      const u = URL.createObjectURL(blob);
      leaked.add(u); return u;
    }
    const ctype = resp.headers?.['content-type'] || resp.headers?.['Content-Type'] || guessType(c.url);
    if (blob instanceof ArrayBuffer) {
      const u = URL.createObjectURL(new Blob([blob], { type: ctype }));
      leaked.add(u); return u;
    }
    if (typeof blob === 'string') {
      const bin = atob(blob);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const u = URL.createObjectURL(new Blob([arr], { type: ctype }));
      leaked.add(u); return u;
    }
    return null;
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

/**
 * Build the full fallback chain for an image URL.
 * Ensures URLs start with https://.
 */
export function imageCandidates(rawUrl: string, referer: string): Cand[] {
  let u = rawUrl.trim();
  if (u.startsWith('//')) u = 'https:' + u;
  if (!/^https?:\/\//i.test(u)) u = 'https://nettruyen.gg' + (u.startsWith('/') ? u : '/' + u);
  const ref = referer || 'https://nettruyen.gg/';
  const out: Cand[] = [];
  out.push({ url: u, referer: ref }); // native first
  out.push({ url: wsrv(u, ref) });
  out.push({ url: weserv(u, ref) });
  return out;
}

/** Hook: resolves an image URL to a loadable src (blob URL or proxy URL) */
export function useImage(rawUrl: string | undefined | null, referer: string) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!!rawUrl);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rawUrl) { setSrc(null); setLoading(false); setError('no url'); return; }
    let cancelled = false;
    let revoked: string | null = null;

    (async () => {
      setLoading(true); setError(null);
      const list = imageCandidates(rawUrl, referer);
      // If native, try native first
      if (isNative()) {
        const blob = await nativeFetch(list[0]);
        if (cancelled) { if (blob) { URL.revokeObjectURL(blob); leaked.delete(blob); } return; }
        if (blob) { setSrc(blob); setLoading(false); return; }
      }
      // Fallback: try each proxy by loading as an <img> (so we know which actually decodes)
      for (const c of list) {
        const ok = await new Promise<boolean>(resolve => {
          const im = new Image();
          im.onload = () => resolve(true);
          im.onerror = () => resolve(false);
          im.referrerPolicy = 'no-referrer';
          im.src = c.url;
        });
        if (cancelled) return;
        if (ok) { setSrc(c.url); setLoading(false); return; }
      }
      if (!cancelled) { setSrc(null); setError('failed'); setLoading(false); }
    })();

    return () => {
      cancelled = true;
      if (revoked) { URL.revokeObjectURL(revoked); leaked.delete(revoked); }
    };
  }, [rawUrl, referer]);

  return { src, loading, error };
}
