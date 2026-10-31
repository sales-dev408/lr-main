import { useMemo } from 'react';
import { Image, ImageBackground, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AdBanner } from '@/components/AdBanner';
import { AppButton, Card, Screen, SectionTitle } from '@/components/Ui';
import { useAuth } from '@/lib/auth';
import { ALLSTAR_DATES, daysUntilTipOff } from '@/lib/allstar';
import { fonts } from '@/lib/theme';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';

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

  const greeting = useMemo(() => {
    const name = auth.profile?.fullName?.split(' ')[0];
    return name ? `Welcome back, ${name}` : 'Explore the Valley Metro';
  }, [auth.profile?.fullName]);

  const heroHeight = Math.min(280, Math.max(200, width * 0.55));

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 32, paddingTop: 4 }}>
        <ImageBackground
          source={require('@/assets/images/phoenix-skyline.jpg')}
          style={{ height: heroHeight, borderRadius: 24, overflow: 'hidden', justifyContent: 'flex-end' }}
          imageStyle={{ borderRadius: 24 }}
          accessibilityLabel="Downtown Phoenix skyline at sunset"
        >
          <LinearGradient
            colors={['rgba(23, 20, 18, 0)', 'rgba(23, 20, 18, 0.45)']}
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
          </LinearGradient>
        </ImageBackground>

        <Link href="/allstar" asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="NBA All-Star 2027 guide"
            style={({ pressed }) => [{ borderRadius: 24, overflow: 'hidden' }, pressed && { opacity: 0.9 }]}
          >
            <LinearGradient
              colors={['#1d1160', '#5b2a86', '#e56020']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: '100%', padding: 18, gap: 4, alignItems: 'flex-start' }}
            >
              <Text style={{ color: '#f9a01b', fontSize: 11 * effectiveScale, fontWeight: '800', letterSpacing: 2 }} allowFontScaling={false}>
                {'🏀'} NBA ALL-STAR 2027 • PHOENIX
              </Text>
              <Text
                style={{ color: '#fff', fontSize: 22 * effectiveScale, fontWeight: '800', fontFamily: fonts.display, letterSpacing: 0.4 }}
                allowFontScaling={false}
              >
                {daysUntilTipOff()} days to tip-off
              </Text>
              <Text style={{ color: '#e9e5f8', fontSize: 13 * effectiveScale, fontWeight: '600' }} allowFontScaling={false}>
                {ALLSTAR_DATES} • Mortgage Matchup Center — tap for the full guide
              </Text>
            </LinearGradient>
          </Pressable>
        </Link>

        <Card>
          <SectionTitle title="Explore" subtitle="Dining, shopping, events, and more" />
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <QuickAction label="NBA All-Star" emoji="🏀" href="/allstar" />
              </View>
              <View style={{ flex: 1 }}>
                <QuickAction label="Downtown Map" emoji="🗺" href="/downtown-map" />
              </View>
            </View>
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
            <Link href="/more" asChild>
              <AppButton variant="secondary">More — Apartments, Real Estate, Services</AppButton>
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
