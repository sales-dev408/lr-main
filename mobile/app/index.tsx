import { Redirect } from 'expo-router';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useAuth } from '@/lib/auth';
import { useAppTheme } from '@/lib/appTheme';
import { useOnboarding } from '@/lib/onboarding';

export default function IndexScreen() {
  const auth = useAuth();
  const appTheme = useAppTheme();
  const onboarding = useOnboarding();

  if (auth.loading || appTheme.loading || onboarding.loading) {
    return <LoadingScreen />;
  }

  if (!auth.token) {
    return <Redirect href="/onboard" />;
  }

  return <Redirect href="/(tabs)" />;
}
