// Feeds the iOS home-screen widget (LightRailWidget) a rotating set of cards:
// featured deals, next team games, and upcoming Arizona events. The payload is
// written into the shared App Group so the WidgetKit extension can read it;
// the extension then reloads its timeline. iOS only — no-op elsewhere.

import { Platform } from 'react-native';
import { ExtensionStorage } from '@bacons/apple-targets';
import { TEAM_SCHEDULES, formatEventDate, upcomingEvents } from './teamSchedules';
import { AZ_EVENT_MONTHS, AZ_ADMISSION_LABELS, azEventRange } from './azEvents';
import type { AppState, VendorListItem } from './types';

const APP_GROUP = 'group.com.lightraildeals.app';
const WIDGET_ITEMS_KEY = 'widget.items';
const WIDGET_NAME = 'LightRailWidget';

export type WidgetItemKind = 'deal' | 'game' | 'event';

export interface WidgetItem {
  kind: WidgetItemKind;
  title: string;
  subtitle: string;
  detail: string;
  url: string; // lrcard:// deep link into the matching tab
}

function timeToMinutes(time?: string): number {
  if (!time) return Number.POSITIVE_INFINITY;
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time.trim());
  if (!match) return Number.POSITIVE_INFINITY;
  let hours = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hours += 12;
  return hours * 60 + Number(match[2]);
}

function dealItems(vendors: VendorListItem[], limit: number): WidgetItem[] {
  const deals = vendors.filter((v) => v.discount.label || v.boosted);
  deals.sort((a, b) => Number(b.boosted) - Number(a.boosted) || a.name.localeCompare(b.name));
  return deals.slice(0, limit).map((v) => ({
    kind: 'deal' as const,
    title: v.name,
    subtitle: v.discount.label || 'Featured deal',
    detail: v.station ? `Near ${v.station}` : (v.city ?? 'Valley Metro'),
    url: v.vendorType === 'restaurant' || v.vendorType === 'bar' || v.vendorType === 'cafe'
      ? 'lrcard://restaurants'
      : 'lrcard://shopping',
  }));
}

function gameItems(limit: number): WidgetItem[] {
  const now = new Date();
  const games = TEAM_SCHEDULES.flatMap((team) =>
    upcomingEvents(team.events, 'all', now).map((event) => ({ team, event })),
  );
  games.sort(
    (a, b) =>
      a.event.date.localeCompare(b.event.date) ||
      timeToMinutes(a.event.time) - timeToMinutes(b.event.time),
  );
  return games.slice(0, limit).map(({ team, event }) => ({
    kind: 'game' as const,
    title: `${team.label} ${event.title}`,
    subtitle: [formatEventDate(event), event.time, event.sport].filter(Boolean).join(' · '),
    detail: event.venue ?? team.name,
    url: 'lrcard://sports',
  }));
}

function eventItems(limit: number): WidgetItem[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = AZ_EVENT_MONTHS.flatMap((m) =>
    m.events.map((event) => ({ event, range: azEventRange(event.date, m.month) })),
  )
    .filter((entry) => entry.range !== null && entry.range.end.getTime() >= today.getTime())
    .sort((a, b) => a.range!.start.getTime() - b.range!.start.getTime());
  return upcoming.slice(0, limit).map(({ event }) => ({
    kind: 'event' as const,
    title: event.name,
    subtitle: `${event.date} · ${event.location}`,
    detail: `${event.category} · ${AZ_ADMISSION_LABELS[event.admission]}`,
    url: 'lrcard://az-events',
  }));
}

export function buildWidgetItems(state: AppState | null, now: Date = new Date()): WidgetItem[] {
  const items: WidgetItem[] = [
    ...dealItems(state?.vendors ?? [], 5),
    ...gameItems(6),
    ...eventItems(4),
  ];
  if (items.length === 0) {
    items.push({
      kind: 'deal',
      title: 'Light Rail Deals',
      subtitle: 'Tap for deals, games, and events along the Valley Metro',
      detail: 'Open the app',
      url: 'lrcard://',
    });
  }
  return items;
}

export function syncWidgetItems(state: AppState | null): void {
  if (Platform.OS !== 'ios') return;
  try {
    const storage = new ExtensionStorage(APP_GROUP);
    storage.set(WIDGET_ITEMS_KEY, JSON.stringify(buildWidgetItems(state)));
    ExtensionStorage.reloadWidget(WIDGET_NAME);
  } catch {
    // ExtensionStorage resolves to a stub outside the native runtime.
  }
}
