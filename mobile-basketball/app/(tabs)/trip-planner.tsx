import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { AppButton, Card, Pill, Screen, SectionTitle } from '@/components/Ui';
import { GAME_DAYS, type GameDay } from '@/lib/allstar';
import {
  GAME_ROUTES,
  RETURN_ROUTES,
  formatMinutes,
  lastTrainHome,
  originsFor,
  titleCaseStation,
  tripsToArena,
  type GameRoute,
} from '@/lib/allstarTrip';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';

interface OriginChoice {
  route: GameRoute;
  station: string;
}

export default function TripPlannerScreen() {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  const [day, setDay] = useState<GameDay>(GAME_DAYS[1]); // Saturday is the classic pick
  const [choice, setChoice] = useState<OriginChoice | null>(null);

  // Boardable stations per route, travel order.
  const originGroups = useMemo(
    () => GAME_ROUTES.map((route) => ({ route, stations: originsFor(route) })),
    [],
  );

  const trips = useMemo(
    () => (choice ? tripsToArena(choice.route, choice.station, day, 3) : []),
    [choice, day],
  );
  const lastTrain = choice ? lastTrainHome(choice.route, day) : null;
  const ret = choice ? RETURN_ROUTES[choice.route.id] : null;

  return (
    <Screen accessibilityLabel="All-Star trip planner">
      <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 32, paddingTop: 4 }}>
        <Card>
          <SectionTitle title="Plan your trip" subtitle="Real train times to the arena — no parking meters, no surge" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {GAME_DAYS.map((d) => (
              <Pressable
                key={d.key}
                onPress={() => setDay(d)}
                accessibilityRole="button"
                accessibilityLabel={d.label}
                accessibilityState={{ selected: day.key === d.key }}
                style={{
                  flex: 1,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: day.key === d.key ? colors.accent : colors.border,
                  backgroundColor: day.key === d.key ? colors.brandSoft : colors.panel,
                  paddingVertical: 10,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 13 * effectiveScale }} allowFontScaling={false}>
                  {d.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={{ color: colors.muted, fontSize: 13 * effectiveScale }} allowFontScaling={false}>
            {day.headline}
          </Text>
          <Text style={{ color: colors.subtle, fontSize: 12 * effectiveScale }} allowFontScaling={false}>
            Tip times are TBA — planner targets arriving downtown by {formatMinutes(day.arriveByMinutes)}.
          </Text>
        </Card>

        <Card>
          <SectionTitle title="Where are you boarding?" subtitle="Every stop that reaches the arena" />
          {originGroups.map(({ route, stations }) => (
            <View key={route.id} style={{ gap: 6 }}>
              <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 14 * effectiveScale }} allowFontScaling={false}>
                {route.label}
                <Text style={{ color: colors.muted, fontWeight: '600' }}> — {route.catchment}</Text>
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {stations.map((station) => {
                  const active = choice?.route.id === route.id && choice.station === station;
                  return (
                    <Pressable
                      key={station}
                      onPress={() => setChoice({ route, station })}
                      accessibilityRole="button"
                      accessibilityLabel={`Board at ${titleCaseStation(station)}`}
                      accessibilityState={{ selected: active }}
                      style={{
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: active ? colors.accent : colors.border,
                        backgroundColor: active ? colors.brandSoft : colors.panel,
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                      }}
                    >
                      <Text style={{ color: colors.ink, fontSize: 12 * effectiveScale, fontWeight: active ? '800' : '600' }} allowFontScaling={false}>
                        {titleCaseStation(station)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </Card>

        {choice ? (
          <Card>
            <SectionTitle
              title="Your game plan"
              subtitle={`${titleCaseStation(choice.station)} → ${titleCaseStation(choice.route.destStation)} • ${day.label}`}
            />
            {trips.length > 0 ? (
              trips.map((t) => (
                <View
                  key={t.depart}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 14,
                    padding: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 15 * effectiveScale }} allowFontScaling={false}>
                      Board {formatMinutes(t.depart)}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 13 * effectiveScale }} allowFontScaling={false}>
                      Arrives {titleCaseStation(choice.route.destStation)} {formatMinutes(t.arrive)}
                    </Text>
                  </View>
                  <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 13 * effectiveScale }} allowFontScaling={false}>
                    {t.arrive - t.depart} min
                  </Text>
                </View>
              ))
            ) : (
              <Text style={{ color: colors.muted, fontSize: 14 * effectiveScale }} allowFontScaling={false}>
                No trains reach the arena stop before {formatMinutes(day.arriveByMinutes)} from this station — pick an earlier day plan or a different stop.
              </Text>
            )}
            <Text style={{ color: colors.muted, fontSize: 13 * effectiveScale }} allowFontScaling={false}>
              {'🚈'} {choice.route.walkNote}
            </Text>
            {lastTrain !== null && ret ? (
              <View style={{ borderRadius: 14, padding: 12, backgroundColor: colors.warningSoft }}>
                <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 14 * effectiveScale }} allowFontScaling={false}>
                  {'⚠️'} Last train home: {formatMinutes(lastTrain)}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 13 * effectiveScale }} allowFontScaling={false}>
                  {ret.label} from {titleCaseStation(ret.station)} — miss it and you&apos;re in a surge-priced rideshare.
                </Text>
              </View>
            ) : null}
          </Card>
        ) : (
          <Card>
            <SectionTitle title="How it works" />
            <Text style={{ color: colors.muted, fontSize: 14 * effectiveScale, lineHeight: 20 * effectiveScale }} allowFontScaling={false}>
              Pick your boarding stop above and we&apos;ll show the last three trains that beat the downtown arrival
              window — plus the final train home so you never get stranded. All times from the published Valley
              Metro timetable.
            </Text>
          </Card>
        )}

        <Card>
          <SectionTitle title="Driving partway?" subtitle="Free lots at suburban stations" />
          <Link href="/park-ride" asChild>
            <AppButton variant="secondary">Find a park & ride station</AppButton>
          </Link>
          <Link href="/downtown-map" asChild>
            <AppButton variant="ghost">See the downtown venue map</AppButton>
          </Link>
        </Card>

        <Pill accessibilityLabel="Data source">Times from the published Valley Metro timetable — verify game-week schedules with Valley Metro.</Pill>
      </ScrollView>
    </Screen>
  );
}
