import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';
import { getItem, setItem } from './storage';

const STORAGE_KEY = 'lr.mobile.colorScheme';

export type AppColorScheme = 'light' | 'dark';

type ColorSchemeContextValue = {
  scheme: AppColorScheme;
  setScheme: (scheme: AppColorScheme) => void;
  highContrast: boolean;
  setHighContrast: (enabled: boolean) => void;
};

const ColorSchemeContext = createContext<ColorSchemeContextValue | null>(null);

export function ColorSchemeProvider({ children }: { children: ReactNode }) {
  const [scheme, setSchemeState] = useState<AppColorScheme>(Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');
  const [highContrast, setHighContrastState] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted || !raw) return;
        try {
          const parsed = JSON.parse(raw) as { scheme?: AppColorScheme; highContrast?: boolean };
          if (parsed.scheme === 'light' || parsed.scheme === 'dark') {
            setSchemeState(parsed.scheme);
          }
          if (typeof parsed.highContrast === 'boolean') {
            setHighContrastState(parsed.highContrast);
          }
        } catch {
          // ignore
        }
      })
      .finally(() => setLoaded(true));
    return () => {
      mounted = false;
    };
  }, []);

  const persist = useCallback(async (next: { scheme: AppColorScheme; highContrast: boolean }) => {
    await setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const setScheme = useCallback(
    (next: AppColorScheme) => {
      setSchemeState(next);
      void persist({ scheme: next, highContrast });
    },
    [highContrast, persist],
  );

  const setHighContrast = useCallback(
    (next: boolean) => {
      setHighContrastState(next);
      void persist({ scheme, highContrast: next });
    },
    [scheme, persist],
  );

  const value = useMemo<ColorSchemeContextValue>(
    () => ({
      scheme,
      setScheme,
      highContrast,
      setHighContrast,
    }),
    [scheme, setScheme, highContrast, setHighContrast],
  );

  if (!loaded) {
    // Prevent theme flash while reading stored preference.
    return null;
  }

  return <ColorSchemeContext.Provider value={value}>{children}</ColorSchemeContext.Provider>;
}

export function useAppColorScheme(): ColorSchemeContextValue {
  const value = useContext(ColorSchemeContext);
  if (!value) {
    throw new Error('useAppColorScheme must be used within ColorSchemeProvider');
  }
  return value;
}
