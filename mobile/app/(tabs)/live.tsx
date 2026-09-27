import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { BrandHeader, Card, GlassCard, Pill, Screen, SectionTitle } from '@/components/Ui';
import { ZoomableImage } from '@/components/ZoomableImage';
import { useDynamicType } from '@/lib/dynamicType';
import { useThemeColors } from '@/lib/useThemeColors';
import { SCHEDULES, type DayType, type Direction, type LineId } from '@/lib/liveSchedules';

const SIDEBAR_BREAKPOINT = 600;

type LineInfo = {
  name: string;
  color: string;
  map: any;
  line: LineId;
  direction: Direction;
};

const LINES: LineInfo[] = [
  {
    name: 'A Line',
    color: '#0d9488',
    map: require('@/assets/images/aline_map.jpeg'),
    line: 'a',
    direction: 'eastbound',
  },
  {
    name: 'A Line',
    color: '#0d9488',
    map: require('@/assets/images/aline_map.jpeg'),
    line: 'a',
    direction: 'westbound',
  },
  {
    name: 'B Line',
    color: '#6366f1',
    map: require('@/assets/images/bline_map.jpeg'),
    line: 'b',
    direction: 'northbound',
  },
  {
    name: 'B Line',
    color: '#6366f1',
    map: require('@/assets/images/bline_map.jpeg'),
    line: 'b',
    direction: 'southbound',
  },
  {
    name: 'Streetcar',
    color: '#f97316',
    map: require('@/assets/images/streetcar_map.jpeg'),
    line: 'streetcar',
    direction: 'northbound',
  },
  {
    name: 'Streetcar',
    color: '#f97316',
    map: require('@/assets/images/streetcar_map.jpeg'),
    line: 'streetcar',
    direction: 'southbound',
  },
];

// Valley Metro schedules run on Phoenix local time (America/Phoenix, UTC-7, no
// DST). Rebase "now" onto Phoenix wall time so the times stay correct no matter
// what timezone the device is set to.
const PHOENIX_OFFSET_MIN = 7 * 60; // minutes behind UTC

function toPhoenixTime(date: Date) {
  // Returns a Date whose local-time getters read as Phoenix wall-clock time.
  return new Date(date.getTime() + (date.getTimezoneOffset() - PHOENIX_OFFSET_MIN) * 60000);
}

function minutesSinceMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

function dayType(date: Date): DayType {
  const day = date.getDay();
  if (day === 0) return 'sunday';
  if (day === 6) return 'saturday';
  return 'weekday';
}

function dayLabel(day: DayType) {
  return day === 'weekday' ? 'Weekday' : day.charAt(0).toUpperCase() + day.slice(1);
}

function lineKey(line: LineInfo) {
  return `${line.name}-${line.direction}`;
}

