import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Linking, Platform, Pressable, RefreshControl, ScrollView, Switch, Text, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Link, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { AppButton, Banner, BrandHeader, Card, FieldInput, Pill, Screen, SectionTitle, Spinner } from '@/components/Ui';
import { AdBanner } from '@/components/AdBanner';
import { listVendors } from '@/lib/api';
import { shareDeal } from '@/lib/share';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';
import { useFavorites } from '@/lib/favorites';
import MapView, { Marker, type Region } from '@/components/MapView';
import type { VendorListItem } from '@/lib/types';

const TYPE_OPTIONS = ['All', 'Restaurant', 'Bar', 'Cafe'] as const;

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
  const { effectiveScale } = useDynamicType();
  const { favorites, toggle: toggleFavorite, isFavorite } = useFavorites();
  const [vendors, setVendors] = useState<VendorListItem[]>([]);
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_OPTIONS)[number]>('All');
  const [cuisineFilter, setCuisineFilter] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [sortByFavorites, setSortByFavorites] = useState(false);
  const [collapsedStations, setCollapsedStations] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await listVendors();
      setVendors(data);
      setSelectedId((prev) => (prev && data.some((v) => v.id === prev) ? prev : data[0]?.id ?? null));
      if (!region) setRegion(initialRegion(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load vendors');
    }
  }, [region]);

  async function handleToggleFavorite(id: string) {
    await toggleFavorite(id);
  }

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

  const cuisineOptions = useMemo(() => {
    const set = new Set<string>();
    for (const v of vendors) {
      if (v.cuisine) set.add(v.cuisine);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [vendors]);

  const filteredVendors = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = vendors.filter((v) => {
      if (!term) return true;
      const hay = [v.name, v.cuisine, v.station, v.address, v.city, v.category].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(term);
    });
    if (typeFilter !== 'All') {
      list = list.filter((v) => (v.vendorType ?? '').toLowerCase() === typeFilter.toLowerCase());
    }
    if (cuisineFilter) {
      list = list.filter((v) => (v.cuisine ?? '').toLowerCase() === cuisineFilter.toLowerCase());
    }
    return list;
  }, [vendors, search, typeFilter, cuisineFilter]);

  const groupedVendors = useMemo(() => {
    const groups = new Map<string, VendorListItem[]>();
    for (const v of filteredVendors) {
      const key = v.station?.trim() || 'Other';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(v);
    }
    for (const arr of groups.values()) {
      arr.sort((a, b) => {
        if (a.boosted !== b.boosted) return a.boosted ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    }
    return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  }, [filteredVendors]);

  const sortedVendors = useMemo(() => {
    const list = [...filteredVendors];
    const favoriteSet = new Set(favorites);
    list.sort((a, b) => {
      if (sortByFavorites) {
        const af = favoriteSet.has(a.id) ? -1 : 1;
        const bf = favoriteSet.has(b.id) ? -1 : 1;
        if (af !== bf) return af - bf;
      }
      if (!location) return a.name.localeCompare(b.name);
      const aHasCoords = a.latitude != null && a.longitude != null;
      const bHasCoords = b.latitude != null && b.longitude != null;
      if (aHasCoords && bHasCoords) {
        return (
          distanceKm(location.coords.latitude, location.coords.longitude, a.latitude!, a.longitude!) -
          distanceKm(location.coords.latitude, location.coords.longitude, b.latitude!, b.longitude!)
        );
      }
      if (aHasCoords !== bHasCoords) return aHasCoords ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [filteredVendors, location, sortByFavorites, favorites]);

  const toggleStation = useCallback((station: string) => {
    setCollapsedStations((prev) => {
      const next = new Set(prev);
      if (next.has(station)) next.delete(station);
      else next.add(station);
      return next;
    });
  }, []);

  const expandAllStations = useCallback(() => {
    setCollapsedStations(new Set());
  }, []);

  const collapseAllStations = useCallback(() => {
    setCollapsedStations(new Set(groupedVendors.keys()));
  }, [groupedVendors]);

  const selected = useMemo(
    () => sortedVendors.find((v) => v.id === selectedId) ?? filteredVendors.find((v) => v.id === selectedId) ?? null,
    [filteredVendors, selectedId, sortedVendors],
  );

  const mappedVendors = useMemo(() => {
    return sortedVendors.filter((v) => v.latitude != null && v.longitude != null);
  }, [sortedVendors]);

  const selectVendor = useCallback(
    (id: string) => {
      setSelectedId(id);
      const vendor = sortedVendors.find((v) => v.id === id) ?? vendors.find((v) => v.id === id);
      if (vendor?.latitude != null && vendor?.longitude != null) {
        setRegion({
          latitude: vendor.latitude,
          longitude: vendor.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    },
    [vendors, sortedVendors],
  );

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ gap: 14, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
      >
        <BrandHeader subtitle="Browse discounts by train stop" />

        <AdBanner slot={2} />

        <Card>
          <SectionTitle title="Filter" subtitle="Restaurants, bars, cafes, and cuisine" />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {TYPE_OPTIONS.map((value) => (
              <AppButton
                key={value}
                variant={typeFilter === value ? 'primary' : 'secondary'}
                onPress={() => {
                  setTypeFilter(value);
                  setCuisineFilter('');
                }}
              >
                {value}
              </AppButton>
            ))}
          </View>
          {cuisineOptions.length > 0 && typeFilter === 'Restaurant' ? (
            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden' }}>
              <Picker selectedValue={cuisineFilter} onValueChange={(itemValue) => setCuisineFilter(String(itemValue))}>
                <Picker.Item label="Any cuisine" value="" />
                {cuisineOptions.map((c) => (
                  <Picker.Item key={c} label={c.charAt(0).toUpperCase() + c.slice(1)} value={c} />
                ))}
              </Picker>
            </View>
          ) : null}
          <FieldInput placeholder="Search name, stop, cuisine…" value={search} onChangeText={setSearch} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
            <Text style={{ color: colors.ink, fontSize: 14 * effectiveScale }} allowFontScaling={false}>
              Sort favorites first
            </Text>
            <Switch
              value={sortByFavorites}
              onValueChange={setSortByFavorites}
              trackColor={{ false: colors.border, true: colors.brand }}
              thumbColor="#fff"
              accessibilityLabel="Sort favorites first"
            />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <AppButton variant="secondary" onPress={expandAllStations}>Expand all</AppButton>
            <AppButton variant="secondary" onPress={collapseAllStations}>Collapse all</AppButton>
          </View>
          {locationPermission === false ? (
            <Banner tone="info">Location permission denied. Enable it in settings to see nearby shops sorted by distance.</Banner>
          ) : null}
        </Card>

        {region ? (
          <View style={{ height: 260, borderRadius: 16, overflow: 'hidden' }}>
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
                      onPress={() => selectVendor(vendor.id)}
                    />
                  ),
              )}
            </MapView>
          </View>
        ) : null}

        {loading ? <Spinner /> : null}
        {error ? <Banner tone="error">{error}</Banner> : null}
        {!loading && vendors.length === 0 ? <Banner tone="info">No vendors available yet.</Banner> : null}
        {!loading && filteredVendors.length === 0 && vendors.length > 0 ? <Banner tone="info">No businesses match your filters.</Banner> : null}

        {Array.from(groupedVendors.entries()).map(([station, items]) => {
          const collapsed = collapsedStations.has(station);
          return (
          <View key={station}>
            <SectionTitle
              title={station}
              subtitle={`${items.length} business${items.length === 1 ? '' : 'es'}`}
              onPress={() => toggleStation(station)}
              right={<Text style={{ color: colors.muted, fontSize: 18 * effectiveScale }} allowFontScaling={false}>{collapsed ? '▶' : '▼'}</Text>}
            />
            {!collapsed ? (
            <Card>
              <View style={{ gap: 10 }}>
                {items.map((vendor) => {
                  const active = vendor.id === selectedId;
                  const remaining = formatTimeRemaining(vendor.endsAt);
                  const dist =
                    location && vendor.latitude != null && vendor.longitude != null
                      ? distanceKm(location.coords.latitude, location.coords.longitude, vendor.latitude, vendor.longitude)
                      : null;
                  const favorite = isFavorite(vendor.id);
                  return (
                    <Pressable
                      key={vendor.id}
                      onPress={() => selectVendor(vendor.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        padding: 12,
                        borderRadius: 12,
                        backgroundColor: active ? colors.brand + '12' : colors.panel,
                        borderWidth: 1,
                        borderColor: active ? colors.brand : colors.border,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{ color: colors.ink, fontSize: 15 * effectiveScale, fontWeight: '700' }}
                          allowFontScaling={false}
                        >
                          {vendor.boosted ? 'Flash: ' : ''}
                          {vendor.name}
                        </Text>
                        {vendor.address ? (
                          <Text
                            style={{ color: colors.muted, fontSize: 12 * effectiveScale, marginTop: 2 }}
                            allowFontScaling={false}
                          >
                            {vendor.address}
                            {vendor.city ? `, ${vendor.city}` : ''}
                          </Text>
                        ) : null}
                        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                          <Pill tone="success">{vendor.discount.label}</Pill>
                          {vendor.cuisine ? <Pill tone="neutral">{vendor.cuisine}</Pill> : null}
                          {remaining ? <Pill tone="warning">{remaining}</Pill> : null}
                          {dist != null ? <Pill tone="neutral">{formatDistance(dist)}</Pill> : null}
                        </View>
                      </View>
                      <Pressable
                        onPress={() => void handleToggleFavorite(vendor.id)}
                        accessibilityLabel={favorite ? 'Remove from favorites' : 'Add to favorites'}
                        style={{ padding: 8 }}
                      >
                        <Text style={{ fontSize: 24 * effectiveScale, color: colors.brand }} allowFontScaling={false}>
                          {favorite ? '♥' : '♡'}
                        </Text>
                      </Pressable>
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          ) : null}
        </View>
      );
    })}

        {selected ? (
          <Card>
            {selected.logoUrl || selected.iconUrl ? (
              <Image
                source={{ uri: selected.logoUrl ?? selected.iconUrl ?? undefined }}
                style={{ width: '100%', height: 140, borderRadius: 16, backgroundColor: '#dfe7f3' }}
                resizeMode="contain"
              />
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <SectionTitle title={selected.name} subtitle={selected.category ?? selected.vendorType ?? undefined} />
              </View>
              <Pressable
                onPress={() => void handleToggleFavorite(selected.id)}
                accessibilityLabel={isFavorite(selected.id) ? 'Remove from favorites' : 'Add to favorites'}
                style={{ padding: 8 }}
              >
                <Text style={{ fontSize: 28 * effectiveScale, color: colors.brand }} allowFontScaling={false}>
                  {isFavorite(selected.id) ? '♥' : '♡'}
                </Text>
              </Pressable>
            </View>
            {selected.station ? (
              <Text style={{ color: colors.muted, fontSize: 14 * effectiveScale }} allowFontScaling={false}>
                {selected.station}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Pill tone="success">{selected.discount.label}</Pill>
              {selected.boosted ? <Pill tone="warning">Flash deal</Pill> : null}
              {formatTimeRemaining(selected.endsAt) ? <Pill tone="neutral">{formatTimeRemaining(selected.endsAt)}</Pill> : null}
            </View>
            {selected.address ? (
              <Text style={{ color: colors.muted, fontSize: 14 * effectiveScale, lineHeight: 20 * effectiveScale }} allowFontScaling={false}>
                {selected.address}
              </Text>
            ) : null}
            {selected.discountDescription ? (
              <Text style={{ color: colors.ink, fontSize: 14 * effectiveScale, lineHeight: 20 * effectiveScale }} allowFontScaling={false}>
                {selected.discountDescription}
              </Text>
            ) : null}
            <Text style={{ color: colors.muted, fontSize: 8 * effectiveScale, lineHeight: 12 * effectiveScale }} allowFontScaling={false}>
              {selected.discountTerms}
            </Text>

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
            <AppButton variant="secondary" onPress={() => void shareDeal(selected)}>
              Share this deal
            </AppButton>
            <Link href={`/discount?vendorId=${encodeURIComponent(selected.id)}`} asChild>
              <AppButton>Show discount QR</AppButton>
            </Link>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
