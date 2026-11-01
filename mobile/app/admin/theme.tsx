import { useState } from 'react';
import { ScrollView, Text, View, Switch } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { AppButton, Banner, BrandHeader, Card, FieldInput, Screen, SectionTitle } from '@/components/Ui';
import { adminSaveTheme } from '@/lib/api';
import { useAdmin } from '@/lib/admin';
import { useAppTheme } from '@/lib/appTheme';
import type { ThemeSettings } from '@/lib/types';

export default function AdminThemeScreen() {
  const router = useRouter();
  const admin = useAdmin();
  const appTheme = useAppTheme();
  const [draft, setDraft] = useState<ThemeSettings>(appTheme.theme);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nbaAllStarEnabled, setNbaAllStarEnabledLocal] = useState(appTheme.nbaAllStarEnabled);

  if (!admin.isAdmin || !admin.token) {
    return (
      <Screen>
        <Card>
          <SectionTitle title="Editing locked" subtitle="Unlock editing from the sign-in screen first." />
          <AppButton onPress={() => router.replace('/settings' as never)}>Go to sign in</AppButton>
        </Card>
      </Screen>
    );
  }

  function updateTab(index: number, patch: Partial<ThemeSettings['tabs'][number]>) {
    setDraft((prev) => ({ ...prev, tabs: prev.tabs.map((tab, i) => (i === index ? { ...tab, ...patch } : tab)) }));
  }

  async function save() {
    if (!admin.token) return;
    setSaving(true);
    setError(null);
    try {
      await adminSaveTheme(admin.token, draft);
      await appTheme.refresh();
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save theme');
    } finally {
      setSaving(false);
    }
  }

  async function toggleNbaAllStar(value: boolean) {
    setNbaAllStarEnabledLocal(value);
    await appTheme.setNbaAllStarEnabled(value);
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: 'App theme' }} />
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
        <BrandHeader subtitle="App theme" />
        
        <Card>
          <SectionTitle title="NBA All-Star Theme" subtitle="Switch to the NBA All-Star 2027 Phoenix theme" />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ fontSize: 16, color: '#1c1917' }}>NBA All-Star Theme</Text>
            <Switch
              value={nbaAllStarEnabled}
              onValueChange={toggleNbaAllStar}
              trackColor={{ false: '#e7e5e4', true: '#1d1160' }}
              thumbColor={nbaAllStarEnabled ? '#e56020' : '#f5f5f4'}
            />
          </View>
          {nbaAllStarEnabled && (
            <Text style={{ fontSize: 12, color: '#57534e', marginTop: 8 }}>
              Phoenix Suns purple with basketball-orange accent
            </Text>
          )}
        </Card>

        <Card>
          <SectionTitle title="Bottom tabs" subtitle="Blue / red / green gradients shared by the app and admin site." />
          {error ? <Banner tone="error">{error}</Banner> : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            {draft.tabs.map((tab) => (
              <View key={tab.key} style={{ alignItems: 'center', gap: 4 }}>
                <LinearGradient colors={tab.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 34, height: 34, borderRadius: 12 }} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: tab.color }}>{tab.label}</Text>
              </View>
            ))}
          </View>
        </Card>

        {draft.tabs.map((tab, index) => (
          <Card key={tab.key}>
            <SectionTitle title={tab.key} />
            <FieldInput value={tab.label} onChangeText={(value) => updateTab(index, { label: value })} placeholder="Label" />
            <FieldInput value={tab.color} onChangeText={(value) => updateTab(index, { color: value })} placeholder="#2563eb" autoCapitalize="none" />
            <FieldInput
              value={tab.gradient[0]}
              onChangeText={(value) => updateTab(index, { gradient: [value, tab.gradient[1]] })}
              placeholder="Gradient start"
              autoCapitalize="none"
            />
            <FieldInput
              value={tab.gradient[1]}
              onChangeText={(value) => updateTab(index, { gradient: [tab.gradient[0], value] })}
              placeholder="Gradient end"
              autoCapitalize="none"
            />
          </Card>
        ))}

        <Card>
          <AppButton onPress={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : 'Save theme'}
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.back()}>
            Cancel
          </AppButton>
        </Card>
      </ScrollView>
    </Screen>
  );
}
