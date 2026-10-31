import { useCallback, useEffect, useState } from 'react';
import { getItem, setItem } from './storage';

const KEY = 'lr.mobile.favorites';

export async function getFavorites(): Promise<string[]> {
  const raw = await getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export async function saveFavorites(ids: string[]): Promise<void> {
  await setItem(KEY, JSON.stringify(ids));
}

export async function toggleFavorite(id: string): Promise<boolean> {
  const current = await getFavorites();
  const next = current.includes(id) ? current.filter((fav) => fav !== id) : [...current, id];
  await saveFavorites(next);
  return next.includes(id);
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getFavorites().then((data) => {
      if (mounted) {
        setFavorites(data);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const toggle = useCallback(async (id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((fav) => fav !== id) : [...prev, id];
      void saveFavorites(next);
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (id: string) => favorites.includes(id),
    [favorites],
  );

  return { favorites, loading, toggle, isFavorite };
}
