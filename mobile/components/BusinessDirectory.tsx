import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, Switch, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { AppButton, Banner, BrandHeader, Card, FieldInput, GlassCard, Pill, Screen, SectionTitle, Spinner } from '@/components/Ui';
import { AdBanner } from '@/components/AdBanner';
import { BusinessModal } from '@/components/BusinessModal';
import { SimpleListPicker } from '@/components/SimpleListPicker';
import { clearVersionCache, listVendors } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';
import { useFavorites } from '@/lib/favorites';
import MapView, { Marker, type Region } from '@/components/MapView';
import { StopPicker } from '@/components/StopPicker';
import { compareStops, findStop, getStops } from '@/lib/stops';
import type { VendorListItem } from '@/lib/types';

const LINE_OPTIONS = ['All lines', 'A Line', 'B Line'] as const;
type LineOption = (typeof LINE_OPTIONS)[number];

export type DirectoryTypeOption = {
  label: string;
  /** vendorType values matched by this filter; null matches every page type. */
  types: string[] | null;
  /** Legacy deep-link values (?type=...) that should select this option. */
  aliases?: string[];
};

export type DirectoryConfig = {
  /** vendorType values that belong to this page. */
  vendorTypes: string[];
  /** Pill/dropdown filters offered on this page. */
  typeOptions: DirectoryTypeOption[];
  /** Offer the cuisine dropdown (restaurants pages). */
  cuisineFilter?: boolean;
};

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - Math.min(1, a)));
  return R * c;
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function formatTimeRemaining(endsAt: string | null): string | null {
  if (!endsAt) return null;
  const diff = new Date(endsAt).getTime() - Date.now();
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

type Props = {
  title: string;
  subtitle: string;
  config: DirectoryConfig;
  adSlot?: number;
};

// Shared business directory used by the Restaurants & Bars and Shopping pages.
// Renders the map, stop picker, filters, station-grouped list, and the
// closeable BusinessModal when a business is tapped.
export function BusinessDirectory({ title, subtitle, config, adSlot = 2 }: Props) {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  const { width } = useWindowDimensions();
  const mapHeight = Math.min(280, Math.max(180, width * 0.45));
  const router = useRouter();
  const auth = useAuth();
  const { favorites, toggle: toggleFavorite, isFavorite } = useFavorites();
  const searchParams = useLocalSearchParams<{ type?: string }>();
  const [vendors, setVendors] = useState<VendorListItem[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [cuisineFilter, setCuisineFilter] = useState<string>('');
  const [selectedVendor, setSelectedVendor] = useState<VendorListItem | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [sortByFavorites, setSortByFavorites] = useState(false);
  const [lineFilter, setLineFilter] = useState<LineOption>('All lines');
  const [bLineFirst, setBLineFirst] = useState(false);
  const [collapsedStations, setCollapsedStations] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Stops the user jumped to that have no businesses — rendered as empty
  // sections so "Jump to a stop" always lands somewhere meaningful.
  const [revealedStops, setRevealedStops] = useState<Set<string>>(new Set());
  const scrollRef = useRef<ScrollView>(null);
  const stationOffsets = useRef<Map<string, number>>(new Map());
  const jumpIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const signedIn = Boolean(auth.token);
  const pageVendorTypes = useMemo(() => new Set(config.vendorTypes.map((t) => t.toLowerCase())), [config.vendorTypes]);

  const pageVendors = useMemo(
    () => vendors.filter((v) => pageVendorTypes.has((v.vendorType ?? 'other').toLowerCase())),
    [vendors, pageVendorTypes],
  );

  const activeTypeOption = useMemo(
    () => config.typeOptions.find((o) => o.label === typeFilter) ?? config.typeOptions[0],
    [config.typeOptions, typeFilter],
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await listVendors();
      setVendors(data);
      setSelectedVendor((prev) => (prev ? data.find((v) => v.id === prev.id) ?? null : null));
      setRegion((prev) => prev ?? initialRegion(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load vendors');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const type = searchParams.type;
      if (typeof type === 'string' && type) {
        const match = config.typeOptions.find((o) => o.label === type || o.aliases?.includes(type));
        if (match) {
          setTypeFilter(match.label);
          setCuisineFilter('');
        }
      }
      let active = true;
      setLoading(true);
      void load().finally(() => {
        if (active) setLoading(false);
      });
      return () => {
        active = false;
      };
    }, [load, searchParams.type, config.typeOptions]),
  );

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true;
    void (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!active) return;
        setLocationPermission(status === 'granted');
        if (status !== 'granted') return;
        const current = await Location.getCurrentPositionAsync({});
        if (!active) return;
        setLocation(current);
        setRegion({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
          latitudeDelta: 0.12,
          longitudeDelta: 0.12,
        });
      } catch {
        if (active) setLocationPermission(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    clearVersionCache();
    await load();
    setRefreshing(false);
  }

  const cuisineOptions = useMemo(() => {
    const set = new Set<string>();
    for (const v of pageVendors) {
      if (v.cuisine) set.add(v.cuisine);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [pageVendors]);

  const filteredVendors = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = pageVendors.filter((v) => {
      if (!term) return true;
      const hay = [v.name, v.cuisine, v.station, v.address, v.city, v.category].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(term);
    });
    if (activeTypeOption?.types) {
      const allowed = new Set(activeTypeOption.types.map((t) => t.toLowerCase()));
      list = list.filter((v) => allowed.has((v.vendorType ?? '').toLowerCase()));
    }
    if (cuisineFilter) {
      list = list.filter((v) => (v.cuisine ?? '').toLowerCase() === cuisineFilter.toLowerCase());
    }
    if (lineFilter !== 'All lines') {
      list = list.filter((v) => findStop(v.station)?.line === lineFilter);
    }
    return list;
  }, [pageVendors, search, activeTypeOption, cuisineFilter, lineFilter]);

  const groupedVendors = useMemo(() => {
    const groups = new Map<string, VendorListItem[]>();
    for (const v of filteredVendors) {
      // Use the canonical stop name when available, otherwise fall back to the
      // vendor's own station label so vendors are still grouped by stop rather
      // than all collapsing into a single "Other" bucket.
      const key = findStop(v.station)?.name ?? (v.station?.trim() || 'Other');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(v);
    }
    // Empty sections for stops the user jumped to with no businesses.
    for (const stop of revealedStops) {
      if (!groups.has(stop)) groups.set(stop, []);
    }
    const favoriteSet = new Set(favorites);
    for (const arr of groups.values()) {
      arr.sort((a, b) => {
        if (sortByFavorites) {
          const af = favoriteSet.has(a.id) ? -1 : 1;
          const bf = favoriteSet.has(b.id) ? -1 : 1;
          if (af !== bf) return af - bf;
        }
        if (a.boosted !== b.boosted) return a.boosted ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    }
    const lineRank = (station: string) => {
      const line = findStop(station)?.line;
      const rank = line === 'A Line' ? 0 : line === 'B Line' ? 1 : 2;
      return bLineFirst && rank < 2 ? 1 - rank : rank;
    };
    return new Map(
      [...groups.entries()].sort((a, b) => lineRank(a[0]) - lineRank(b[0]) || compareStops(a[0], b[0])),
    );
  }, [filteredVendors, sortByFavorites, favorites, bLineFirst, revealedStops]);

  const stopEntries = useMemo(() => {
    const counts = new Map<string, number>();
    const cities = new Map<string, string | null>();
    for (const v of pageVendors) {
      const canonical = findStop(v.station)?.name;
      const key = canonical ?? v.station?.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (canonical) {
        const stop = findStop(v.station);
        if (stop?.city) cities.set(key, stop.city);
      }
    }
    const knownStops = getStops();
    const entries = knownStops.map((stop) => ({
      stop: stop.name,
      count: counts.get(stop.name) ?? 0,
      city: stop.city,
    }));
    // Include stops that have vendors but aren't in the canonical stops list
    // (e.g. when the snapshot didn't include stops but /stops was fetched).
    for (const [name, count] of counts) {
      if (!knownStops.some((s) => s.name === name)) {
        entries.push({ stop: name, count, city: cities.get(name) ?? null });
      }
    }
    return entries;
  }, [pageVendors]);

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

  const jumpToStation = useCallback((station: string) => {
    setCollapsedStations((prev) => {
      if (!prev.has(station)) return prev;
      const next = new Set(prev);
      next.delete(station);
      return next;
    });
    // If the stop has no businesses, reveal an empty section for it so the
    // jump lands on real content instead of silently no-oping.
    setRevealedStops((prev) => {
      if (prev.has(station)) return prev;
      const next = new Set(prev);
      next.add(station);
      return next;
    });
    // Center the map on the stop as well so the jump is always visible.
    const stop = findStop(station);
    if (stop?.latitude != null && stop?.longitude != null) {
      setRegion({ latitude: stop.latitude, longitude: stop.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 });
    }
    if (jumpIntervalRef.current) {
      clearInterval(jumpIntervalRef.current);
    }
    // Poll until onLayout reports the section's y position after it expands.
    let attempts = 0;
    const id = setInterval(() => {
      attempts++;
      const offset = stationOffsets.current.get(station);
      if (offset != null) {
        clearInterval(id);
        jumpIntervalRef.current = null;
        scrollRef.current?.scrollTo({ y: Math.max(offset - 8, 0), animated: false });
      } else if (attempts >= 20) {
        clearInterval(id);
        jumpIntervalRef.current = null;
      }
    }, 75);
    jumpIntervalRef.current = id;
  }, []);

  useEffect(() => {
    return () => {
      if (jumpIntervalRef.current) {
        clearInterval(jumpIntervalRef.current);
      }
    };
  }, []);

  const mappedVendors = useMemo(() => {
    return sortedVendors.filter((v) => v.latitude != null && v.longitude != null);
  }, [sortedVendors]);

  const selectVendor = useCallback(
    (id: string) => {
      const vendor = vendors.find((v) => v.id === id) ?? null;
      setSelectedVendor(vendor);
      if (vendor?.latitude != null && vendor?.longitude != null) {
        setRegion({
          latitude: vendor.latitude,
          longitude: vendor.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    },
    [vendors],
  );

  function onToggleFavorite(id: string) {
    if (!signedIn) {
      router.push('/auth' as never);
      return;
    }
    void toggleFavorite(id);
  }

  const activeFilterCount = (typeFilter !== 'All' ? 1 : 0) + (cuisineFilter ? 1 : 0) + (lineFilter !== 'All lines' ? 1 : 0);

  return (
    <Screen>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ gap: 18, paddingBottom: 32, paddingTop: 4 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
      >
        <BrandHeader subtitle={subtitle} />

        {adSlot ? <AdBanner slot={adSlot} /> : null}

        {region ? (
          <View style={{ height: mapHeight, borderRadius: 16, overflow: 'hidden' }}>
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

        <GlassCard>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <SectionTitle
              title="Filter & jump"
              subtitle={
                activeFilterCount > 0
                  ? `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} active`
                  : 'Search, filter, or jump to a stop'
              }
            />
            <AppButton variant={filtersOpen ? 'primary' : 'secondary'} onPress={() => setFiltersOpen((v) => !v)}>
              {filtersOpen ? 'Done' : 'Filters'}
            </AppButton>
          </View>
          <FieldInput placeholder={`Search ${title.toLowerCase()}…`} value={search} onChangeText={setSearch} />
          <View style={{ marginTop: 4 }}>
            <StopPicker entries={stopEntries} onSelect={jumpToStation} label="Jump to a stop" itemNoun="business" />
          </View>

          {filtersOpen ? (
            <View style={{ gap: 10, marginTop: 4 }}>
              {config.typeOptions.length > 1 ? (
                <View>
                  <Text style={{ color: colors.muted, fontSize: 12 * effectiveScale, marginBottom: 6 }} allowFontScaling={false}>
                    Type
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {config.typeOptions.map((option) => (
                      <AppButton
                        key={option.label}
                        variant={typeFilter === option.label ? 'primary' : 'secondary'}
                        onPress={() => {
                          setTypeFilter(option.label);
                          setCuisineFilter('');
                        }}
                      >
                        {option.label}
                      </AppButton>
                    ))}
                  </View>
                </View>
              ) : null}

              {config.cuisineFilter && cuisineOptions.length > 0 ? (
                <SimpleListPicker
                  label="Cuisine"
                  selected={cuisineFilter}
                  entries={cuisineOptions.map((c) => ({
                    value: c,
                    label: c.charAt(0).toUpperCase() + c.slice(1),
                    count: pageVendors.filter((v) => (v.cuisine ?? '').toLowerCase() === c.toLowerCase()).length,
                  }))}
                  onSelect={setCuisineFilter}
                  itemNoun="business"
                  allLabel="Any cuisine"
                />
              ) : null}

              <View>
                <Text style={{ color: colors.muted, fontSize: 12 * effectiveScale, marginBottom: 6 }} allowFontScaling={false}>
                  Rail line
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {LINE_OPTIONS.map((value) => (
                    <AppButton
                      key={value}
                      variant={lineFilter === value ? 'primary' : 'secondary'}
                      onPress={() => setLineFilter(value)}
                    >
                      {value}
                    </AppButton>
                  ))}
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
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
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
                <Text style={{ color: colors.ink, fontSize: 14 * effectiveScale }} allowFontScaling={false}>
                  Show B Line stops first
                </Text>
                <Switch
                  value={bLineFirst}
                  onValueChange={setBLineFirst}
                  trackColor={{ false: colors.border, true: colors.brand }}
                  thumbColor="#fff"
                  accessibilityLabel="Show B Line stops first"
                />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
                <Text style={{ color: colors.ink, fontSize: 14 * effectiveScale }} allowFontScaling={false}>
                  Stations
                </Text>
                <AppButton
                  variant="secondary"
                  onPress={() => {
                    if (collapsedStations.size === 0) {
                      setCollapsedStations(new Set(groupedVendors.keys()));
                    } else {
                      setCollapsedStations(new Set());
                    }
                  }}
                >
                  {collapsedStations.size === 0 ? 'Collapse all' : 'Expand all'}
                </AppButton>
              </View>
            </View>
          ) : null}

          {locationPermission === false ? (
            <Banner tone="info">Location permission denied. Enable it in settings to see nearby businesses sorted by distance.</Banner>
          ) : null}
        </GlassCard>

        {loading ? <Spinner /> : null}
        {error ? <Banner tone="error">{error}</Banner> : null}
        {!loading && pageVendors.length === 0 ? <Banner tone="info">No businesses listed yet.</Banner> : null}
        {!loading && filteredVendors.length === 0 && pageVendors.length > 0 ? <Banner tone="info">No businesses match your filters.</Banner> : null}

        {Array.from(groupedVendors.entries()).map(([station, items]) => {
          const collapsed = collapsedStations.has(station);
          const stationLine = findStop(station)?.line ?? null;
          return (
          <View
            key={station}
            onLayout={(event) => stationOffsets.current.set(station, event.nativeEvent.layout.y)}
          >
            <SectionTitle
              title={station}
              subtitle={`${stationLine ? `${stationLine} · ` : ''}${items.length} business${items.length === 1 ? '' : 'es'}`}
              onPress={items.length > 0 ? () => toggleStation(station) : undefined}
              right={
                items.length > 0 ? (
                  <Text style={{ color: colors.muted, fontSize: 18 * effectiveScale }} allowFontScaling={false}>{collapsed ? '▶' : '▼'}</Text>
                ) : undefined
              }
            />
            {items.length === 0 ? (
              <Card>
                <Text style={{ color: colors.muted, fontSize: 14 * effectiveScale }} allowFontScaling={false}>
                  No {title.toLowerCase()} listed at this stop yet.
                </Text>
              </Card>
            ) : !collapsed ? (
            <Card>
              <View style={{ gap: 10 }}>
                {items.map((vendor) => {
                  const remaining = formatTimeRemaining(vendor.endsAt);
                  const dist =
                    location && vendor.latitude != null && vendor.longitude != null
                      ? distanceKm(location.coords.latitude, location.coords.longitude, vendor.latitude, vendor.longitude)
                      : null;
                  const favorite = isFavorite(vendor.id);
                  const vendorLine = findStop(vendor.station)?.line ?? null;
                  const locked = vendor.membersOnly && !signedIn;
                  return (
                    <Pressable
                      key={vendor.id}
                      onPress={() => selectVendor(vendor.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${vendor.name}, ${vendor.discount.label}`}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        padding: 12,
                        borderRadius: 12,
                        backgroundColor: pressed ? colors.brand + '12' : colors.panel,
                        borderWidth: 1,
                        borderColor: colors.border,
                      })}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{ color: colors.ink, fontSize: 15 * effectiveScale, fontWeight: '700' }}
                          allowFontScaling={false}
                        >
                          {vendor.boosted ? <Text style={{ color: colors.accent }}>Flash: </Text> : ''}
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
                          <Pill tone={locked ? 'neutral' : 'success'}>{locked ? '🔒 Members-only' : vendor.discount.label}</Pill>
                          {vendorLine ? <Pill tone="neutral">{vendorLine}</Pill> : null}
                          {vendor.cuisine ? <Pill tone="neutral">{vendor.cuisine}</Pill> : null}
                          {remaining ? <Pill tone="warning">{remaining}</Pill> : null}
                          {dist != null ? <Pill tone="neutral">{formatDistance(dist)}</Pill> : null}
                        </View>
                      </View>
                      <Pressable
                        onPress={() => onToggleFavorite(vendor.id)}
                        accessibilityLabel={
                          !signedIn ? 'Sign in to save favorites' : favorite ? 'Remove from favorites' : 'Add to favorites'
                        }
                        style={{ padding: 8 }}
                      >
                        <Text style={{ fontSize: 24 * effectiveScale, color: favorite ? colors.accent : colors.subtle }} allowFontScaling={false}>
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
      </ScrollView>
      <BusinessModal vendor={selectedVendor} onClose={() => setSelectedVendor(null)} />
    </Screen>
  );
}
