import { View } from 'react-native';
import { Link } from 'expo-router';
import { AppButton, BrandHeader, Card, Screen, SectionTitle } from '@/components/Ui';

export default function MoreScreen() {
  return (
    <Screen>
      <View style={{ gap: 14, paddingBottom: 12 }}>
        <BrandHeader subtitle="More to explore" />
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 12 }}>
        <View style={{ width: '100%', maxWidth: 360, gap: 18 }}>
          <SectionTitle title="More" subtitle="Everything else, in one place" />
          <Card>
            <View style={{ gap: 12, alignItems: 'center' }}>
              <Link href="/(tabs)/apartments" asChild>
                <AppButton style={{ width: '100%' }}>Apartments & hotels</AppButton>
              </Link>
              <Link href="/(tabs)/az-events" asChild>
                <AppButton style={{ width: '100%' }}>Events Around Arizona</AppButton>
              </Link>
              <Link href="/(tabs)/sports" asChild>
                <AppButton style={{ width: '100%' }}>Sports</AppButton>
              </Link>
              <Link href="/(tabs)/discover" asChild>
                <AppButton style={{ width: '100%' }}>Discover</AppButton>
              </Link>
              <Link href="/(tabs)/live" asChild>
                <AppButton style={{ width: '100%' }}>Train schedule</AppButton>
              </Link>
            </View>
          </Card>
        </View>
      </View>
    </Screen>
  );
}
