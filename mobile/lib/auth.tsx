import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { login as loginRequest, register as registerRequest, updateMe, deleteMe } from './api';
import { initPushNotifications } from './notifications';
import { getItem, removeItem, setItem } from './storage';
import type { AuthResponse, PushPreferences, UserProfile } from './types';

const AUTH_KEY = 'lr.mobile.auth';

const defaultPushPreferences: PushPreferences = { newVendor: true, expiringDeal: true, localEvent: true };

type AuthContextValue = {
  loading: boolean;
  token: string | null;
  profile: UserProfile | null;
  signIn: (body: { email?: string; phone?: string; password: string }) => Promise<void>;
  registerAccount: (body: { firstName: string; lastName: string; email?: string; phone?: string; password: string; city?: string }) => Promise<void>;
  updateProfile: (profile: Partial<UserProfile> & { pushPreferences?: PushPreferences }) => Promise<void>;
  deleteAccount: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  function normalizeProfile(input: UserProfile): UserProfile {
    return { ...input, pushPreferences: input.pushPreferences ?? defaultPushPreferences };
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      const raw = await getItem(AUTH_KEY);
      if (!mounted) {
        return;
      }
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as AuthResponse<UserProfile>;
          setToken(parsed.token);
          setProfile(normalizeProfile(parsed.profile));
          void initPushNotifications();
        } catch {
          await removeItem(AUTH_KEY);
        }
      }
      setLoading(false);
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const persist = useCallback(
    async (auth: AuthResponse<UserProfile>) => {
      setToken(auth.token);
      setProfile(normalizeProfile(auth.profile));
      await setItem(AUTH_KEY, JSON.stringify(auth));
      void initPushNotifications();
    },
    [],
  );

  const updateProfile = useCallback(
    async (update: Partial<UserProfile> & { pushPreferences?: PushPreferences }) => {
      const next = normalizeProfile({ ...(profile ?? ({} as UserProfile)), ...update } as UserProfile);
      setProfile(next);
      if (token) {
        await setItem(AUTH_KEY, JSON.stringify({ token, profile: next }));
      }
      const body: { city?: string | null; pushPreferences?: PushPreferences } = {};
      if ('city' in update) body.city = update.city ?? null;
      if ('pushPreferences' in update) body.pushPreferences = update.pushPreferences;
      if (Object.keys(body).length > 0) {
        const refreshed = normalizeProfile(await updateMe(body));
        setProfile(refreshed);
        if (token) {
          await setItem(AUTH_KEY, JSON.stringify({ token, profile: refreshed }));
        }
        if ('city' in body) {
          void initPushNotifications();
        }
      }
    },
    [profile, token],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      token,
      profile,
      signIn: async (body) => {
        const auth = await loginRequest(body);
        await persist(auth);
      },
      registerAccount: async (body) => {
        const auth = await registerRequest(body);
        await persist(auth);
      },
      updateProfile: async (update) => {
        await updateProfile(update);
      },
      deleteAccount: async () => {
        await deleteMe();
        setToken(null);
        setProfile(null);
        await removeItem(AUTH_KEY);
      },
      logout: async () => {
        setToken(null);
        setProfile(null);
        await removeItem(AUTH_KEY);
      },
    }),
    [loading, persist, profile, token, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return value;
}
