import type { DayType } from './liveSchedules';

// NBA All-Star 2027 content — sourced from nbaevents.nba.com/allstar2027 and
// nbaexperiences.com/nba-all-star-2027. Tip-off is Friday, Feb 19, 2027;
// Phoenix is on Mountain Standard Time year-round.
export const ALLSTAR_START = new Date('2027-02-19T17:00:00-07:00');
export const ALLSTAR_DATES = 'February 19–21, 2027';
export const ALLSTAR_CITY = 'Phoenix, Arizona';

export const ALLSTAR_LINKS = {
  hub: 'https://nbaevents.nba.com/allstar2027',
  buildFanPass: 'https://nbaevents.nba.com/allstar2027/build-my-fan-pass',
  curated: 'https://nbaevents.nba.com/allstar2027/curated',
  packages: 'https://nbaexperiences.com/nba-all-star-2027',
  nbaApp: 'https://nbaevents.nba.com/app',
};

export interface AllStarEvent {
  day: string;
  date: string;
  title: string;
  detail: string;
  venue: string;
}

export const ALLSTAR_SCHEDULE: AllStarEvent[] = [
  {
    day: 'Friday',
    date: 'Feb 19',
    title: 'NBA Jam Session opens',
    detail: 'The league\u2019s all-weekend fan festival — hoops, merch, player appearances.',
    venue: 'Downtown Phoenix',
  },
  {
    day: 'Friday',
    date: 'Feb 19',
    title: 'Castrol Rising Stars',
    detail: 'The NBA\u2019s best rookies and sophomores tip off the weekend.',
    venue: 'Mortgage Matchup Center',
  },
  {
    day: 'Friday',
    date: 'Feb 19',
    title: 'Ruffles NBA All-Star Celebrity Game',
    detail: 'Stars from music, film and sports hit the floor.',
    venue: 'Mortgage Matchup Center',
  },
  {
    day: 'Saturday',
    date: 'Feb 20',
    title: 'NBA All-Star Saturday Night',
    detail: 'Skills Challenge, 3-Point Contest and the Slam Dunk Contest.',
    venue: 'Mortgage Matchup Center',
  },
  {
    day: 'Saturday',
    date: 'Feb 20',
    title: 'NBA All-Star Music Festival',
    detail: 'Live performances around downtown Phoenix all weekend.',
    venue: 'Downtown Phoenix',
  },
  {
    day: 'Sunday',
    date: 'Feb 21',
    title: '76th NBA All-Star Game',
    detail: 'The main event — the league\u2019s best on one floor in Phoenix.',
    venue: 'Mortgage Matchup Center',
  },
];

export interface TicketPackage {
  name: string;
  blurb: string;
  url: string;
}

export const TICKET_PACKAGES: TicketPackage[] = [
  { name: 'Hall of Fame', blurb: 'Top-tier access — all 3 events, premium seats, legends experiences.', url: 'https://nbaexperiences.com/nba-all-star-2027/hall-of-fame' },
  { name: 'Legend', blurb: '3-game package, lower-level seats, EXP Lounge + legend shootaround.', url: 'https://nbaexperiences.com/nba-all-star-2027/legend' },
  { name: 'Playmaker', blurb: 'All 3 events, lower-level behinds, Champions Club access.', url: 'https://nbaexperiences.com/nba-all-star-2027/playmaker' },
  { name: 'MVP', blurb: 'Saturday Night + the Game, lower-level seats, on-court photo.', url: 'https://nbaexperiences.com/nba-all-star-2027/mvp' },
  { name: 'NBA EXP Lounge Premium', blurb: 'Suite-level theater seats and premium lounge access.', url: 'https://nbaexperiences.com/nba-all-star-2027/nba-exp-lounge-premium' },
  { name: 'Rookie', blurb: 'Flexible single-game options across the weekend.', url: 'https://nbaexperiences.com/nba-all-star-2027/rookie' },
  { name: 'Draftee', blurb: '2-game or single-game options, upper-level seats, mascot breakfast.', url: 'https://nbaexperiences.com/nba-all-star-2027/draftee' },
  { name: 'Prospect', blurb: 'Entry-point single-game tickets plus Jam Session admission.', url: 'https://nbaexperiences.com/nba-all-star-2027/prospect' },
];

