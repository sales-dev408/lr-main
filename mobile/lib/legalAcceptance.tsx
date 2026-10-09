import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { getItem, setItem } from './storage';
import { recordLegalAcceptance } from './api';

const LEGAL_KEY = 'lr.mobile.legalAccepted';

type StoredAcceptance = {
  accepted?: boolean;
  at?: string;
  /** true until the server-side record succeeds. */
  recorded?: boolean;
};

type LegalAcceptanceContextValue = {
  loading: boolean;
  accepted: boolean;
  accept: () => Promise<void>;
};

const LegalAcceptanceContext = createContext<LegalAcceptanceContextValue | null>(null);

async function persist(state: StoredAcceptance) {
  await setItem(LEGAL_KEY, JSON.stringify(state));
}

// Persist the acceptance to the backend (timestamp + request IP are captured
// server-side). Best-effort: on failure the local flag stays unrecorded and is
// retried on the next app launch.
async function recordToServer(state: StoredAcceptance) {
  try {
    await recordLegalAcceptance(Platform.OS);
    await persist({ ...state, recorded: true });
  } catch {
    // Leave recorded unset so it retries next launch.
  }
}

// First-run gate: users must accept the Terms of Use, Privacy Policy, and EULA
// once before entering the app. Acceptance is persisted locally (so the gate
// never reappears) and recorded in the legal_acceptances table for audit.
export function LegalAcceptanceProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    let mounted = true;
    getItem(LEGAL_KEY)
      .then((raw) => {
        if (!mounted) return;
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw) as StoredAcceptance;
          if (parsed.accepted === true) {
            setAccepted(true);
            // Backfill server recording for acceptances stored before the
            // endpoint existed, or that failed last time.
            if (!parsed.recorded) void recordToServer(parsed);
          }
        } catch {
          setAccepted(false);
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
        const state: StoredAcceptance = { accepted: true, at: new Date().toISOString() };
        await persist(state);
        void recordToServer(state);
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
