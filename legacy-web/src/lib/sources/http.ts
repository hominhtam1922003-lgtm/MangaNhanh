const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
];

export function pickUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export async function fetchHtml(url: string, opts: { referer?: string; cookie?: string } = {}) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': pickUA(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
      ...(opts.referer ? { Referer: opts.referer } : {}),
      ...(opts.cookie ? { Cookie: opts.cookie } : {})
    },
    cache: 'no-store',
    redirect: 'follow'
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} when fetching ${url}`);
  }
  const buf = await res.arrayBuffer();
  // Try utf-8 decode; fall back to latin1
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(buf);
  } catch {
    return new TextDecoder('latin1').decode(buf);
  }
}

export async function fetchBuffer(url: string, referer?: string) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': pickUA(),
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Referer': referer || '',
      'Sec-Fetch-Dest': 'image',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'cross-site'
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} image ${url}`);
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const ab = await res.arrayBuffer();
  return { buffer: Buffer.from(ab), contentType };
}
