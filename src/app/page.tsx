'use client';

import AppShell from '@/components/AppShell';
import Router from '@/components/Router';
import { ThemeProvider } from '@/components/ThemeProvider';

export default function Page() {
  return (
    <ThemeProvider>
      <AppShell>
        <Router/>
      </AppShell>
    </ThemeProvider>
  );
}
