import { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppButton, Card, Screen, SectionTitle } from '@/components/Ui';
import { useLegalAcceptance } from '@/lib/legalAcceptance';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';
import { EULA_URL, PRIVACY_URL, TERMS_URL } from '@/lib/theme';

function LegalLink({ url, children }: { url: string; children: string }) {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  return (
    <Text
      onPress={() => void Linking.openURL(url)}
      accessibilityRole="link"
      style={{ color: colors.brand, textDecorationLine: 'underline', fontSize: 14 * effectiveScale }}
      allowFontScaling={false}
    >
      {children}
    </Text>
  );
}

// First-run gate: the app is fully usable without an account, but every user
// must accept the legal documents once. Acceptance is persisted and the screen
// is never shown again.
export default function LegalScreen() {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  const router = useRouter();
  const legal = useLegalAcceptance();
  const [checked, setChecked] = useState({ terms: false, privacy: false, eula: false });
  const allChecked = checked.terms && checked.privacy && checked.eula;
  const boxSize = 24 * effectiveScale;

  function toggle(key: keyof typeof checked) {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function continueToApp() {
    await legal.accept();
    router.replace('/(tabs)');
  }

  const rows: { key: keyof typeof checked; label: string; url: string; doc: string }[] = [
    { key: 'terms', label: 'I agree to the', url: TERMS_URL, doc: 'Terms of Use' },
    { key: 'privacy', label: 'I have read and agree to the', url: PRIVACY_URL, doc: 'Privacy Policy' },
    { key: 'eula', label: 'I agree to the', url: EULA_URL, doc: 'End User License Agreement' },
  ];

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', gap: 20, paddingVertical: 24 }}>
        <View style={{ alignItems: 'center', gap: 14 }}>
          <Image source={require('@/assets/images/logo.png')} style={{ width: 96, height: 96 }} resizeMode="contain" />
          <Text style={{ fontSize: 26 * effectiveScale, fontWeight: '800', color: colors.ink, textAlign: 'center' }} allowFontScaling={false}>
            Welcome to Light Rail Deals
          </Text>
          <Text style={{ fontSize: 15 * effectiveScale, color: colors.muted, textAlign: 'center', lineHeight: 22 * effectiveScale, maxWidth: 320 }} allowFontScaling={false}>
            Your guide to the Valley Metro — deals, dining, events, hotels, and train times along the light rail.
          </Text>
        </View>

        <Card>
          <SectionTitle title="Before you continue" subtitle="Please review and accept each document" />
          {rows.map((row) => (
            <Pressable
              key={row.key}
              onPress={() => toggle(row.key)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: checked[row.key] }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}
            >
              <View
                style={{
                  width: boxSize,
                  height: boxSize,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: colors.brand,
                  backgroundColor: checked[row.key] ? colors.brand : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {checked[row.key] ? (
                  <Text style={{ color: '#fff', fontSize: 14 * effectiveScale, fontWeight: '800' }} allowFontScaling={false}>✓</Text>
                ) : null}
              </View>
              <Text style={{ flex: 1, color: colors.ink, fontSize: 14 * effectiveScale, lineHeight: 20 * effectiveScale }} allowFontScaling={false}>
                {row.label} <LegalLink url={row.url}>{row.doc}</LegalLink>
              </Text>
            </Pressable>
          ))}
          <AppButton onPress={() => void continueToApp()} disabled={!allChecked} accessibilityHint="Accept all documents to enter the app">
            Accept & continue
          </AppButton>
          <Text style={{ color: colors.muted, fontSize: 12 * effectiveScale, textAlign: 'center', lineHeight: 17 * effectiveScale }} allowFontScaling={false}>
            No account needed — you can browse the whole app right away. Creating an account later unlocks favorites and member-exclusive deals.
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}
