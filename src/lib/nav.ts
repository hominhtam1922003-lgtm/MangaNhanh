// Helper to build SPA-compatible paths that work in static export / Capacitor APK.
export function mangaPath(source: string, slug: string) {
  return `/manga/${source}/${slug}`;
}
export function readPath(source: string, slug: string, chapter: string) {
  return `/read/${source}/${slug}/${chapter}`;
}
export function sourcePath(id: string) {
  return `/source/${id}`;
}
