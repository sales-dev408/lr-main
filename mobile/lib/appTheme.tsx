import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { getAppTheme } from './api';
import { DEFAULT_THEME_SETTINGS, NBA_ALLSTAR_THEME_SETTINGS } from './theme';
import { getItem, setItem } from './storage';
import type { ThemeSettings, ThemeTab } from './types';

const NBA_ALLSTAR_STORAGE_KEY = 'lr.mobile.nbaAllStar';

type AppThemeContextValue = {
  theme: ThemeSettings;
  loading: boolean;
  refresh: () => Promise<void>;
  tabFor: (key: string) => ThemeTab;
  nbaAllStarEnabled: boolean;
  setNbaAllStarEnabled: (enabled: boolean) => Promise<void>;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [nbaAllStarEnabled, setNbaAllStarEnabledState] = useState(false);

  const mounted = useRef(true);
  const initialized = useRef(false);

  const refresh = useCallback(
    async () => {
      // Check if NBA All-Star theme is enabled
      const storedNbaAllStar = await getItem(NBA_ALLSTAR_STORAGE_KEY);
      const isNbaAllStarEnabled = storedNbaAllStar === 'true';

      await getAppTheme()
        .then((remote) => {
          if (!mounted.current) return;
          // The admin dashboard publishes mode:'nba-allstar' to flip every
          // device to the basketball theme; the local switch still works too.
          const remoteNba = remote?.mode === 'nba-allstar';
          const nba = remoteNba || isNbaAllStarEnabled;
          setNbaAllStarEnabledState(nba);
          if (nba) {
            setTheme(NBA_ALLSTAR_THEME_SETTINGS);
          } else if (remote?.tabs?.length) {
            setTheme(remote);
          }
        })
        // Keep the bundled fallback theme when the backend is unreachable;
        // still honor the local NBA switch in that case.
        .catch(() => {
          if (mounted.current && isNbaAllStarEnabled) {
            setNbaAllStarEnabledState(true);
            setTheme(NBA_ALLSTAR_THEME_SETTINGS);
          }
        })
        .finally(() => {
          if (mounted.current) {
            setLoading(false);
          }
        });
    },
    [],
  );

  const setNbaAllStarEnabled = useCallback(async (enabled: boolean) => {
    await setItem(NBA_ALLSTAR_STORAGE_KEY, String(enabled));
    setNbaAllStarEnabledState(enabled);
    if (enabled) {
      setTheme(NBA_ALLSTAR_THEME_SETTINGS);
    } else {
      // Re-fetch the regular theme from backend
      await refresh();
    }
  }, [refresh]);

  useEffect(() => {
    mounted.current = true;
    if (!initialized.current) {
      initialized.current = true;
      refresh();
    }
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  // Refresh the theme when the app returns to the foreground.
  useEffect(() => {
    const handleAppState = (next: AppStateStatus) => {
      if (next === 'active') {
        void refresh();
      }
    };
    const subscription = AppState.addEventListener('change', handleAppState);
    return () => {
      subscription.remove();
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
      nbaAllStarEnabled,
      setNbaAllStarEnabled,
    }),
    [loading, refresh, theme, nbaAllStarEnabled, setNbaAllStarEnabled],
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
