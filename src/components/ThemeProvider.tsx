'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { getSettings, setSettings, type Settings } from '@/lib/client/storage';

type Ctx = Settings & {
  toggleTheme: () => void;
  setMode: (m: Settings['readMode']) => void;
  update: (p: Partial<Settings>) => void;
};

const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeScript() {
  // Runs before React mounts to prevent flash of wrong theme
  const code = `(function(){try{var s=JSON.parse(localStorage.getItem('manganhanh:settings')||'{}');var t=s.theme||'dark';var d=t==='system'?window.matchMedia('(prefers-color-scheme: dark)').matches:t==='dark';document.documentElement.classList.toggle('dark',d);document.documentElement.classList.toggle('light',!d);}catch(e){document.documentElement.classList.add('dark');}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setS] = useState<Settings>(() => {
    if (typeof window === 'undefined') return { theme: 'dark', readMode: 'vertical', imageQuality: 'original', direction: 'ltr' };
    return getSettings();
  });

  useEffect(() => {
    const apply = () => {
      const isDark = settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark', isDark);
      document.documentElement.classList.toggle('light', !isDark);
    };
    apply();
    setSettings(settings);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (settings.theme === 'system') {
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [settings]);

  const value: Ctx = {
    ...settings,
    toggleTheme: () => setS(s => ({ ...s, theme: s.theme === 'dark' ? 'light' : s.theme === 'light' ? 'system' : 'dark' })),
    setMode: (m) => setS(s => ({ ...s, readMode: m })),
    update: (p) => setS(s => ({ ...s, ...p }))
  };
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const c = useContext(ThemeCtx);
  if (!c) throw new Error('useTheme must be used inside ThemeProvider');
  return c;
}
