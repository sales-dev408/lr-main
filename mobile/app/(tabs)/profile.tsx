import { Linking, ScrollView, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppButton, Banner, BrandHeader, Card, Screen, SectionTitle } from '@/components/Ui';
import { useAuth } from '@/lib/auth';
import { getMyAnalytics } from '@/lib/api';
import { PRIVACY_URL, TERMS_URL, EULA_URL, WEBSITE_URL } from '@/lib/theme';
import type { UserAnalytics } from '@/lib/types';

export default function ProfileScreen() {
  const router = useRouter();
  const auth = useAuth();
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    try {
      setAnalyticsError(null);
      setAnalytics(await getMyAnalytics());
    } catch (err) {
      setAnalyticsError(err instanceof Error ? err.message : 'Unable to load analytics');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (auth.token) {
        void loadAnalytics();
      }
    }, [auth.token, loadAnalytics]),
  );

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
          <SectionTitle title="My activity" subtitle="Membership usage at a glance" />
          {analyticsError ? <Banner tone="error">{analyticsError}</Banner> : null}
          {!analytics && !analyticsError ? (
            <Banner tone="info">Loading activity…</Banner>
          ) : null}
          {analytics ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: '#10223d', fontSize: 18, fontWeight: '700' }}>
                {analytics.totalRedemptions} total redemption{analytics.totalRedemptions === 1 ? '' : 's'}
              </Text>
              {analytics.byVendor.length > 0 ? (
                <>
                  <Text style={{ color: '#52617a' }}>By business:</Text>
                  {analytics.byVendor.map((item) => (
                    <Text key={item.vendorId} style={{ color: '#52617a' }}>
                      {item.vendorName}: {item.redemptions}
                    </Text>
                  ))}
                </>
              ) : (
                <Text style={{ color: '#52617a' }}>No redemptions yet.</Text>
              )}
            </View>
          ) : null}
        </Card>

        <Card>
          <SectionTitle title="About & Legal" subtitle="Website, terms, and privacy" />
          <AppButton variant="secondary" onPress={() => void Linking.openURL(WEBSITE_URL)}>
            Open website
          </AppButton>
          <AppButton variant="secondary" onPress={() => void Linking.openURL(TERMS_URL)}>
            Terms of Use
          </AppButton>
          <AppButton variant="secondary" onPress={() => void Linking.openURL(PRIVACY_URL)}>
            Privacy Policy - Light Rail Deals
          </AppButton>
          <AppButton variant="secondary" onPress={() => void Linking.openURL(EULA_URL)}>
            EULA
          </AppButton>
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
