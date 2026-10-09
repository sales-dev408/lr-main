import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getItem, setItem } from './storage';

const LEGAL_KEY = 'lr.mobile.legalAccepted';

type LegalAcceptanceContextValue = {
  loading: boolean;
  accepted: boolean;
  accept: () => Promise<void>;
};

const LegalAcceptanceContext = createContext<LegalAcceptanceContextValue | null>(null);

// First-run gate: users must accept the Terms of Use, Privacy Policy, and EULA
// once before entering the app. Acceptance is persisted locally and applies to
// both anonymous and signed-in use.
export function LegalAcceptanceProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    let mounted = true;
    getItem(LEGAL_KEY)
      .then((raw) => {
        if (!mounted) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as { accepted?: boolean };
            setAccepted(parsed.accepted === true);
          } catch {
            setAccepted(false);
          }
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo<LegalAcceptanceContextValue>(
    () => ({
      loading,
      accepted,
      accept: async () => {
        setAccepted(true);
        await setItem(LEGAL_KEY, JSON.stringify({ accepted: true, at: new Date().toISOString() }));
      },
    }),
    [accepted, loading],
  );

  return <LegalAcceptanceContext.Provider value={value}>{children}</LegalAcceptanceContext.Provider>;
}

export function useLegalAcceptance() {
  const value = useContext(LegalAcceptanceContext);
  if (!value) {
    throw new Error('useLegalAcceptance must be used within LegalAcceptanceProvider');
  }
  return value;
}
