import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AdminProvider } from '@/lib/admin';
import { AppThemeProvider } from '@/lib/appTheme';
import { AuthProvider } from '@/lib/auth';
import { OnboardingProvider } from '@/lib/onboarding';

export default function RootLayout() {
  return (
    <AuthProvider>
      <AdminProvider>
        <AppThemeProvider>
          <OnboardingProvider>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="onboard" />
              <Stack.Screen name="auth" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="admin/content" />
              <Stack.Screen name="admin/theme" />
              <Stack.Screen name="card/[id]" />
              <Stack.Screen name="tickets" />
              <Stack.Screen name="scan" />
              <Stack.Screen name="discount" />
            </Stack>
          </OnboardingProvider>
        </AppThemeProvider>
      </AdminProvider>
    </AuthProvider>
  );
}
