import { useCallback, useState } from 'react';
import { Image, Linking, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppButton, Banner, BrandHeader, Card, Pill, Screen, SectionTitle, Spinner } from '@/components/Ui';
import { adminDeleteContent, adminListContent, listPublishedContent } from '@/lib/api';
import { useAdmin } from '@/lib/admin';
import type { ContentBlock } from '@/lib/types';

export default function DiscoverScreen() {
  const router = useRouter();
  const admin = useAdmin();
  const [items, setItems] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      // Admins see drafts too so they can review before publishing.
      setItems(admin.token ? await adminListContent(admin.token) : await listPublishedContent());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load content');
    }
  }, [admin.token]);

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

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
        <BrandHeader subtitle="Discover" />

        {admin.isAdmin ? (
          <Card>
            <SectionTitle title="Editing unlocked" subtitle={`Signed in as ${admin.profile?.email ?? 'admin'}`} />
            <AppButton onPress={() => router.push('/admin/content')}>Add content</AppButton>
            <AppButton variant="secondary" onPress={() => router.push('/admin/theme')}>
              Edit app theme
            </AppButton>
            <AppButton variant="ghost" onPress={() => void admin.lock().then(() => load())}>
              Lock editing
            </AppButton>
          </Card>
        ) : null}

        {loading ? <Spinner /> : null}
        {error ? <Banner tone="error">{error}</Banner> : null}
        {!loading && items.length === 0 ? <Banner tone="info">No content has been published yet.</Banner> : null}

        {items.map((item) => (
          <Card key={item.id}>
            <SectionTitle title={item.title} subtitle={item.kind} />
            {!item.published ? <Pill tone="warning">Draft</Pill> : null}
            {item.kind === 'image' && item.url ? (
              <Image source={{ uri: item.url }} style={{ width: '100%', height: 190, borderRadius: 16, backgroundColor: '#dfe7f3' }} resizeMode="cover" />
            ) : null}
            {item.body ? <Text style={{ color: '#52617a', lineHeight: 20 }}>{item.body}</Text> : null}
            {item.url && item.kind !== 'image' ? (
              <AppButton variant="secondary" onPress={() => void Linking.openURL(item.url as string)}>
                {item.kind === 'file' ? 'Open file' : 'Open link'}
              </AppButton>
            ) : null}
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
        ))}
      </ScrollView>
    </Screen>
  );
}
