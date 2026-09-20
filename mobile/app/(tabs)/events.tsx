import { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Linking, Platform, RefreshControl, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppButton, Banner, BrandHeader, GlassCard, Pill, Screen, SectionTitle, Spinner } from '@/components/Ui';
import { SimpleListPicker } from '@/components/SimpleListPicker';
import { getEvents } from '@/lib/api';
// Automatic event notifications disabled - only admin can manually trigger push notifications
// import { scheduleEventNotifications } from '@/lib/notifications';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';
import type { RssEvent } from '@/lib/types';

type ViewMode = 'all' | 'day' | 'week' | 'month';

const MIN_CARD_WIDTH = 280;

// Only admin-created events with no time-of-day set are emitted as a bare
// `YYYY-MM-DD` string. RSS `pubDate` values (RFC-822, e.g.
// "Mon, 06 Jan 2025 08:00:00 -0500") never match this and must be treated
// as full date/times, not date-only strings.
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '';
  const dateOnly = DATE_ONLY_RE.test(iso);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (dateOnly) {
    // Date-only events (no specific time set): show just the date.
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }
  return d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Date-only events (no time-of-day set) remain visible through the end of
// their day rather than expiring at midnight.
function isPastEvent(item: RssEvent): boolean {
  if (!item.pubDate) return false;
  const dateOnly = DATE_ONLY_RE.test(item.pubDate);
  const d = new Date(dateOnly ? `${item.pubDate}T23:59:59` : item.pubDate);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

// Soonest-first: events without a known date/time sort to the end.
function compareByTime(a: RssEvent, b: RssEvent): number {
  const aTime = a.pubDate ? new Date(a.pubDate).getTime() : NaN;
  const bTime = b.pubDate ? new Date(b.pubDate).getTime() : NaN;
  const aValid = !Number.isNaN(aTime);
  const bValid = !Number.isNaN(bTime);
  if (aValid && bValid) return aTime - bTime;
  if (aValid) return -1;
  if (bValid) return 1;
  return a.title.localeCompare(b.title);
}

// Filter events by view mode (all/day/week/month)
function filterByViewMode(events: RssEvent[], mode: ViewMode): RssEvent[] {
  if (mode === 'all') return events;
  
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (7 - now.getDay()));
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  return events.filter((event) => {
    if (!event.pubDate) return false;
    const eventDate = new Date(event.pubDate);
    
    switch (mode) {
      case 'day':
        return eventDate >= startOfDay && eventDate < endOfDay;
      case 'week':
        return eventDate >= startOfDay && eventDate <= endOfWeek;
      case 'month':
        return eventDate >= startOfDay && eventDate <= endOfMonth;
      default:
        return true;
    }
  });
}

function formatPhoneForDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export default function EventsScreen() {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<RssEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState('');
  const [sportFilter, setSportFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('all');

  const gap = 16;
  // Screen padding mirrors Ui.tsx: responsive to width AND scaled by the
  // user's text-size multiplier. Keeping this in sync prevents cards from
  // overflowing and overlapping horizontally.
  const screenPadding = Math.round(Math.min(24, Math.max(16, width * 0.05)) * effectiveScale);
  const listPadding = 20;
  // Account for both the Screen wrapper padding and the FlatList content padding.
  const availableWidth = width - (screenPadding + listPadding) * 2;
  const columns = Math.max(1, Math.floor(availableWidth / MIN_CARD_WIDTH));
  const cardWidth = (availableWidth - gap * (columns - 1)) / columns;

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await getEvents();
      // Auto-remove events whose date/time has already passed, then sort
      // soonest-first so the closest upcoming events show at the top.
      const upcoming = data.filter((e) => !isPastEvent(e)).sort(compareByTime);
      setItems(upcoming);
      // Automatic event notifications disabled - only admin can manually trigger push notifications
      // void scheduleEventNotifications(upcoming, auth.profile?.city ?? '', auth.profile?.pushPreferences);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load events');
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

  // Re-filter when the screen gains focus to remove any events that have
  // become stale while the user was away.
  useFocusEffect(
    useCallback(() => {
      setItems((prev) => prev.filter((e) => !isPastEvent(e)).sort(compareByTime));
    }, []),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function openLink(url: string | null | undefined) {
    if (!url) return;
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    void Linking.openURL(normalized);
  }

  function callPhone(phone: string) {
    void Linking.openURL(Platform.select({ default: `tel:${phone.replace(/[^\d+]/g, '')}` }) ?? '');
  }

  const cityOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of items) {
      const city = e.city?.trim();
      if (city) counts.set(city, (counts.get(city) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, label: value, count }));
  }, [items]);

  const sportOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of items) {
      const sport = e.sport?.trim();
      if (sport) counts.set(sport, (counts.get(sport) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, label: value, count }));
  }, [items]);

  const typeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of items) {
      const type = e.eventType?.trim();
      if (type) counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, label: value, count }));
  }, [items]);

  const filteredItems = useMemo(() => {
    let filtered = items.filter((e) => {
      if (cityFilter && (e.city ?? '').trim().toLowerCase() !== cityFilter.toLowerCase()) return false;
      if (sportFilter && (e.sport ?? '').trim().toLowerCase() !== sportFilter.toLowerCase()) return false;
      if (typeFilter && (e.eventType ?? '').trim().toLowerCase() !== typeFilter.toLowerCase()) return false;
      return true;
    });
    
    // Apply view mode filter
    filtered = filterByViewMode(filtered, viewMode);
    
    return filtered;
  }, [items, cityFilter, sportFilter, typeFilter, viewMode]);

  const hasActiveFilters = !!(cityFilter || sportFilter || typeFilter);

  const header = useMemo(
    () => (
      <View style={{ gap: 14, paddingBottom: 12 }}>
        <BrandHeader subtitle="Local events & happenings" />
        <GlassCard>
          <SectionTitle title="Filter events" subtitle="Narrow down by city, sport, or event type" />
          <View style={{ gap: 10 }}>
            {/* 2x2 grid: a single wrapping row squeezed the buttons at larger
                text scales and covered the Month label. */}
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {(['all', 'day', 'week', 'month'] as ViewMode[]).map((mode) => (
                <AppButton
                  key={mode}
                  variant={viewMode === mode ? 'primary' : 'secondary'}
                  onPress={() => setViewMode(mode)}
                  style={{ flexBasis: '45%', flexGrow: 1 }}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </AppButton>
              ))}
            </View>
            <SimpleListPicker
              entries={cityOptions}
              selected={cityFilter}
              onSelect={setCityFilter}
              label="City"
              itemNoun="event"
              allLabel="All cities"
            />
            <SimpleListPicker
              entries={sportOptions}
              selected={sportFilter}
              onSelect={setSportFilter}
              label="Sport"
              itemNoun="event"
              allLabel="All sports"
            />
            <SimpleListPicker
              entries={typeOptions}
              selected={typeFilter}
              onSelect={setTypeFilter}
              label="Event type"
              itemNoun="event"
              allLabel="All event types"
            />
            {hasActiveFilters ? (
              <AppButton
                variant="ghost"
                onPress={() => {
                  setCityFilter('');
                  setSportFilter('');
                  setTypeFilter('');
                }}
              >
                Clear filters
              </AppButton>
            ) : null}
          </View>
        </GlassCard>
      </View>
    ),
    [cityOptions, sportOptions, typeOptions, cityFilter, sportFilter, typeFilter, hasActiveFilters, viewMode],
  );

  const renderItem = useCallback(
    ({ item }: { item: RssEvent }) => {
      return (
        <View style={{ width: cardWidth, marginBottom: gap }}>
          <View style={{ borderRadius: 16, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
            {item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={{ width: '100%', height: cardWidth * 0.56, backgroundColor: colors.subtle }}
                resizeMode="cover"
                accessibilityLabel={item.title}
              />
            ) : null}
            <View style={{ padding: 16, gap: 10 }}>
              <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 16 * effectiveScale }} allowFontScaling={false}>
                {item.title}
              </Text>
              {item.pubDate ? (
                <Text style={{ color: colors.brand, fontWeight: '600', fontSize: 14 * effectiveScale }} allowFontScaling={false}>
                  {formatDateTime(item.pubDate)}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {item.city ? <Pill tone="neutral">{item.city}</Pill> : null}
                {item.eventType ? <Pill tone="neutral">{item.eventType}</Pill> : null}
                {item.sport ? <Pill tone="neutral">{item.sport}</Pill> : null}
              </View>
              {item.description ? (
                <Text
                  style={{ color: colors.muted, lineHeight: 20 * effectiveScale, fontSize: 14 * effectiveScale }}
                  allowFontScaling={false}
                >
                  {item.description}
                </Text>
              ) : null}
              {item.phone ? (
                <Text
                  onPress={() => callPhone(item.phone!)}
                  accessibilityRole="link"
                  accessibilityLabel={`Call ${item.phone}`}
                  accessibilityHint="Opens your phone app"
                  style={{ color: colors.brand, fontWeight: '600', fontSize: 14 * effectiveScale, textDecorationLine: 'underline' }}
                  allowFontScaling={false}
                >
                  📞 {formatPhoneForDisplay(item.phone)}
                </Text>
              ) : null}
              {item.link ? (
                <Text
                  onPress={() => openLink(item.link)}
                  accessibilityRole="link"
                  accessibilityLabel={`Open event link: ${item.link}`}
                  accessibilityHint="Opens the event website"
                  style={{ color: colors.brand, fontWeight: '600', fontSize: 14 * effectiveScale, textDecorationLine: 'underline' }}
                  allowFontScaling={false}
                >
                  🌐 {item.link}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      );
    },
    [cardWidth, colors.panel, colors.border, colors.ink, colors.muted, colors.subtle, colors.brand, effectiveScale, gap],
  );

  return (
    <Screen>
      {loading ? <Spinner /> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      {!loading && filteredItems.length === 0 ? (
        <Banner tone="info">
          {hasActiveFilters || viewMode !== 'all' 
            ? 'No events match your filters.' 
            : 'No upcoming events. Pull down to refresh.'}
        </Banner>
      ) : null}
      <FlatList
        data={filteredItems}
        key={columns}
        numColumns={columns}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: listPadding, paddingBottom: 32, paddingTop: 4 }}
        columnWrapperStyle={columns > 1 ? { gap } : undefined}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        ListHeaderComponent={header}
      />
    </Screen>
  );
}
