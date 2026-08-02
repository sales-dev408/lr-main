import { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { AppButton, Banner, Card, FieldInput, Pill, Screen, SectionTitle, Spinner } from '@/components/Ui';
import { getCard } from '@/lib/api';
import { useOnboarding } from '@/lib/onboarding';
import type { CardDetail } from '@/lib/types';

function themeLabel(theme: string) {
  return theme.replace('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function CardDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const onboarding = useOnboarding();
  const [card, setCard] = useState<CardDetail | null>(null);
  const [city, setCity] = useState(onboarding.selection.city ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const title = useMemo(() => card?.name ?? 'Card details', [card]);
  const hasId = Boolean(params.id);

  useEffect(() => {
    if (!hasId) return;

    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getCard(params.id!, city.trim() || undefined);
        if (mounted) setCard(data);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Unable to load card');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasId, params.id]);

  async function applyCity() {
    if (!params.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getCard(params.id, city.trim() || undefined);
      setCard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load card');
    } finally {
      setLoading(false);
    }
  }

  if (!hasId) {
    return (
      <Screen>
        <Banner tone="error">Card id is required.</Banner>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
        {loading ? <Spinner /> : null}
        {error ? <Banner tone="error">{error}</Banner> : null}

        {card ? (
          <>
            <Card>
              <SectionTitle title={title} subtitle={themeLabel(card.theme)} />
              {card.image_url ? <Image source={{ uri: card.image_url }} style={{ width: '100%', height: 180, borderRadius: 16, backgroundColor: '#dfe7f3' }} /> : null}
              <Text style={{ color: '#52617a' }}>{card.description ?? 'No description available.'}</Text>
              <Pill tone="success">{card.status}</Pill>
              <FieldInput value={city} onChangeText={setCity} placeholder="City for local discounts (optional)" />
              <AppButton variant="secondary" onPress={() => void applyCity()}>
                Apply city
              </AppButton>
            </Card>

            {card.participatingBusinesses.length > 0 ? (
              <Card>
                <SectionTitle title="Participating businesses" subtitle="Show your membership pass at checkout." />
                {card.participatingBusinesses.map((business) => (
                  <View key={business.id} style={{ borderWidth: 1, borderColor: '#e5ebf3', borderRadius: 14, padding: 12, gap: 6 }}>
                    <Text style={{ fontWeight: '700', color: '#10223d' }}>{business.name}</Text>
                    <Text style={{ color: '#52617a' }}>{business.city ?? 'City not listed'}</Text>
                    {business.discount?.applied ? (
                      <Pill tone="success">{business.discount.applied.description}</Pill>
                    ) : (
                      <Text style={{ color: '#52617a' }}>No discount configured</Text>
                    )}
                  </View>
                ))}
              </Card>
            ) : null}

            <Card>
              <SectionTitle title="Your membership pass" subtitle="One card unlocks every participating business." />
              <Link href="/(tabs)/passes" asChild>
                <AppButton>View my membership card</AppButton>
              </Link>
            </Card>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
