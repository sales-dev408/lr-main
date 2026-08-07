import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { registerPushToken } from './api';
import type { CardSummary, PushPreferences, RssEvent } from './types';

type NotificationsModule = typeof import('expo-notifications');

// Only load the notifications module on native platforms. Loading it on web
// triggers expo-notifications' auto-registration FX, which logs a "not supported
// on web" warning and stack trace to the console.
const Notifications: NotificationsModule | null =
  Platform.OS === 'web'
    ? null
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('expo-notifications') as NotificationsModule);

export async function initPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web' || !Notifications) return null;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.expoConfig?.extra?.expoProjectId;
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    await registerPushToken(tokenData.data);
    return tokenData.data;
  } catch {
    return null;
  }
}

export function listenForNotifications() {
  if (Platform.OS === 'web' || !Notifications) return () => {};
  const sub = Notifications.addNotificationReceivedListener(() => {
    // Notifications are handled by the system UI; analytics/logging can go here.
  });
  return () => sub.remove();
}

const DEAL_NOTIFICATION_PREFIX = 'deal-';
const EVENT_NOTIFICATION_PREFIX = 'event-';

async function cancelScheduledNotifications(prefix: string) {
  if (Platform.OS === 'web' || !Notifications) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.identifier.startsWith(prefix)) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

export async function scheduleDealNotifications(cards: CardSummary[], prefs?: PushPreferences): Promise<void> {
  if (Platform.OS === 'web' || !Notifications || prefs?.expiringDeal === false) return;
  await cancelScheduledNotifications(DEAL_NOTIFICATION_PREFIX);

  const now = Date.now();
  for (const card of cards) {
    if (!card.expiration_date || card.status !== 'active') continue;
    const expiration = new Date(card.expiration_date).getTime();
    if (!expiration || expiration <= now) continue;
    const reminder = new Date(expiration - 24 * 60 * 60 * 1000);
    if (reminder.getTime() <= now) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: `${DEAL_NOTIFICATION_PREFIX}${card.id}`,
      content: {
        title: 'Deal expiring soon',
        body: `${card.name} expires ${new Date(card.expiration_date).toLocaleDateString()}. Use it before it's gone!`,
        data: { type: 'expiring_deal', cardId: card.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder },
    });
  }
}

function eventMatchesCity(event: RssEvent, city: string): boolean {
  if (!city) return false;
  const haystack = `${event.title} ${event.description ?? ''} ${event.sourceName ?? ''}`.toLowerCase();
  return haystack.includes(city.toLowerCase());
}

export async function scheduleEventNotifications(events: RssEvent[], city: string, prefs?: PushPreferences): Promise<void> {
  if (Platform.OS === 'web' || !Notifications || !city || prefs?.localEvent === false) return;
  await cancelScheduledNotifications(EVENT_NOTIFICATION_PREFIX);

  const now = Date.now();
  const cutoff = now + 7 * 24 * 60 * 60 * 1000;
  for (const event of events) {
    if (!event.pubDate || !eventMatchesCity(event, city)) continue;
    const eventTime = new Date(event.pubDate).getTime();
    if (!eventTime || eventTime <= now || eventTime > cutoff) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: `${EVENT_NOTIFICATION_PREFIX}${event.id}`,
      content: {
        title: 'Local event happening soon',
        body: event.title,
        data: { type: 'local_event', link: event.link },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(eventTime - 60 * 60 * 1000) },
    });
  }
}
