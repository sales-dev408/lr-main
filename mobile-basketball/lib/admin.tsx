import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { adminLogin } from './api';
import { getItem, removeItem, setItem } from './storage';
import type { AdminAuthProfile } from './types';

const ADMIN_KEY = 'lr.mobile.admin';

type StoredAdmin = { token: string; profile: AdminAuthProfile };

type AdminContextValue = {
  loading: boolean;
  token: string | null;
  profile: AdminAuthProfile | null;
  isAdmin: boolean;
  /**
   * Unlocks in-app editing. The app collects these as the "first name" and
   * "last name" fields, but they are the admin credentials configured in the
   * admin dashboard and are always verified server-side.
   */
  unlock: (credentials: { email: string; password: string }) => Promise<void>;
  lock: () => Promise<void>;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<AdminAuthProfile | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const raw = await getItem(ADMIN_KEY);
      if (!mounted) {
        return;
      }
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as StoredAdmin;
          setToken(parsed.token);
          setProfile(parsed.profile);
        } catch {
          await removeItem(ADMIN_KEY);
        }
      }
      setLoading(false);
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo<AdminContextValue>(
    () => ({
      loading,
      token,
      profile,
      isAdmin: Boolean(token && profile),
      unlock: async ({ email, password }) => {
        const auth = await adminLogin({ email, password });
        setToken(auth.token);
        setProfile(auth.profile);
        await setItem(ADMIN_KEY, JSON.stringify({ token: auth.token, profile: auth.profile }));
      },
      lock: async () => {
        setToken(null);
        setProfile(null);
        await removeItem(ADMIN_KEY);
      },
    }),
    [loading, profile, token],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const value = useContext(AdminContext);
  if (!value) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return value;
}