function formatArrival(minutes: number) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hour24 = Math.floor(m / 60);
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour}:${String(m % 60).padStart(2, '0')} ${hour24 < 12 ? 'AM' : 'PM'}`;
}

function scheduleFor(date: Date, line: LineId, direction: Direction) {
  const day = dayType(date);
  const lineSchedules = SCHEDULES[line];
  if (!lineSchedules) return null;
  const daySchedule = lineSchedules[day];
  if (!daySchedule) return null;
  return daySchedule[direction] ?? null;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * All stops served by a line+direction, in timetable order. Station lists are
 * identical across day types for a given direction, so weekday is preferred
 * with the other days as fallback.
 */
function stationsForLine(line: LineInfo): string[] {
  for (const day of ['weekday', 'saturday', 'sunday'] as DayType[]) {
    const stations = SCHEDULES[line.line]?.[day]?.[line.direction]?.stations;
    if (stations && stations.length > 0) return stations;
  }
  return [];
}

/**
 * Minutes-since-midnight of the next scheduled arrival at a stop, looking at
 * yesterday (post-midnight trips), today, and tomorrow so results stay correct
 * around the end of service. Returns null when nothing serves the stop.
 */
function nextArrivalAtStop(
  line: LineId,
  direction: Direction,
  stationIndex: number,
  now: Date,
): { minutes: number; day: DayType } | null {
  const nowMinutes = minutesSinceMidnight(now);
  const candidates: { minutes: number; day: DayType }[] = [];

  const consider = (date: Date, offset: number) => {
    const schedule = scheduleFor(date, line, direction);
    if (!schedule) return;
    const day = dayType(date);
    for (const trip of schedule.trips) {
      const t = trip[stationIndex];
      if (typeof t !== 'number' || t < 0) continue;
      const absolute = t + offset;
      if (absolute >= nowMinutes) candidates.push({ minutes: absolute, day });
    }
  };

  const previousDay = new Date(now);
  previousDay.setDate(now.getDate() - 1);
  consider(previousDay, -1440);
  consider(now, 0);
  const nextDay = new Date(now);
  nextDay.setDate(now.getDate() + 1);
  consider(nextDay, 1440);

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.minutes - b.minutes);
  return candidates[0];
}

function arrivalDayLabel(minutes: number) {
  return minutes < 1440 ? 'Today' : minutes < 2880 ? 'Tomorrow' : `In ${Math.floor(minutes / 1440)} days`;
}

/** "DOWNTOWN PHX HUB/JEFFERSON ST" -> "Downtown PHX Hub/Jefferson St" */
function titleCaseStation(name: string) {
  return name
    .split('/')
    .map((part) =>
      part
        .split(' ')
        .map((token) => {
          const lower = token.toLowerCase();
          if (lower === 'phx') return 'PHX';
          if (/^\d+(st|nd|rd|th)$/i.test(token)) return lower;
          return token.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join(' '),
    )
    .join('/');
}

function StopArrivalPicker({ line, now }: { line: LineInfo; now: Date }) {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const stations = useMemo(() => stationsForLine(line), [line]);

  const arrival =
    selectedIndex != null ? nextArrivalAtStop(line.line, line.direction, selectedIndex, now) : null;

  if (stations.length === 0) return null;

  return (
    <View style={{ width: '100%', gap: 8 }}>
      <Pressable
        onPress={() => setOpen((prev) => !prev)}
        accessibilityRole="button"
        accessibilityLabel={`Choose a ${line.direction} stop on the ${line.name}`}
        accessibilityState={{ expanded: open }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 11,
          backgroundColor: colors.panel,
        }}
      >
        <Text style={{ color: colors.ink, fontSize: 15 * effectiveScale }} allowFontScaling={false}>
          {selectedIndex != null ? titleCaseStation(stations[selectedIndex]) : 'Choose a stop'}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 14 * effectiveScale }} allowFontScaling={false}>
          {stations.length} stop{stations.length === 1 ? '' : 's'} {open ? '▴' : '▾'}
        </Text>
      </Pressable>

      {open ? (
        <ScrollView
          style={{ maxHeight: 220, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.panel }}
          contentContainerStyle={{ paddingVertical: 4 }}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {stations.map((station, index) => {
            const active = index === selectedIndex;
            return (
              <Pressable
                key={station}
                onPress={() => {
                  setSelectedIndex(index);
                  setOpen(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => ({
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  backgroundColor: pressed || active ? line.color + '18' : 'transparent',
                })}
              >
                <Text
                  style={{ color: colors.ink, fontSize: 14 * effectiveScale, fontWeight: active ? '700' : '400' }}
                  allowFontScaling={false}
                >
                  {titleCaseStation(station)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {selectedIndex != null ? (
        <View style={{ paddingHorizontal: 4 }}>
          {arrival ? (
            <Text style={{ color: colors.ink, fontSize: 14 * effectiveScale }} allowFontScaling={false}>
              Next arrival:{' '}
              <Text style={{ color: line.color, fontWeight: '800' }} allowFontScaling={false}>
                {formatArrival(arrival.minutes)}
              </Text>
              <Text style={{ color: colors.muted }} allowFontScaling={false}>
                {` · ${arrivalDayLabel(arrival.minutes)}`}
              </Text>
            </Text>
          ) : (
            <Text style={{ color: colors.muted, fontSize: 14 * effectiveScale }} allowFontScaling={false}>
              No scheduled arrivals for this stop.
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

function LineCard({ line, compact, now }: { line: LineInfo; compact: boolean; now: Date }) {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  const { width } = useWindowDimensions();
  const centered = width < SIDEBAR_BREAKPOINT;
  const mapHeight = Math.min(200, Math.max(120, width * 0.4)) * effectiveScale;

  return (
    <Card accessibilityLabel={`${line.name} ${line.direction} schedule`}>
      <View style={{ alignItems: centered ? 'center' : 'flex-start', gap: 14, width: '100%' }}>
        <ZoomableImage source={line.map} label={`${line.name} map`} height={mapHeight} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: centered ? 'center' : 'flex-start', flexWrap: 'wrap' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: line.color }} />
            <Text style={{ color: colors.ink, fontSize: 18 * effectiveScale, fontWeight: '800' }} allowFontScaling={false}>{line.name}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Pill tone="warning">{line.direction.charAt(0).toUpperCase() + line.direction.slice(1)}</Pill>
            <Pill tone="neutral">{dayLabel(dayType(now))}</Pill>
          </View>
        </View>

        <StopArrivalPicker line={line} now={now} />
      </View>
    </Card>
  );
}

export default function LiveTrainsScreen() {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  const { width } = useWindowDimensions();
  const [now, setNow] = useState(new Date());

  const compact = width < SIDEBAR_BREAKPOINT;

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(interval);
  }, []);

  const phoenixNow = toPhoenixTime(now);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          gap: 18,
          paddingBottom: 40,
          paddingTop: 4,
          alignItems: 'stretch',
        }}
      >
        <BrandHeader subtitle={`Train Schedule · ${formatTime(phoenixNow)} · ${dayLabel(dayType(phoenixNow))}`} />

        <GlassCard>
          <SectionTitle title="Train schedules" subtitle="Pick a stop to see the next scheduled arrival" />
          <View style={{ flexDirection: compact ? 'column' : 'row', flexWrap: compact ? undefined : 'wrap', gap: 14, justifyContent: compact ? 'flex-start' : 'space-between', alignItems: compact ? 'stretch' : 'stretch' }}>
            {LINES.map((line) => (
              <View key={lineKey(line)} style={{ flex: compact ? undefined : 1, flexBasis: compact ? 'auto' : 0, minWidth: compact ? '100%' : 280, width: compact ? '100%' : undefined, maxWidth: compact ? '100%' : undefined }}>
                <LineCard line={line} compact={compact} now={phoenixNow} />
              </View>
            ))}
          </View>
        </GlassCard>

        <Text
          style={{
            color: colors.warning,
            fontSize: 12 * effectiveScale,
            lineHeight: 18 * effectiveScale,
            textAlign: 'center',
            paddingHorizontal: 8,
          }}
          allowFontScaling={false}
        >
          {`Train schedule information provided by this app is for informational purposes only and may be inaccurate, incomplete, or outdated. Schedules and services can change without notice due to delays, cancellations, weather, traffic, maintenance, emergencies, or other circumstances beyond our control.

The developer does not guarantee the accuracy or reliability of the information and is not responsible for any loss, damage, missed train, missed connection, expense, or inconvenience resulting from reliance on the information provided.

Users should verify schedules and service status with the official railway operator before traveling. By using this feature, you acknowledge that you use the information at your own risk and agree to release the developer from liability to the fullest extent permitted by law.`}
        </Text>
      </ScrollView>
    </Screen>
  );
}
