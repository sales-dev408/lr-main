import { Image, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { AppButton, Screen } from '@/components/Ui';
import { theme } from '@/lib/theme';

export default function WelcomeScreen() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', gap: 32, padding: 24 }}>
        <View style={{ alignItems: 'center', gap: 16 }}>
          <Image source={require('@/assets/images/logo.png')} style={{ width: 160, height: 160 }} resizeMode="contain" />
          <Text style={{ fontSize: 32, fontWeight: '800', color: theme.ink, textAlign: 'center' }}>Light Rail Deals</Text>
          <Text style={{ fontSize: 16, color: theme.muted, textAlign: 'center', maxWidth: 280 }}>
            One membership card. Exclusive deals at every participating business.
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          <Link href="/auth?mode=login" asChild>
            <AppButton>Sign In</AppButton>
          </Link>
          <Link href="/auth?mode=register" asChild>
            <AppButton variant="secondary">Register</AppButton>
          </Link>
        </View>
      </ScrollView>
    </Screen>
  );
}
