import { ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { AppButton, Card, Screen, SectionTitle } from '@/components/Ui';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';

// Overflow tab — housing and local services that aren't core to the All-Star
// weekend experience live here so the main nav stays visitor-focused.
const SECTIONS: { label: string; blurb: string; emoji: string; href: `/${string}` }[] = [
  { label: 'Apartments', blurb: 'Apartments along the light rail', emoji: '🏢', href: '/apartments' },
  { label: 'Real Estate', blurb: 'Valley real estate near transit', emoji: '🏘', href: '/real-estate' },
  { label: 'Services', blurb: 'Banks, auto, legal, health and more', emoji: '🛠', href: '/services' },
];

export default function MoreScreen() {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();

  return (
    <Screen accessibilityLabel="More sections">
      <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 32, paddingTop: 4 }}>
        <Card>
          <SectionTitle title="More" subtitle="Housing and local services" />
          {SECTIONS.map((section) => (
            <View key={section.label} style={{ gap: 4 }}>
              <Link href={section.href as never} asChild>
                <AppButton variant="secondary" style={{ justifyContent: 'flex-start' }}>
                  <Text style={{ fontSize: 16 * effectiveScale }} allowFontScaling={false}>
                    {section.emoji}{' '}
                    <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 14 * effectiveScale }} allowFontScaling={false}>
                      {section.label}
                    </Text>
                  </Text>
                </AppButton>
              </Link>
              <Text style={{ color: colors.muted, fontSize: 12 * effectiveScale, marginLeft: 4 }} allowFontScaling={false}>
                {section.blurb}
              </Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </Screen>
  );
}
