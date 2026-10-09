import { Alert, Linking, ScrollView, Switch, Text, View } from 'react-native';
import { Link, useRouter, useFocusEffect } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { useCallback, useMemo, useState } from 'react';
import { AppButton, Banner, BrandHeader, Card, Screen, SectionTitle } from '@/components/Ui';
import { AdBanner } from '@/components/AdBanner';
import { useAuth } from '@/lib/auth';
import { getMyAnalytics, listVendors } from '@/lib/api';
import { getLocalRedemptions, toLocalAnalytics } from '@/lib/localStats';
import { useAppColorScheme } from '@/lib/colorScheme';
import { PRIVACY_URL, TERMS_URL, EULA_URL, WEBSITE_URL } from '@/lib/theme';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType, TEXT_SCALE_OPTIONS } from '@/lib/dynamicType';
import type { UserAnalytics, VendorListItem } from '@/lib/types';

const IMAGE_CREDITS = [
  {
    image: 'Downtown Phoenix skyline at night',
    screen: 'Splash screen & Home hero',
    credit: 'Alan Stark — CC BY-SA 2.0 (via Wikimedia Commons / Flickr)',
  },
  {
    image: 'Valley Metro rail line maps (A Line, B Line, streetcar)',
    screen: 'Train Times',
    credit: 'Valley Metro — used for trip planning reference',
  },
  {
    image: 'Light Rail Deals logo & icons',
    screen: 'Throughout the app',
    credit: 'Light Rail Deals',
  },
];

