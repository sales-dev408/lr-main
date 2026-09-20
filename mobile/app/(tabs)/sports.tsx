import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppButton, Banner, BrandHeader, Card, GlassCard, Pill, Screen, SectionTitle, Spinner } from '@/components/Ui';
import { SimpleListPicker, type SimpleListPickerEntry } from '@/components/SimpleListPicker';
import { fetchScoreboard, fetchStandings, CONFERENCES, DIVISIONS, SPORTS, type NcaaGame, type NcaaStanding } from '@/lib/ncaa';
import { useSportsFavorites } from '@/lib/sportsFavorites';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';

type ViewMode = 'scoreboard' | 'standings';

export default function SportsScreen() {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  const { favorites, toggle: toggleFavorite, isFavorite } = useSportsFavorites();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sportFilter, setSportFilter] = useState('football');
  const [divisionFilter, setDivisionFilter] = useState('fbs');
  const [conferenceFilter, setConferenceFilter] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('scoreboard');
  const [games, setGames] = useState<NcaaGame[]>([]);
  const [standings, setStandings] = useState<NcaaStanding[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      if (viewMode === 'scoreboard') {
        const data = await fetchScoreboard(sportFilter, divisionFilter, conferenceFilter || undefined);
        setGames(data.games || []);
      } else {
        const data = await fetchStandings(sportFilter, divisionFilter, conferenceFilter || undefined);
        setStandings(data.standings || []);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unable to load sports data';
      console.error('NCAA API Error:', errorMsg);
      setError(errorMsg);
      setGames([]);
      setStandings([]);
    }
  }, [sportFilter, divisionFilter, conferenceFilter, viewMode]);

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

  const filteredGames = useMemo(() => {
    if (!favorites.length) return games;
    return games.filter((game) => 
      favorites.includes(game.home_team.id) || favorites.includes(game.away_team.id)
    );
  }, [games, favorites]);

  const filteredStandings = useMemo(() => {
    if (!favorites.length) return standings;
    return standings.filter((standing) => favorites.includes(standing.team));
  }, [standings, favorites]);

  const sportOptions = useMemo(() => SPORTS, []);
  const divisionOptions = useMemo(() => {
    // FBS/FCS only exist for football; D1 does not exist for football
    // upstream (D2/D3 do).
    if (sportFilter === 'football') return DIVISIONS.filter((d) => d.value !== 'd1');
    return DIVISIONS.filter((d) => d.value !== 'fbs' && d.value !== 'fcs');
  }, [sportFilter]);
  const conferenceOptions = useMemo(() => {
    if (sportFilter !== 'football') return [];
    return CONFERENCES;
  }, [sportFilter]);

  function renderGameItem({ item }: { item: NcaaGame }) {
    const homeFavorite = isFavorite(item.home_team.id);
    const awayFavorite = isFavorite(item.away_team.id);
    
    return (
      <Card>
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.muted, fontSize: 12 * effectiveScale }} allowFontScaling={false}>
              {item.game_date ? new Date(item.game_date).toLocaleDateString() : 'TBD'}
            </Text>
            {item.status ? (
              <Pill tone="warning">{item.status}</Pill>
            ) : null}
          </View>
          
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.ink, fontSize: 16 * effectiveScale, fontWeight: '700' }} allowFontScaling={false}>
                  {item.away_team.name}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 * effectiveScale }} allowFontScaling={false}>
                  {item.away_team.abbreviation}
                </Text>
              </View>
              <View style={{ alignItems: 'center', paddingHorizontal: 16 }}>
                <Text style={{ color: colors.ink, fontSize: 24 * effectiveScale, fontWeight: '800' }} allowFontScaling={false}>
                  {item.away_team.score ?? '-'}
                </Text>
              </View>
              <Pressable onPress={() => void toggleFavorite(item.away_team.id)} style={{ padding: 8 }}>
                <Text style={{ fontSize: 24 * effectiveScale, color: awayFavorite ? colors.accent : colors.subtle }} allowFontScaling={false}>
                  {awayFavorite ? '♥' : '♡'}
                </Text>
              </Pressable>
            </View>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.ink, fontSize: 16 * effectiveScale, fontWeight: '700' }} allowFontScaling={false}>
                  {item.home_team.name}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 * effectiveScale }} allowFontScaling={false}>
                  {item.home_team.abbreviation}
                </Text>
              </View>
              <View style={{ alignItems: 'center', paddingHorizontal: 16 }}>
                <Text style={{ color: colors.ink, fontSize: 24 * effectiveScale, fontWeight: '800' }} allowFontScaling={false}>
                  {item.home_team.score ?? '-'}
                </Text>
              </View>
              <Pressable onPress={() => void toggleFavorite(item.home_team.id)} style={{ padding: 8 }}>
                <Text style={{ fontSize: 24 * effectiveScale, color: homeFavorite ? colors.accent : colors.subtle }} allowFontScaling={false}>
                  {homeFavorite ? '♥' : '♡'}
                </Text>
              </Pressable>
            </View>
          </View>
          
          {item.venue ? (
            <Text style={{ color: colors.muted, fontSize: 12 * effectiveScale, textAlign: 'center' }} allowFontScaling={false}>
              {item.venue.name} - {item.venue.city}, {item.venue.state}
            </Text>
          ) : null}
          
          {item.quarter || item.time_remaining ? (
            <Text style={{ color: colors.brand, fontSize: 12 * effectiveScale, textAlign: 'center', fontWeight: '600' }} allowFontScaling={false}>
              {[item.quarter, item.time_remaining].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </View>
      </Card>
    );
  }

  function renderStandingItem({ item }: { item: NcaaStanding }) {
    const favorite = isFavorite(item.team);
    
    return (
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.ink, fontSize: 16 * effectiveScale, fontWeight: '700' }} allowFontScaling={false}>
              {item.team}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 * effectiveScale }} allowFontScaling={false}>
              {item.conference}
            </Text>
          </View>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ color: colors.ink, fontSize: 16 * effectiveScale, fontWeight: '600' }} allowFontScaling={false}>
              {item.wins}-{item.losses}{item.ties !== undefined ? `-${item.ties}` : ''}
            </Text>
            {item.percentage ? (
              <Text style={{ color: colors.muted, fontSize: 12 * effectiveScale }} allowFontScaling={false}>
                {item.percentage.toFixed(3)}
              </Text>
            ) : null}
          </View>
          <Pressable onPress={() => void toggleFavorite(item.team)} style={{ padding: 8 }}>
            <Text style={{ fontSize: 24 * effectiveScale, color: favorite ? colors.accent : colors.subtle }} allowFontScaling={false}>
              {favorite ? '♥' : '♡'}
            </Text>
          </Pressable>
        </View>
      </Card>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ gap: 18, paddingBottom: 32, paddingTop: 4 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
      >
        <BrandHeader subtitle="NCAA Sports" />

        <GlassCard>
          <SectionTitle title="Filter" subtitle="Select sport, division, and conference" />
          <View style={{ gap: 10 }}>
            <SimpleListPicker
              entries={[...sportOptions] as SimpleListPickerEntry[]}
              selected={sportFilter}
              onSelect={(value) => {
                setSportFilter(value);
                // FBS/FCS only exist for football; reset to a valid division
                // and clear the conference filter when switching sports.
                if (value !== 'football') {
                  if (divisionFilter === 'fbs' || divisionFilter === 'fcs') setDivisionFilter('d1');
                  setConferenceFilter('');
                } else if (divisionFilter === 'd1') {
                  setDivisionFilter('fbs');
                }
              }}
              label="Sport"
              itemNoun="sport"
              allLabel="All sports"
            />
            <SimpleListPicker
              entries={[...divisionOptions] as SimpleListPickerEntry[]}
              selected={divisionFilter}
              onSelect={setDivisionFilter}
              label="Division"
              itemNoun="division"
              allLabel="All divisions"
            />
            {conferenceOptions.length > 0 ? (
              <SimpleListPicker
                entries={[...conferenceOptions] as SimpleListPickerEntry[]}
                selected={conferenceFilter}
                onSelect={setConferenceFilter}
                label="Conference"
                itemNoun="conference"
                allLabel="All conferences"
              />
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <AppButton
                variant={viewMode === 'scoreboard' ? 'primary' : 'secondary'}
                onPress={() => setViewMode('scoreboard')}
                style={{ flex: 1 }}
              >
                Scoreboard
              </AppButton>
              <AppButton
                variant={viewMode === 'standings' ? 'primary' : 'secondary'}
                onPress={() => setViewMode('standings')}
                style={{ flex: 1 }}
              >
                Standings
              </AppButton>
            </View>
            {favorites.length > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
                <Text style={{ color: colors.ink, fontSize: 14 * effectiveScale }} allowFontScaling={false}>
                  Show favorites only
                </Text>
                <Pill tone="success">{favorites.length} favorite{favorites.length !== 1 ? 's' : ''}</Pill>
              </View>
            ) : null}
          </View>
        </GlassCard>

        {loading ? <Spinner /> : null}
        {error ? (
          <Banner tone="error">{error}</Banner>
        ) : null}
        
        {!loading && !error && viewMode === 'scoreboard' && filteredGames.length === 0 ? (
          <Banner tone="info">
            {favorites.length > 0 ? 'No games for your favorite teams.' : 'No games available for selected filters.'}
          </Banner>
        ) : null}
        
        {!loading && !error && viewMode === 'standings' && filteredStandings.length === 0 ? (
          <Banner tone="info">
            {favorites.length > 0 ? 'No standings for your favorite teams.' : 'No standings available for selected filters.'}
          </Banner>
        ) : null}

        {!loading && viewMode === 'scoreboard' ? (
          <FlatList
            data={filteredGames}
            renderItem={renderGameItem}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ gap: 12 }}
            scrollEnabled={false}
          />
        ) : null}

        {!loading && viewMode === 'standings' ? (
          <FlatList
            data={filteredStandings}
            renderItem={renderStandingItem}
            keyExtractor={(item, index) => `${item.team}-${index}`}
            contentContainerStyle={{ gap: 12 }}
            scrollEnabled={false}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}
