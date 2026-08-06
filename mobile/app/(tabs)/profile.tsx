import { Alert, Linking, ScrollView, Switch, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { useCallback, useMemo, useState } from 'react';
import { AppButton, Banner, BrandHeader, Card, Screen, SectionTitle } from '@/components/Ui';
import { useAuth } from '@/lib/auth';
import { getMyAnalytics, listVendors } from '@/lib/api';
import { useAppColorScheme } from '@/lib/colorScheme';
import { PRIVACY_URL, TERMS_URL, EULA_URL, WEBSITE_URL } from '@/lib/theme';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType, TEXT_SCALE_OPTIONS } from '@/lib/dynamicType';
import type { UserAnalytics, VendorListItem } from '@/lib/types';

export default function ProfileScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const auth = useAuth();
  const { scheme, setScheme, highContrast, setHighContrast } = useAppColorScheme();
  const { effectiveScale, textScale, setTextScale } = useDynamicType();
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [vendors, setVendors] = useState<VendorListItem[]>([]);

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
      setAnalytics(await getMyAnalytics());
      setVendors(await listVendors());
    } catch (err) {
      setAnalyticsError(err instanceof Error ? err.message : 'Unable to load profile data');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (auth.token) {
        void load();
      }
    }, [auth.token, load]),
  );

  async function handleCityChange(next: string) {
    await auth.updateProfile({ city: next });
  }

  const sectionLabel = { color: colors.ink, fontSize: 16 * effectiveScale, fontWeight: '600' } as const;
  const valueLabel = { color: colors.muted, fontSize: 14 * effectiveScale } as const;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
        <BrandHeader subtitle="Profile & Settings" />

        <Card>
          <SectionTitle title="Profile" subtitle="Signed-in customer details" />
          {auth.profile ? (
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
            <Banner tone="info">No customer profile is signed in.</Banner>
          )}
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
          <SectionTitle title="My activity" subtitle="Membership usage at a glance" />
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
                <Text style={{ color: colors.muted, fontSize: 14 * effectiveScale }} allowFontScaling={false}>No redemptions yet.</Text>
              )}
            </View>
          ) : null}
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
          <SectionTitle title="Membership" subtitle="Passes and membership" />
          <AppButton variant="secondary" onPress={() => router.push('/(tabs)/mypass')}>
            My membership pass
          </AppButton>
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
          <AppButton
            variant="ghost"
            onPress={() =>
              Alert.alert('Delete account', 'This permanently deletes your account and cannot be undone.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => void auth.deleteAccount().then(() => router.replace('/auth')),
                },
              ])
            }
          >
            Delete account
          </AppButton>
        </Card>
      </ScrollView>
    </Screen>
  );
}
