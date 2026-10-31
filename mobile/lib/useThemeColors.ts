import { useMemo } from 'react';
import { darkTheme, nbaDarkTheme, nbaTheme, theme, type ThemeColors } from './theme';
import { useAppColorScheme } from './colorScheme';
import { useAppTheme } from './appTheme';

export function useThemeColors(): ThemeColors {
  const { scheme, highContrast } = useAppColorScheme();
  const { nbaAllStarEnabled } = useAppTheme();

  return useMemo(() => {
    const base = nbaAllStarEnabled ? (scheme === 'dark' ? nbaDarkTheme : nbaTheme) : scheme === 'dark' ? darkTheme : theme;
    if (!highContrast) return base;

    return {
      ...base,
      bg: scheme === 'dark' ? '#000000' : '#ffffff',
      panel: scheme === 'dark' ? '#000000' : '#ffffff',
      ink: scheme === 'dark' ? '#ffffff' : '#000000',
      ink2: scheme === 'dark' ? '#ffffff' : '#000000',
      border: scheme === 'dark' ? '#ffffff' : '#000000',
      muted: scheme === 'dark' ? '#ffffff' : '#000000',
      subtle: scheme === 'dark' ? '#ffffff' : '#000000',
      accent: scheme === 'dark' ? '#ffffff' : '#000000',
    };
  }, [highContrast, scheme, nbaAllStarEnabled]);
}
