import type { ThemeSettings } from './types';

// Light Rail Deals brand theme. These values mirror the admin console palette
// and are consumed by the shared UI components so screens stay consistent.
export const theme = {
  brand: '#2563eb',
  brandDark: '#1d4ed8',
  brandSoft: '#dbeafe',
  ink: '#0e1b2a',
  ink2: '#123141',
  bg: '#eef2f8',
  panel: '#ffffff',
  border: '#dbe3f0',
  muted: '#64748b',
  subtle: '#7c8a9d',
  danger: '#dc2626',
  success: '#15803d',
  warning: '#b45309',
  radius: 18,
  shadow: {
    shadowColor: '#0b1f2a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;

export const APPLE_TRADEMARK_NOTICE =
  'Apple, the Apple logo, and Apple Wallet are trademarks of Apple Inc., registered in the U.S. and other countries.';

export const WEBSITE_URL = 'https://lightraildeals.com';

// Fallback theme used before the admin-published theme loads from the backend.
// Keys match the tab route names so the bottom bar can look up each tab's style.
export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  brand: '#2563eb',
  primaryGradient: ['#2563eb', '#16a34a'],
  tabs: [
    { key: 'vendors', label: 'Deals', color: '#2563eb', gradient: ['#3b82f6', '#1d4ed8'] },
    { key: 'index', label: 'Browse', color: '#dc2626', gradient: ['#ef4444', '#b91c1c'] },
    { key: 'discover', label: 'Discover', color: '#16a34a', gradient: ['#22c55e', '#15803d'] },
    { key: 'passes', label: 'My Pass', color: '#2563eb', gradient: ['#3b82f6', '#1d4ed8'] },
    { key: 'profile', label: 'Profile', color: '#16a34a', gradient: ['#22c55e', '#15803d'] },
  ],
};
