import { useCallback, useRef, useState } from 'react';
import { Image, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { AppButton, Banner, Card, FieldInput, Pill, Screen, SectionTitle, Spinner } from '@/components/Ui';
import { affirmRedemptionToken, createRedemptionToken, type RedemptionToken } from '@/lib/api';
import { qrCodeUrl } from '@/lib/qr';
import { useThemeColors } from '@/lib/useThemeColors';

function CheckMark() {
  return (
    <View style={{ alignSelf: 'center', width: 72, height: 72, borderRadius: 36, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: 40, fontWeight: '800' }}>✓</Text>
    </View>
  );
}

export default function DiscountScreen() {
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const { vendorId } = useLocalSearchParams<{ vendorId?: string }>();

  const [token, setToken] = useState<RedemptionToken | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [affirmationName, setAffirmationName] = useState('');
  const [approved, setApproved] = useState(false);
  const [approvedLabel, setApprovedLabel] = useState('');

  const hasRun = useRef<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!vendorId || hasRun.current === vendorId) return;
      hasRun.current = vendorId;
      let active = true;
      setLoading(true);
      setError(null);
      setToken(null);
      setShowFallback(false);
      setApproved(false);
      void (async () => {
        try {
          const data = await createRedemptionToken(vendorId);
          if (!active) return;
          setToken(data);
        } catch (err) {
          if (!active) return;
          setError(err instanceof Error ? err.message : 'Unable to load discount QR code');
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [vendorId]),
  );

  async function submitAffirmation() {
    if (!token) return;
    const name = affirmationName.trim();
    if (!name) {
      setError('Please sign your name to confirm you used the discount.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await affirmRedemptionToken(token.token, name);
      if (result.ok) {
        setApproved(true);
        setApprovedLabel(result.discountLabel);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to apply discount');
    } finally {
      setLoading(false);
    }
  }

  const qrSize = Math.min(width - 64, 320);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: approved ? 'Discount applied' : 'Discount QR' }} />
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
        {loading ? <Spinner /> : null}
        {error ? <Banner tone="error">{error}</Banner> : null}

        {approved ? (
          <Card>
            <CheckMark />
            <SectionTitle title="Membership Accepted" subtitle="Show this screen to the vendor." />
            <Text style={{ color: colors.ink2, textAlign: 'center' }}>
              Light Rail Deals Membership Accepted, apply <Text style={{ fontWeight: '700', color: colors.ink }}>{approvedLabel}</Text> to bill.
            </Text>
          </Card>
        ) : token ? (
          <>
            <Card>
              <SectionTitle title={token.vendorName} subtitle="Show this QR code so the vendor can apply your discount." />
              <View style={{ alignItems: 'center', gap: 12 }}>
                <Image
                  source={{ uri: qrCodeUrl(token.url, qrSize) }}
                  style={{ width: qrSize, height: qrSize, borderRadius: 16, backgroundColor: '#fff' }}
                  resizeMode="contain"
                />
                <Pill tone="success">{token.discountLabel}</Pill>
                {token.discountDescription ? (
                  <Text style={{ color: colors.ink, textAlign: 'center', fontSize: 14 }}>{token.discountDescription}</Text>
                ) : null}
                <Text style={{ color: colors.muted, fontSize: 8, lineHeight: 12, textAlign: 'center' }}>
                  {token.terms}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Expires in 5 minutes</Text>
              </View>
            </Card>

            {!showFallback ? (
              <AppButton variant="secondary" onPress={() => setShowFallback(true)}>
                QR code can’t be scanned?
              </AppButton>
            ) : (
              <Card>
                <SectionTitle title="Can’t scan?" subtitle="Write your name to affirm you used this discount." />
                <FieldInput
                  placeholder="Your full name"
                  value={affirmationName}
                  onChangeText={setAffirmationName}
                  autoCapitalize="words"
                />
                <AppButton onPress={() => void submitAffirmation()}>Confirm and show approved screen</AppButton>
              </Card>
            )}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
