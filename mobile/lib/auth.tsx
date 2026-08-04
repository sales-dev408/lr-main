import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { login as loginRequest, register as registerRequest, updateMe } from './api';
import { initPushNotifications } from './notifications';
import { getItem, removeItem, setItem } from './storage';
import type { AuthResponse, UserProfile } from './types';

const AUTH_KEY = 'lr.mobile.auth';

type AuthContextValue = {
  loading: boolean;
  token: string | null;
  profile: UserProfile | null;
  signIn: (body: { firstName: string; lastName: string }) => Promise<void>;
  registerAccount: (body: { firstName: string; lastName: string; email?: string; phone?: string; city?: string }) => Promise<void>;
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

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
          setProfile(parsed.profile);
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

  async function persist(auth: AuthResponse<UserProfile>) {
    setToken(auth.token);
    setProfile(auth.profile);
    await setItem(AUTH_KEY, JSON.stringify(auth));
    void initPushNotifications();
  }

  const updateProfile = useCallback(
    async (update: Partial<UserProfile>) => {
      const next = { ...(profile ?? ({} as UserProfile)), ...update } as UserProfile;
      setProfile(next);
      if (token) {
        await setItem(AUTH_KEY, JSON.stringify({ token, profile: next }));
      }
      if ('city' in update) {
        const refreshed = await updateMe({ city: update.city ?? null });
        setProfile(refreshed);
        if (token) {
          await setItem(AUTH_KEY, JSON.stringify({ token, profile: refreshed }));
        }
        void initPushNotifications();
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
      logout: async () => {
        setToken(null);
        setProfile(null);
        await removeItem(AUTH_KEY);
      },
    }),
    [loading, profile, token, updateProfile],
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
