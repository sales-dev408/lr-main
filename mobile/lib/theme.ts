import type { ThemeSettings } from './types';

// Light Rail Deals brand theme. These values mirror the admin console palette
// and are consumed by the shared UI components so screens stay consistent.
export const theme = {
  brand: '#0d9488',
  brandDark: '#0f766e',
  brandSoft: '#ccfbf1',
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
} as const;

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
    { key: 'vendors', label: 'Deals', color: '#0d9488', gradient: ['#14b8a6', '#0d9488'] },
    { key: 'index', label: 'Browse', color: '#f43f5e', gradient: ['#fb7185', '#e11d48'] },
    { key: 'events', label: 'Events', color: '#8b5cf6', gradient: ['#a78bfa', '#7c3aed'] },
    { key: 'discover', label: 'Discover', color: '#10b981', gradient: ['#34d399', '#059669'] },
    { key: 'passes', label: 'My Pass', color: '#6366f1', gradient: ['#818cf8', '#4f46e5'] },
    { key: 'profile', label: 'Profile', color: '#0ea5e9', gradient: ['#38bdf8', '#0284c7'] },
  ],
};
