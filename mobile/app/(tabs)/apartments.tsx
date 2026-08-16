import { useCallback, useMemo, useState } from 'react';
import { Linking, Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppButton, Banner, BrandHeader, Card, Pill, Screen, SectionTitle, Spinner } from '@/components/Ui';
import { listApartments } from '@/lib/api';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';
import MapView, { Marker, type Region } from '@/components/MapView';
import type { ApartmentRecord } from '@/lib/types';

function initialRegion(apartments: ApartmentRecord[]): Region {
  const withCoords = apartments.filter((a) => a.latitude != null && a.longitude != null);
  if (withCoords.length === 0) {
    return { latitude: 33.45, longitude: -112.07, latitudeDelta: 0.5, longitudeDelta: 0.5 };
  }
  const first = withCoords[0];
  return { latitude: first.latitude!, longitude: first.longitude!, latitudeDelta: 0.2, longitudeDelta: 0.2 };
}

export default function ApartmentsScreen() {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  const [apartments, setApartments] = useState<ApartmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await listApartments();
      setApartments(data);
      if (!region) setRegion(initialRegion(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load apartments');
    }
  }, [region]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      void load().finally(() => {
        if (active) setLoading(false);
      });
      return () => {
        active = false;
      };
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const mapped = useMemo(() => apartments.filter((a) => a.latitude != null && a.longitude != null), [apartments]);

  const selected = useMemo(() => apartments.find((a) => a.id === selectedId) ?? null, [apartments, selectedId]);

  function selectApartment(id: string) {
    const apt = apartments.find((a) => a.id === id);
    setSelectedId(id);
    if (apt?.latitude != null && apt?.longitude != null) {
      setRegion({ latitude: apt.latitude, longitude: apt.longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 });
    }
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ gap: 14, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
      >
        <BrandHeader subtitle="Apartments & hotels near the light rail" />

        {region ? (
          <View style={{ height: 280, borderRadius: 16, overflow: 'hidden' }}>
            <MapView
              style={{ flex: 1, borderRadius: 16 }}
              initialRegion={region}
              region={region}
              showsUserLocation
              onRegionChangeComplete={setRegion}
            >
              {mapped.map(
                (apt) =>
                  apt.latitude != null &&
                  apt.longitude != null && (
                    <Marker
                      key={apt.id}
                      coordinate={{ latitude: apt.latitude, longitude: apt.longitude }}
                      title={apt.name}
                      onPress={() => selectApartment(apt.id)}
                    />
                  ),
              )}
            </MapView>
          </View>
        ) : null}

        {loading ? <Spinner /> : null}
        {error ? <Banner tone="error">{error}</Banner> : null}
        {!loading && apartments.length === 0 ? <Banner tone="info">No apartments or hotels listed yet.</Banner> : null}

        {apartments.length > 0 ? (
          <Card>
            <SectionTitle title="Listings" subtitle={`${apartments.length} place${apartments.length === 1 ? '' : 's'}`} />
            <View style={{ gap: 10 }}>
              {apartments.map((apt) => {
                const active = apt.id === selectedId;
                return (
                  <View key={apt.id} style={{ borderWidth: 1, borderColor: active ? colors.brand : colors.border, borderRadius: 14, padding: 12, gap: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 16 * effectiveScale }} allowFontScaling={false}>
                        {apt.name}
                      </Text>
                      {active ? <Pill tone="success">On map</Pill> : null}
                    </View>
                    {apt.station ? <Text style={{ color: colors.muted, fontSize: 13 * effectiveScale }} allowFontScaling={false}>Near {apt.station}</Text> : null}
                    {apt.address ? <Text style={{ color: colors.muted, fontSize: 13 * effectiveScale }} allowFontScaling={false}>{[apt.address, apt.city].filter(Boolean).join(', ')}</Text> : null}
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                      <AppButton variant={active ? 'primary' : 'secondary'} onPress={() => selectApartment(apt.id)} style={{ flex: 1 }}>
                        Show on map
                      </AppButton>
                      {apt.address ? (
                        <AppButton
                          variant="secondary"
                          onPress={() =>
                            void Linking.openURL(
                              Platform.select({
                                ios: `maps:?q=${encodeURIComponent(apt.address!)}`,
                                android: `geo:0,0?q=${encodeURIComponent(apt.address!)}`,
                                default: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(apt.address!)}`,
                              }) ?? '',
                            )
                          }
                        >
                          Directions
                        </AppButton>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        ) : null}

        {selected ? (
          <Card>
            <SectionTitle title={selected.name} subtitle={selected.station ?? undefined} />
            {selected.phone ? <Text style={{ color: colors.muted, fontSize: 14 * effectiveScale }} allowFontScaling={false}>{selected.phone}</Text> : null}
            {selected.website ? <AppButton variant="secondary" onPress={() => void Linking.openURL(selected.website!)}>Visit website</AppButton> : null}
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
