export type Item = {
  id: string;
  title: string;
  url: string;          // link video trực tiếp (mp4 / webm)
  subtitles?: string;   // (tuỳ chọn) link file .vtt có sẵn: dòng 1 = tiếng Trung, dòng 2 = tiếng Việt
  tags?: string[];
  credit?: string;      // ghi công / giấy phép
  thumb?: string;       // ảnh poster (tuỳ chọn)
};

export type Cue = {
  start: number;
  end: number;
  zh: string;
  vi?: string;
};

export type SubMode = 'overlay' | 'parallel' | 'off';

/** Kết quả tìm web (Google Programmable Search). */
export type WebResult = {
  id: string;
  title: string;
  url: string;
  snippet: string;
  thumb?: string;
  host: string;
};
