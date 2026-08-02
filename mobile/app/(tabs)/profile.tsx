import { Linking, ScrollView, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { AppButton, AppleTrademark, Banner, BrandHeader, Card, Screen, SectionTitle } from '@/components/Ui';
import { useAuth } from '@/lib/auth';
import { WEBSITE_URL } from '@/lib/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const auth = useAuth();

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
        <BrandHeader subtitle="Your account" />

        <Card>
          <SectionTitle title="Profile" subtitle="Signed-in customer details" />
          {auth.profile ? (
            <>
              <Text style={{ fontWeight: '700', color: '#10223d', fontSize: 18 }}>{auth.profile.fullName}</Text>
              <Text style={{ color: '#52617a' }}>{auth.profile.email ?? auth.profile.phone ?? 'No email or phone on file'}</Text>
            </>
          ) : (
            <Banner tone="info">No customer profile is signed in.</Banner>
          )}
        </Card>

        <Card>
          <SectionTitle title="Membership & tickets" subtitle="Passes and event tickets" />
          <AppButton variant="secondary" onPress={() => router.push('/(tabs)/passes')}>
            My membership pass
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/tickets')}>
            My event tickets
          </AppButton>
        </Card>

        <Card>
          <SectionTitle title="About & Legal" subtitle="Website, terms, and privacy" />
          <AppButton variant="secondary" onPress={() => void Linking.openURL(WEBSITE_URL)}>
            Open website
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/legal?doc=terms')}>
            Terms of Service
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/legal?doc=privacy')}>
            Privacy Policy
          </AppButton>
          <AppleTrademark />
        </Card>

        <Card>
          <SectionTitle title="Session" subtitle="Account access" />
          <AppButton
            variant="danger"
            onPress={() => {
              void auth.logout().then(() => router.replace('/auth'));
            }}
          >
            Log out
          </AppButton>
        </Card>
      </ScrollView>
    </Screen>
  );
}
