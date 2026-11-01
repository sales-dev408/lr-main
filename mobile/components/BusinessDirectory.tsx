import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, Switch, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { AppButton, Banner, BrandHeader, Card, FieldInput, GlassCard, Pill, Screen, SectionTitle, Spinner } from '@/components/Ui';
import { AdBanner } from '@/components/AdBanner';
import { BusinessModal } from '@/components/BusinessModal';
import { SimpleListPicker } from '@/components/SimpleListPicker';
import { clearVersionCache, listVendors } from '@/lib/api';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';
import { useFavorites } from '@/lib/favorites';
import { posthog } from '@/lib/posthog';
import MapView, { Marker, type Region } from '@/components/MapView';
import { StopPicker } from '@/components/StopPicker';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';
import { compareStops, findStop, getStops } from '@/lib/stops';
import { searchScore } from '@/lib/search';
import type { VendorListItem } from '@/lib/types';


export type DirectoryTypeOption = {
  label: string;
  /** vendorType values matched by this filter; null matches every page type. */
  types: string[] | null;
  /** vendor.category substrings matched by this filter (services pages). */
  categories?: string[];
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
  /** Screen layout: 'restaurants' = filters first, map last; 'directory' = map first. */
  layout?: 'restaurants' | 'directory';
  /** Label for a category dropdown populated from vendor.category values. */
  categoryDropdown?: string;
  /** Group the list by vendor city instead of rail stop. */
  groupByCity?: boolean;
  /** City sections to always show first, in order (groupByCity only). */
  cityOrder?: string[];
};

