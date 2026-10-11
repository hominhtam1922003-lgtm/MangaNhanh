import type { Cue } from './types';
import { API_BASE } from './config';

export type JobStatus = {
  id: string;
  status: 'queued' | 'running' | 'done' | 'error';
  message?: string;
  cues?: Cue[];
};

/** Gửi video cho backend tự nhận dạng tiếng Trung. Trả về job id để hỏi trạng thái. */
export async function startSubtitleJob(url: string, translate: boolean): Promise<JobStatus> {
  const r = await fetch(`${API_BASE}/api/subtitles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, translate }),
  });
  if (!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`);
  return r.json();
}

export async function getSubtitleJob(id: string): Promise<JobStatus> {
  const r = await fetch(`${API_BASE}/api/subtitles/${id}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
