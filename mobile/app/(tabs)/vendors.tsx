import { useCallback, useMemo, useState } from 'react';
import { Image, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { AppButton, Banner, BrandHeader, Card, Pill, Screen, SectionTitle, Spinner } from '@/components/Ui';
import { listVendors } from '@/lib/api';
import { barcodeUrl } from '@/lib/qr';
import { useThemeColors } from '@/lib/useThemeColors';
import type { VendorListItem } from '@/lib/types';

const CATEGORIES = ['All', 'Sports', 'Dining', 'Entertainment'] as const;

function formatTimeRemaining(endsAt: string | null): string | null {
  if (!endsAt) return null;
  const end = new Date(endsAt).getTime();
  const now = Date.now();
  const diff = end - now;
  if (diff <= 0) return 'Ended';
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h left`;
  }
  return `${hours}h ${minutes}m left`;
}

export default function VendorsScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [vendors, setVendors] = useState<VendorListItem[]>([]);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await listVendors({ category: category === 'All' ? undefined : category });
      setVendors(data);
      setSelectedId((prev) => (prev && data.some((v) => v.id === prev) ? prev : data[0]?.id ?? null));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load vendors');
    }
  }, [category]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      void load().finally(() => {
        if (active) setLoading(false);
      });
      const interval = setInterval(() => {
        if (active) void load();
      }, 30000);
      return () => {
        active = false;
        clearInterval(interval);
      };
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const selected = useMemo(() => vendors.find((v) => v.id === selectedId) ?? null, [vendors, selectedId]);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ gap: 14, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
      >
        <BrandHeader subtitle="Discounts along the line" />
        <Card>
          <SectionTitle title="Participating businesses" subtitle="Your membership card works at every business below." />
          <Banner tone="info">Tap a business, then scan its in-store discount code to confirm your discount.</Banner>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {CATEGORIES.map((value) => (
              <AppButton key={value} variant={category === value ? 'primary' : 'secondary'} onPress={() => setCategory(value)}>
                {value}
              </AppButton>
            ))}
          </View>
          <Link href="/scan" asChild>
            <AppButton>Scan vendor QR code</AppButton>
          </Link>
          <AppButton
            variant="secondary"
            onPress={() =>
              router.push({ pathname: '/map', params: { category: category === 'All' ? undefined : category } } as unknown as Parameters<typeof router.push>[0])
            }
          >
            View on map
          </AppButton>
        </Card>

        {loading ? <Spinner /> : null}
        {error ? <Banner tone="error">{error}</Banner> : null}
        {!loading && vendors.length === 0 ? <Banner tone="info">No vendors available yet.</Banner> : null}

        {vendors.length > 0 ? (
          <Card>
            <SectionTitle title="Vendors" subtitle="Tap to select" />
            <View style={{ gap: 8 }}>
              {vendors.map((vendor) => {
                const active = vendor.id === selectedId;
                const remaining = formatTimeRemaining(vendor.endsAt);
                return (
                  <AppButton key={vendor.id} variant={active ? 'primary' : 'secondary'} onPress={() => setSelectedId(vendor.id)}>
                    {vendor.boosted ? 'Flash: ' : ''}{vendor.name} · {vendor.discount.label}{remaining ? ` · ${remaining}` : ''}
                  </AppButton>
                );
              })}
            </View>
          </Card>
        ) : null}

        {selected ? (
          <Card>
            {selected.logoUrl || selected.iconUrl ? (
              <Image
                source={{ uri: selected.logoUrl ?? selected.iconUrl ?? undefined }}
                style={{ width: '100%', height: 140, borderRadius: 16, backgroundColor: '#dfe7f3' }}
                resizeMode="contain"
              />
            ) : null}
            <SectionTitle title={selected.name} subtitle={selected.category ?? undefined} />
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Pill tone="success">{selected.discount.label}</Pill>
              {selected.boosted ? <Pill tone="warning">Flash deal</Pill> : null}
              {formatTimeRemaining(selected.endsAt) ? <Pill tone="neutral">{formatTimeRemaining(selected.endsAt)}</Pill> : null}
            </View>
            {selected.address ? <Text style={{ color: colors.muted }}>{selected.address}</Text> : null}

            {selected.discountCode ? (
              <View style={{ alignItems: 'center', gap: 8 }}>
                <Image
                  source={{ uri: barcodeUrl(selected.discountCode, 320, 120) }}
                  style={{ width: 320, height: 120, borderRadius: 8, backgroundColor: '#fff' }}
                  resizeMode="contain"
                />
                <Text selectable style={{ color: colors.ink, fontWeight: '700', letterSpacing: 0.5 }}>
                  {selected.discountCode}
                </Text>
              </View>
            ) : null}
            <Link href="/scan" asChild>
              <AppButton>Scan this vendor&apos;s discount code</AppButton>
            </Link>
            <Link href="/(tabs)/passes" asChild>
              <AppButton variant="secondary">Open my membership pass</AppButton>
            </Link>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
