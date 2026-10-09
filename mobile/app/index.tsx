import { Redirect } from 'expo-router';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useAuth } from '@/lib/auth';
import { useAppTheme } from '@/lib/appTheme';
import { useLegalAcceptance } from '@/lib/legalAcceptance';

export default function IndexScreen() {
  const auth = useAuth();
  const appTheme = useAppTheme();
  const legal = useLegalAcceptance();

  if (auth.loading || appTheme.loading || legal.loading) {
    return <LoadingScreen />;
  }

  // First launch only: Terms / Privacy / EULA acceptance. Everything else in
  // the app works anonymously — authentication is opt-in from the sidebar.
  if (!legal.accepted) {
    return <Redirect href="/legal" />;
  }

  return <Redirect href="/(tabs)" />;
}
