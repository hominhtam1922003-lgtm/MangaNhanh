export interface VideoItem {
  url: string;
  title: string;
  thumbnail: string;
  uploaderName: string;
  views: number;
  duration: number;
  type?: string;
}
export interface Stream {
  url: string;
  mimeType: string;
  quality: string;
  videoOnly?: boolean;
}
export interface VideoDetails {
  title: string;
  uploader: string;
  description: string;
  thumbnailUrl: string;
  hls?: string;
  videoStreams: Stream[];
  audioStreams: Stream[];
  relatedStreams: VideoItem[];
}
const base = (process.env.EXPO_PUBLIC_PIPED_API_URL || 'https://pipedapi.kavin.rocks').replace(/\/$/, '');
async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 20000);
  try {
    const response = await fetch(`${base}${path}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`Piped returned HTTP ${response.status}. Try again or configure another instance.`);
    return await response.json();
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted) throw new Error('The Piped instance timed out. Try again or configure another instance.');
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
export function videoId(url: string): string | null {
  const id = url.match(/[?&]v=([\w-]{11})(?:&|$)/)?.[1] ?? (/^[\w-]{11}$/.test(url) ? url : null);
  return id;
}
export const trending = (signal?: AbortSignal) => request<VideoItem[]>('/trending?region=US', signal);
export const search = async (query: string, signal?: AbortSignal) => {
  const result = await request<{ items: VideoItem[] }>(`/search?q=${encodeURIComponent(query)}&filter=videos`, signal);
  return result.items.filter(item => (!item.type || item.type === 'stream') && videoId(item.url));
};
export const details = (id: string, signal?: AbortSignal) => request<VideoDetails>(`/streams/${encodeURIComponent(id)}`, signal);
// expo-av cannot mux separate DASH audio/video tracks: only use combined streams.
export function playbackSource(data: VideoDetails, audioOnly: boolean): string | undefined {
  if (audioOnly) return data.audioStreams.find(s => s.mimeType?.includes('mp4'))?.url ?? data.audioStreams[0]?.url;
  return data.hls || data.videoStreams.find(s => !s.videoOnly && s.mimeType?.includes('mp4'))?.url;
}
