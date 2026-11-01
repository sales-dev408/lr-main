import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { registerPushToken, unregisterPushToken } from './api';
import {
  addToInbox,
  hydrateNotificationInbox,
  isNotificationsMuted,
  setNotificationsMutedLocal,
} from './notificationInbox';

type NotificationsModule = typeof import('expo-notifications');

// Only load the notifications module on native platforms. Loading it on web
// triggers expo-notifications' auto-registration FX, which logs a "not supported
// on web" warning and stack trace to the console.
const Notifications: NotificationsModule | null =
  Platform.OS === 'web'
    ? null
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('expo-notifications') as NotificationsModule);

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

export async function initPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web' || !Notifications) return null;

  // Automatic local-event and deal notifications are disabled. Purge anything
  // scheduled by older app versions so queued notifications stop firing.
  await cancelScheduledNotifications(EVENT_NOTIFICATION_PREFIX).catch(() => undefined);
  await cancelScheduledNotifications(DEAL_NOTIFICATION_PREFIX).catch(() => undefined);

  installNotificationHandler();

  if (isNotificationsMuted()) {
    // Muted users still keep OS permission but get no token server-side, so
    // nothing is delivered to begin with.
    return null;
  }

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

function installNotificationHandler() {
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      const suppressed = isNotificationsMuted();
      return {
        shouldShowBanner: !suppressed,
        shouldShowList: !suppressed,
        shouldPlaySound: !suppressed,
        shouldSetBadge: !suppressed,
      };
    },
  });
}

// Call once at app start (root layout). Mirrors every received notification
// into the local inbox used by the Notifications screen, and installs the
// mute-aware display handler even for anonymous users.
export function listenForNotifications() {
  void hydrateNotificationInbox();
  if (Platform.OS === 'web' || !Notifications) return () => {};
  installNotificationHandler();
  const sub = Notifications.addNotificationReceivedListener((notification) => {
    const content = notification.request.content;
    addToInbox({
      title: content.title ?? 'Notification',
      body: content.body ?? '',
      data: (content.data ?? {}) as Record<string, unknown>,
    });
  });
  return () => sub.remove();
}

// Mute stops system banners/sounds locally and clears the server-side push
// token so the backend stops delivering to this device entirely (signed-in
// users only — anonymous users never have a server token). Unmuting
// re-registers the token.
export async function setNotificationsMuted(mutedValue: boolean): Promise<void> {
  setNotificationsMutedLocal(mutedValue);
  try {
    if (mutedValue) {
      await unregisterPushToken();
    } else {
      await initPushNotifications();
    }
  } catch {
    // Local mute still applies even if the server update fails.
  }
}



