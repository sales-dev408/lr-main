export type DayType = 'weekday' | 'saturday' | 'sunday';
export type Direction = 'eastbound' | 'westbound' | 'northbound' | 'southbound';

export type LineSchedule = { stations: string[]; direction: Direction; trips: number[][]; };

type FrequencyRule = { first: number; last: number; interval: number | ((t: number) => number) };

const RULES: Record<DayType, FrequencyRule> = {
  weekday: {
    first: 4 * 60 + 40, // 4:40 a.m.
    last: 23 * 60, // 11 p.m.
    interval: (t) => (t >= 7 * 60 + 30 && t <= 18 * 60 + 30 ? 12 : 20),
  },
  saturday: {
    first: 5 * 60, // 5 a.m.
    last: 26 * 60, // 2 a.m. Sunday
    interval: (t) => (t >= 6 * 60 && t <= 19 * 60 ? 15 : 20),
  },
  sunday: {
    first: 5 * 60, // 5 a.m.
    last: 23 * 60, // 11 p.m.
    interval: 20,
  },
};

const SEGMENT_MINUTES: Record<'a' | 'b', number> = {
  a: 5,
  b: 4,
};

const LINE_STATIONS: Record<'a' | 'b', Partial<Record<Direction, string[]>>> = {
  a: {
    eastbound: [
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
    westbound: [
      'GILBERT RD/MAIN ST',
      'MESA DR/MAIN ST',
      'COUNTRY CLUB/MAIN ST',
      'SYCAMORE/MAIN ST',
      'MCCLINTOCK DR/APACHE BLVD',
      'UNIVERSITY DR/RURAL RD',
      'VETERANS WAY/COLLEGE AVE',
      'PRIEST DR/WASHINGTON ST',
      '50TH ST/WASHINGTON ST',
      '44TH ST/WASHINGTON ST',
      '24TH ST/WASHINGTON ST',
      '3RD ST/WASHINGTON ST',
      'DOWNTOWN PHX HUB/WASHINGTON ST',
    ],
  },
  b: {
    northbound: [
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
    southbound: [
      'METRO PKWY',
      '19TH AVE/DUNLAP',
      'GLENDALE/19TH AVE',
      'MONTEBELLO/19TH AVE',
      '19TH AVE/CAMELBACK',
      'CENTRAL AVE/CAMELBACK',
      'INDIAN SCHOOL/CENTRAL AVE',
      'THOMAS/CENTRAL AVE',
      'MCDOWELL/CENTRAL AVE',
      'VAN BUREN/1ST AVE',
      'DOWNTOWN PHX HUB/1ST AVE',
      'DOWNTOWN PHX HUB/JEFFERSON ST',
      'BUCKEYE/CENTRAL AVE',
      'BROADWAY/CENTRAL AVE',
      'SOUTHERN/CENTRAL AVE',
      'BASELINE/CENTRAL AVE',
    ],
  },
};

function generateDepartures(rule: FrequencyRule): number[] {
  const times: number[] = [];
  let t = rule.first;
  while (t <= rule.last) {
    times.push(t);
    const interval = typeof rule.interval === 'function' ? rule.interval(t) : rule.interval;
    t += interval;
  }
  return times;
}

function buildTrips(stations: string[], segmentMinutes: number, departures: number[]): number[][] {
  return departures.map((departure) => {
    const trip: number[] = [departure];
    for (let i = 1; i < stations.length; i += 1) {
      trip.push(trip[i - 1] + segmentMinutes);
    }
    return trip;
  });
}

export const SCHEDULES: Record<string, Partial<Record<DayType, Partial<Record<Direction, LineSchedule>>>>> = {};

const DAYS: DayType[] = ['weekday', 'saturday', 'sunday'];
const LINES: ('a' | 'b')[] = ['a', 'b'];

for (const line of LINES) {
  SCHEDULES[line] = {};
  for (const day of DAYS) {
    SCHEDULES[line][day] = {};
    const departures = generateDepartures(RULES[day]);
    const segment = SEGMENT_MINUTES[line];
    const directions = Object.keys(LINE_STATIONS[line]) as Direction[];
    for (const direction of directions) {
      const stations = LINE_STATIONS[line][direction];
      if (!stations) continue;
      SCHEDULES[line][day][direction] = {
        stations,
        direction,
        trips: buildTrips(stations, segment, departures),
      };
    }
  }
}