export interface MapLocation {
  key: string;
  title: string;
  type: 'venue' | 'stop';
  latitude: number;
  longitude: number;
  blurb?: string;
  rail?: string;
}

// Key All-Star weekend locations in downtown Phoenix. Venues and districts in
// orange, Valley Metro Rail stops in purple — coordinates match the published
// stop snapshot used by the rest of the app.
export const DOWNTOWN_LOCATIONS: MapLocation[] = [
  {
    key: 'arena',
    title: 'Mortgage Matchup Center',
    type: 'venue',
    latitude: 33.44566,
    longitude: -112.07114,
    blurb: 'Home of the Phoenix Suns — All-Star Game, Saturday Night, Rising Stars and the Celebrity Game.',
    rail: '3rd St / Jefferson (eastbound) • 3rd St / Washington (westbound), A Line',
  },
  {
    key: 'convention-center',
    title: 'Phoenix Convention Center',
    type: 'venue',
    latitude: 33.44959,
    longitude: -112.06976,
    blurb: 'Downtown fan-festival hub — expected home of NBA Jam Session.',
    rail: '3rd St / Washington + 3rd St / Jefferson, A Line',
  },
  {
    key: 'chase-field',
    title: 'Chase Field',
    type: 'venue',
    latitude: 33.44529,
    longitude: -112.06671,
    blurb: 'Home of the Arizona Diamondbacks — two blocks east of the arena.',
    rail: '3rd St / Jefferson, A Line',
  },
  {
    key: 'cityscape',
    title: 'CityScape Phoenix',
    type: 'venue',
    latitude: 33.4478,
    longitude: -112.0724,
    blurb: 'Bars, restaurants and watch-party spots two blocks from the arena.',
    rail: 'Downtown Phx Hub / Washington St, A Line',
  },
  {
    key: 'arizona-center',
    title: 'Arizona Center',
    type: 'venue',
    latitude: 33.44966,
    longitude: -112.06711,
    blurb: 'Open-air dining, shops and a garden courtyard across from the Convention Center.',
    rail: '3rd St / Washington, A Line',
  },
  {
    key: 'heritage-square',
    title: 'Heritage Square',
    type: 'venue',
    latitude: 33.45024,
    longitude: -112.06608,
    blurb: 'Historic Victorian block — museums and Pizzeria Bianco.',
    rail: '3rd St / Washington, A Line',
  },
  {
    key: 'roosevelt-row',
    title: 'Roosevelt Row',
    type: 'venue',
    latitude: 33.4586,
    longitude: -112.0695,
    blurb: 'Murals, galleries and nightlife in the downtown arts district.',
    rail: 'Roosevelt / Central Ave, B Line',
  },
];

export const DOWNTOWN_STOPS: MapLocation[] = [
  { key: 's-3rd-jeff', title: '3rd St / Jefferson', type: 'stop', latitude: 33.446274, longitude: -112.069297 },
  { key: 's-3rd-wash', title: '3rd St / Washington', type: 'stop', latitude: 33.448352, longitude: -112.070595 },
  { key: 's-hub-jeff', title: 'Downtown Hub / Jefferson St', type: 'stop', latitude: 33.447106, longitude: -112.074424 },
  { key: 's-hub-wash', title: 'Downtown Hub / Washington St', type: 'stop', latitude: 33.448331, longitude: -112.074447 },
  { key: 's-hub-central', title: 'Downtown Hub / Central Ave', type: 'stop', latitude: 33.447756, longitude: -112.073778 },
  { key: 's-hub-1st', title: 'Downtown Hub / 1st Ave', type: 'stop', latitude: 33.447823, longitude: -112.075234 },
  { key: 's-vanburen', title: 'Van Buren / Central Ave', type: 'stop', latitude: 33.451922, longitude: -112.073955 },
  { key: 's-roosevelt', title: 'Roosevelt / Central Ave', type: 'stop', latitude: 33.459383, longitude: -112.073941 },
];