// The five primary cuisine families from the restructure spec. Each cuisine
// string in the data is matched into a family; tapping a family reveals the
// actual cuisine sub-types present in the results.
const CUISINE_GROUPS: { label: string; pattern: RegExp }[] = [
  { label: 'American', pattern: /american|bbq|bar-?b-?que|burger|steak|seafood|southern|comfort|wing|diner|breakfast|brunch|sandwich|cajun|smash|deli|smok/i },
  { label: 'Mexican', pattern: /mexican|tex-?mex|taco|burrito|taquer|southwest|latin|mariscos/i },
  { label: 'Italian', pattern: /italian|pizza|pasta|pizzeria/i },
  { label: 'Mediterranean', pattern: /mediterranean|greek|turkish|lebanese|middle east|shawarma|falafel|kebab/i },
  { label: 'Asian', pattern: /chinese|japanese|korean|thai|vietnam|indian|filipino|sushi|ramen|pho|asian|laotian|hawaiian|dim sum|malaysian|indonesian|tibetan|nepalese/i },
];

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
  const { favorites, toggle: toggleFavorite, isFavorite } = useFavorites();
  const searchParams = useLocalSearchParams<{ type?: string }>();
  const [vendors, setVendors] = useState<VendorListItem[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [cuisineFilter, setCuisineFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [cuisineGroup, setCuisineGroup] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<VendorListItem | null>(null);
  const [search, setSearch] = useState('');
  // The applied term — only updates when the user submits the search so
  // typing doesn't re-filter the list on every keystroke.
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [sortByFavorites, setSortByFavorites] = useState(false);
  const [, setLocationPermission] = useState(false);
  const [bLineFirst] = useState(false);
  const [collapsedStations, setCollapsedStations] = useState<Set<string>>(new Set());
  // Stops the user jumped to that have no businesses — rendered as empty
  // sections so "Jump to a stop" always lands somewhere meaningful.
  const [revealedStops, setRevealedStops] = useState<Set<string>>(new Set());
  const scrollRef = useRef<ScrollView>(null);
  const stationOffsets = useRef<Map<string, number>>(new Map());
  const jumpIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingJumpStation = useRef<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

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

  const groupCuisines = useMemo(() => {
    if (!cuisineGroup) return [];
    if (cuisineGroup === 'Other') {
      return cuisineOptions.filter((c) => !CUISINE_GROUPS.some((g) => g.pattern.test(c)));
    }
    const group = CUISINE_GROUPS.find((g) => g.label === cuisineGroup);
    return group ? cuisineOptions.filter((c) => group.pattern.test(c)) : [];
  }, [cuisineGroup, cuisineOptions]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const v of pageVendors) {
      if (v.category?.trim()) set.add(v.category.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [pageVendors]);

  const filteredVendors = useMemo(() => {
    const term = searchTerm.trim();
    let scored: Map<string, number> | null = null;
    let list = pageVendors;
    if (term) {
      scored = new Map();
      list = pageVendors.filter((v) => {
        const s = searchScore([v.name, v.cuisine, v.station, v.address, v.city, v.category], term);
        if (s == null) return false;
        scored!.set(v.id, s);
        return true;
      });
      if (scored.size) {
        list = [...list].sort((a, b) => scored!.get(a.id)! - scored!.get(b.id)!);
      }
    }
    if (activeTypeOption?.types) {
      const allowed = new Set(activeTypeOption.types.map((t) => t.toLowerCase()));
      list = list.filter((v) => allowed.has((v.vendorType ?? '').toLowerCase()));
    }
    if (activeTypeOption?.categories?.length) {
      const wanted = activeTypeOption.categories.map((c) => c.toLowerCase());
      list = list.filter((v) => wanted.some((c) => (v.category ?? '').toLowerCase().includes(c)));
    }
    if (cuisineFilter) {
      list = list.filter((v) => (v.cuisine ?? '').toLowerCase() === cuisineFilter.toLowerCase());
    }
    if (!cuisineFilter && cuisineGroup) {
      if (cuisineGroup === 'Other') {
        list = list.filter((v) => !v.cuisine || !CUISINE_GROUPS.some((g) => g.pattern.test(v.cuisine ?? '')));
      } else {
        const group = CUISINE_GROUPS.find((g) => g.label === cuisineGroup);
        if (group) list = list.filter((v) => v.cuisine != null && group.pattern.test(v.cuisine ?? ''));
      }
    }
    if (categoryFilter) {
      const needle = categoryFilter.toLowerCase();
      list = list.filter((v) => (v.category ?? '').toLowerCase() === needle);
    }
    return list;
  }, [pageVendors, searchTerm, activeTypeOption, cuisineFilter, cuisineGroup, categoryFilter]);

  const groupedVendors = useMemo(() => {
    const groups = new Map<string, VendorListItem[]>();
    const sortItems = (arr: VendorListItem[]) => {
      const favoriteSet = new Set(favorites);
      arr.sort((a, b) => {
        if (sortByFavorites) {
          const af = favoriteSet.has(a.id) ? -1 : 1;
          const bf = favoriteSet.has(b.id) ? -1 : 1;
          if (af !== bf) return af - bf;
        }
        if (a.boosted !== b.boosted) return a.boosted ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    };
    if (config.groupByCity) {
      const order = config.cityOrder ?? [];
      for (const city of order) groups.set(city, []);
      for (const v of filteredVendors) {
        const key = v.city?.trim() || 'Other';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(v);
      }
      for (const arr of groups.values()) sortItems(arr);
      const rank = (name: string) => {
        const i = order.findIndex((c) => c.toLowerCase() === name.toLowerCase());
        return i < 0 ? order.length : i;
      };
      return new Map(
        [...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0])),
      );
    }
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
    for (const arr of groups.values()) sortItems(arr);
    const lineRank = (station: string) => {
      const line = findStop(station)?.line;
      const rank = line === 'A Line' ? 0 : line === 'B Line' ? 1 : 2;
      return bLineFirst && rank < 2 ? 1 - rank : rank;
    };
    return new Map(
      [...groups.entries()].sort((a, b) => lineRank(a[0]) - lineRank(b[0]) || compareStops(a[0], b[0])),
    );
  }, [filteredVendors, sortByFavorites, favorites, bLineFirst, revealedStops, config.groupByCity, config.cityOrder]);

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
    pendingJumpStation.current = station;
    // Poll until onLayout reports the section's y position after it expands.
    let attempts = 0;
    const id = setInterval(() => {
      attempts++;
      const offset = stationOffsets.current.get(station);
      if (offset != null) {
        clearInterval(id);
        jumpIntervalRef.current = null;
        pendingJumpStation.current = null;
        scrollRef.current?.scrollTo({ y: Math.max(offset - 8, 0), animated: false });
      } else if (attempts >= 40) {
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
      if (vendor) {
        posthog?.capture('business_viewed', {
          vendor_id: vendor.id,
          vendor_type: vendor.vendorType ?? 'other',
        });
      }
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

  // Favorites are stored locally — no sign-in required.
  function onToggleFavorite(id: string) {
    posthog?.capture('business_favorite_updated', {
      vendor_id: id,
      is_favorited: !isFavorite(id),
    });
    void toggleFavorite(id);
  }


  const mapSection = region ? (
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
  ) : null;

  const filtersCard = (
    <GlassCard>
      <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 8 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <FieldInput
            placeholder={`Search ${title.toLowerCase()}…`}
            value={search}
            onChangeText={(text) => {
              setSearch(text);
              setSearchTerm(text);
            }}
            onSubmitEditing={() => setSearchTerm(search.trim())}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>
        <AppButton variant="primary" onPress={() => setSearchTerm(search.trim())}>
          Search
        </AppButton>
      </View>
      {config.cuisineFilter && cuisineOptions.length > 0 ? (
        <View style={{ marginTop: 8, gap: 8 }}>
          <Text style={{ color: colors.muted, fontSize: 12 * effectiveScale }} allowFontScaling={false}>
            Cuisine Filter
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <AppButton
              variant={!cuisineGroup && !cuisineFilter ? 'primary' : 'secondary'}
              onPress={() => { setCuisineGroup(null); setCuisineFilter(''); }}
            >
              All cuisines
            </AppButton>
            {[...CUISINE_GROUPS.map((g) => g.label), 'Other'].map((label) => (
              <AppButton
                key={label}
                variant={cuisineGroup === label ? 'primary' : 'secondary'}
                onPress={() => {
                  setCuisineGroup(cuisineGroup === label ? null : label);
                  setCuisineFilter('');
                }}
              >
                {label}
              </AppButton>
            ))}
          </View>
          {cuisineGroup && groupCuisines.length > 0 ? (
            <SimpleListPicker
              label={`${cuisineGroup} cuisine`}
              selected={cuisineFilter}
              entries={groupCuisines.map((c) => ({
                value: c,
                label: c.charAt(0).toUpperCase() + c.slice(1),
                count: pageVendors.filter((v) => (v.cuisine ?? '').toLowerCase() === c.toLowerCase()).length,
              }))}
              onSelect={setCuisineFilter}
              itemNoun="business"
              allLabel={`All ${cuisineGroup.toLowerCase()}`}
            />
          ) : null}
        </View>
      ) : null}
      {config.categoryDropdown && categoryOptions.length > 0 ? (
        <View style={{ marginTop: 8 }}>
          <SimpleListPicker
            label={config.categoryDropdown}
            selected={categoryFilter}
            entries={categoryOptions.map((c) => ({
              value: c,
              label: c,
              count: pageVendors.filter((v) => (v.category ?? '').trim() === c).length,
            }))}
            onSelect={setCategoryFilter}
            itemNoun="business"
            allLabel="All types"
          />
        </View>
      ) : null}
      {config.layout === 'restaurants' && config.typeOptions.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {config.typeOptions.map((option) => (
            <AppButton
              key={option.label}
              variant={typeFilter === option.label ? 'primary' : 'secondary'}
              onPress={() => {
                setTypeFilter(typeFilter === option.label ? 'All' : option.label);
                setCuisineFilter('');
              }}
            >
              {option.label}
            </AppButton>
          ))}
        </View>
      ) : null}
      {config.groupByCity ? null : (
        <View style={{ marginTop: 8 }}>
          <StopPicker entries={stopEntries} onSelect={jumpToStation} label="Jump to a stop" itemNoun="business" />
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4, marginTop: 4 }}>
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
    </GlassCard>
  );

  return (
    <Screen>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ gap: 18, paddingBottom: 32, paddingTop: 4 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        onScroll={(e) => setShowScrollTop(e.nativeEvent.contentOffset.y > 400)}
        scrollEventThrottle={200}
        onContentSizeChange={() => {
          // Content can finish laying out after the poll ends (e.g. a
          // just-revealed empty stop section) — retry the pending jump so
          // "Jump to a stop" still lands on the selected stop.
          const target = pendingJumpStation.current;
          if (target) {
            const offset = stationOffsets.current.get(target);
            if (offset != null) {
              pendingJumpStation.current = null;
              scrollRef.current?.scrollTo({ y: Math.max(offset - 8, 0), animated: false });
            }
          }
        }}
      >
        <BrandHeader subtitle={subtitle} />

        {adSlot ? <AdBanner slot={adSlot} /> : null}

        {mapSection}

        {filtersCard}

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
                  {config.groupByCity
                    ? `No ${title.toLowerCase()} listed in ${station} yet.`
                    : `No ${title.toLowerCase()} listed at this stop yet.`}
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
                          <Pill tone="success">{vendor.discount.label}</Pill>
                          {vendorLine ? <Pill tone="neutral">{vendorLine}</Pill> : null}
                          {vendor.cuisine ? <Pill tone="neutral">{vendor.cuisine}</Pill> : null}
                          {remaining ? <Pill tone="warning">{remaining}</Pill> : null}
                          {dist != null ? <Pill tone="neutral">{formatDistance(dist)}</Pill> : null}
                        </View>
                      </View>
                      <Pressable
                        onPress={() => onToggleFavorite(vendor.id)}
                        accessibilityLabel={
                          favorite ? 'Remove from favorites' : 'Add to favorites'
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
      <ScrollToTopButton visible={showScrollTop} onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })} />
      <BusinessModal vendor={selectedVendor} onClose={() => setSelectedVendor(null)} />
    </Screen>
  );
}
