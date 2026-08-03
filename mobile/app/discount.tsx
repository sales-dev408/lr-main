import { useCallback, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { Link, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { AppButton, Banner, Card, Pill, Screen, SectionTitle, Spinner } from '@/components/Ui';
import { getMyPass, lookupDiscountByCode } from '@/lib/api';
import { lookupQrUrl } from '@/lib/passes';
import { useAuth } from '@/lib/auth';
import type { CreatePassResponse, DiscountLookup } from '@/lib/types';
import { theme } from '@/lib/theme';

function CheckMark() {
  return (
    <View style={{ alignSelf: 'center', width: 72, height: 72, borderRadius: 36, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: 40, fontWeight: '800' }}>✓</Text>
    </View>
  );
}

export default function DiscountScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const auth = useAuth();
  const [lookup, setLookup] = useState<DiscountLookup | null>(null);
  const [pass, setPass] = useState<CreatePassResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!code) {
        setLoading(false);
        setError('No QR code scanned.');
        return () => {};
      }
      let active = true;
      setLoading(true);
      setError(null);
      void (async () => {
        try {
          const [discount, passResponse] = await Promise.all([
            lookupDiscountByCode(code),
            auth.token ? getMyPass() : null,
          ]);
          if (!active) return;
          setLookup(discount);
          if (passResponse?.pass) {
            setPass(passResponse);
          }
        } catch (err) {
          if (!active) return;
          setError(err instanceof Error ? err.message : 'Unable to confirm membership');
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [code, auth.token]),
  );

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: 'Discount confirmed' }} />
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
        {loading ? <Spinner /> : null}
        {error ? <Banner tone="error">{error}</Banner> : null}

        {!loading && lookup ? (
          <>
            <Card>
              <CheckMark />
              <SectionTitle title="Membership confirmed" subtitle={`${lookup.cardName}`} />
              <Text style={{ color: theme.ink2, textAlign: 'center' }}>
                You&apos;re a member at <Text style={{ fontWeight: '700', color: theme.ink }}>{lookup.vendorName}</Text>.
              </Text>
              <Pill tone="success">{lookup.discountLabel}</Pill>
              <Text style={{ color: theme.ink2, textAlign: 'center' }}>Show this screen at checkout to redeem your discount.</Text>
            </Card>

            {pass ? (
              <Card>
                <SectionTitle title="Your membership pass" subtitle="Show this QR code if staff asks for it." />
                <View style={{ alignItems: 'center', gap: 8 }}>
                  <Image source={{ uri: lookupQrUrl(pass.pass.lookupToken) }} style={{ width: 240, height: 240, borderRadius: 12, backgroundColor: '#fff' }} resizeMode="contain" />
                  <Text selectable style={{ color: theme.ink, fontWeight: '700', letterSpacing: 1 }}>{pass.pass.lookupToken}</Text>
                </View>
              </Card>
            ) : (
              <Banner tone="info">Sign in to view your membership pass QR code.</Banner>
            )}

            <Link href="/(tabs)/passes" asChild>
              <AppButton>View full membership pass</AppButton>
            </Link>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
