import { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Linking, RefreshControl, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppButton, Banner, BrandHeader, Screen, Spinner } from '@/components/Ui';
import { getEvents } from '@/lib/api';
import { scheduleEventNotifications } from '@/lib/notifications';
import { useAuth } from '@/lib/auth';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';
import type { RssEvent } from '@/lib/types';

const MIN_CARD_WIDTH = 280;

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function isPastEvent(item: RssEvent): boolean {
  if (!item.pubDate) return false;
  const d = new Date(item.pubDate);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

export default function EventsScreen() {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  const auth = useAuth();
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<RssEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const columns = Math.max(1, Math.floor(width / MIN_CARD_WIDTH));
  const gap = 16;
  // Screen padding is responsive (16-24px based on width), use the max for safety.
  const screenPadding = Math.min(24, Math.max(16, width * 0.05));
  const listPadding = 20;
  // Account for both the Screen wrapper padding and the FlatList content padding.
  const availableWidth = width - (screenPadding + listPadding) * 2;
  const cardWidth = (availableWidth - gap * (columns - 1)) / columns;

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await getEvents();
      // Auto-remove events whose date/time has already passed.
      const upcoming = data.filter((e) => !isPastEvent(e));
      setItems(upcoming);
      void scheduleEventNotifications(upcoming, auth.profile?.city ?? '', auth.profile?.pushPreferences);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load events');
    }
  }, [auth.profile]);

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
      setItems((prev) => prev.filter((e) => !isPastEvent(e)));
    }, []),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function openLink(url: string | null | undefined) {
    if (url) void Linking.openURL(url);
  }

  const header = useMemo(
    () => (
      <View style={{ gap: 14, paddingBottom: 12 }}>
        <BrandHeader subtitle="Local events & happenings" />
      </View>
    ),
    [],
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
              {item.description ? (
                <Text
                  numberOfLines={4}
                  style={{ color: colors.muted, lineHeight: 20 * effectiveScale, fontSize: 14 * effectiveScale }}
                  allowFontScaling={false}
                >
                  {item.description}
                </Text>
              ) : null}
              {item.link ? (
                <AppButton variant="secondary" onPress={() => openLink(item.link)}>
                  View event
                </AppButton>
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
      {!loading && items.length === 0 ? <Banner tone="info">No upcoming events. Pull down to refresh.</Banner> : null}
      <FlatList
        data={items}
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
