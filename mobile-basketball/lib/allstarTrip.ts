import { SCHEDULES, type DayType, type Direction, type LineId } from './liveSchedules';
import type { GameDay } from './allstar';

// Game-day routing over the Valley Metro timetable. The arena sits between the
// 3rd St pair on the A Line and the Downtown Hub pair on the B Line, so every
// fan funnels to one of three arrival stops depending on where they board.
export interface GameRoute {
  id: string;
  line: LineId;
  direction: Direction;
  destStation: string;
  label: string;
  catchment: string;
  walkNote: string;
}

export const GAME_ROUTES: GameRoute[] = [
  {
    id: 'a-west',
    line: 'a',
    direction: 'westbound',
    destStation: '3RD ST/WASHINGTON',
    label: 'A Line westbound',
    catchment: 'Mesa, Tempe & SE Valley',
    walkNote: '2-minute walk to Mortgage Matchup Center',
  },
  {
    id: 'b-south',
    line: 'b',
    direction: 'southbound',
    destStation: 'DOWNTOWN PHX HUB/1ST AVE',
    label: 'B Line southbound',
    catchment: 'North Phoenix, Glendale & Metrocenter',
    walkNote: '1 block to the arena',
  },
  {
    id: 'b-north',
    line: 'b',
    direction: 'northbound',
    destStation: 'DOWNTOWN PHX HUB/CENTRAL AVE',
    label: 'B Line northbound',
    catchment: 'South Phoenix & Baseline corridor',
    walkNote: '4-minute walk to the arena',
  },
];

// Where each inbound crowd catches the train home, and on which line.
export const RETURN_ROUTES: Record<string, { line: LineId; direction: Direction; station: string; label: string }> = {
  'a-west': { line: 'a', direction: 'eastbound', station: '3RD ST/JEFFERSON', label: 'A Line eastbound' },
  'b-south': { line: 'b', direction: 'northbound', station: 'WASHINGTON/CENTRAL AVE', label: 'B Line northbound' },
  'b-north': { line: 'b', direction: 'southbound', station: 'DOWNTOWN PHX HUB/JEFFERSON ST', label: 'B Line southbound' },
};

export function titleCaseStation(name: string): string {
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

export function formatMinutes(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hour24 = Math.floor(m / 60);
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour}:${String(m % 60).padStart(2, '0')} ${hour24 < 12 ? 'AM' : 'PM'}`;
}

// Every boardable station on a route, in travel order — anything before the
// arena stop works as an origin.
export function originsFor(route: GameRoute): string[] {
  const schedule = SCHEDULES[route.line]?.weekday?.[route.direction];
  if (!schedule) return [];
  const destIdx = schedule.stations.indexOf(route.destStation);
  return schedule.stations.slice(0, destIdx < 0 ? undefined : destIdx);
}

export interface TripOption {
  depart: number;
  arrive: number;
}

// Latest trains that still get a fan to the arena stop before the target
// arrival time. Looks 150 minutes back from the target so earlier options
// exist for people who want a long pre-game downtown.
export function tripsToArena(route: GameRoute, origin: string, day: GameDay, count = 3): TripOption[] {
  const schedule = SCHEDULES[route.line]?.[day.dayType]?.[route.direction];
  if (!schedule) return [];
  const oi = schedule.stations.indexOf(origin);
  const di = schedule.stations.indexOf(route.destStation);
  if (oi < 0 || di < 0 || oi >= di) return [];
  return schedule.trips
    .map((trip) => ({ depart: trip[oi], arrive: trip[di] }))
    .filter((t) => t.depart >= 0 && t.arrive >= 0 && t.arrive <= day.arriveByMinutes && t.arrive >= day.arriveByMinutes - 150)
    .sort((a, b) => a.arrive - b.arrive)
    .slice(-count);
}

// Last departure of the day from the return-leg station — the train a fan must
// not miss. Includes post-midnight trips (timetable uses values >= 1440).
export function lastTrainHome(route: GameRoute, day: GameDay): number | null {
  const ret = RETURN_ROUTES[route.id];
  const schedule = SCHEDULES[ret.line]?.[day.dayType]?.[ret.direction];
  if (!schedule) return null;
  const idx = schedule.stations.indexOf(ret.station);
  if (idx < 0) return null;
  let last: number | null = null;
  for (const trip of schedule.trips) {
    const t = trip[idx];
    if (t >= 0 && (last === null || t > last)) last = t;
  }
  return last;
}

export function lastTrainAt(line: LineId, direction: Direction, station: string, dayType: DayType): number | null {
  const schedule = SCHEDULES[line]?.[dayType]?.[direction];
  if (!schedule) return null;
  const idx = schedule.stations.indexOf(station);
  if (idx < 0) return null;
  let last: number | null = null;
  for (const trip of schedule.trips) {
    const t = trip[idx];
    if (t >= 0 && (last === null || t > last)) last = t;
  }
  return last;
}

// Next departures from a station right now — powers the platform pulse card.
export function nextDepartures(
  line: LineId,
  direction: Direction,
  station: string,
  now: Date,
  count = 2,
): number[] {
  const day: DayType = now.getDay() === 0 ? 'sunday' : now.getDay() === 6 ? 'saturday' : 'weekday';
  const schedule = SCHEDULES[line]?.[day]?.[direction];
  if (!schedule) return [];
  const idx = schedule.stations.indexOf(station);
  if (idx < 0) return [];
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const found: number[] = [];
  for (const trip of schedule.trips) {
    const t = trip[idx];
    if (t >= 0 && t >= nowMin) found.push(t);
  }
  // Post-midnight trips are stored as >=1440 for the same service day; also
  // check yesterday's post-midnight runs still on the rails.
  if (found.length < count) {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yd: DayType = yesterday.getDay() === 0 ? 'sunday' : yesterday.getDay() === 6 ? 'saturday' : 'weekday';
    const ysched = SCHEDULES[line]?.[yd]?.[direction];
    const yi = ysched ? ysched.stations.indexOf(station) : -1;
    if (ysched && yi >= 0) {
      for (const trip of ysched.trips) {
        const t = trip[yi];
        if (t >= 1440 && t - 1440 >= nowMin) found.push(t - 1440);
      }
    }
  }
  return found.sort((a, b) => a - b).slice(0, count);
}
