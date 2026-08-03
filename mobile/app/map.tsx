import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Platform, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { AppButton, Banner, BrandHeader, Card, Pill, Screen, SectionTitle, Spinner } from '@/components/Ui';
import { listVendors } from '@/lib/api';
import type { VendorListItem } from '@/lib/types';

const CATEGORIES = ['All', 'Sports', 'Dining', 'Entertainment'] as const;

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function initialRegion(vendors: VendorListItem[]): Region {
  const withCoords = vendors.filter((v) => v.latitude != null && v.longitude != null);
  if (withCoords.length === 0) {
    return { latitude: 33.45, longitude: -112.07, latitudeDelta: 0.5, longitudeDelta: 0.5 };
  }
  const first = withCoords[0];
  return {
    latitude: first.latitude!,
    longitude: first.longitude!,
    latitudeDelta: 0.2,
    longitudeDelta: 0.2,
  };
}

export default function MapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>(
    CATEGORIES.includes(params.category as (typeof CATEGORIES)[number]) ? (params.category as (typeof CATEGORIES)[number]) : 'All',
  );
  const [vendors, setVendors] = useState<VendorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [region, setRegion] = useState<Region | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await listVendors({ category: category === 'All' ? undefined : category });
      setVendors(data);
      if (!region) setRegion(initialRegion(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load vendors');
    }
  }, [category, region]);

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

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const current = await Location.getCurrentPositionAsync({});
      setLocation(current);
      if (!region) {
        setRegion({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        });
      }
    })();
  }, [region]);

  const filtered = useMemo(() => {
    if (!location) return vendors;
    return vendors
      .filter((v) => v.latitude != null && v.longitude != null)
      .sort(
        (a, b) =>
          distanceKm(location.coords.latitude, location.coords.longitude, a.latitude!, a.longitude!) -
          distanceKm(location.coords.latitude, location.coords.longitude, b.latitude!, b.longitude!),
      );
  }, [vendors, location]);

  const isWeb = Platform.OS === 'web';

  return (
    <Screen>
      <View style={{ flex: 1, paddingBottom: 16 }}>
        <BrandHeader subtitle="Find participating businesses near you" />
        {loading ? <Spinner /> : null}
        {error ? <Banner tone="error">{error}</Banner> : null}

        {!loading && (
          <Card>
            <SectionTitle title="Filter" />
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {CATEGORIES.map((value) => (
                <AppButton key={value} variant={category === value ? 'primary' : 'secondary'} onPress={() => setCategory(value)}>
                  {value}
                </AppButton>
              ))}
            </View>
          </Card>
        )}

        {!loading && filtered.length === 0 ? (
          <Banner tone="info">No mapped vendors found. Make sure vendors have latitude and longitude set.</Banner>
        ) : null}

        {!isWeb && region ? (
          <MapView
            style={{ flex: 1, borderRadius: 16, marginTop: 14 }}
            initialRegion={region}
            showsUserLocation
            onRegionChangeComplete={setRegion}
          >
            {filtered.map(
              (vendor) =>
                vendor.latitude != null &&
                vendor.longitude != null && (
                  <Marker
                    key={vendor.id}
                    coordinate={{ latitude: vendor.latitude, longitude: vendor.longitude }}
                    title={vendor.name}
                    description={vendor.discount.label}
                  />
                ),
            )}
          </MapView>
        ) : null}

        {isWeb && !loading ? (
          <Banner tone="info">Map view is available in the iOS/Android app. Nearby vendors are listed below.</Banner>
        ) : null}

        {!loading ? (
          <ScrollView style={{ marginTop: 14 }} contentContainerStyle={{ gap: 10 }}>
            {filtered.slice(0, 20).map((vendor) => (
              <Card key={vendor.id}>
                <SectionTitle title={vendor.name} subtitle={vendor.category ?? undefined} />
                <Pill tone="success">{vendor.discount.label}</Pill>
                {vendor.address ? <Text style={{ color: '#52617a' }}>{vendor.address}</Text> : null}
                {vendor.latitude != null && vendor.longitude != null ? (
                  <AppButton
                    variant="secondary"
                    onPress={() => void Linking.openURL(`https://maps.google.com/?q=${vendor.latitude},${vendor.longitude}`)}
                  >
                    Open in Maps
                  </AppButton>
                ) : null}
              </Card>
            ))}
          </ScrollView>
        ) : null}

        <AppButton variant="secondary" onPress={() => router.back()}>
          Back to vendors
        </AppButton>
      </View>
    </Screen>
  );
}
