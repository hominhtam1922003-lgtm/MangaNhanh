export type SourceId = 'nettruyen' | 'truyenqq';

export interface SourceInfo {
  id: SourceId;
  name: string;
  baseUrl: string;
  logoColor: string;
}

export interface MangaBasic {
  source: SourceId;
  slug: string;
  title: string;
  thumbnail: string;
  cover?: string;
  latestChapter?: string;
  updatedAt?: string;
}

export interface MangaDetail extends MangaBasic {
  otherName?: string;
  author?: string;
  status?: string;
  genres?: { name: string; slug: string }[];
  views?: string;
  followers?: string;
  rating?: string;
  description?: string;
  chapters: Chapter[];
}

export interface Chapter {
  source: SourceId;
  mangaSlug: string;
  slug: string;      // chapter slug portion, e.g. "chuong-565"
  title: string;     // "Chapter 565"
  number: number;
  updatedAt?: string;
  views?: string;
}

export interface ChapterPage {
  src: string;           // proxied url (/api/image?url=...)
  originalSrc: string;
  index: number;
}
