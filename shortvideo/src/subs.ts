import type { Cue } from './types';

const toSec = (t: string): number => {
  const p = t.trim().replace(',', '.').split(':').map(Number);
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
};

/** Parse WebVTT. Mỗi cue: dòng 1 = tiếng Trung, các dòng sau = tiếng Việt (nếu có). */
export function parseVtt(text: string): Cue[] {
  const cues: Cue[] = [];
  for (const block of text.replace(/\r/g, '').split(/\n\s*\n/)) {
    const lines = block.split('\n');
    const i = lines.findIndex((l) => l.includes('-->'));
    if (i < 0) continue;
    const [a, b] = lines[i].split('-->');
    const body = lines.slice(i + 1).map((s) => s.trim()).filter(Boolean);
    if (!body.length) continue;
    cues.push({
      start: toSec(a),
      end: toSec(b.trim().split(/\s+/)[0]),
      zh: body[0],
      vi: body.length > 1 ? body.slice(1).join(' ') : undefined,
    });
  }
  return cues;
}

export function findCueIndex(cues: Cue[], t: number): number {
  // Tìm nhanh bằng binary search (cue đã sắp xếp theo thời gian)
  let lo = 0, hi = cues.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].start <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans >= 0 && t <= cues[ans].end + 0.3 ? ans : -1;
}
