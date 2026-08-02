import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { getAppTheme } from './api';
import { DEFAULT_THEME_SETTINGS } from './theme';
import type { ThemeSettings, ThemeTab } from './types';

type AppThemeContextValue = {
  theme: ThemeSettings;
  loading: boolean;
  refresh: () => Promise<void>;
  tabFor: (key: string) => ThemeTab;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME_SETTINGS);
  const [loading, setLoading] = useState(true);

  const mounted = useRef(true);

  const refresh = useCallback(
    () =>
      getAppTheme()
        .then((remote) => {
          if (mounted.current && remote?.tabs?.length) {
            setTheme(remote);
          }
        })
        // Keep the bundled fallback theme when the backend is unreachable.
        .catch(() => undefined)
        .finally(() => {
          if (mounted.current) {
            setLoading(false);
          }
        }),
    [],
  );

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  // Refresh the theme when the app returns to the foreground and periodically
  // while it is active, so admin console changes show up without a restart.
  useEffect(() => {
    const handleAppState = (next: AppStateStatus) => {
      if (next === 'active') {
        void refresh();
      }
    };
    const subscription = AppState.addEventListener('change', handleAppState);
    const interval = setInterval(() => void refresh(), 30000);
    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [refresh]);

  const value = useMemo<AppThemeContextValue>(
    () => ({
      theme,
      loading,
      refresh,
      tabFor: (key) =>
        theme.tabs.find((tab) => tab.key === key) ??
        DEFAULT_THEME_SETTINGS.tabs.find((tab) => tab.key === key) ?? {
          key,
          label: key,
          color: theme.brand,
          gradient: theme.primaryGradient,
        },
    }),
    [loading, refresh, theme],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  const value = useContext(AppThemeContext);
  if (!value) {
    throw new Error('useAppTheme must be used within AppThemeProvider');
  }
  return value;
}