export function daysUntilTipOff(now = new Date()): number {
  return Math.max(0, Math.ceil((ALLSTAR_START.getTime() - now.getTime()) / 86_400_000));
}

// --- Game-day planning ------------------------------------------------------
// Official tip times are TBA — `arriveBy` is the recommended downtown arrival
// window used by the trip planner (planning estimate).
export interface GameDay {
  key: string;
  label: string;
  dayType: DayType;
  date: Date;
  arriveByMinutes: number;
  headline: string;
}

export const GAME_DAYS: GameDay[] = [
  {
    key: 'fri',
    label: 'Friday • Feb 19',
    dayType: 'weekday',
    date: new Date('2027-02-19T09:00:00-07:00'),
    arriveByMinutes: 17 * 60,
    headline: 'Jam Session opens • Castrol Rising Stars • Celebrity Game',
  },
  {
    key: 'sat',
    label: 'Saturday • Feb 20',
    dayType: 'saturday',
    date: new Date('2027-02-20T09:00:00-07:00'),
    arriveByMinutes: 16 * 60 + 30,
    headline: 'All-Star Saturday Night • Music Festival',
  },
  {
    key: 'sun',
    label: 'Sunday • Feb 21',
    dayType: 'sunday',
    date: new Date('2027-02-21T09:00:00-07:00'),
    arriveByMinutes: 16 * 60 + 30,
    headline: '76th NBA All-Star Game',
  },
];

// --- Park & ride ------------------------------------------------------------
// Valley Metro park-and-ride stations feeding the arena. Lots are free and
// unattended — arrive early on event nights.
export interface ParkRide {
  name: string;
  line: string;
  board: string;
  tip: string;
}

export const PARK_AND_RIDE: ParkRide[] = [
  { name: '44th St / Washington', line: 'A Line', board: 'Westbound — 8 stops to the arena', tip: 'Biggest lot near downtown; the classic All-Star play.' },
  { name: '38th St / Washington', line: 'A Line', board: 'Westbound — 7 stops', tip: 'Overflow option when 44th St fills.' },
  { name: 'Priest Dr / Washington St', line: 'A Line', board: 'Westbound — 6 stops', tip: 'Quick in from the 202.' },
  { name: 'Center Pkwy / Washington', line: 'A Line', board: 'Westbound — 5 stops', tip: 'South Tempe access off Priest.' },
  { name: 'Mill Ave / 3rd St', line: 'A Line', board: 'Westbound — 4 stops', tip: 'Tempe garages nearby; pre-game on Mill Ave.' },
  { name: 'Dorsey Ln / Apache Blvd', line: 'A Line', board: 'Westbound — 4 stops', tip: 'Streetcar connection point.' },
  { name: 'McClintock Dr / Apache Blvd', line: 'A Line', board: 'Westbound — 4 stops', tip: 'ASU-adjacent lot.' },
  { name: 'Smith-Martin / Apache Blvd', line: 'A Line', board: 'Westbound — 3 stops', tip: 'Good Mesa-side option.' },
  { name: 'Price-101 Fwy / Apache Blvd', line: 'A Line', board: 'Westbound — 2 stops', tip: 'Right off the 101.' },
  { name: 'Sycamore / Main St', line: 'A Line', board: 'Westbound — 3 stops', tip: 'Central Mesa.' },
  { name: 'Country Club / Main St', line: 'A Line', board: 'Westbound — 2 stops', tip: 'Easy in/out lot.' },
  { name: 'Mesa Dr / Main St', line: 'A Line', board: 'Westbound — 1 stop to end', tip: 'Big east-valley lot.' },
  { name: 'Gilbert Rd / Main St', line: 'A Line', board: 'Westbound — end of line', tip: 'End of the line — never fight downtown parking.' },
  { name: 'Metro Parkway', line: 'B Line', board: 'Southbound — end of line', tip: 'Former Metrocenter lot, tons of space.' },
  { name: 'Dunlap / 25th Ave', line: 'B Line', board: 'Southbound — 7 stops', tip: 'Northwest valley access.' },
  { name: 'Mountain View / 25th Ave', line: 'B Line', board: 'Southbound — 6 stops', tip: 'Quiet lot, quick walk.' },
  { name: '19th Ave / Dunlap', line: 'B Line', board: 'Southbound — 6 stops', tip: 'I-17 corridor option.' },
  { name: 'Northern / 19th Ave', line: 'B Line', board: 'Southbound — 5 stops', tip: 'Mid-town lot.' },
  { name: 'Glendale / 19th Ave', line: 'B Line', board: 'Southbound — 4 stops', tip: 'Historic Glendale approach.' },
  { name: 'Montebello / 19th Ave', line: 'B Line', board: 'Southbound — 3 stops', tip: 'Close-in overflow.' },
  { name: '19th Ave / Camelback', line: 'B Line', board: 'Southbound — 2 stops to downtown edge', tip: 'Camelback corridor.' },
  { name: '7th Ave / Camelback', line: 'B Line', board: 'Southbound — 2 stops', tip: 'Melrose district lot.' },
  { name: 'Central Ave / Camelback', line: 'B Line', board: 'Southbound — 5 stops downtown', tip: 'Uptown anchoring point.' },
  { name: 'Baseline / Central Ave', line: 'B Line', board: 'Northbound — end of line', tip: 'South Phoenix — ride straight up Central.' },
];

