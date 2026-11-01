import { Linking, ScrollView, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppButton, Banner, BrandHeader, Card, Screen, SectionTitle } from '@/components/Ui';
import { AdBanner } from '@/components/AdBanner';
import { getLocalRedemptions, toLocalAnalytics } from '@/lib/localStats';
import { useAppColorScheme } from '@/lib/colorScheme';
import { PRIVACY_URL, TERMS_URL, EULA_URL, WEBSITE_URL } from '@/lib/theme';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType, TEXT_SCALE_OPTIONS } from '@/lib/dynamicType';
import type { UserAnalytics } from '@/lib/types';

const IMAGE_CREDITS = [
  { image: 'Downtown Phoenix skyline at sunset', screen: 'Home hero', credit: 'Adobe Stock #888020508' },
  { image: 'Valley Metro rail line maps (A Line, B Line, streetcar)', screen: 'Train Times', credit: 'Valley Metro — used for trip planning reference' },
  { image: 'Light Rail Deals logo & icons', screen: 'Throughout the app', credit: 'Light Rail Deals' },
];

export default function SettingsScreen() {
  const colors = useThemeColors();
  const { scheme, setScheme, highContrast, setHighContrast } = useAppColorScheme();
  const { effectiveScale, textScale, setTextScale } = useDynamicType();
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setAnalyticsError(null);
      setAnalytics(toLocalAnalytics(await getLocalRedemptions()));
    } catch (err) {
      setAnalyticsError(err instanceof Error ? err.message : 'Unable to load stats');
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 32, paddingTop: 4 }}>
        <BrandHeader subtitle="Settings" />
        <AdBanner slot={5} />

        <Card>
          <SectionTitle title="My Stats" subtitle="Activity tracked on this device" />
          {analyticsError ? <Banner tone="error">{analyticsError}</Banner> : null}
          {!analytics && !analyticsError ? <Banner tone="info">Loading activity…</Banner> : null}
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
            <Switch value={scheme === 'dark'} onValueChange={(on) => setScheme(on ? 'dark' : 'light')} trackColor={{ false: colors.border, true: colors.brand }} thumbColor="#fff" accessibilityLabel="Toggle dark mode" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
            <Text style={{ color: colors.ink, fontSize: 16 * effectiveScale }} allowFontScaling={false}>High contrast mode</Text>
            <Switch value={highContrast} onValueChange={setHighContrast} trackColor={{ false: colors.border, true: colors.brand }} thumbColor="#fff" accessibilityLabel="Toggle high contrast mode" />
          </View>
        </Card>

        <Card>
          <SectionTitle title="Text & icon size" subtitle="Adjust for readability" />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {TEXT_SCALE_OPTIONS.map((option) => (
              <AppButton key={option.value} variant={textScale === option.value ? 'primary' : 'secondary'} onPress={() => setTextScale(option.value)} style={{ flex: 1, minWidth: 90 }}>
                {option.label}
              </AppButton>
            ))}
          </View>
        </Card>

        <Card>
          <SectionTitle title="About & Legal" subtitle="Website, terms, and privacy" />
          <AppButton variant="secondary" onPress={() => void Linking.openURL(WEBSITE_URL)}>Open website</AppButton>
          <AppButton variant="secondary" onPress={() => void Linking.openURL(TERMS_URL)}>Terms of Use</AppButton>
          <AppButton variant="secondary" onPress={() => void Linking.openURL(PRIVACY_URL)}>Privacy Policy</AppButton>
          <AppButton variant="secondary" onPress={() => void Linking.openURL(EULA_URL)}>EULA</AppButton>
        </Card>

        <Card>
          <SectionTitle title="Credits" subtitle="Images and where they appear" />
          {IMAGE_CREDITS.map((item) => (
            <View key={item.image} style={{ gap: 2, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ color: colors.ink, fontSize: 14 * effectiveScale, fontWeight: '600' }} allowFontScaling={false}>{item.image}</Text>
              <Text style={{ color: colors.muted, fontSize: 13 * effectiveScale }} allowFontScaling={false}>{item.screen}</Text>
              <Text style={{ color: colors.subtle, fontSize: 12 * effectiveScale }} allowFontScaling={false}>{item.credit}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </Screen>
  );
}
