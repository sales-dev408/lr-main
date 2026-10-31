import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import MapView, { Marker, type Region } from '@/components/MapView';
import { Card, Screen, SectionTitle } from '@/components/Ui';
import { DOWNTOWN_LOCATIONS, DOWNTOWN_STOPS, type MapLocation } from '@/lib/allstar';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';

const DOWNTOWN: Region = {
  latitude: 33.4495,
  longitude: -112.0715,
  latitudeDelta: 0.022,
  longitudeDelta: 0.022,
};

const VENUE_COLOR = '#e56020';
const STOP_COLOR = '#1d1160';

function regionFor(loc: MapLocation): Region {
  return { latitude: loc.latitude, longitude: loc.longitude, latitudeDelta: 0.008, longitudeDelta: 0.008 };
}

export default function DowntownMapScreen() {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  const [region, setRegion] = useState<Region | undefined>();
  const [selected, setSelected] = useState<string>('arena');

  function focus(loc: MapLocation) {
    setSelected(loc.key);
    setRegion(regionFor(loc));
  }

  return (
    <Screen accessibilityLabel="Downtown Phoenix All-Star map">
      <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 32, paddingTop: 4 }}>
        <Card>
          <SectionTitle
            title="Downtown Phoenix"
            subtitle="All-Star venues in orange • light rail stops in purple"
          />
          <View style={{ height: 320, borderRadius: 16, overflow: 'hidden' }}>
            <MapView
              style={{ flex: 1 }}
              initialRegion={DOWNTOWN}
              region={region}
              showsUserLocation
            >
              {DOWNTOWN_LOCATIONS.map((loc) => (
                <Marker
                  key={loc.key}
                  coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
                  title={loc.title}
                  description={loc.blurb}
                  color={VENUE_COLOR}
                  onPress={() => focus(loc)}
                />
              ))}
              {DOWNTOWN_STOPS.map((stop) => (
                <Marker
                  key={stop.key}
                  coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
                  title={stop.title}
                  color={STOP_COLOR}
                  onPress={() => focus(stop)}
                />
              ))}
            </MapView>
          </View>
        </Card>

        <Card>
          <SectionTitle title="Where to be" subtitle="Tap a spot to see it on the map" />
          {DOWNTOWN_LOCATIONS.map((loc) => {
            const active = selected === loc.key;
            return (
              <Pressable
                key={loc.key}
                onPress={() => focus(loc)}
                accessibilityRole="button"
                accessibilityLabel={loc.title}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    gap: 12,
                    alignItems: 'flex-start',
                    borderWidth: 1,
                    borderColor: active ? colors.accent : colors.border,
                    backgroundColor: active ? colors.brandSoft : colors.panel,
                    borderRadius: 14,
                    padding: 12,
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    marginTop: 5,
                    backgroundColor: VENUE_COLOR,
                  }}
                />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ color: colors.ink, fontSize: 15 * effectiveScale, fontWeight: '800' }} allowFontScaling={false}>
                    {loc.title}
                  </Text>
                  {loc.blurb ? (
                    <Text style={{ color: colors.muted, fontSize: 13 * effectiveScale, lineHeight: 18 * effectiveScale }} allowFontScaling={false}>
                      {loc.blurb}
                    </Text>
                  ) : null}
                  {loc.rail ? (
                    <Text style={{ color: colors.brand, fontSize: 12 * effectiveScale, fontWeight: '700' }} allowFontScaling={false}>
                      {'🚈'} {loc.rail}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </Card>

        <Card>
          <SectionTitle title="Rail stops downtown" subtitle="Purple pins on the map" />
          {DOWNTOWN_STOPS.map((stop) => (
            <Pressable
              key={stop.key}
              onPress={() => focus(stop)}
              accessibilityRole="button"
              accessibilityLabel={stop.title}
              style={({ pressed }) => [
                { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
                pressed && { opacity: 0.7 },
              ]}
            >
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: STOP_COLOR }} />
              <Text style={{ color: colors.ink, fontSize: 14 * effectiveScale, fontWeight: '600' }} allowFontScaling={false}>
                {stop.title}
              </Text>
            </Pressable>
          ))}
          <Text style={{ color: colors.subtle, fontSize: 12 * effectiveScale }} allowFontScaling={false}>
            A Line runs along Washington St (westbound) and Jefferson St (eastbound); the B Line runs along
            Central Ave and 1st Ave through the Downtown Hub.
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}
