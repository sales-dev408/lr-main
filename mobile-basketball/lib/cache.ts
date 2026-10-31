import AsyncStorage from '@react-native-async-storage/async-storage';
import { getItem, setItem, removeItem } from './storage';

const CACHE_PREFIX = 'lr.mobile.cache.';
const SECURE_CACHE_PREFIX = 'lr.mobile.scache.';

interface CacheEntry<T> {
  value: T;
  storedAt: number;
}

async function getCache<T>(key: string, ttlMs: number): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - entry.storedAt <= ttlMs) {
      return entry.value;
    }
  } catch {
    // ignored
  }
  return null;
}

async function setCache<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ value, storedAt: Date.now() }));
  } catch {
    // ignored
  }
}

export async function fetchCached<T>(key: string, fetcher: () => Promise<T>, ttlMs: number): Promise<T> {
  const cached = await getCache<T>(key, ttlMs);
  if (cached !== null) {
    return cached;
  }
  try {
    const fresh = await fetcher();
    await setCache(key, fresh);
    return fresh;
  } catch (error) {
    const stale = await getCache<T>(key, Number.MAX_SAFE_INTEGER);
    if (stale !== null) {
      return stale;
    }
    throw error;
  }
}

export async function clearApiCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    for (const key of keys.filter((k) => k.startsWith(CACHE_PREFIX))) {
      await AsyncStorage.removeItem(key);
    }
  } catch {
    // ignored
  }
}

export async function clearCache(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_PREFIX + key);
  } catch {
    // ignored
  }
}

export async function getSecureCache<T>(key: string, ttlMs: number): Promise<T | null> {
  try {
    const raw = await getItem(SECURE_CACHE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - entry.storedAt <= ttlMs) {
      return entry.value;
    }
  } catch {
    // ignored
  }
  return null;
}

export async function setSecureCache<T>(key: string, value: T): Promise<void> {
  try {
    await setItem(SECURE_CACHE_PREFIX + key, JSON.stringify({ value, storedAt: Date.now() }));
  } catch {
    // ignored
  }
}

export async function clearSecureCache(prefix?: string): Promise<void> {
  try {
    const raw = await getItem(SECURE_CACHE_PREFIX + (prefix ?? ''));
    if (raw !== null) {
      await removeItem(SECURE_CACHE_PREFIX + (prefix ?? ''));
    }
  } catch {
    // ignored
  }
}
