// NCAA API client for fetching sports data
// Upstream data comes from https://ncaa-api.henrygd.me, a public mirror of the
// NCAA stats feed (the old api.ncaa.com endpoints no longer resolve). Requests
// go through the backend proxy first so web builds avoid CORS; on failure the
// client falls back to fetching the upstream API directly.

import { getApiBaseUrl } from './config';

const NCAA_API_BASE = 'https://ncaa-api.henrygd.me';

export interface NcaaTeam {
  id: string;
  name: string;
  abbreviation: string;
  score?: number;
}

export interface NcaaGame {
  id: number;
  sport: string;
  path: string;
  game_date: string;
  home_team: NcaaTeam;
  away_team: NcaaTeam;
  status?: string;
  quarter?: string;
  time_remaining?: string;
  venue?: {
    name: string;
    city: string;
    state: string;
  };
}

export interface NcaaScoreboardResponse {
  games?: NcaaGame[];
}

export interface NcaaStanding {
  team: string;
  conference: string;
  wins: number;
  losses: number;
  ties?: number;
  percentage?: number;
}

export interface NcaaStandingsResponse {
  standings?: NcaaStanding[];
}

// ---- upstream (ncaa-api.henrygd.me) response shapes ----

interface UpstreamTeam {
  score?: string | number;
  names?: { char6?: string; short?: string; seo?: string; full?: string };
  conferences?: { conferenceSeo?: string | null }[];
}

interface UpstreamGame {
  gameID?: string | number;
  away?: UpstreamTeam;
  home?: UpstreamTeam;
  finalMessage?: string;
  startTime?: string;
  startTimeEpoch?: string | number;
  gameState?: string;
  startDate?: string;
  currentPeriod?: string;
  contestClock?: string;
}

interface UpstreamStandingsGroup {
  conference?: string;
  standings?: Record<string, unknown>[];
}

