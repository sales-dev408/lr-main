import { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { BrandHeader, Card, Screen, SectionTitle } from '@/components/Ui';
import { useDynamicType } from '@/lib/dynamicType';
import { useThemeColors } from '@/lib/useThemeColors';
import { SCHEDULES, type DayType, type Direction } from '@/lib/liveSchedules';

const SIDEBAR_BREAKPOINT = 600;

type ScheduleLineInfo = {
  name: string;
  color: string;
  map: any;
  line: 'a' | 'b';
  direction: Direction;
  stations: string[];
};

type SimulatedLineInfo = {
  name: string;
  color: string;
  map: any;
  stations: string[];
  segmentMinutes: number[];
  firstDeparture: { hour: number; minute: number };
  loop?: boolean;
};

type LineInfo = ScheduleLineInfo | SimulatedLineInfo;

const LINES: LineInfo[] = [
  {
    name: 'A Line',
    color: '#0d9488',
    map: require('@/assets/images/aline_map.jpeg'),
    line: 'a',
    direction: 'eastbound',
    stations: [
      'DOWNTOWN PHX HUB/JEFFERSON ST',
      '3RD ST/JEFFERSON',
      '24TH ST/JEFFERSON',
      '44TH ST/WASHINGTON',
      '50TH ST/WASHINGTON ST',
      'PRIEST DR/WASHINGTON ST',
      'VETERANS WAY/COLLEGE AVE',
      'UNIVERSITY DR/RURAL RD',
      'MCCLINTOCK DR/APACHE BLVD',
      'SYCAMORE/MAIN ST',
      'COUNTRY CLUB/MAIN ST',
      'MESA DR/MAIN ST',
      'GILBERT RD/MAIN ST',
    ],
  },
  {
    name: 'B Line',
    color: '#6366f1',
    map: require('@/assets/images/bline_map.jpeg'),
    line: 'b',
    direction: 'northbound',
    stations: [
      'BASELINE/CENTRAL AVE',
      'SOUTHERN/CENTRAL AVE',
      'BROADWAY/CENTRAL AVE',
      'BUCKEYE/CENTRAL AVE',
      'DOWNTOWN PHX HUB/CENTRAL AVE',
      'WASHINGTON/CENTRAL AVE',
      'VAN BUREN/CENTRAL AVE',
      'MCDOWELL/CENTRAL AVE',
      'THOMAS/CENTRAL AVE',
      'INDIAN SCHOOL/CENTRAL AVE',
      'CENTRAL AVE/CAMELBACK',
      '19TH AVE/CAMELBACK',
      'MONTEBELLO/19TH AVE',
      'GLENDALE/19TH AVE',
      '19TH AVE/DUNLAP',
      'METRO PKWY',
    ],
  },
  {
    name: 'Streetcar',
    color: '#f97316',
    map: require('@/assets/images/streetcar_map.jpeg'),
    stations: [
      'Dorsey/Apache',
      'Rural/Apache',
      'Paseo Del Saber/Apache',
      'College Ave/Apache',
      '11th St/Mill',
      '9th St/Mill',
      '6th St/Mill',
      '3rd St/Mill',
      'University Dr/Ash',
      '5th St/Ash',
      '3rd St/Ash',
      'Tempe Beach Park/Rio Salado',
      'Hayden Ferry/Rio Salado',
      'Marina Heights/Rio Salado',
    ],
    segmentMinutes: [1, 2, 2, 3, 2, 2, 2, 2, 2, 2, 3, 2, 2],
    firstDeparture: { hour: 6, minute: 0 },
    loop: true,
  },
];

type LineStatus = {
  current: string;
  next: string;
  minutes: number;
  segmentDuration: number;
  progress: number;
};

function minutesSinceMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

function dayType(date: Date): DayType {
  const day = date.getDay();
  if (day === 0) return 'sunday';
  if (day === 6) return 'saturday';
  return 'weekday';
}

function scheduleFor(date: Date, line: 'a' | 'b', direction: Direction) {
  const day = dayType(date);
  const lineSchedules = SCHEDULES[line];
  if (!lineSchedules) return null;
  const daySchedule = lineSchedules[day];
  if (!daySchedule) return null;
  return daySchedule[direction] ?? null;
}

function firstValidIndex(trip: number[]) {
  for (let i = 0; i < trip.length; i += 1) {
    if (trip[i] !== -1) return i;
  }
  return -1;
}

function lastValidIndex(trip: number[]) {
  for (let i = trip.length - 1; i >= 0; i -= 1) {
    if (trip[i] !== -1) return i;
  }
  return -1;
}

function getScheduleStatus(line: ScheduleLineInfo, now: Date): LineStatus {
  const nowMinutes = minutesSinceMidnight(now);
  const schedule = scheduleFor(now, line.line, line.direction);

  if (!schedule || schedule.trips.length === 0) {
    return { current: '—', next: '—', minutes: 0, segmentDuration: 0, progress: 0 };
  }

  // Try the current day; if no active trip, look ahead to the next day's schedule.
  const candidate = findBestTrip(schedule.trips, nowMinutes, line.stations);
  if (candidate) return candidate;

  const nextDay = new Date(now);
  nextDay.setDate(now.getDate() + 1);
  const nextSchedule = scheduleFor(nextDay, line.line, line.direction) ?? schedule;
  const nextTrips = nextSchedule?.trips ?? schedule.trips;
  // Shift current time back by a day so next-day trip times line up with now.
  const nextDayCandidate = findBestTrip(nextTrips, nowMinutes - 1440, line.stations);
  if (nextDayCandidate) return nextDayCandidate;

  const fallbackTrip = schedule.trips[0];
  return statusFromTrip(fallbackTrip, line.stations, -1440);
}

function findBestTrip(trips: number[][], nowMinutes: number, stations: string[]): LineStatus | null {
  let best: { nextArrival: number; status: LineStatus } | null = null;
  for (const trip of trips) {
    const status = statusFromTrip(trip, stations, nowMinutes);
    if (status.next === '—') continue;
    const nextArrival = nowMinutes + status.minutes;
    if (!best || nextArrival < best.nextArrival) {
      best = { nextArrival, status };
    }
  }
  return best?.status ?? null;
}

function statusFromTrip(trip: number[], stations: string[], nowMinutes: number): LineStatus {
  const startIdx = firstValidIndex(trip);
  const endIdx = lastValidIndex(trip);

  if (startIdx === -1) {
    return { current: '—', next: '—', minutes: 0, segmentDuration: 0, progress: 0 };
  }

  // If the train hasn't started yet, show first station and next departure.
  if (nowMinutes < trip[startIdx]) {
    let nextIdx = startIdx + 1;
    while (nextIdx <= endIdx && trip[nextIdx] === -1) nextIdx += 1;
    const nextTime = trip[nextIdx] ?? trip[endIdx];
    const segmentDuration = Math.max(1, nextTime - trip[startIdx]);
    return {
      current: stations[startIdx],
      next: stations[nextIdx] ?? stations[endIdx],
      minutes: Math.max(0, Math.ceil(nextTime - nowMinutes)),
      segmentDuration,
      progress: 0,
    };
  }

  // If the train has already finished, mark it so it can be skipped in favor
  // of the next day's first departure.
  if (nowMinutes >= trip[endIdx]) {
    return { current: '—', next: '—', minutes: 0, segmentDuration: 0, progress: 0 };
  }

  // Find the station the train has most recently passed and the next stop.
  let currentIdx = startIdx;
  let nextIdx = endIdx;
  for (let i = startIdx; i < endIdx; i += 1) {
    if (trip[i] === -1) continue;
    let j = i + 1;
    while (j <= endIdx && trip[j] === -1) j += 1;
    if (j > endIdx) continue;
    if (nowMinutes >= trip[i] && nowMinutes < trip[j]) {
      currentIdx = i;
      nextIdx = j;
    }
  }

  const segmentDuration = Math.max(1, trip[nextIdx] - trip[currentIdx]);
  const elapsed = Math.max(0, nowMinutes - trip[currentIdx]);
  const minutesToNext = Math.max(0, Math.ceil(trip[nextIdx] - nowMinutes));
  const progress = Math.min(1, Math.max(0, elapsed / segmentDuration));

  return {
    current: stations[currentIdx],
    next: stations[nextIdx],
    minutes: minutesToNext,
    segmentDuration,
    progress,
  };
}

function getSimulatedStatus(line: SimulatedLineInfo, now: Date): LineStatus {
  const totalMinutes = line.segmentMinutes.reduce((a, b) => a + b, 0);
  const start = line.firstDeparture.hour * 60 + line.firstDeparture.minute;
  let elapsed = minutesSinceMidnight(now) - start;
  if (elapsed < 0) {
    elapsed += Math.ceil(-elapsed / totalMinutes) * totalMinutes;
  }
  const intoCycle = elapsed % totalMinutes;

  let currentIndex = 0;
  let accumulated = 0;
  for (let i = 0; i < line.segmentMinutes.length; i += 1) {
    const duration = line.segmentMinutes[i];
    if (intoCycle <= accumulated + duration) {
      currentIndex = i;
      break;
    }
    accumulated += duration;
  }

  const segmentDuration = line.segmentMinutes[currentIndex];
  const elapsedInSegment = intoCycle - accumulated;
  const minutesToNext = Math.max(0, Math.ceil(segmentDuration - elapsedInSegment));
  const progress = Math.min(1, Math.max(0, elapsedInSegment / segmentDuration));
  const nextIndex = line.loop ? (currentIndex + 1) % line.stations.length : Math.min(currentIndex + 1, line.stations.length - 1);

  return {
    current: line.stations[currentIndex],
    next: line.stations[nextIndex],
    minutes: minutesToNext,
    segmentDuration,
    progress,
  };
}

function getLineStatus(line: LineInfo, now: Date): LineStatus {
  return 'line' in line ? getScheduleStatus(line, now) : getSimulatedStatus(line, now);
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function StatusRow({ label, value, color, muted, centered = false }: { label: string; value: string; color: string; muted?: string; centered?: boolean }) {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  return (
    <View style={{ gap: 4, alignItems: centered ? 'center' : 'flex-start' }}>
      <Text style={{ color: colors.muted, fontSize: 11 * effectiveScale, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }} allowFontScaling={false}>{label}</Text>
      <Text style={{ color, fontSize: 15 * effectiveScale, fontWeight: '700', lineHeight: 22 * effectiveScale, textAlign: centered ? 'center' : 'left' }} allowFontScaling={false}>{value}</Text>
      {muted ? <Text style={{ color: colors.muted, fontSize: 12 * effectiveScale, textAlign: centered ? 'center' : 'left' }} allowFontScaling={false}>{muted}</Text> : null}
    </View>
  );
}

function LineCard({ line, status, compact }: { line: LineInfo; status: LineStatus; compact: boolean }) {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  const { width } = useWindowDimensions();
  const centered = width < SIDEBAR_BREAKPOINT;

  return (
    <Card>
      <View style={{ alignItems: centered ? 'center' : 'flex-start', gap: 14 }}>
        <Image
          source={line.map}
          style={{ width: '100%', height: 200 * effectiveScale, borderRadius: 16, backgroundColor: colors.panel }}
          resizeMode="contain"
          accessibilityLabel={`${line.name} map`}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: centered ? 'center' : 'flex-start' }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: line.color }} />
          <Text style={{ color: colors.ink, fontSize: 18 * effectiveScale, fontWeight: '800' }} allowFontScaling={false}>{line.name}</Text>
          <View style={{ borderRadius: 999, backgroundColor: colors.warningSoft, paddingVertical: 4, paddingHorizontal: 10 }}>
            <Text style={{ color: colors.ink, fontSize: 11 * effectiveScale, fontWeight: '800' }} allowFontScaling={false}>LIVE</Text>
          </View>
        </View>

        {compact ? (
          <View style={{ alignItems: 'center', gap: 14, width: '100%' }}>
            <StatusRow label="Current stop" value={status.current} color={colors.ink} centered />
            <StatusRow label="Next station" value={status.next} color={line.color} muted={`Arriving in ${status.minutes} min`} centered />
            <View style={{ width: '100%', height: 8 * effectiveScale, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' }}>
              <View style={{ width: `${status.progress * 100}%`, height: '100%', backgroundColor: line.color, borderRadius: 4 }} />
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingTop: 6 }}>
            <StatusRow label="Current stop" value={status.current} color={colors.ink} />
            <StatusRow label="Next station" value={status.next} color={line.color} muted={`Arriving in ${status.minutes} min`} />
            <View style={{ alignItems: 'flex-end', gap: 4, minWidth: 80 * effectiveScale }}>
              <Text style={{ color: colors.muted, fontSize: 11 * effectiveScale, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }} allowFontScaling={false}>Arrival</Text>
              <Text style={{ color: line.color, fontSize: 26 * effectiveScale, fontWeight: '800' }} allowFontScaling={false}>{status.minutes}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 * effectiveScale }} allowFontScaling={false}>min</Text>
              <View style={{ width: 80 * effectiveScale, height: 6 * effectiveScale, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden', marginTop: 6 }}>
                <View style={{ width: `${status.progress * 100}%`, height: '100%', backgroundColor: line.color, borderRadius: 3 }} />
              </View>
            </View>
          </View>
        )}
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

  const lineStatuses = useMemo(() => LINES.map((line) => getLineStatus(line, now)), [now]);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          gap: 14,
          paddingBottom: 32,
          alignItems: compact ? 'center' : 'stretch',
        }}
      >
        <BrandHeader subtitle={`Live train times · ${formatTime(now)}`} />

        <Card>
          <SectionTitle title="Current trains" subtitle="Next stop and estimated arrival" />
          <View style={{ flexDirection: compact ? 'column' : 'row', gap: 14, justifyContent: 'space-between', alignItems: compact ? 'center' : 'stretch' }}>
            {LINES.map((line, index) => (
              <View key={line.name} style={{ flex: 1, width: '100%' }}>
                <LineCard line={line} status={lineStatuses[index]} compact={compact} />
              </View>
            ))}
          </View>
        </Card>

        <Text
          style={{
            color: colors.warning,
            fontSize: 12 * effectiveScale,
            lineHeight: 18 * effectiveScale,
            textAlign: 'center',
            paddingHorizontal: 8,
            maxWidth: compact ? 360 * effectiveScale : undefined,
          }}
          allowFontScaling={false}
        >
          Live positions are estimated from the published schedule and may be inaccurate due to construction, traffic, and service changes.
        </Text>
      </ScrollView>
    </Screen>
  );
}
