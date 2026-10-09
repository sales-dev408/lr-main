import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Local notification inbox. Every push notification received while the app is
// running is mirrored here so users can review it later on the Notifications
// screen. Also owns the "muted" flag — when muted, the notification handler
// suppresses system banners/sounds and (for signed-in users) the server-side
// push token is cleared so no further pushes are delivered.

export type InboxEntry = {
  id: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  receivedAt: number;
  read: boolean;
};

const INBOX_KEY = 'notification-inbox:v1';
const MUTED_KEY = 'notification-muted:v1';
const MAX_ENTRIES = 100;

let entries: InboxEntry[] = [];
let muted = false;
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

async function persist() {
  try {
    await AsyncStorage.setItem(INBOX_KEY, JSON.stringify(entries));
  } catch {
    // Inbox is best-effort; storage failures shouldn't break notifications.
  }
}

async function persistMuted() {
  try {
    if (muted) await AsyncStorage.setItem(MUTED_KEY, '1');
    else await AsyncStorage.removeItem(MUTED_KEY);
  } catch {
    // best-effort
  }
}

export async function hydrateNotificationInbox(): Promise<void> {
  if (hydrated) return;
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    try {
      const [rawInbox, rawMuted] = await Promise.all([AsyncStorage.getItem(INBOX_KEY), AsyncStorage.getItem(MUTED_KEY)]);
      if (rawInbox) {
        const parsed = JSON.parse(rawInbox) as InboxEntry[];
        if (Array.isArray(parsed)) entries = parsed.filter((e) => e && typeof e.id === 'string');
      }
      muted = rawMuted === '1';
    } catch {
      // start with a clean inbox on corrupt data
    } finally {
      hydrated = true;
      hydratePromise = null;
      notify();
    }
  })();
  return hydratePromise;
}

export function addToInbox(entry: Omit<InboxEntry, 'id' | 'receivedAt' | 'read'>) {
  entries = [
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      receivedAt: Date.now(),
      read: false,
      ...entry,
    },
    ...entries,
  ].slice(0, MAX_ENTRIES);
  void persist();
  notify();
}

export function markAllInboxRead() {
  if (!entries.some((e) => !e.read)) return;
  entries = entries.map((e) => (e.read ? e : { ...e, read: true }));
  void persist();
  notify();
}

export function markInboxRead(id: string) {
  entries = entries.map((e) => (e.id === id && !e.read ? { ...e, read: true } : e));
  void persist();
  notify();
}

export function clearInbox() {
  entries = [];
  void persist();
  notify();
}

export function getInboxEntries(): InboxEntry[] {
  return entries;
}

export function getUnreadCount(): number {
  return entries.reduce((n, e) => (e.read ? n : n + 1), 0);
}

export function isNotificationsMuted(): boolean {
  return muted;
}

export function setNotificationsMutedLocal(value: boolean) {
  if (muted === value) return;
  muted = value;
  void persistMuted();
  notify();
}

export function subscribeInbox(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useNotificationInbox() {
  const [, bump] = useState(0);
  useEffect(() => {
    void hydrateNotificationInbox();
    return subscribeInbox(() => bump((n) => n + 1));
  }, []);
  return { entries, muted, unread: getUnreadCount() };
}
