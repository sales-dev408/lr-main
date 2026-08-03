import { useCallback, useState } from 'react';
import { Linking, RefreshControl, ScrollView, Text } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { AppButton, Banner, BrandHeader, Card, Pill, Screen, SectionTitle, Spinner } from '@/components/Ui';
import { getEvents } from '@/lib/api';
import type { RssEvent } from '@/lib/types';

export default function EventsScreen() {
  const [items, setItems] = useState<RssEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await getEvents());
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

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: 'Events' }} />
      <ScrollView
        contentContainerStyle={{ gap: 14, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
      >
        <BrandHeader subtitle="Local events & happenings" />

        {loading ? <Spinner /> : null}
        {error ? <Banner tone="error">{error}</Banner> : null}
        {!loading && items.length === 0 ? <Banner tone="info">No events found. Pull down to refresh.</Banner> : null}

        {items.map((item) => (
          <Card key={item.id}>
            <SectionTitle title={item.title} subtitle={item.sourceName ?? undefined} />
            {item.pubDate ? (
              <Pill tone="neutral">{new Date(item.pubDate).toLocaleDateString()}</Pill>
            ) : null}
            {item.description ? <Text style={{ color: '#52617a', lineHeight: 20 }}>{item.description}</Text> : null}
            {item.link ? (
              <AppButton variant="secondary" onPress={() => void Linking.openURL(item.link!)}>
                View event
              </AppButton>
            ) : null}
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
