import { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { AppButton, Banner, Card, FieldInput, Pill, Screen, SectionTitle, Spinner } from '@/components/Ui';
import { getCard } from '@/lib/api';
import { useOnboarding } from '@/lib/onboarding';
import type { CardDetail } from '@/lib/types';

function themeLabel(theme: string) {
  return theme.replace('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function CardDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const onboarding = useOnboarding();
  const [card, setCard] = useState<CardDetail | null>(null);
  const [city, setCity] = useState(onboarding.selection.city ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const title = useMemo(() => card?.name ?? 'Card details', [card]);
  const hasId = Boolean(params.id);

  useEffect(() => {
    if (!hasId) {
      return;
    }

    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getCard(params.id!, city.trim() || undefined);
        if (mounted) {
          setCard(data);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unable to load card');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [city, hasId, params.id]);

  if (loading) {
    return (
      <Screen>
        <Spinner />
      </Screen>
    );
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
        <Card>
          <SectionTitle title={title} subtitle={card ? themeLabel(card.theme) : undefined} />
          {error ? <Banner tone="error">{error}</Banner> : null}
          {card ? (
            <>
              {card.image_url ? <Image source={{ uri: card.image_url }} style={{ width: '100%', height: 180, borderRadius: 16, backgroundColor: '#dfe7f3' }} /> : null}
              <Text style={{ color: '#52617a' }}>{card.description ?? 'No description available.'}</Text>
              <Pill tone="success">{card.status}</Pill>
              <FieldInput value={city} onChangeText={setCity} placeholder="City for local discounts (optional)" />
              <AppButton variant="secondary" onPress={() => router.replace({ pathname: '/card/[id]', params: { id: card.id } })}>
                Refresh with city
              </AppButton>
            </>
          ) : null}
        </Card>

        {card ? (
          <Card>
            <SectionTitle title="Participating businesses" subtitle="Show your membership pass at checkout." />
            {card.participatingBusinesses.map((business) => (
              <View key={business.id} style={{ borderWidth: 1, borderColor: '#e5ebf3', borderRadius: 14, padding: 12, gap: 6 }}>
                <Text style={{ fontWeight: '700' }}>{business.name}</Text>
                <Text style={{ color: '#52617a' }}>{business.city ?? 'City not listed'}</Text>
                {business.discount ? (
                  <Text style={{ color: '#10223d' }}>
                    {business.discount.type} · {business.discount.value}
                    {business.discount.type === 'percent' ? '%' : '$'}
                  </Text>
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
      </ScrollView>
    </Screen>
  );
}
