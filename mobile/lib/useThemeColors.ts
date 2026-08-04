import { useEffect, useState } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import { darkTheme, theme, type ThemeColors } from './theme';

async function highContrastEnabled(): Promise<boolean> {
  const checks = [
    (AccessibilityInfo as { isHighContrastEnabled?: () => Promise<boolean> }).isHighContrastEnabled?.(),
    (AccessibilityInfo as { isHighTextContrastEnabled?: () => Promise<boolean> }).isHighTextContrastEnabled?.(),
    (AccessibilityInfo as { isDarkerSystemColorsEnabled?: () => Promise<boolean> }).isDarkerSystemColorsEnabled?.(),
  ].filter(Boolean) as Promise<boolean>[];
  if (checks.length === 0) return false;
  const results = await Promise.all(checks);
  return results.some(Boolean);
}

export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const enabled = await highContrastEnabled();
      if (mounted) setHighContrast(enabled);
    };
    void check();

    const onChange = () => void check();
    const subs: { remove?: () => void }[] = [];
    subs.push((AccessibilityInfo as any).addEventListener('highContrastTextChanged', onChange));
    subs.push((AccessibilityInfo as any).addEventListener('darkerSystemColorsChanged', onChange));
    return () => {
      mounted = false;
      subs.forEach((s) => s?.remove?.());
    };
  }, []);

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
}
