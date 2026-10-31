import { Platform } from 'react-native';

export function getApiBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';
}

export function getMapboxAccessToken(): string | null {
  return (
    Platform.select({
      ios: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN_IOS || process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN,
      android: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN_ANDROID || process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN,
      default: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN,
    }) ?? null
  );
}

export function getMapboxStyleUrl(): string | undefined {
  return Platform.select({
    ios: process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL_IOS || process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL,
    android: process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL_ANDROID || process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL,
    default: process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL,
  });
}
