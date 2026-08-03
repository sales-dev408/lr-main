import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { AppButton, Banner, BrandHeader, Card, FieldInput, Screen, SectionTitle } from '@/components/Ui';
import { adminCreateContent, adminListContent, adminUpdateContent } from '@/lib/api';
import { useAdmin } from '@/lib/admin';
import type { ContentKind } from '@/lib/types';

const KINDS: ContentKind[] = ['text', 'article', 'image', 'file', 'embed'];

export default function AdminContentScreen() {
  const router = useRouter();
  const admin = useAdmin();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [kind, setKind] = useState<ContentKind>('text');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [published, setPublished] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id || !admin.token) return;
    void (async () => {
      try {
        const all = await adminListContent(admin.token as string);
        const existing = all.find((item) => item.id === id);
        if (existing) {
          setKind(existing.kind);
          setTitle(existing.title);
          setBody(existing.body ?? '');
          setUrl(existing.url ?? '');
          setPublished(existing.published);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load content');
      }
    })();
  }, [admin.token, id]);

  if (!admin.isAdmin || !admin.token) {
    return (
      <Screen>
        <Card>
          <SectionTitle title="Editing locked" subtitle="Unlock editing from the sign-in screen first." />
          <AppButton onPress={() => router.replace('/auth')}>Go to sign in</AppButton>
        </Card>
      </Screen>
    );
  }

  async function save() {
    if (!admin.token) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        kind,
        title,
        ...(body ? { body } : {}),
        ...(url ? { url } : {}),
        published,
      };
      if (id) {
        await adminUpdateContent(admin.token, id, payload);
      } else {
        await adminCreateContent(admin.token, payload);
      }
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save content');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: id ? 'Edit content' : 'Add content' }} />
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
        <BrandHeader subtitle={id ? 'Edit content' : 'Add content'} />
        <Card>
          <SectionTitle title="Content" subtitle="Published items appear in the app's Discover tab." />
          {error ? <Banner tone="error">{error}</Banner> : null}
          <Text style={{ color: '#52617a' }}>Type</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {KINDS.map((value) => (
              <AppButton key={value} variant={kind === value ? 'primary' : 'secondary'} onPress={() => setKind(value)}>
                {value}
              </AppButton>
            ))}
          </View>
          <FieldInput value={title} onChangeText={setTitle} placeholder="Title" />
          {kind === 'text' || kind === 'article' ? (
            <FieldInput value={body} onChangeText={setBody} placeholder="Body" multiline numberOfLines={6} style={{ minHeight: 120, textAlignVertical: 'top' }} />
          ) : null}
          {kind !== 'text' && kind !== 'article' ? (
            <FieldInput value={url} onChangeText={setUrl} placeholder="https://… (image, file, or embed URL)" autoCapitalize="none" />
          ) : null}
          <AppButton variant={published ? 'primary' : 'secondary'} onPress={() => setPublished(!published)}>
            {published ? 'Published' : 'Draft'}
          </AppButton>
          <AppButton onPress={() => void save()} disabled={saving || !title}>
            {saving ? 'Saving…' : 'Save'}
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.back()}>
            Cancel
          </AppButton>
        </Card>
      </ScrollView>
    </Screen>
  );
}
