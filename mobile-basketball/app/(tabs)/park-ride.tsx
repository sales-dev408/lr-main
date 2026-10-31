import { ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { AppButton, Card, Screen, SectionTitle } from '@/components/Ui';
import { PARK_AND_RIDE } from '@/lib/allstar';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';

export default function ParkRideScreen() {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  const lines = ['A Line', 'B Line'];

  return (
    <Screen accessibilityLabel="Park and ride guide">
      <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 32, paddingTop: 4 }}>
        <Card>
          <SectionTitle title="Park & ride to All-Star" subtitle="Free station lots — leave the car, beat the traffic" />
          <Text style={{ color: colors.muted, fontSize: 14 * effectiveScale, lineHeight: 20 * effectiveScale }} allowFontScaling={false}>
            Valley Metro&apos;s station lots are free and unattended. On event nights they fill early — arrive with
            time to spare, ride in, and skip downtown parking entirely.
          </Text>
        </Card>

        {lines.map((line) => (
          <Card key={line}>
            <SectionTitle
              title={line === 'A Line' ? 'A Line — East Valley' : 'B Line — North & South Phoenix'}
              subtitle={line === 'A Line' ? 'Mesa, Tempe, Chandler approach' : 'Metrocenter to Baseline on Central'}
            />
            {PARK_AND_RIDE.filter((p) => p.line === line).map((p) => (
              <View
                key={p.name}
                style={{
                  flexDirection: 'row',
                  gap: 12,
                  alignItems: 'flex-start',
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 14,
                  padding: 12,
                }}
              >
                <Text style={{ fontSize: 18 * effectiveScale }} allowFontScaling={false}>
                  {'🅿️'}
                </Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 15 * effectiveScale }} allowFontScaling={false}>
                    {p.name}
                  </Text>
                  <Text style={{ color: colors.brand, fontSize: 12 * effectiveScale, fontWeight: '700' }} allowFontScaling={false}>
                    {p.board}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 13 * effectiveScale }} allowFontScaling={false}>
                    {p.tip}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        ))}

        <Card>
          <SectionTitle title="Then what?" />
          <Link href="/trip-planner" asChild>
            <AppButton>Plan the rail leg</AppButton>
          </Link>
          <Link href="/downtown-map" asChild>
            <AppButton variant="secondary">Downtown venue map</AppButton>
          </Link>
        </Card>
      </ScrollView>
    </Screen>
  );
}
