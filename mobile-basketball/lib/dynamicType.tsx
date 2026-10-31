import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { getItem, setItem } from './storage';

export const MAX_FONT_MULTIPLIER = 2.0;
const STORAGE_KEY = 'lr.mobile.textScale';

export type TextScaleOption = 1.0 | 1.4 | 2.0;

export const TEXT_SCALE_OPTIONS: { value: TextScaleOption; label: string }[] = [
  { value: 1.0, label: 'Default' },
  { value: 1.4, label: 'Large (140%)' },
  { value: 2.0, label: 'Extra Large (200%)' },
];

type DynamicTypeContextValue = {
  textScale: number;
  setTextScale: (scale: TextScaleOption) => void;
  effectiveScale: number;
};

const DynamicTypeContext = createContext<DynamicTypeContextValue | null>(null);

export function DynamicTypeProvider({ children }: { children: ReactNode }) {
  const [textScale, setTextScaleState] = useState<TextScaleOption>(1.0);
  const [loaded, setLoaded] = useState(false);
  const { fontScale } = useWindowDimensions();

  useEffect(() => {
    getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = parseFloat(raw);
          if (!Number.isNaN(parsed)) {
            // Clamp to the nearest valid TextScaleOption.
            const valid = TEXT_SCALE_OPTIONS.reduce((best, opt) =>
              Math.abs(opt.value - parsed) < Math.abs(best.value - parsed) ? opt : best,
            );
            setTextScaleState(valid.value);
          }
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  const setTextScale = useCallback((value: TextScaleOption) => {
    setTextScaleState(value);
    void setItem(STORAGE_KEY, String(value));
  }, []);

  const effectiveScale = loaded ? Math.min(fontScale * textScale, MAX_FONT_MULTIPLIER) : 1.0;

  const value = useMemo(
    () => ({ textScale, setTextScale, effectiveScale }),
    [textScale, setTextScale, effectiveScale],
  );

  return <DynamicTypeContext.Provider value={value}>{children}</DynamicTypeContext.Provider>;
}

export function useDynamicType() {
  const value = useContext(DynamicTypeContext);
  if (!value) {
    throw new Error('useDynamicType must be used within a DynamicTypeProvider');
  }
  return value;
}
