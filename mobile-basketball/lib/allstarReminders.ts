import { Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

// Mirror lib/notifications.ts — loading expo-notifications on web triggers its
// unsupported-platform FX warning, so keep it native-only.
const Notifications: NotificationsModule | null =
  Platform.OS === 'web'
    ? null
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('expo-notifications') as NotificationsModule);

const PREFIX = 'allstar-';

export function remindersSupported(): boolean {
  return Notifications != null;
}

// Local, on-device reminder for an All-Star event — fires at 9 AM the morning
// of the event day so fans get a heads-up before heading downtown.
export async function scheduleEventReminder(key: string, title: string, fireDate: Date): Promise<boolean> {
  if (!Notifications) return false;
  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return false;

  await Notifications.cancelScheduledNotificationAsync(`${PREFIX}${key}`).catch(() => undefined);
  await Notifications.scheduleNotificationAsync({
    identifier: `${PREFIX}${key}`,
    content: {
      title: `Today: ${title}`,
      body: 'NBA All-Star 2027 in downtown Phoenix — check the app for train times and your last train home.',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireDate },
  });
  return true;
}

export async function cancelEventReminder(key: string): Promise<void> {
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(`${PREFIX}${key}`).catch(() => undefined);
}
