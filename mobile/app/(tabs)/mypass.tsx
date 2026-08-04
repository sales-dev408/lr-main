import { useCallback, useMemo, useState } from 'react';
import { Image, ImageBackground, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { AppButton, Banner, BrandHeader, Card, Screen, SectionTitle, Spinner } from '@/components/Ui';
import { getCard, getMyPass } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { barcodeUrl } from '@/lib/qr';
import { useThemeColors } from '@/lib/useThemeColors';
import type { CardDetail, CreatePassResponse } from '@/lib/types';

function parseImageUrls(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((item) => typeof item === 'string' && item.length > 0);
    if (typeof parsed === 'string') return [parsed];
    return [];
  } catch {
    return value ? [value] : [];
  }
}

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

  const passWidth = Math.min(width - 64, 420);
  const passHeight = passWidth * (9 / 16) + 120;
  const barcodeWidth = Math.min(passWidth - 48, 340);
  const backgroundImage = useMemo(() => {
    const urls = parseImageUrls(card?.image_url ?? null);
    return urls[0];
  }, [card?.image_url]);

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

            <View
              style={{
                alignSelf: 'center',
                width: passWidth,
                height: passHeight,
                borderRadius: 20,
                overflow: 'hidden',
                backgroundColor: card?.primary_color ?? '#0B1F3A',
                borderWidth: 2,
                borderColor: card?.secondary_color ?? '#8FB2D9',
              }}
            >
              {backgroundImage ? (
                <ImageBackground source={{ uri: backgroundImage }} style={{ flex: 1, width: '100%', height: '100%' }} resizeMode="cover">
                  <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                    <View
                      style={{
                        padding: 18,
                        paddingBottom: 12,
                        backgroundColor: 'rgba(0,0,0,0.55)',
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>{card?.name ?? 'Light Rail Membership'}</Text>
                      {card?.description ? <Text style={{ color: '#fff', fontSize: 13, opacity: 0.9, marginTop: 2 }}>{card.description}</Text> : null}
                      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 8 }}>{profile?.fullName ?? 'Member'}</Text>
                    </View>
                    <View style={{ alignItems: 'center', padding: 14, backgroundColor: '#fff' }}>
                      <Image
                        source={{ uri: barcodeUrl(pass.pass.barcodeValue, barcodeWidth, 100) }}
                        style={{ width: barcodeWidth, height: 100, borderRadius: 4, backgroundColor: '#fff' }}
                        resizeMode="contain"
                      />
                      <Text selectable style={{ color: '#111827', fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginTop: 6 }}>
                        {pass.pass.barcodeValue}
                      </Text>
                    </View>
                  </View>
                </ImageBackground>
              ) : (
                <View style={{ flex: 1, justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18 }}>
                    {card?.icon_url ? <Image source={{ uri: card.icon_url }} style={{ width: 64, height: 64, borderRadius: 12, marginBottom: 10 }} /> : null}
                    <Text style={{ color: card?.secondary_color ?? '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center' }}>
                      {card?.name ?? 'Light Rail Membership'}
                    </Text>
                    {card?.description ? <Text style={{ color: card?.secondary_color ?? '#fff', fontSize: 14, opacity: 0.9, textAlign: 'center', marginTop: 4 }}>{card.description}</Text> : null}
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 14 }}>{profile?.fullName ?? 'Member'}</Text>
                  </View>
                  <View style={{ alignItems: 'center', padding: 14, backgroundColor: '#fff' }}>
                    <Image
                      source={{ uri: barcodeUrl(pass.pass.barcodeValue, barcodeWidth, 100) }}
                      style={{ width: barcodeWidth, height: 100, borderRadius: 4, backgroundColor: '#fff' }}
                      resizeMode="contain"
                    />
                    <Text selectable style={{ color: '#111827', fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginTop: 6 }}>
                      {pass.pass.barcodeValue}
                    </Text>
                  </View>
                </View>
              )}
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
