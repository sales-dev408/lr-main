import { useCallback, useMemo, useState } from 'react';
import { Image, ImageBackground, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AdBanner } from '@/components/AdBanner';
import { AppButton, Banner, Card, Screen, SectionTitle, Spinner } from '@/components/Ui';
import { useAuth } from '@/lib/auth';
import { listVendors } from '@/lib/api';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';
import type { VendorListItem } from '@/lib/types';

function QuickAction({ label, href, emoji }: { label: string; href: `/${string}`; emoji: string }) {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  return (
    <Link href={href as never} asChild>
      <AppButton variant="secondary" style={{ width: '100%', minHeight: 62 * effectiveScale, justifyContent: 'center' }}>
        <Text style={{ fontSize: 18 * effectiveScale }} allowFontScaling={false}>
          {emoji} <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 14 * effectiveScale }} allowFontScaling={false}>{label}</Text>
        </Text>
      </AppButton>
    </Link>
  );
}

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const { effectiveScale } = useDynamicType();
  const auth = useAuth();
  const [vendors, setVendors] = useState<VendorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setVendors(await listVendors());
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
    return name ? `Welcome back, ${name}` : 'Explore the Valley Metro';
  }, [auth.profile?.fullName]);

  const activeDeals = useMemo(
    () => vendors.filter((v) => v.discount.label && (!v.endsAt || new Date(v.endsAt) > new Date())).length,
    [vendors],
  );

  const heroHeight = Math.min(280, Math.max(200, width * 0.55));

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 32, paddingTop: 4 }}>
        <ImageBackground
          source={require('@/assets/images/phoenix-skyline.jpg')}
          style={{ height: heroHeight, borderRadius: 24, overflow: 'hidden', justifyContent: 'flex-end' }}
          imageStyle={{ borderRadius: 24 }}
          accessibilityLabel="Downtown Phoenix skyline at night"
        >
          <LinearGradient
            colors={['rgba(23, 20, 18, 0.05)', 'rgba(23, 20, 18, 0.72)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={{ flex: 1, justifyContent: 'flex-end', padding: 20, gap: 8 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Image source={require('@/assets/images/logo.png')} style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#fff' }} resizeMode="contain" />
              <Text style={{ color: '#fff', fontSize: 20 * effectiveScale, fontWeight: '800' }} allowFontScaling={false}>
                Light Rail Deals
              </Text>
            </View>
            <Text style={{ color: '#fff', fontSize: 24 * effectiveScale, fontWeight: '800' }} allowFontScaling={false}>
              {greeting}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 14 * effectiveScale }} allowFontScaling={false}>
              {loading ? 'Finding deals along the light rail…' : `${activeDeals} deals at ${vendors.length} businesses along the light rail.`}
            </Text>
          </LinearGradient>
        </ImageBackground>

        {loading ? <Spinner /> : null}
        {error ? <Banner tone="error">{error}</Banner> : null}

        <Card>
          <SectionTitle title="Explore" subtitle="Dining, shopping, events, and more" />
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <QuickAction label="Restaurants & Bars" emoji="🍽" href="/restaurants" />
              </View>
              <View style={{ flex: 1 }}>
                <QuickAction label="Shopping" emoji="🛍" href="/shopping" />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <QuickAction label="Events" emoji="★" href="/events" />
              </View>
              <View style={{ flex: 1 }}>
                <QuickAction label="Hotels" emoji="🏨" href="/hotels" />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <QuickAction label="Sports" emoji="🏀" href="/sports" />
              </View>
              <View style={{ flex: 1 }}>
                <QuickAction label="Train Times" emoji="⚡" href="/live" />
              </View>
            </View>
          </View>
        </Card>

        <AdBanner slot={1} />

        <Card>
          <SectionTitle title="Around the Valley" subtitle="More guides and your account" />
          <View style={{ gap: 10 }}>
            <Link href="/apartments" asChild>
              <AppButton variant="secondary">Apartments near the rail</AppButton>
            </Link>
            <Link href="/az-events" asChild>
              <AppButton variant="secondary">Events Around Arizona</AppButton>
            </Link>
            <Link href="/discover" asChild>
              <AppButton variant="secondary">Discover</AppButton>
            </Link>
            <Link href="/profile" asChild>
              <AppButton variant="secondary">Profile & settings</AppButton>
            </Link>
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}
