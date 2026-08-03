import { useCallback, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { AppButton, Banner, BrandHeader, Card, Screen, SectionTitle, Spinner } from '@/components/Ui';
import { getCard, getMyPass } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { qrCodeUrl } from '@/lib/qr';
import type { CardDetail, CreatePassResponse } from '@/lib/types';

export default function PassesScreen() {
  const { token } = useAuth();
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

  const qrSize = card?.qr_size ?? 240;
  const primaryColor = card?.primary_color ?? '#0B1F3A';
  const secondaryColor = card?.secondary_color ?? '#8FB2D9';

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
        <BrandHeader subtitle="My membership card" />

        {!token ? (
          <Card>
            <SectionTitle title="Your membership card" subtitle="Sign in to get your all-in-one pass." />
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
            <View style={{ backgroundColor: primaryColor, borderRadius: 16, padding: 20, gap: 6, alignItems: 'center', borderWidth: 2, borderColor: secondaryColor }}>
              {card?.icon_url ? <Image source={{ uri: card.icon_url }} style={{ width: 48, height: 48, borderRadius: 8, marginBottom: 6 }} /> : null}
              <Text style={{ color: secondaryColor, fontSize: 12, letterSpacing: 1 }}>MEMBER QR CODE</Text>
              <Image source={{ uri: qrCodeUrl(pass.pass.barcodeValue, qrSize) }} style={{ width: qrSize, height: qrSize, borderRadius: 8, backgroundColor: '#fff' }} resizeMode="contain" />
              <Text selectable style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 }}>
                {pass.pass.barcodeValue}
              </Text>
            </View>
            <Text style={{ color: '#52617a' }}>
              Scan a vendor&apos;s in-store QR code to confirm your discount, or show this code if a staff member asks for it.
            </Text>

            <Link href="/scan" asChild>
              <AppButton>Scan vendor QR code</AppButton>
            </Link>
            <Link href="/(tabs)/vendors" asChild>
              <AppButton variant="secondary">See participating businesses</AppButton>
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
