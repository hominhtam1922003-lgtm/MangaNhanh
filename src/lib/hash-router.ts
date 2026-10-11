'use client';
import { useEffect, useState } from 'react';

// Hash-based router: URLs are represented as #/path
// e.g. #/, #/manga/nettruyen/slug, #/read/nettruyen/slug/chap-565, #/search?q=...
export interface Route {
  path: string;          // "/manga/nettruyen/slug"
  segments: string[];    // ["manga","nettruyen","slug"]
  query: Record<string, string>;
}

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, '') || '/';
  const [pathPart, queryPart = ''] = h.split('?');
  const path = pathPart.startsWith('/') ? pathPart : '/' + pathPart;
  const segments = path.split('/').filter(Boolean);
  const query: Record<string, string> = {};
  if (queryPart) {
    for (const kv of queryPart.split('&')) {
      const [k, v = ''] = kv.split('=');
      if (k) query[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
    }
  }
  return { path, segments, query };
}

export function useHashRoute(): [Route, (to: string) => void] {
  const [route, setRoute] = useState<Route>(() => {
    if (typeof window === 'undefined') return { path: '/', segments: [], query: {} };
    return parseHash(window.location.hash);
  });
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    // Normalize initial URL
    if (!window.location.hash) {
      window.location.replace('#/');
    }
    window.addEventListener('popstate', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
      window.removeEventListener('popstate', onChange);
    };
  }, []);
  const navigate = (to: string) => {
    const target = to.startsWith('#') ? to : '#' + (to.startsWith('/') ? to : '/' + to);
    if (window.location.hash === target) return;
    window.location.hash = target.slice(1);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };
  return [route, navigate];
}

export function buildHref(to: string) {
  return '#' + (to.startsWith('/') ? to : '/' + to);
}
