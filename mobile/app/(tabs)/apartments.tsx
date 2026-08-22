import { useCallback, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppButton, Banner, BrandHeader, Card, FieldInput, Pill, Screen, SectionTitle, Spinner } from '@/components/Ui';
import { listApartments } from '@/lib/api';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';
import MapView, { Marker, type Region } from '@/components/MapView';
import { StopPicker } from '@/components/StopPicker';
import { compareStops } from '@/lib/stops';
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
  const [search, setSearch] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const stationOffsets = useRef<Map<string, number>>(new Map());

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await listApartments();
      setApartments(data);
      setRegion((prev) => prev ?? initialRegion(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load apartments');
    }
  }, []);

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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return apartments;
    return apartments.filter((a) => {
      const hay = [a.name, a.station, a.address, a.city, a.section].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(term);
    });
  }, [apartments, search]);

  const grouped = useMemo(() => {
    const groups = new Map<string, ApartmentRecord[]>();
    for (const a of filtered) {
      const key = a.station?.trim() || a.section?.trim() || 'Other';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(a);
    }
    for (const arr of groups.values()) {
      arr.sort((a, b) => {
        const ad = a.distanceMiles ?? Infinity;
        const bd = b.distanceMiles ?? Infinity;
        if (ad !== bd) return ad - bd;
        return a.name.localeCompare(b.name);
      });
    }
    return new Map([...groups.entries()].sort((a, b) => compareStops(a[0], b[0])));
  }, [filtered]);

  const stopEntries = useMemo(
    () =>
      Array.from(grouped.entries()).map(([station, items]) => ({
        stop: station,
        count: items.length,
        city: items[0]?.city ?? null,
      })),
    [grouped],
  );

  const jumpToStation = useCallback((station: string) => {
    const offset = stationOffsets.current.get(station);
    if (offset != null) {
      scrollRef.current?.scrollTo({ y: Math.max(offset - 8, 0), animated: true });
    }
  }, []);

  const mapped = useMemo(() => filtered.filter((a) => a.latitude != null && a.longitude != null), [filtered]);

  const selected = useMemo(() => apartments.find((a) => a.id === selectedId) ?? null, [apartments, selectedId]);

  function selectApartment(id: string) {
    const apt = apartments.find((a) => a.id === id);
    setSelectedId(id);
    if (apt?.latitude != null && apt?.longitude != null) {
      setRegion({ latitude: apt.latitude, longitude: apt.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 });
    }
  }

  return (
    <Screen>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ gap: 14, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
      >
        <BrandHeader subtitle="Apartments & hotels within 1/2 mile of the light rail" />

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

        <Card>
          <SectionTitle title="Find a place" subtitle="Search by name, stop, or address" />
          <FieldInput placeholder="Search…" value={search} onChangeText={setSearch} />
          <StopPicker entries={stopEntries} onSelect={jumpToStation} label="Jump to a stop" itemNoun="listing" />
        </Card>

        {Array.from(grouped.entries()).map(([station, items]) => (
          <View
            key={station}
            onLayout={(event) => stationOffsets.current.set(station, event.nativeEvent.layout.y)}
          >
            <SectionTitle title={station} subtitle={`${items.length} listing${items.length === 1 ? '' : 's'}`} />
            <Card>
              <View style={{ gap: 10 }}>
                {items.map((apt) => {
                  const active = apt.id === selectedId;
                  return (
                    <Pressable
                      key={apt.id}
                      onPress={() => selectApartment(apt.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: active ? colors.brand : colors.border,
                        backgroundColor: active ? colors.brand + '12' : colors.panel,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 15 * effectiveScale }} allowFontScaling={false}>
                          {apt.name}
                        </Text>
                        {active ? <Pill tone="success">On map</Pill> : null}
                      </View>
                      {apt.distanceMiles != null ? (
                        <Text style={{ color: colors.muted, fontSize: 12 * effectiveScale, marginTop: 2 }} allowFontScaling={false}>
                          {apt.distanceMiles.toFixed(2)} miles from rail
                        </Text>
                      ) : null}
                      {apt.address ? (
                        <Text style={{ color: colors.muted, fontSize: 13 * effectiveScale, marginTop: 2 }} allowFontScaling={false}>
                          {[apt.address, apt.city].filter(Boolean).join(', ')}
                        </Text>
                      ) : null}
                      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                        {apt.address ? (
                          <Pill tone="neutral">Directions</Pill>
                        ) : null}
                        {apt.website ? (
                          <Pill tone="neutral">Website</Pill>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          </View>
        ))}

        {selected ? (
          <Card>
            <SectionTitle title={selected.name} subtitle={selected.station ?? selected.section ?? undefined} />
            {selected.distanceMiles != null ? (
              <Text style={{ color: colors.muted, fontSize: 14 * effectiveScale }} allowFontScaling={false}>
                {selected.distanceMiles.toFixed(2)} miles from the light rail
              </Text>
            ) : null}
            {selected.address ? (
              <Text style={{ color: colors.muted, fontSize: 14 * effectiveScale }} allowFontScaling={false}>
                {[selected.address, selected.city].filter(Boolean).join(', ')}
              </Text>
            ) : null}
            {selected.phone ? (
              <Text style={{ color: colors.muted, fontSize: 14 * effectiveScale }} allowFontScaling={false}>
                {selected.phone}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {selected.address ? (
                <AppButton
                  variant="secondary"
                  onPress={() =>
                    void Linking.openURL(
                      Platform.select({
                        ios: `maps:?q=${encodeURIComponent(selected.address!)}`,
                        android: `geo:0,0?q=${encodeURIComponent(selected.address!)}`,
                        default: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.address!)}`,
                      }) ?? '',
                    )
                  }
                >
                  Get directions
                </AppButton>
              ) : null}
              {selected.website ? (
                <AppButton variant="secondary" onPress={() => void Linking.openURL(selected.website!)}>
                  Visit website
                </AppButton>
              ) : null}
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
