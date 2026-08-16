import { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Linking, RefreshControl, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppButton, Banner, BrandHeader, Pill, Screen, Spinner } from '@/components/Ui';
import { getEvents } from '@/lib/api';
import { scheduleEventNotifications } from '@/lib/notifications';
import { useAuth } from '@/lib/auth';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';
import type { RssEvent } from '@/lib/types';

const MIN_CARD_WIDTH = 280;

function formatDate(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
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
  const gap = 12;
  const padding = 16;
  const cardWidth = (width - padding * 2 - gap * (columns - 1)) / columns;

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await getEvents();
      setItems(data);
      void scheduleEventNotifications(data, auth.profile?.city ?? '', auth.profile?.pushPreferences);
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
      <View style={{ gap: 14, paddingBottom: 8 }}>
        <BrandHeader subtitle="Local events & happenings" />
      </View>
    ),
    [],
  );

  function renderItem({ item }: { item: RssEvent }) {
    return (
      <View style={{ width: cardWidth, marginBottom: gap, marginRight: gap }}>
        <View style={{ borderRadius: 16, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={{ width: '100%', height: cardWidth * 0.56, backgroundColor: colors.subtle }}
              resizeMode="cover"
              accessibilityLabel={item.title}
            />
          ) : null}
          <View style={{ padding: 14, gap: 8 }}>
            <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 16 * effectiveScale }} allowFontScaling={false}>
              {item.title}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {item.sourceName ? <Pill tone="neutral">{item.sourceName}</Pill> : null}
              {item.pubDate ? <Pill tone="neutral">{formatDate(item.pubDate)}</Pill> : null}
            </View>
            {item.description ? (
              <Text
                numberOfLines={3}
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
  }

  return (
    <Screen>
      {loading ? <Spinner /> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      {!loading && items.length === 0 ? <Banner tone="info">No events found. Pull down to refresh.</Banner> : null}
      <FlatList
        data={items}
        key={columns}
        numColumns={columns}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding, paddingBottom: 24 }}
        columnWrapperStyle={columns > 1 ? { gap } : undefined}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        ListHeaderComponent={header}
      />
    </Screen>
  );
}
