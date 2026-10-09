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
  accent: string;
  radius: number;
  shadow: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
}

// Light Rail Deals brand theme — "Valley Metro" palette. Warm desert neutrals
// with a rail-teal brand and an Arizona-sunset copper accent. These values are
// consumed by the shared UI components so screens stay consistent.
export const theme: ThemeColors = {
  brand: '#0e7490',
  brandDark: '#155e75',
  brandSoft: '#cffafe',
  infoSoft: '#cffafe',
  successSoft: '#dcfce7',
  warningSoft: '#fef3c7',
  dangerSoft: '#fee2e2',
  ink: '#1c1917',
  ink2: '#292524',
  bg: '#fafaf9',
  panel: '#ffffff',
  border: '#e7e5e4',
  muted: '#57534e',
  subtle: '#a8a29e',
  danger: '#dc2626',
  success: '#16a34a',
  warning: '#d97706',
  accent: '#ea580c',
  radius: 20,
  shadow: {
    shadowColor: '#1c1917',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 10,
  },
};

export const darkTheme: ThemeColors = {
  brand: '#22d3ee',
  brandDark: '#67e8f9',
  brandSoft: '#164e63',
  infoSoft: '#164e63',
  successSoft: '#14532d',
  warningSoft: '#78350f',
  dangerSoft: '#7f1d1d',
  ink: '#fafaf9',
  ink2: '#e7e5e4',
  bg: '#171412',
  panel: '#26201d',
  border: '#44403c',
  muted: '#a8a29e',
  subtle: '#78716c',
  danger: '#f87171',
  success: '#4ade80',
  warning: '#fbbf24',
  accent: '#fb923c',
  radius: 20,
  shadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 10,
  },
};

export const APPLE_TRADEMARK_NOTICE =
  'Apple and the Apple logo are trademarks of Apple Inc., registered in the U.S. and other countries.';

export const WEBSITE_URL = 'https://lightraildeals.com';
export const TERMS_URL = 'https://www.lightraildeals.com/terms-of-use.html';
export const PRIVACY_URL = 'https://www.lightraildeals.com/privacy-policy.html';
export const EULA_URL = 'https://www.lightraildeals.com/eula.html';

// Fallback theme used before the admin-published theme loads from the backend.
// Keys match route names so navigation can look up each section's style.
export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  brand: '#0e7490',
  primaryGradient: ['#0e7490', '#ea580c'],
  tabs: [
    { key: 'index', label: 'Home', color: '#0e7490', gradient: ['#06b6d4', '#0e7490'] },
    { key: 'restaurants', label: 'Restaurants & Bars', color: '#ea580c', gradient: ['#fb923c', '#ea580c'] },
    { key: 'shopping', label: 'Shopping', color: '#7c3aed', gradient: ['#a78bfa', '#7c3aed'] },
    { key: 'hotels', label: 'Hotels', color: '#0284c7', gradient: ['#38bdf8', '#0284c7'] },
    { key: 'sports', label: 'Sports', color: '#059669', gradient: ['#34d399', '#059669'] },
    { key: 'events', label: 'Events', color: '#e11d48', gradient: ['#fb7185', '#e11d48'] },
    { key: 'live', label: 'Train Times', color: '#4f46e5', gradient: ['#818cf8', '#4f46e5'] },
    { key: 'profile', label: 'Profile', color: '#57534e', gradient: ['#a8a29e', '#57534e'] },
    { key: 'discover', label: 'Discover', color: '#0d9488', gradient: ['#2dd4bf', '#0d9488'] },
    { key: 'az-events', label: 'Events Around Arizona', color: '#d97706', gradient: ['#fbbf24', '#d97706'] },
    { key: 'apartments', label: 'Apartments', color: '#f59e0b', gradient: ['#fbbf24', '#d97706'] },
  ],
};
