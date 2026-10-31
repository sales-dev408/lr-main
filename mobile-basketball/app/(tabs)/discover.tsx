import { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppButton, Banner, BrandHeader, Card, Pill, Screen, SectionTitle, Spinner } from '@/components/Ui';
import { AdBanner } from '@/components/AdBanner';
import { adminDeleteContent, listPublishedContent } from '@/lib/api';
import { useAdmin } from '@/lib/admin';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';
import type { ContentBlock } from '@/lib/types';

type SortOption = 'newest' | 'oldest' | 'az' | 'za';

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest',
  oldest: 'Oldest',
  az: 'A-Z',
  za: 'Z-A',
};

function excerpt(body: string | null, max = 160): string {
  if (!body) return '';
  const clean = body.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
}

export default function DiscoverScreen() {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  const { width } = useWindowDimensions();
  const imageHeight = Math.min(200, Math.max(140, width * 0.35));
  const router = useRouter();
  const admin = useAdmin();
  const [items, setItems] = useState<ContentBlock[]>([]);
  const [sort, setSort] = useState<SortOption>('newest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await listPublishedContent());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load content');
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

  async function remove(id: string) {
    if (!admin.token) return;
    try {
      await adminDeleteContent(admin.token, id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete content');
    }
  }

  function open(item: ContentBlock) {
    router.push({ pathname: '/article', params: { id: item.id } });
  }

  const sortedItems = useMemo(() => {
    const list = [...items];
    switch (sort) {
      case 'newest':
        return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case 'oldest':
        return list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case 'az':
        return list.sort((a, b) => a.title.localeCompare(b.title));
      case 'za':
        return list.sort((a, b) => b.title.localeCompare(a.title));
      default:
        return list;
    }
  }, [items, sort]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 32, paddingTop: 4 }}>
        <BrandHeader subtitle="Discover" />

        <AdBanner slot={3} />

        {admin.isAdmin ? (
          <Card>
            <SectionTitle title="Admin tools" subtitle="Manage content and theme" />
            <AppButton onPress={() => router.push('/admin/content')}>Add content</AppButton>
            <AppButton variant="secondary" onPress={() => router.push('/admin/theme')}>
              Edit app theme
            </AppButton>
            <AppButton variant="ghost" onPress={() => void admin.lock().then(() => load())}>
              Exit admin mode
            </AppButton>
          </Card>
        ) : null}

        {!loading && items.length > 0 ? (
          <Card>
            <SectionTitle title="Sort" subtitle="Choose how content is ordered" />
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
                <AppButton key={key} variant={sort === key ? 'primary' : 'secondary'} onPress={() => setSort(key)}>
                  {SORT_LABELS[key]}
                </AppButton>
              ))}
            </View>
          </Card>
        ) : null}

        {loading ? <Spinner /> : null}
        {error ? <Banner tone="error">{error}</Banner> : null}
        {!loading && items.length === 0 ? <Banner tone="info">No content has been published yet.</Banner> : null}

        {sortedItems.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => open(item)}
            accessibilityRole="button"
            accessibilityLabel={`Read ${item.title}`}
            style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
          >
            <Card>
              {item.kind === 'image' && item.url ? (
                <Image
                  source={{ uri: item.url }}
                  style={{ width: '100%', height: imageHeight, borderRadius: 16, backgroundColor: colors.panel }}
                  resizeMode="cover"
                  accessibilityLabel={item.title}
                />
              ) : null}
              <View style={{ gap: 6 }}>
                <Text style={{ color: colors.ink, fontSize: 18 * effectiveScale, fontWeight: '800' }} allowFontScaling={false}>
                  {item.title}
                </Text>
                {!item.published ? <Pill tone="warning">Draft</Pill> : null}
                {item.body ? (
                  <Text style={{ color: colors.muted, lineHeight: 20 * effectiveScale, fontSize: 14 * effectiveScale }} allowFontScaling={false}>
                    {excerpt(item.body)}
                  </Text>
                ) : null}
                <Text style={{ color: colors.brand, fontSize: 13 * effectiveScale, fontWeight: '700', marginTop: 2 }} allowFontScaling={false}>
                  Read more →
                </Text>
              </View>
              {admin.isAdmin ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <AppButton variant="secondary" onPress={() => router.push({ pathname: '/admin/content', params: { id: item.id } })}>
                      Edit
                    </AppButton>
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppButton variant="danger" onPress={() => void remove(item.id)}>
                      Delete
                    </AppButton>
                  </View>
                </View>
              ) : null}
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
