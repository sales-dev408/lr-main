import { useCallback, useMemo, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { AppButton, Banner, BrandHeader, Card, FieldInput, Pill, Screen, SectionTitle, Spinner } from '@/components/Ui';
import { listCards } from '@/lib/api';
import { scheduleDealNotifications } from '@/lib/notifications';
import { useOnboarding } from '@/lib/onboarding';
import { useThemeColors } from '@/lib/useThemeColors';
import { useAuth } from '@/lib/auth';
import type { CardSummary, CardTheme } from '@/lib/types';

const THEMES: CardTheme[] = ['sports', 'entertainment', 'shops_restaurants'];

function prettyTheme(theme: CardTheme) {
  return theme.replace('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function BrowseScreen() {
  const colors = useThemeColors();
  const auth = useAuth();
  const onboarding = useOnboarding();
  const [theme, setTheme] = useState<CardTheme>(onboarding.selection.theme ?? 'shops_restaurants');
  const [city, setCity] = useState(onboarding.selection.city ?? '');
  const [cityInput, setCityInput] = useState(city);
  const [cards, setCards] = useState<CardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError(null);
      listCards({ theme, city: city.trim() || undefined })
        .then((data) => {
          if (active) setCards(data);
          void scheduleDealNotifications(data, auth.profile?.pushPreferences);
        })
        .catch((err) => {
          if (active) setError(err instanceof Error ? err.message : 'Unable to load cards');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [theme, city, auth.profile?.pushPreferences]),
  );

  const applyCity = useCallback(() => {
    setCity(cityInput.trim());
  }, [cityInput]);

  const featured = useMemo(() => cards[0] ?? null, [cards]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
        <BrandHeader subtitle="Browse cards" />
        <Card>
          <SectionTitle title="Browse cards" subtitle="Active cards and participating businesses." />
          {onboarding.selection.code ? (
            <Banner tone="success">
              Loaded from onboarding code: {onboarding.selection.cardName} · {onboarding.selection.vendorName}
            </Banner>
          ) : null}
          <FieldInput
            value={cityInput}
            onChangeText={setCityInput}
            onBlur={applyCity}
            placeholder="City (optional)"
            autoCapitalize="words"
          />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {THEMES.map((value) => (
              <AppButton key={value} variant={theme === value ? 'primary' : 'secondary'} onPress={() => setTheme(value)}>
                {prettyTheme(value)}
              </AppButton>
            ))}
          </View>
        </Card>

        {loading ? <Spinner /> : null}
        {error ? <Banner tone="error">{error}</Banner> : null}

        {featured ? (
          <Card>
            <SectionTitle title="Featured card" subtitle={featured.name} />
            {featured.image_url ? (
              <Image source={{ uri: featured.image_url }} style={{ width: '100%', height: 180, borderRadius: 16, backgroundColor: '#dfe7f3' }} />
            ) : null}
            <Text style={{ color: colors.muted }}>{featured.description ?? 'No description yet.'}</Text>
            <Pill tone="success">{prettyTheme(featured.theme)}</Pill>
            <Link href={`/card/${featured.id}`} asChild>
              <AppButton>Open card</AppButton>
            </Link>
          </Card>
        ) : null}

        {cards.map((card) => (
          <Card key={card.id}>
            <SectionTitle title={card.name} subtitle={prettyTheme(card.theme)} />
            <Text style={{ color: colors.muted }}>{card.description ?? 'No description available.'}</Text>
            <View style={{ gap: 8 }}>
              {card.participatingBusinesses.map((business) => (
                <View key={business.id} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, gap: 6 }}>
                  <Text style={{ fontWeight: '700' }}>{business.name}</Text>
                  <Text style={{ color: colors.muted }}>{business.city ?? 'City not listed'}</Text>
                  {business.discount ? (
                    <Text style={{ color: colors.ink }}>
                      {business.discount.type} · {business.discount.value}
                      {business.discount.type === 'percent' ? '%' : '$'}
                    </Text>
                  ) : (
                    <Text style={{ color: colors.muted }}>No discount configured</Text>
                  )}
                </View>
              ))}
            </View>
            <Link href={`/card/${card.id}`} asChild>
              <AppButton variant="secondary">View details</AppButton>
            </Link>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
