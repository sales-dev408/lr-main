import { useCallback, useState } from 'react';
import { Image, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { AppButton, Banner, BrandHeader, Card, Screen, SectionTitle, Spinner } from '@/components/Ui';
import { getCard, getMyPass } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { barcodeUrl } from '@/lib/qr';
import { useThemeColors } from '@/lib/useThemeColors';
import type { CardDetail, CreatePassResponse } from '@/lib/types';

export default function MyPassScreen() {
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const { token, profile } = useAuth();
  const [pass, setPass] = useState<CreatePassResponse | null>(null);
  const [card, setCard] = useState<CardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let active = true;
    if (!token) {
      setPass(null);
      setCard(null);
      setLoading(false);
      return () => {
        active = false;
      };
    }
    setLoading(true);
    setError(null);
    getMyPass()
      .then(async (data) => {
        if (!active) return;
        setPass(data);
        try {
          const cardDetail = await getCard(data.pass.cardId);
          if (active) setCard(cardDetail);
        } catch {
          // card design is optional; keep pass visible
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load your membership pass');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  useFocusEffect(load);

  const primaryColor = card?.primary_color ?? '#0B1F3A';
  const secondaryColor = card?.secondary_color ?? '#8FB2D9';
  const passWidth = Math.min(width - 64, 380);
  const barcodeWidth = Math.min(passWidth - 40, 340);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
        <BrandHeader subtitle="My membership pass" />

        {!token ? (
          <Card>
            <SectionTitle title="Your membership pass" subtitle="Sign in to get your all-in-one pass." />
            <Banner tone="info">Create an account or sign in and your membership pass is generated automatically.</Banner>
            <Link href="/auth" asChild>
              <AppButton>Sign in</AppButton>
            </Link>
          </Card>
        ) : null}

        {loading ? <Spinner /> : null}
        {error ? <Banner tone="error">{error}</Banner> : null}

        {token && pass ? (
          <Card>
            <SectionTitle title={card?.name ?? 'Light Rail Membership'} subtitle="One card, every participating business." />
            {card?.logo_url ? (
              <Image source={{ uri: card.logo_url }} style={{ width: '100%', height: 80, resizeMode: 'contain', marginBottom: 8 }} />
            ) : null}

            <View
              style={{
                backgroundColor: primaryColor,
                borderRadius: 20,
                padding: 20,
                gap: 10,
                alignItems: 'center',
                alignSelf: 'center',
                width: passWidth,
                borderWidth: 2,
                borderColor: secondaryColor,
              }}
            >
              {card?.icon_url ? <Image source={{ uri: card.icon_url }} style={{ width: 56, height: 56, borderRadius: 10, marginBottom: 4 }} /> : null}
              <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800', textAlign: 'center' }}>
                {profile?.fullName ?? 'Member'}
              </Text>
              <Text style={{ color: secondaryColor, fontSize: 12, letterSpacing: 1, fontWeight: '700' }}>
                CUSTOM MEMBER ID
              </Text>
              <Text selectable style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 }}>
                {pass.pass.barcodeValue}
              </Text>
              <Image
                source={{ uri: barcodeUrl(pass.pass.barcodeValue, barcodeWidth, 120) }}
                style={{ width: barcodeWidth, height: 120, borderRadius: 8, backgroundColor: '#fff' }}
                resizeMode="contain"
              />
            </View>

            <Text style={{ color: colors.muted, textAlign: 'center' }}>
              Show this barcode if a staff member asks for it, or scan a vendor&apos;s in-store discount code to confirm your discount.
            </Text>

            <Link href="/(tabs)/scan" asChild>
              <AppButton>Scan vendor discount code</AppButton>
            </Link>
            <Link href="/(tabs)/browse" asChild>
              <AppButton variant="secondary">Browse participating businesses</AppButton>
            </Link>
          </Card>
        ) : null}

        {token && !loading && !pass && !error ? (
          <Card>
            <SectionTitle title="Set up your card" subtitle="Get your all-in-one membership pass." />
            <AppButton onPress={() => void getMyPass().then(setPass).catch((err) => setError(err instanceof Error ? err.message : 'Unable to load pass'))}>
              Load membership pass
            </AppButton>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
