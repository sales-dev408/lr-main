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

export default function RootLayout() {
  // Mirror received push notifications into the local inbox for the
  // Notifications tab, starting as early as possible in the app lifecycle.
  useEffect(() => listenForNotifications(), []);
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
              </Stack>
              </DynamicTypeProvider>
            </LegalAcceptanceProvider>
          </AppThemeProvider>
        </AdminProvider>
      </AuthProvider>
    </ColorSchemeProvider>
  );
}
