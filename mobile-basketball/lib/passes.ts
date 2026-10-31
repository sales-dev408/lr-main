import { getItem, setItem } from './storage';
import { barcodeUrl } from './qr';
import type { StoredPass } from './types';

const PASSES_KEY = 'lr.mobile.passes';

export async function loadStoredPasses(): Promise<StoredPass[]> {
  const raw = await getItem(PASSES_KEY);
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw) as StoredPass[];
  } catch {
    return [];
  }
}

export async function saveStoredPass(pass: StoredPass): Promise<void> {
  const current = await loadStoredPasses();
  const next = [pass, ...current.filter((item) => item.serialNumber !== pass.serialNumber)];
  await setItem(PASSES_KEY, JSON.stringify(next));
}

export async function upsertStoredPasses(passes: StoredPass[]): Promise<void> {
  await setItem(PASSES_KEY, JSON.stringify(passes));
}

export function lookupBarcodeUrl(lookupToken: string): string {
  return barcodeUrl(lookupToken, 320, 120);
}
