import { NextRequest, NextResponse } from 'next/server';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
];
function pickUA() { return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]; }

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get('url');
  if (!target) return new NextResponse('Missing url param', { status: 400 });
  try {
    const parsed = new URL(target);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return new NextResponse('Invalid protocol', { status: 400 });
    }
    const acceptImage = /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(parsed.pathname) ||
      req.headers.get('accept')?.includes('image');
    const headers: Record<string, string> = {
      'User-Agent': pickUA(),
      'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
      'Accept': acceptImage
        ? 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Referer': searchParams.get('referer') || `${parsed.protocol}//${parsed.host}/`
    };
    const upstream = await fetch(target, { headers, redirect: 'follow', cache: 'no-store' });
    if (!upstream.ok) return new NextResponse(`Upstream ${upstream.status}`, { status: upstream.status });
    const contentType = upstream.headers.get('content-type') || (acceptImage ? 'image/jpeg' : 'text/html; charset=utf-8');
    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err: any) {
    return new NextResponse('Proxy error: ' + (err?.message || 'unknown'), { status: 500 });
  }
}
