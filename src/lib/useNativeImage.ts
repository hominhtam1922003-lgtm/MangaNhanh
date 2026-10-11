"use client";

/**
 * Native image loader using CapacitorHttp when available.
 * CDNs like kcgsbok.com (NetTruyen) reject image loads missing the proper Referer
 * header; the standard <img src=...> from capacitor:// scheme sends no Referer → 403.
 * We fetch via Android native HTTP (CapacitorHttp) with correct Referer, convert to
 * a Blob object URL, and use that as the img src.
 */
import { useEffect, useState } from 'react';

type ImgCandidate = { src?: string; referer?: string };

const OBJECT_URLS = new Set<string>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    OBJECT_URLS.forEach(u => URL.revokeObjectURL(u));
    OBJECT_URLS.clear();
  });
}

async function nativeFetchImage(url: string, referer?: string): Promise<string> {
  const w = window as any;
  const hasCapHttp = w.Capacitor?.Plugins?.CapacitorHttp?.request;

  const res = await (hasCapHttp
    ? w.Capacitor.Plugins.CapacitorHttp.request({
        method: 'GET',
        url,
        responseType: 'arraybuffer',
        headers: {
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Referer': referer || '',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 13) Chrome/124.0.0.0 Mobile Safari/537.36'
        }
      })
    : fetch(url, { headers: referer ? { Referer: referer } : undefined }).then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const blob = await r.blob();
        return { data: blob, headers: { 'content-type': blob.type } };
      }));

  let blob: Blob;
  const contentType = (res.headers && (res.headers['content-type'] || res.headers['Content-Type'])) || 'image/jpeg';
  const data: any = res.data;
  if (data instanceof Blob) {
    blob = data;
  } else if (data instanceof ArrayBuffer) {
    blob = new Blob([data], { type: contentType });
  } else if (Array.isArray(data) || (typeof Uint8Array !== 'undefined' && data instanceof Uint8Array)) {
    blob = new Blob([data as unknown as BlobPart], { type: contentType });
  } else if (typeof data === 'string') {
    // Try base64 data URI
    if (data.startsWith('data:')) {
      const parts = data.split(',');
      const meta = parts[0] || '';
      const mimeMatch = meta.match(/data:([^;]+)/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const b64 = parts[1] || parts[0];
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      blob = new Blob([arr], { type: mime });
    } else {
      // raw base64
      try {
        const bin = atob(data);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        blob = new Blob([arr], { type: contentType });
      } catch {
        throw new Error('Dữ liệu ảnh không hợp lệ');
      }
    }
  } else if (data && typeof data === 'object' && typeof data.data !== 'undefined') {
    const inner = data.data;
    const innerCtype = data.contentType || data.mime || data.type || contentType;
    if (inner instanceof Blob) blob = inner;
    else if (inner instanceof ArrayBuffer) blob = new Blob([inner], { type: innerCtype });
    else if (Array.isArray(inner) || inner instanceof Uint8Array) blob = new Blob([inner as unknown as BlobPart], { type: innerCtype });
    else if (typeof inner === 'string') {
      const bin = atob(inner);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      blob = new Blob([arr], { type: innerCtype });
    } else {
      throw new Error('Không nhận được dữ liệu ảnh');
    }
  } else {
    throw new Error('Không nhận được dữ liệu ảnh');
  }
  const objUrl = URL.createObjectURL(blob);
  OBJECT_URLS.add(objUrl);
  return objUrl;
}

/**
 * Try a list of candidate (src, referer) pairs until one loads.
 * Falls back gracefully: if everything fails, returns null and component can show error.
 */
export function useNativeImage(candidates: ImgCandidate[]): { url: string | null; loading: boolean; error: string | null } {
  const [state, setState] = useState<{ url: string | null; loading: boolean; error: string | null }>({
    url: null, loading: true, error: null
  });

  useEffect(() => {
    let cancelled = false;
    let currentObjectUrl: string | null = null;

    async function run() {
      setState(s => ({ ...s, loading: true, error: null }));
      let lastErr: unknown;
      for (const c of candidates) {
        if (!c.src) continue;
        try {
          const obj = await nativeFetchImage(c.src, c.referer);
          if (cancelled) { URL.revokeObjectURL(obj); OBJECT_URLS.delete(obj); return; }
          if (currentObjectUrl) { URL.revokeObjectURL(currentObjectUrl); OBJECT_URLS.delete(currentObjectUrl); }
          currentObjectUrl = obj;
          setState({ url: obj, loading: false, error: null });
          return;
        } catch (e) {
          lastErr = e;
          // fallback: also try letting browser load the URL directly (may work for CDNs that don't check Referer)
          try {
            await new Promise<void>((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve();
              img.onerror = () => reject(new Error('img onerror'));
              img.src = c.src!;
              if (c.referer) img.referrerPolicy = 'no-referrer-when-downgrade';
            });
            if (cancelled) return;
            if (currentObjectUrl) { URL.revokeObjectURL(currentObjectUrl); OBJECT_URLS.delete(currentObjectUrl); currentObjectUrl = null; }
            setState({ url: c.src!, loading: false, error: null });
            return;
          } catch {}
        }
      }
      if (!cancelled) setState({ url: null, loading: false, error: lastErr instanceof Error ? lastErr.message : 'Lỗi tải ảnh' });
    }

    run();
    return () => {
      cancelled = true;
      if (currentObjectUrl) { URL.revokeObjectURL(currentObjectUrl); OBJECT_URLS.delete(currentObjectUrl); }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates.map(c => c.src + '|' + c.referer).join('||')]);

  return state;
}
