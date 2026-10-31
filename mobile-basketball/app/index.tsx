import { useState } from 'react';
import { Redirect } from 'expo-router';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useAuth } from '@/lib/auth';
import { useAppTheme } from '@/lib/appTheme';
import { useLegalAcceptance } from '@/lib/legalAcceptance';

export default function IndexScreen() {
  const auth = useAuth();
  const appTheme = useAppTheme();
  const legal = useLegalAcceptance();
  const [entered, setEntered] = useState(false);

  if (auth.loading || appTheme.loading || legal.loading) {
    return <LoadingScreen />;
  }

  // First launch only: Terms / Privacy / EULA acceptance. Everything else in
  // the app works anonymously — authentication is opt-in from the sidebar.
  if (!legal.accepted) {
    return <Redirect href="/legal" />;
  }

  // Returning users: after everything has loaded, keep the splash up until
  // they tap anywhere to enter the app.
  if (!entered) {
    return <LoadingScreen ready onContinue={() => setEntered(true)} />;
  }

  return <Redirect href="/(tabs)" />;
}
