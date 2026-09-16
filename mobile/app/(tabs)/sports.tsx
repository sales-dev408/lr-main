import { Text, View } from 'react-native';
import { BrandHeader, Card, Screen } from '@/components/Ui';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';

export default function SportsScreen() {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();

  return (
    <Screen>
      <View style={{ gap: 14, paddingBottom: 12 }}>
        <BrandHeader subtitle="Local sports" />
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Card accessibilityLabel="Sports coming soon">
          <View style={{ alignItems: 'center', gap: 10, paddingVertical: 12 }}>
            <Text style={{ fontSize: 42 * effectiveScale }} allowFontScaling={false}>
              🏆
            </Text>
            <Text style={{ color: colors.ink, fontSize: 20 * effectiveScale, fontWeight: '800' }} allowFontScaling={false}>
              Coming soon
            </Text>
            <Text
              style={{ color: colors.muted, fontSize: 14 * effectiveScale, textAlign: 'center' }}
              allowFontScaling={false}
            >
              We&apos;re building something great for local sports. Check back soon!
            </Text>
          </View>
        </Card>
      </View>
    </Screen>
  );
}
