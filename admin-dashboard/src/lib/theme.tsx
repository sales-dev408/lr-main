import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiRequest } from './api';
import type { ThemeSettings } from './types';

export const DEFAULT_THEME: ThemeSettings = {
  brand: '#2563eb',
  primaryGradient: ['#2563eb', '#16a34a'],
  tabs: [
    { key: 'vendors', label: 'Deals', color: '#2563eb', gradient: ['#3b82f6', '#1d4ed8'] },
    { key: 'index', label: 'Browse', color: '#dc2626', gradient: ['#ef4444', '#b91c1c'] },
    { key: 'discover', label: 'Discover', color: '#16a34a', gradient: ['#22c55e', '#15803d'] },
    { key: 'passes', label: 'My Pass', color: '#2563eb', gradient: ['#3b82f6', '#1d4ed8'] },
    { key: 'profile', label: 'Profile', color: '#16a34a', gradient: ['#22c55e', '#15803d'] },
  ],
};

type ThemeContextValue = {
  theme: ThemeSettings;
  setTheme: (theme: ThemeSettings) => void;
  reload: () => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyCssVariables(theme: ThemeSettings) {
  const root = document.documentElement;
  root.style.setProperty('--accent', theme.brand);
  root.style.setProperty('--brand-gradient', `linear-gradient(135deg, ${theme.primaryGradient[0]}, ${theme.primaryGradient[1]})`);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeSettings>(DEFAULT_THEME);

  const setTheme = useCallback((next: ThemeSettings) => {
    setThemeState(next);
    applyCssVariables(next);
  }, []);

  const reload = useCallback(
    () =>
      // The published theme is public so the shell can style itself before login.
      apiRequest<ThemeSettings>('/settings/theme')
        .then((next) => {
          if (next?.tabs?.length) setTheme(next);
        })
        .catch(() => undefined),
    [setTheme],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<ThemeContextValue>(() => ({ theme, setTheme, reload }), [reload, setTheme, theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return value;
}
