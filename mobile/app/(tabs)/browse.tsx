import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Linking, Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { AppButton, Banner, BrandHeader, Card, FieldInput, Pill, Screen, SectionTitle, Spinner } from '@/components/Ui';
import { listVendors } from '@/lib/api';
import { barcodeUrl } from '@/lib/qr';
import { shareDeal } from '@/lib/share';
import { useThemeColors } from '@/lib/useThemeColors';
import MapView, { Marker, type Region } from '@/components/MapView';
import type { VendorListItem } from '@/lib/types';

const CATEGORIES = ['All', 'Sports', 'Dining', 'Entertainment'] as const;

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function formatTimeRemaining(endsAt: string | null): string | null {
  if (!endsAt) return null;
  const end = new Date(endsAt).getTime();
  const now = Date.now();
  const diff = end - now;
  if (diff <= 0) return 'Ended';
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h left`;
  }
  return `${hours}h ${minutes}m left`;
}

function initialRegion(vendors: VendorListItem[]): Region {
  const withCoords = vendors.filter((v) => v.latitude != null && v.longitude != null);
  if (withCoords.length === 0) {
    return { latitude: 33.45, longitude: -112.07, latitudeDelta: 0.5, longitudeDelta: 0.5 };
  }
  const first = withCoords[0];
  return { latitude: first.latitude!, longitude: first.longitude!, latitudeDelta: 0.2, longitudeDelta: 0.2 };
}

export default function BrowseScreen() {
  const colors = useThemeColors();
  const [vendors, setVendors] = useState<VendorListItem[]>([]);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [region, setRegion] = useState<Region | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await listVendors({ category: category === 'All' ? undefined : category });
      setVendors(data);
      setSelectedId((prev) => (prev && data.some((v) => v.id === prev) ? prev : data[0]?.id ?? null));
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
      const interval = setInterval(() => {
        if (active) void load();
      }, 30000);
      return () => {
        active = false;
        clearInterval(interval);
      };
    }, [load]),
  );

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      if (status !== 'granted') return;
      const current = await Location.getCurrentPositionAsync({});
      setLocation(current);
      setRegion({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        latitudeDelta: 0.12,
        longitudeDelta: 0.12,
      });
    })();
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const filteredVendors = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term
      ? vendors.filter((v) => v.name.toLowerCase().includes(term) || (v.category ?? '').toLowerCase().includes(term))
      : vendors;
  }, [vendors, search]);

  const sortedVendors = useMemo(() => {
    if (!location) return filteredVendors;
    return filteredVendors
      .filter((v) => v.latitude != null && v.longitude != null)
      .sort(
        (a, b) =>
          distanceKm(location.coords.latitude, location.coords.longitude, a.latitude!, a.longitude!) -
          distanceKm(location.coords.latitude, location.coords.longitude, b.latitude!, b.longitude!),
      );
  }, [filteredVendors, location]);

  const selected = useMemo(() => sortedVendors.find((v) => v.id === selectedId) ?? filteredVendors.find((v) => v.id === selectedId) ?? null, [filteredVendors, selectedId, sortedVendors]);

  const mappedVendors = useMemo(() => {
    return sortedVendors.length > 0 ? sortedVendors : filteredVendors;
  }, [filteredVendors, sortedVendors]);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ gap: 14, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
      >
        <BrandHeader subtitle="Browse discounts & participating businesses" />

        <Card>
          <SectionTitle title="Browse by type" subtitle="Filter participating businesses by category" />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {CATEGORIES.map((value) => (
              <AppButton key={value} variant={category === value ? 'primary' : 'secondary'} onPress={() => setCategory(value)}>
                {value}
              </AppButton>
            ))}
          </View>
          <FieldInput placeholder="Search vendors…" value={search} onChangeText={setSearch} />
          {locationPermission === false ? (
            <Banner tone="info">Location permission denied. Enable it in settings to see nearby shops sorted by distance.</Banner>
          ) : null}
        </Card>

        {Platform.OS !== 'web' && region ? (
          <View style={{ height: 280, borderRadius: 16, overflow: 'hidden' }}>
            <MapView
              style={{ flex: 1, borderRadius: 16 }}
              initialRegion={region}
              region={region}
              showsUserLocation
              onRegionChangeComplete={setRegion}
            >
              {mappedVendors.map(
                (vendor) =>
                  vendor.latitude != null &&
                  vendor.longitude != null && (
                    <Marker
                      key={vendor.id}
                      coordinate={{ latitude: vendor.latitude, longitude: vendor.longitude }}
                      title={vendor.name}
                      description={vendor.discount.label}
                      onPress={() => setSelectedId(vendor.id)}
                    />
                  ),
              )}
            </MapView>
          </View>
        ) : Platform.OS === 'web' ? (
          <Banner tone="info">Map view is available in the iOS/Android app. Nearby vendors are listed below.</Banner>
        ) : null}

        {loading ? <Spinner /> : null}
        {error ? <Banner tone="error">{error}</Banner> : null}
        {!loading && vendors.length === 0 ? <Banner tone="info">No vendors available yet.</Banner> : null}

        {filteredVendors.length > 0 ? (
          <Card>
            <SectionTitle title="Participating businesses" subtitle={search ? `${filteredVendors.length} match${filteredVendors.length === 1 ? '' : 'es'}` : 'Tap to select'} />
            <View style={{ gap: 8 }}>
              {filteredVendors.map((vendor) => {
                const active = vendor.id === selectedId;
                const remaining = formatTimeRemaining(vendor.endsAt);
                const dist = location && vendor.latitude != null && vendor.longitude != null
                  ? distanceKm(location.coords.latitude, location.coords.longitude, vendor.latitude, vendor.longitude)
                  : null;
                return (
                  <AppButton key={vendor.id} variant={active ? 'primary' : 'secondary'} onPress={() => setSelectedId(vendor.id)}>
                    {vendor.boosted ? 'Flash: ' : ''}{vendor.name} · {vendor.discount.label}
                    {remaining ? ` · ${remaining}` : ''}
                    {dist != null ? ` · ${formatDistance(dist)}` : ''}
                  </AppButton>
                );
              })}
            </View>
          </Card>
        ) : null}

        {selected ? (
          <Card>
            {selected.logoUrl || selected.iconUrl ? (
              <Image
                source={{ uri: selected.logoUrl ?? selected.iconUrl ?? undefined }}
                style={{ width: '100%', height: 140, borderRadius: 16, backgroundColor: '#dfe7f3' }}
                resizeMode="contain"
              />
            ) : null}
            <SectionTitle title={selected.name} subtitle={selected.category ?? undefined} />
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Pill tone="success">{selected.discount.label}</Pill>
              {selected.boosted ? <Pill tone="warning">Flash deal</Pill> : null}
              {formatTimeRemaining(selected.endsAt) ? <Pill tone="neutral">{formatTimeRemaining(selected.endsAt)}</Pill> : null}
            </View>
            {selected.address ? <Text style={{ color: colors.muted }}>{selected.address}</Text> : null}

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
            <Link href="/(tabs)/mypass" asChild>
              <AppButton variant="secondary">Open my membership pass</AppButton>
            </Link>
            <AppButton variant="secondary" onPress={() => void shareDeal(selected)}>
              Share this deal
            </AppButton>

            {selected.discountCode ? (
              <View style={{ alignItems: 'center', gap: 8 }}>
                <Image
                  source={{ uri: barcodeUrl(selected.discountCode, 320, 120) }}
                  style={{ width: '100%', maxWidth: 320, height: 120, borderRadius: 8, backgroundColor: '#fff' }}
                  resizeMode="contain"
                />
                <Text selectable style={{ color: colors.ink, fontWeight: '700', letterSpacing: 0.5 }}>
                  {selected.discountCode}
                </Text>
              </View>
            ) : null}
            <Link href="/(tabs)/scan" asChild>
              <AppButton>Scan this vendor&apos;s discount code</AppButton>
            </Link>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
