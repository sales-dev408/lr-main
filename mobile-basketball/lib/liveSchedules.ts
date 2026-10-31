import { SCHEDULE_DATA } from './scheduleData';

export type DayType = 'weekday' | 'saturday' | 'sunday';
export type Direction = 'eastbound' | 'westbound' | 'northbound' | 'southbound';
export type LineId = 'a' | 'b' | 'streetcar';

export type LineSchedule = { stations: string[]; direction: Direction; trips: number[][] };

type ScheduleData = Record<
  LineId,
  Partial<Record<DayType, Partial<Record<Direction, { stations: string[]; trips: number[][] }>>>>
>;

const DATA = SCHEDULE_DATA as unknown as ScheduleData;

export const SCHEDULES: Record<LineId, Partial<Record<DayType, Partial<Record<Direction, LineSchedule>>>>> = {
  a: {},
  b: {},
  streetcar: {},
};

for (const line of ['a', 'b', 'streetcar'] as LineId[]) {
  const lineData = DATA[line];
  for (const day of ['weekday', 'saturday', 'sunday'] as DayType[]) {
    const dayData = lineData?.[day];
    if (!dayData) continue;
    SCHEDULES[line][day] = {};
    for (const direction of Object.keys(dayData) as Direction[]) {
      const entry = dayData[direction];
      if (!entry) continue;
      SCHEDULES[line][day]![direction] = {
        stations: entry.stations,
        direction,
        trips: entry.trips.map((trip) => [...trip]),
      };
    }
  }
}
