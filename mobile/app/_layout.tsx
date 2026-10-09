import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AdminProvider } from '@/lib/admin';
import { AppThemeProvider } from '@/lib/appTheme';
import { AuthProvider } from '@/lib/auth';
import { ColorSchemeProvider } from '@/lib/colorScheme';
import { LegalAcceptanceProvider } from '@/lib/legalAcceptance';
import { DynamicTypeProvider } from '@/lib/dynamicType';
import { listenForNotifications } from '@/lib/notifications';
import { getAppState } from '@/lib/api';

export default function RootLayout() {
  // Mirror received push notifications into the local inbox for the
  // Notifications tab, starting as early as possible in the app lifecycle.
  useEffect(() => listenForNotifications(), []);
  // Warm the app-state snapshot once per launch: a tiny /api/app/version check
  // decides whether the cached snapshot needs re-downloading. Every directory
  // screen then reads the same cached data — this is the only backend traffic
  // the browsing experience produces.
  useEffect(() => {
    void getAppState();
  }, []);
  return (
    <ColorSchemeProvider>
      <AuthProvider>
        <AdminProvider>
          <AppThemeProvider>
            <LegalAcceptanceProvider>
              <DynamicTypeProvider>
                <StatusBar style="auto" />
                <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="legal" />
                <Stack.Screen name="auth" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="admin/content" />
                <Stack.Screen name="admin/theme" />
                <Stack.Screen name="discount" />
                <Stack.Screen name="article" />
              </Stack>
              </DynamicTypeProvider>
            </LegalAcceptanceProvider>
          </AppThemeProvider>
        </AdminProvider>
      </AuthProvider>
    </ColorSchemeProvider>
  );
}
