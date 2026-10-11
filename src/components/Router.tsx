'use client';

import { useHashRoute } from '@/lib/hash-router';
import HomePage from '@/views/HomePage';
import AboutPage from '@/views/AboutPage';
import LibraryPage from '@/views/LibraryPage';
import HistoryPage from '@/views/HistoryPage';
import SearchPage from '@/views/SearchPage';
import SourcePage from '@/views/SourcePage';
import MangaDetailPage from '@/views/MangaDetailPage';
import ReaderPage from '@/views/ReaderPage';
import DownloadPage from '@/views/DownloadPage';
import { Empty } from './Loading';

export default function Router() {
  const [route] = useHashRoute();
  const [p0, p1, p2, p3] = route.segments;

  if (!p0) return <HomePage/>;
  if (p0 === 'about') return <AboutPage/>;
  if (p0 === 'library') return <LibraryPage/>;
  if (p0 === 'history') return <HistoryPage/>;
  if (p0 === 'download') return <DownloadPage/>;
  if (p0 === 'search') return <SearchPage/>;
  if (p0 === 'source') return <SourcePage/>;
  if (p0 === 'manga' && p1 && p2) return <MangaDetailPage source={p1} slug={p2}/>;
  if (p0 === 'read' && p1 && p2 && p3) return <ReaderPage source={p1} slug={p2} chapter={p3}/>;
  return <Empty title="Trang không tồn tại"/>;
}