export default function ProfileScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const auth = useAuth();
  const { scheme, setScheme, highContrast, setHighContrast } = useAppColorScheme();
  const { effectiveScale, textScale, setTextScale } = useDynamicType();
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [vendors, setVendors] = useState<VendorListItem[]>([]);

  const [profileError, setProfileError] = useState<string | null>(null);
  const signedIn = Boolean(auth.token);

  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const v of vendors) {
      if (v.city?.trim()) set.add(v.city.trim());
    }
    return Array.from(set).sort();
  }, [vendors]);

  const load = useCallback(async () => {
    try {
      setAnalyticsError(null);
      // Signed-in members get server-side analytics; anonymous users see
      // stats tracked locally on-device (redemptions still work without an
      // account).
      if (auth.token) {
        setAnalytics(await getMyAnalytics());
      } else {
        setAnalytics(toLocalAnalytics(await getLocalRedemptions()));
      }
      setVendors(await listVendors());
    } catch (err) {
      setAnalyticsError(err instanceof Error ? err.message : 'Unable to load profile data');
    }
  }, [auth.token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handleCityChange(next: string) {
    setProfileError(null);
    try {
      await auth.updateProfile({ city: next });
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Unable to update city');
    }
  }

  const sectionLabel = { color: colors.ink, fontSize: 16 * effectiveScale, fontWeight: '600' } as const;
  const valueLabel = { color: colors.muted, fontSize: 14 * effectiveScale } as const;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 32, paddingTop: 4 }}>
        <BrandHeader subtitle="Profile & Settings" />

        <AdBanner slot={5} />

        <Card>
          <SectionTitle title="Profile" subtitle={signedIn ? 'Signed-in member details' : 'Browsing without an account'} />
          {profileError ? <Banner tone="error">{profileError}</Banner> : null}
          {auth.profile && signedIn ? (
            <View style={{ gap: 10 }}>
              <View>
                <Text style={sectionLabel}>Name</Text>
                <Text style={valueLabel}>{auth.profile.fullName}</Text>
              </View>
              {auth.profile.email ? (
                <View>
                  <Text style={sectionLabel}>Email</Text>
                  <Text style={valueLabel}>{auth.profile.email}</Text>
                </View>
              ) : null}
              {auth.profile.phone ? (
                <View>
                  <Text style={sectionLabel}>Phone</Text>
                  <Text style={valueLabel}>{auth.profile.phone}</Text>
                </View>
              ) : null}
              <View style={{ marginTop: 4, gap: 6 }}>
                <Text style={sectionLabel} accessibilityLabel="City label">
                  City
                </Text>
                <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden' }}>
                  <Picker
                    selectedValue={auth.profile?.city ?? ''}
                    onValueChange={(itemValue) => void handleCityChange(itemValue)}
                    accessibilityLabel="Select your city"
                    accessibilityRole="combobox"
                  >
                    <Picker.Item label="Select a city" value="" />
                    {cities.map((name) => (
                      <Picker.Item key={name} label={name} value={name} />
                    ))}
                  </Picker>
                </View>
                <Text style={{ color: colors.muted, fontSize: 12 * effectiveScale }} allowFontScaling={false}>Local events and deals are matched to this city.</Text>
              </View>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={valueLabel}>
                You&apos;re using the app anonymously — everything works except favorites and member-exclusive deals.
              </Text>
              <Link href="/auth" asChild>
                <AppButton>Sign In / Create Account</AppButton>
              </Link>
            </View>
          )}
        </Card>

        <Card>
          <SectionTitle title="My Stats" subtitle={signedIn ? 'Membership usage at a glance' : 'Activity tracked on this device'} />
          {analyticsError ? <Banner tone="error">{analyticsError}</Banner> : null}
          {!analytics && !analyticsError ? (
            <Banner tone="info">Loading activity…</Banner>
          ) : null}
          {analytics ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.ink, fontSize: 18 * effectiveScale, fontWeight: '700' }} allowFontScaling={false}>
                {analytics.totalRedemptions} total redemption{analytics.totalRedemptions === 1 ? '' : 's'}
              </Text>
              {analytics.byVendor.length > 0 ? (
                <>
                  <Text style={{ color: colors.muted, fontSize: 14 * effectiveScale }} allowFontScaling={false}>By business:</Text>
                  {analytics.byVendor.map((item) => (
                    <Text key={item.vendorId} style={{ color: colors.muted, fontSize: 14 * effectiveScale }} allowFontScaling={false}>
                      {item.vendorName}: {item.redemptions}
                    </Text>
                  ))}
                </>
              ) : (
                <Text style={{ color: colors.muted, fontSize: 14 * effectiveScale }} allowFontScaling={false}>No redemptions yet — redeem a deal to see it here.</Text>
              )}
            </View>
          ) : null}
        </Card>

        <Card>
          <SectionTitle title="Appearance" subtitle="Choose how the app looks" />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
            <Text style={{ color: colors.ink, fontSize: 16 * effectiveScale }} allowFontScaling={false}>Dark mode</Text>
            <Switch
              value={scheme === 'dark'}
              onValueChange={(on) => setScheme(on ? 'dark' : 'light')}
              trackColor={{ false: colors.border, true: colors.brand }}
              thumbColor="#fff"
              accessibilityLabel="Toggle dark mode"
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
            <Text style={{ color: colors.ink, fontSize: 16 * effectiveScale }} allowFontScaling={false}>High contrast mode</Text>
            <Switch
              value={highContrast}
              onValueChange={setHighContrast}
              trackColor={{ false: colors.border, true: colors.brand }}
              thumbColor="#fff"
              accessibilityLabel="Toggle high contrast mode"
            />
          </View>
        </Card>

        <Card>
          <SectionTitle title="Text & icon size" subtitle="Adjust for readability" />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {TEXT_SCALE_OPTIONS.map((option) => (
              <AppButton
                key={option.value}
                variant={textScale === option.value ? 'primary' : 'secondary'}
                onPress={() => setTextScale(option.value)}
                style={{ flex: 1, minWidth: 90 }}
              >
                {option.label}
              </AppButton>
            ))}
          </View>
        </Card>

        <Card>
          <SectionTitle title="Membership" subtitle="Status and activity" />
          {auth.profile?.status === 'active' ? (
            <Banner tone="success">Your membership is active.</Banner>
          ) : signedIn ? (
            <Banner tone="info">No active membership plan.</Banner>
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={valueLabel}>Members get favorites plus access to exclusive deals.</Text>
              <Link href="/auth" asChild>
                <AppButton variant="secondary">Learn more & sign up</AppButton>
              </Link>
            </View>
          )}
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
            Privacy Policy
          </AppButton>
          <AppButton variant="secondary" onPress={() => void Linking.openURL(EULA_URL)}>
            EULA
          </AppButton>
        </Card>

        {signedIn ? (
          <Card>
            <SectionTitle title="Session" subtitle="Account access" />
            <AppButton
              variant="danger"
              onPress={() => {
                void auth.logout().then(() => router.replace('/'));
              }}
            >
              Log out
            </AppButton>
            <AppButton
              variant="ghost"
              onPress={() =>
                Alert.alert('Delete account', 'This permanently deletes your account and cannot be undone.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      void auth.deleteAccount()
                        .then(() => router.replace('/'))
                        .catch((err) => Alert.alert('Error', err instanceof Error ? err.message : 'Unable to delete account'));
                    },
                  },
                ])
              }
            >
              Delete account
            </AppButton>
          </Card>
        ) : null}

        <Card>
          <SectionTitle title="Credits" subtitle="Images and where they appear" />
          {IMAGE_CREDITS.map((item) => (
            <View key={item.image} style={{ gap: 2, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ color: colors.ink, fontSize: 14 * effectiveScale, fontWeight: '600' }} allowFontScaling={false}>
                {item.image}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13 * effectiveScale }} allowFontScaling={false}>
                {item.screen}
              </Text>
              <Text style={{ color: colors.subtle, fontSize: 12 * effectiveScale }} allowFontScaling={false}>
                {item.credit}
              </Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </Screen>
  );
}
