import { useCallback, useRef, useState } from 'react';
import { Image, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Link, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { AppButton, Banner, Card, FieldInput, Pill, Screen, SectionTitle, Spinner } from '@/components/Ui';
import { affirmRedemptionToken, createRedemptionToken, type RedemptionToken } from '@/lib/api';
import { recordLocalRedemption } from '@/lib/localStats';
import { useAuth } from '@/lib/auth';
import { qrCodeUrl } from '@/lib/qr';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';

function CheckMark({ effectiveScale }: { effectiveScale: number }) {
  const size = 72 * effectiveScale;
  return (
    <View style={{ alignSelf: 'center', width: size, height: size, borderRadius: size / 2, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: 40 * effectiveScale, fontWeight: '800' }} allowFontScaling={false}>✓</Text>
    </View>
  );
}

export default function DiscountScreen() {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  const { width } = useWindowDimensions();
  const { vendorId } = useLocalSearchParams<{ vendorId?: string }>();
  const auth = useAuth();

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
          // Anonymous discount tracking: when signed in the backend records
          // this against the member account; without an account we track it
          // on-device so My Stats keeps working.
          if (!auth.token) {
            void recordLocalRedemption({ id: vendorId, name: data.vendorName }).catch(() => undefined);
          }
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
    }, [vendorId, auth.token]),
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
      } else {
        setError(result.discountLabel || 'The vendor was unable to apply the discount.');
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
        {error && !auth.token ? (
          <Link href="/auth" asChild>
            <AppButton>Sign In / Create Account</AppButton>
          </Link>
        ) : null}

        {approved ? (
          <Card>
            <CheckMark effectiveScale={effectiveScale} />
            <SectionTitle title="Membership Accepted" subtitle="Show this screen to the vendor." />
            <Text style={{ color: colors.ink2, textAlign: 'center', fontSize: 16 * effectiveScale, lineHeight: 22 * effectiveScale }} allowFontScaling={false}>
              Light Rail Deals Membership Accepted, apply <Text style={{ fontWeight: '700', color: colors.ink }} allowFontScaling={false}>{approvedLabel}</Text> to bill.
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
                  <Text style={{ color: colors.ink, textAlign: 'center', fontSize: 14 * effectiveScale, lineHeight: 20 * effectiveScale }} allowFontScaling={false}>{token.discountDescription}</Text>
                ) : null}
                <Text style={{ color: colors.muted, fontSize: 8 * effectiveScale, lineHeight: 12 * effectiveScale, textAlign: 'center' }} allowFontScaling={false}>
                  {token.terms}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 * effectiveScale }} allowFontScaling={false}>Expires in 5 minutes</Text>
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
