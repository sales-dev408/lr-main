#!/usr/bin/env node
// Generates assets/app-snapshot.json — the offline seed bundled inside the app.
// Run before each app-store release:  node scripts/generate-app-seed.mjs
// Runtime content updates do NOT need this — the app refreshes its AsyncStorage
// snapshot via /api/app/version on launch. The seed only covers a first launch
// with no connectivity.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://okbolfpndeakmchpznmt.supabase.co/functions/v1/router/api';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'app-snapshot.json');
const MAX_INLINE_MEDIA = 200 * 1024; // drop inline data: URLs heavier than 200KB

function stripHeavyMedia(value) {
  if (Array.isArray(value)) return value.map(stripHeavyMedia);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = stripHeavyMedia(v);
    return out;
  }
  if (typeof value === 'string' && value.startsWith('data:') && value.length > MAX_INLINE_MEDIA) return null;
  return value;
}

const res = await fetch(`${API_BASE}/app`, { cache: 'no-store' });
if (!res.ok) throw new Error(`GET /app failed: ${res.status}`);
const raw = await res.json();
const seed = stripHeavyMedia(raw);
seed.version = 0;
writeFileSync(OUT, JSON.stringify(seed));
console.log(`wrote ${OUT} (${(JSON.stringify(seed).length / 1024).toFixed(0)} KB)`);
