import { getItem, setItem } from './storage';
import type { UserAnalytics } from './types';

const LOCAL_STATS_KEY = 'lr.mobile.localStats';

type LocalRedemption = {
  vendorId: string;
  vendorName: string;
  at: string;
};

// Anonymous usage stats: redemptions initiated without an account are tracked
// on-device so the My Stats section keeps working for unauthenticated users.
export async function getLocalRedemptions(): Promise<LocalRedemption[]> {
  const raw = await getItem(LOCAL_STATS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is LocalRedemption =>
        typeof item === 'object' && item !== null && typeof (item as LocalRedemption).vendorId === 'string',
    );
  } catch {
    return [];
  }
}

export async function recordLocalRedemption(vendor: { id: string; name: string }): Promise<void> {
  const existing = await getLocalRedemptions();
  const next = [...existing, { vendorId: vendor.id, vendorName: vendor.name, at: new Date().toISOString() }];
  await setItem(LOCAL_STATS_KEY, JSON.stringify(next));
}

export function toLocalAnalytics(redemptions: LocalRedemption[]): UserAnalytics {
  const byVendor = new Map<string, { vendorId: string; vendorName: string; redemptions: number }>();
  const daily = new Map<string, number>();
  for (const r of redemptions) {
    const entry = byVendor.get(r.vendorId) ?? { vendorId: r.vendorId, vendorName: r.vendorName, redemptions: 0 };
    entry.redemptions += 1;
    byVendor.set(r.vendorId, entry);
    const day = r.at.slice(0, 10);
    daily.set(day, (daily.get(day) ?? 0) + 1);
  }
  return {
    totalRedemptions: redemptions.length,
    byVendor: Array.from(byVendor.values()).sort((a, b) => b.redemptions - a.redemptions),
    daily: Array.from(daily.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([day, count]) => ({ day, redemptions: count })),
  };
}
