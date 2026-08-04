import { useMemo } from 'react';
import { darkTheme, theme, type ThemeColors } from './theme';
import { useAppColorScheme } from './colorScheme';

export function useThemeColors(): ThemeColors {
  const { scheme, highContrast } = useAppColorScheme();

  return useMemo(() => {
    const base = scheme === 'dark' ? darkTheme : theme;
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
    };
  }, [highContrast, scheme]);
}