// --- Phoenix All-Star history ------------------------------------------------
export const PHX_HISTORY = [
  {
    year: '1975',
    title: 'The first one',
    detail: 'Phoenix\u2019s debut at Veterans Memorial Coliseum — Walt Frazier took MVP.',
  },
  {
    year: '1995',
    title: 'America West Arena',
    detail: 'Mitch Richmond won MVP at the brand-new downtown arena; Dan Majerle repped the Suns at home.',
  },
  {
    year: '2009',
    title: 'Shaq & Kobe, reunited',
    detail: 'The famous co-MVPs at US Airways Center — Phoenix\u2019s last All-Star until now.',
  },
  {
    year: '2027',
    title: 'The Valley runs it back',
    detail: 'First All-Star in Phoenix in 18 years — the 76th edition, at Mortgage Matchup Center.',
  },
];

// --- Daily drop feed ----------------------------------------------------------
// Rotating countdown content — indexed by days remaining so it changes daily.
export const DAILY_DROPS: { tag: string; text: string }[] = [
  { tag: 'Game plan', text: 'Arrive downtown 2+ hours before tip — Jam Session and the fan zones fill fast.' },
  { tag: 'History', text: 'Phoenix last hosted in 2009: Shaq and Kobe shared MVP on the Suns\u2019 own floor.' },
  { tag: 'Rail tip', text: '44th St / Washington has the biggest park & ride on the A Line.' },
  { tag: 'Tickets', text: 'Watch nbaexperiences.com — single-game packages drop in waves. Register for presales.' },
  { tag: 'Pre-game', text: 'CityScape, two blocks from the arena, is the unofficial pre-game district.' },
  { tag: 'History', text: '1995: Mitch Richmond took All-Star MVP at America West Arena in downtown Phoenix.' },
  { tag: 'Beat the surge', text: 'After events, the B Line platforms at 1st Ave are usually lighter than 3rd St.' },
  { tag: 'History', text: '1975: the Valley\u2019s first All-Star Game — Walt Frazier MVP at the Coliseum.' },
  { tag: 'Rail tip', text: 'Weekend trains run about every 15 minutes — you rarely wait long downtown.' },
  { tag: 'Post-game', text: 'Roosevelt Row is the late-night mural district — one B Line stop north.' },
  { tag: 'Game plan', text: 'Know your last train before you go — the planner tab shows it for every stop.' },
  { tag: 'Tickets', text: 'The Fan Pass bundles Jam Session + Celebrity Game + Music Festival entry.' },
];