function toScore(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function mapTeam(team: UpstreamTeam | undefined): NcaaTeam {
  const names = team?.names ?? {};
  const name = names.short || names.full || names.char6 || 'TBD';
  return {
    id: names.seo || name,
    name,
    abbreviation: names.char6 || name,
    score: toScore(team?.score),
  };
}

function teamInConference(team: UpstreamTeam | undefined, conference: string): boolean {
  return (team?.conferences ?? []).some((c) => c?.conferenceSeo === conference);
}

function gameStatus(game: UpstreamGame): string | undefined {
  if (game.finalMessage?.trim()) return game.finalMessage.trim();
  switch (game.gameState) {
    case 'final':
      return 'Final';
    case 'live':
      return 'Live';
    case 'pre':
      return game.startTime || undefined;
    default:
      return undefined;
  }
}

function mapGame(entry: unknown, sport: string, division: string): NcaaGame | null {
  const normalized = entry as NcaaGame | null;
  // The backend proxy already normalizes; pass those entries straight through.
  if (normalized && typeof normalized === 'object' && normalized.home_team && normalized.away_team) {
    return normalized;
  }
  const game = (entry as { game?: UpstreamGame } | null)?.game;
  if (!game) return null;
  const epoch = Number(game.startTimeEpoch);
  return {
    id: Number(game.gameID) || 0,
    sport,
    path: division,
    game_date: Number.isFinite(epoch) && epoch > 0 ? new Date(epoch * 1000).toISOString() : String(game.startDate ?? ''),
    home_team: mapTeam(game.home),
    away_team: mapTeam(game.away),
    status: gameStatus(game),
    quarter: game.gameState === 'live' ? game.currentPeriod?.trim() || undefined : undefined,
    time_remaining: game.gameState === 'live' ? game.contestClock?.trim() || undefined : undefined,
  };
}

function numField(row: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== '') {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

async function fetchNcaa(path: string): Promise<unknown> {
  const headers = { Accept: 'application/json' };

  try {
    const response = await fetch(`${getApiBaseUrl()}/proxy/ncaa/${path}`, { headers });
    if (response.ok) return await response.json();
  } catch (error) {
    console.warn('NCAA proxy fetch failed, trying upstream directly:', error);
  }

  const response = await fetch(`${NCAA_API_BASE}/${path}`, { headers });
  if (!response.ok) {
    throw new Error(`NCAA API error: ${response.status}`);
  }
  return response.json();
}

export async function fetchScoreboard(sport: string, division: string, conference?: string): Promise<NcaaScoreboardResponse> {
  try {
    const conferencePath = conference ? `/${encodeURIComponent(conference)}` : '';
    const data = await fetchNcaa(`scoreboard/${encodeURIComponent(sport)}/${encodeURIComponent(division)}${conferencePath}`);
    const entries = Array.isArray((data as { games?: unknown[] })?.games) ? (data as { games: unknown[] }).games : [];

    // The upstream scoreboard endpoint ignores the conference segment, so when
    // entries arrive in the raw upstream shape (direct-upstream fallback) the
    // filter is applied here. Proxy-normalized entries are already filtered.
    const filtered = conference
      ? entries.filter((entry) => {
          const game = (entry as { game?: UpstreamGame })?.game;
          if (!game) return true;
          return teamInConference(game.home, conference) || teamInConference(game.away, conference);
        })
      : entries;

    const games = filtered
      .map((entry) => mapGame(entry, sport, division))
      .filter((game): game is NcaaGame => game !== null);

    return { games };
  } catch (error) {
    console.error('NCAA scoreboard fetch error:', error);
    throw new Error(`Failed to fetch scoreboard: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function fetchStandings(sport: string, division: string, conference?: string): Promise<NcaaStandingsResponse> {
  try {
    const conferencePath = conference ? `/${encodeURIComponent(conference)}` : '';
    const data = await fetchNcaa(`standings/${encodeURIComponent(sport)}/${encodeURIComponent(division)}${conferencePath}`);
    const normalized = (data as NcaaStandingsResponse | undefined)?.standings;
    if (Array.isArray(normalized)) return { standings: normalized };
    const groups = Array.isArray((data as { data?: UpstreamStandingsGroup[] })?.data)
      ? (data as { data: UpstreamStandingsGroup[] }).data
      : [];

    const standings: NcaaStanding[] = [];
    for (const group of groups) {
      for (const row of group.standings ?? []) {
        const wins = numField(row, 'Overall W', 'W');
        const losses = numField(row, 'Overall L', 'L');
        const ties = numField(row, 'Overall T', 'T', 'Overall Ties');
        const total = wins + losses + ties;
        standings.push({
          team: String(row['School'] ?? row['Team'] ?? ''),
          conference: String(group.conference ?? ''),
          wins,
          losses,
          ...(ties > 0 ? { ties } : {}),
          ...(total > 0 ? { percentage: wins / total } : {}),
        });
      }
    }
    return { standings };
  } catch (error) {
    console.error('NCAA standings fetch error:', error);
    throw new Error(`Failed to fetch standings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Available sports from the API
export const SPORTS = [
  { value: 'football', label: 'Football', count: 0 },
  { value: 'basketball-men', label: "Men's Basketball", count: 0 },
  { value: 'basketball-women', label: "Women's Basketball", count: 0 },
  { value: 'soccer-men', label: "Men's Soccer", count: 0 },
  { value: 'soccer-women', label: "Women's Soccer", count: 0 },
  { value: 'volleyball-women', label: "Women's Volleyball", count: 0 },
  { value: 'baseball', label: 'Baseball', count: 0 },
  { value: 'softball', label: 'Softball', count: 0 },
  { value: 'icehockey-men', label: "Men's Ice Hockey", count: 0 },
  { value: 'icehockey-women', label: "Women's Ice Hockey", count: 0 },
  { value: 'lacrosse-men', label: "Men's Lacrosse", count: 0 },
  { value: 'lacrosse-women', label: "Women's Lacrosse", count: 0 },
] as const;

// Available divisions
export const DIVISIONS = [
  { value: 'fbs', label: 'FBS', count: 0 },
  { value: 'fcs', label: 'FCS', count: 0 },
  { value: 'd1', label: 'Division I', count: 0 },
  { value: 'd2', label: 'Division II', count: 0 },
  { value: 'd3', label: 'Division III', count: 0 },
] as const;

// Popular conferences for football
export const CONFERENCES = [
  { value: 'big-ten', label: 'Big Ten', count: 0 },
  { value: 'sec', label: 'SEC', count: 0 },
  { value: 'acc', label: 'ACC', count: 0 },
  { value: 'big-12', label: 'Big 12', count: 0 },
  { value: 'pac-12', label: 'Pac-12', count: 0 },
  { value: 'american', label: 'American', count: 0 },
  { value: 'mountain-west', label: 'Mountain West', count: 0 },
] as const;
