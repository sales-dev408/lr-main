import type { ThemeSettings } from './types';

export interface ThemeColors {
  brand: string;
  brandDark: string;
  brandSoft: string;
  infoSoft: string;
  successSoft: string;
  warningSoft: string;
  dangerSoft: string;
  ink: string;
  ink2: string;
  bg: string;
  panel: string;
  border: string;
  muted: string;
  subtle: string;
  danger: string;
  success: string;
  warning: string;
  radius: number;
  shadow: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
}

// Light Rail Deals brand theme. These values mirror the admin console palette
// and are consumed by the shared UI components so screens stay consistent.
export const theme: ThemeColors = {
  brand: '#0d9488',
  brandDark: '#0f766e',
  brandSoft: '#ccfbf1',
  infoSoft: '#ccfbf1',
  successSoft: '#dcfce7',
  warningSoft: '#fef3c7',
  dangerSoft: '#fee2e2',
  ink: '#0f172a',
  ink2: '#1e293b',
  bg: '#f8fafc',
  panel: '#ffffff',
  border: '#e2e8f0',
  muted: '#64748b',
  subtle: '#94a3b8',
  danger: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b',
  radius: 20,
  shadow: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.09,
    shadowRadius: 30,
    elevation: 10,
  },
};

export const darkTheme: ThemeColors = {
  brand: '#14b8a6',
  brandDark: '#2dd4bf',
  brandSoft: '#134e4a',
  infoSoft: '#134e4a',
  successSoft: '#064e3b',
  warningSoft: '#78350f',
  dangerSoft: '#7f1d1d',
  ink: '#f8fafc',
  ink2: '#e2e8f0',
  bg: '#0f172a',
  panel: '#1e293b',
  border: '#334155',
  muted: '#94a3b8',
  subtle: '#64748b',
  danger: '#f87171',
  success: '#34d399',
  warning: '#fbbf24',
  radius: 20,
  shadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 10,
  },
};

export const APPLE_TRADEMARK_NOTICE =
  'Apple, the Apple logo, and Apple Wallet are trademarks of Apple Inc., registered in the U.S. and other countries.';

export const WEBSITE_URL = 'https://lightraildeals.com';
export const TERMS_URL = 'https://www.lightraildeals.com/terms-of-use.html';
export const PRIVACY_URL = 'https://www.lightraildeals.com/privacy-policy.html';
export const EULA_URL = 'https://www.lightraildeals.com/eula.html';

// Fallback theme used before the admin-published theme loads from the backend.
// Keys match the tab route names so the bottom bar can look up each tab's style.
export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  brand: '#0d9488',
  primaryGradient: ['#0d9488', '#6366f1'],
  tabs: [
    { key: 'index', label: 'Home', color: '#0d9488', gradient: ['#14b8a6', '#0d9488'] },
    { key: 'live', label: 'Live Train Times', color: '#f59e0b', gradient: ['#fbbf24', '#d97706'] },
    { key: 'browse', label: 'Browse', color: '#f43f5e', gradient: ['#fb7185', '#e11d48'] },
    { key: 'events', label: 'Events', color: '#8b5cf6', gradient: ['#a78bfa', '#7c3aed'] },
    { key: 'discover', label: 'Discover', color: '#10b981', gradient: ['#34d399', '#059669'] },
    { key: 'mypass', label: 'My Pass', color: '#6366f1', gradient: ['#818cf8', '#4f46e5'] },
    { key: 'tickets', label: 'Tickets', color: '#ec4899', gradient: ['#f472b6', '#db2777'] },
    { key: 'profile', label: 'Profile', color: '#0ea5e9', gradient: ['#38bdf8', '#0284c7'] },
  ],
};
