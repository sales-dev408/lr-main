import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { BrandHeader, Card, Screen, SectionTitle } from '@/components/Ui';
import { useDynamicType } from '@/lib/dynamicType';
import { useThemeColors } from '@/lib/useThemeColors';

type LineInfo = {
  name: string;
  color: string;
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

function minutesSinceMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function getLineStatus(line: LineInfo, now: Date) {
  const totalMinutes = line.segmentMinutes.reduce((a, b) => a + b, 0);
  const start = line.firstDeparture.hour * 60 + line.firstDeparture.minute;
  const nowMin = minutesSinceMidnight(now);
  let elapsed = nowMin - start;
  if (elapsed < 0) {
    elapsed += Math.ceil(-elapsed / totalMinutes) * totalMinutes;
  }
  const intoCycle = elapsed % totalMinutes;

  let currentIndex = 0;
  let accumulated = 0;
  for (let i = 0; i < line.segmentMinutes.length; i += 1) {
    if (intoCycle < accumulated + line.segmentMinutes[i]) {
      currentIndex = i;
      break;
    }
    accumulated += line.segmentMinutes[i];
  }

  const minutesToNext = line.segmentMinutes[currentIndex] - (intoCycle - accumulated);
  const nextIndex = (currentIndex + 1) % line.stations.length;

  return {
    current: line.stations[currentIndex],
    next: line.stations[nextIndex],
    minutes: minutesToNext,
  };
}

export default function LiveTrainsScreen() {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const lineStatuses = useMemo(() => LINES.map((line) => getLineStatus(line, now)), [now]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
        <BrandHeader subtitle="Live trains" />

        <Card>
          <SectionTitle title="Current trains" subtitle="Next stop and estimated arrival" />

          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', backgroundColor: colors.brandSoft, paddingVertical: 10, paddingHorizontal: 12, gap: 8 }}>
              <Text style={{ flex: 1.2, fontWeight: '700', color: colors.ink, fontSize: 13 * effectiveScale }} allowFontScaling={false}>Line</Text>
              <Text style={{ flex: 2.5, fontWeight: '700', color: colors.ink, fontSize: 13 * effectiveScale }} allowFontScaling={false}>Current stop</Text>
              <Text style={{ flex: 2.5, fontWeight: '700', color: colors.ink, fontSize: 13 * effectiveScale }} allowFontScaling={false}>Next station</Text>
              <Text style={{ flex: 1, fontWeight: '700', color: colors.ink, fontSize: 13 * effectiveScale, textAlign: 'right' }} allowFontScaling={false}>Arrival</Text>
            </View>

            {lineStatuses.map((status, index) => {
              const line = LINES[index];
              const isLast = index === lineStatuses.length - 1;
              return (
                <View
                  key={line.name}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 14,
                    paddingHorizontal: 12,
                    gap: 8,
                    backgroundColor: index % 2 === 1 ? colors.panel : colors.bg,
                    borderBottomWidth: isLast ? 0 : 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ flex: 1.2, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: line.color }} />
                    <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 13 * effectiveScale }} allowFontScaling={false}>{line.name}</Text>
                  </View>
                  <Text style={{ flex: 2.5, color: colors.ink, fontSize: 12 * effectiveScale, lineHeight: 18 * effectiveScale }} allowFontScaling={false}>{status.current}</Text>
                  <Text style={{ flex: 2.5, color: colors.ink, fontSize: 12 * effectiveScale, lineHeight: 18 * effectiveScale }} allowFontScaling={false}>{status.next}</Text>
                  <Text style={{ flex: 1, color: colors.muted, fontSize: 13 * effectiveScale, fontWeight: '700', textAlign: 'right' }} allowFontScaling={false}>
                    {status.minutes} min
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>

        <Text style={{ color: colors.warning, fontSize: 12 * effectiveScale, lineHeight: 18 * effectiveScale, textAlign: 'center', paddingHorizontal: 8 }} allowFontScaling={false}>
          Live positions are estimated from the published PDF schedule and may be inaccurate due to construction, traffic, and service changes.
        </Text>
      </ScrollView>
    </Screen>
  );
}
