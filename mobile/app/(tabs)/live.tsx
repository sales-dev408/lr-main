import { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { BrandHeader, Card, Screen, SectionTitle } from '@/components/Ui';
import { useDynamicType } from '@/lib/dynamicType';
import { useThemeColors } from '@/lib/useThemeColors';

const SIDEBAR_BREAKPOINT = 600;

type LineInfo = {
  name: string;
  color: string;
  map: any;
  stations: string[];
  segmentMinutes: number[];
  firstDeparture: { hour: number; minute: number };
};

// Station names and segment travel times derived from the eTransit PDF:
// A Line eastbound (page 4 first complete trip starting at 5:26 a.m.)
// B Line northbound (page 16 first complete trip starting at 4:58 a.m.)
const LINES: LineInfo[] = [
  {
    name: 'A Line',
    color: '#0d9488',
    map: require('@/assets/images/aline_map.png'),
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
    segmentMinutes: [3, 7, 8, 2, 3, 9, 4, 5, 8, 6, 5, 6],
    firstDeparture: { hour: 5, minute: 26 },
  },
  {
    name: 'B Line',
    color: '#6366f1',
    map: require('@/assets/images/bline_map.png'),
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
    segmentMinutes: [2, 5, 5, 6, 1, 1, 4, 5, 4, 5, 5, 2, 4, 7, 10],
    firstDeparture: { hour: 4, minute: 58 },
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

function getLineStatus(line: LineInfo, now: Date): LineStatus {
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
  const nextIndex = (currentIndex + 1) % line.stations.length;

  return {
    current: line.stations[currentIndex],
    next: line.stations[nextIndex],
    minutes: minutesToNext,
    segmentDuration,
    progress,
  };
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
        <BrandHeader subtitle={`Live trains · ${formatTime(now)}`} />

        <Card>
          <SectionTitle title="Current trains" subtitle="Next stop and estimated arrival" />
          <View style={{ flexDirection: compact ? 'column' : 'row', gap: 14, justifyContent: 'space-between' }}>
            {LINES.map((line, index) => (
              <View key={line.name} style={{ flex: 1 }}>
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
          Live positions are estimated from the published PDF schedule and may be inaccurate due to construction, traffic, and service changes.
        </Text>
      </ScrollView>
    </Screen>
  );
}
