import { useCallback, useState } from 'react';
import { Image, Linking, ScrollView, Text, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { AppButton, Banner, BrandHeader, Card, Screen, SectionTitle, Spinner } from '@/components/Ui';
import { getMyPass } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { CreatePassResponse } from '@/lib/types';

function barcodeUrl(text: string) {
  return `https://quickchart.io/barcode?type=code128&text=${encodeURIComponent(text)}&width=320&height=120`;
}

export default function PassesScreen() {
  const { token } = useAuth();
  const [pass, setPass] = useState<CreatePassResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let active = true;
    if (!token) {
      setPass(null);
      setLoading(false);
      return () => {
        active = false;
      };
    }
    setLoading(true);
    setError(null);
    getMyPass()
      .then((data) => {
        if (active) setPass(data);
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

  const walletUrl = pass?.walletUrl ?? pass?.passUrl;

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
            <SectionTitle title="Light Rail Membership" subtitle="One card, every participating business." />
            <View style={{ backgroundColor: '#0B1F3A', borderRadius: 16, padding: 20, gap: 6, alignItems: 'center' }}>
              <Text style={{ color: '#8FB2D9', fontSize: 12, letterSpacing: 1 }}>MEMBER BARCODE</Text>
              <Image source={{ uri: barcodeUrl(pass.pass.barcodeValue) }} style={{ width: 320, height: 120, borderRadius: 8 }} resizeMode="contain" />
              <Text selectable style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 }}>
                {pass.pass.barcodeValue}
              </Text>
            </View>
            <Text style={{ color: '#52617a' }}>
              Show this barcode at any participating business. Staff scan it and your member discount is applied.
            </Text>

            {walletUrl ? (
              <AppButton onPress={() => void Linking.openURL(walletUrl)}>Add to Wallet</AppButton>
            ) : (
              <Link href="/pass/setup" asChild>
                <AppButton variant="secondary">Set up wallet pass</AppButton>
              </Link>
            )}

            <Link href="/(tabs)/vendors" asChild>
              <AppButton variant="secondary">See participating businesses</AppButton>
            </Link>
          </Card>
        ) : null}

        {token && !loading && !pass && !error ? (
          <Card>
            <SectionTitle title="Set up your card" subtitle="Get your all-in-one membership pass." />
            <Link href="/pass/setup" asChild>
              <AppButton>Set up membership pass</AppButton>
            </Link>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
