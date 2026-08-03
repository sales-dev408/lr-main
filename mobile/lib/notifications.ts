import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { registerPushToken } from './api';

export async function initPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
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
  if (Platform.OS === 'web') return () => {};
  const sub = Notifications.addNotificationReceivedListener(() => {
    // Notifications are handled by the system UI; analytics/logging can go here.
  });
  return () => sub.remove();
}
