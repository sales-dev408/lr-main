import { Redirect } from 'expo-router';
import { Screen, Spinner } from '@/components/Ui';
import { useAuth } from '@/lib/auth';

export default function IndexScreen() {
  const auth = useAuth();

  if (auth.loading) {
    return (
      <Screen>
        <Spinner />
      </Screen>
    );
  }

  if (!auth.token) {
    return <Redirect href="/onboard" />;
  }

  return <Redirect href="/(tabs)" />;
}
