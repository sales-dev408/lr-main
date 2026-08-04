import { useCallback, useMemo, useState } from 'react';
import { Image, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AppButton, Banner, Card, Screen, SectionTitle, Spinner } from '@/components/Ui';
import { useAuth } from '@/lib/auth';
import { getMyAnalytics, listVendors } from '@/lib/api';
import { useThemeColors } from '@/lib/useThemeColors';
import type { UserAnalytics, VendorListItem } from '@/lib/types';

function StatPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colors = useThemeColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 4, padding: 16, backgroundColor: colors.panel, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ fontSize: 28, fontWeight: '800', color }}>{value}</Text>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.muted, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const auth = useAuth();
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [vendors, setVendors] = useState<VendorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [analyticsData, vendorsData] = await Promise.all([getMyAnalytics(), listVendors()]);
      setAnalytics(analyticsData);
      setVendors(vendorsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load home data');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      void load().finally(() => {
        if (active) setLoading(false);
      });
      return () => {
        active = false;
      };
    }, [load]),
  );

  const greeting = useMemo(() => {
    const name = auth.profile?.fullName?.split(' ')[0];
    return name ? `Welcome back, ${name}` : 'Welcome to Light Rail Deals';
  }, [auth.profile?.fullName]);

  const activeDeals = useMemo(() => vendors.filter((v) => v.discount.label && (!v.endsAt || new Date(v.endsAt) > new Date())).length, [vendors]);
  const topVendor = useMemo(() => analytics?.byVendor[0], [analytics]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
        <LinearGradient
          colors={['#0d9488', '#6366f1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 24, padding: 24, gap: 8 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Image source={require('@/assets/images/logo.png')} style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: '#fff' }} resizeMode="contain" />
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>Light Rail Deals</Text>
          </View>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', opacity: 0.9 }}>{greeting}</Text>
        </LinearGradient>

        {loading ? <Spinner /> : null}
        {error ? <Banner tone="error">{error}</Banner> : null}

        {!loading && analytics ? (
          <Card>
            <SectionTitle title="Your stats" subtitle="Membership activity at a glance" />
            <View style={{ flexDirection: width < 360 ? 'column' : 'row', gap: 12 }}>
              <StatPill label="Total redemptions" value={analytics.totalRedemptions} color="#10b981" />
              <StatPill label="Active deals" value={activeDeals} color="#f43f5e" />
            </View>
            {topVendor ? (
              <Text style={{ color: colors.muted, textAlign: 'center' }}>
                Favorite spot: <Text style={{ fontWeight: '700', color: colors.ink }}>{topVendor.vendorName}</Text> ({topVendor.redemptions})
              </Text>
            ) : null}
          </Card>
        ) : null}

        <Card>
          <SectionTitle title="Quick actions" subtitle="Jump to the most used features" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <View style={{ width: '48%', minWidth: 140 }}>
              <Link href="/(tabs)/browse" asChild>
                <AppButton>Browse discounts</AppButton>
              </Link>
            </View>
            <View style={{ width: '48%', minWidth: 140 }}>
              <Link href="/(tabs)/mypass" asChild>
                <AppButton>My membership card</AppButton>
              </Link>
            </View>
            <View style={{ width: '48%', minWidth: 140 }}>
              <Link href="/(tabs)/scan" asChild>
                <AppButton>Scan code</AppButton>
              </Link>
            </View>
          </View>
        </Card>

        <Card>
          <SectionTitle title="More" subtitle="Events, tickets, settings, and curated content" />
          <View style={{ gap: 10 }}>
            <Link href="/(tabs)/events" asChild>
              <AppButton variant="secondary">Local events</AppButton>
            </Link>
            <Link href="/(tabs)/tickets" asChild>
              <AppButton variant="secondary">Event tickets & drawings</AppButton>
            </Link>
            <Link href="/(tabs)/discover" asChild>
              <AppButton variant="secondary">Discover content</AppButton>
            </Link>
            <Link href="/(tabs)/profile" asChild>
              <AppButton variant="secondary">Profile / Settings</AppButton>
            </Link>
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}
