import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getPool } from '../db/pool.js';

// ---- NCAA upstream normalization ----
// ncaa-api.henrygd.me returns nested shapes (`games[].game`, grouped
// `data[].standings[]`). Normalize into the flat shape every shipped app
// version expects so older bundles keep working without an update.
interface NcaaUpstreamTeam {
  score?: string | number;
  names?: { char6?: string; short?: string; seo?: string; full?: string };
  conferences?: { conferenceSeo?: string | null }[];
}

interface NcaaUpstreamGame {
  gameID?: string | number;
  away?: NcaaUpstreamTeam;
  home?: NcaaUpstreamTeam;
  finalMessage?: string;
  startTime?: string;
  startTimeEpoch?: string | number;
  gameState?: string;
  startDate?: string;
  currentPeriod?: string;
  contestClock?: string;
}

function ncaaToScore(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function ncaaMapTeam(team: NcaaUpstreamTeam | undefined) {
  const names = team?.names ?? {};
  const name = names.short || names.full || names.char6 || 'TBD';
  return {
    id: names.seo || name,
    name,
    abbreviation: names.char6 || name,
    score: ncaaToScore(team?.score),
  };
}

function ncaaTeamInConference(team: NcaaUpstreamTeam | undefined, conference: string): boolean {
  return (team?.conferences ?? []).some((c) => c?.conferenceSeo === conference);
}

function ncaaGameStatus(game: NcaaUpstreamGame): string | undefined {
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

function ncaaMapGame(entry: unknown, sport: string, division: string) {
  const game = (entry as { game?: NcaaUpstreamGame } | null)?.game;
  if (!game) return null;
  const epoch = Number(game.startTimeEpoch);
  return {
    id: Number(game.gameID) || 0,
    sport,
    path: division,
    game_date: Number.isFinite(epoch) && epoch > 0 ? new Date(epoch * 1000).toISOString() : String(game.startDate ?? ''),
    home_team: ncaaMapTeam(game.home),
    away_team: ncaaMapTeam(game.away),
    status: ncaaGameStatus(game),
    quarter: game.gameState === 'live' ? game.currentPeriod?.trim() || undefined : undefined,
    time_remaining: game.gameState === 'live' ? game.contestClock?.trim() || undefined : undefined,
  };
}

function ncaaNumField(row: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== '') {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

// Upstream divisions: football uses fbs/fcs/d2/d3 (d1 does not exist);
// every other sport uses d1/d2/d3 (fbs/fcs do not). Shipped app versions
// keep the stale division when switching sports, so coerce invalid combos
// here instead of passing the upstream 400/404 through to clients (whose
// direct-API fallback points at the dead api.ncaa.com host).
function ncaaCoerceDivision(sport: string, division: string): string {
  const isFootballDivision = division === 'fbs' || division === 'fcs';
  if (sport === 'football') return division === 'd1' ? 'fbs' : division;
  return isFootballDivision ? 'd1' : division;
}

export async function registerHealthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/health', { config: { rateLimit: { max: 100, timeWindow: '1 minute' } } }, async () => {
    const pool = getPool();
    let db = false;

    if (pool) {
      try {
        await pool.query('SELECT 1');
        db = true;
      } catch {
        db = false;
      }
    }

    return { status: 'ok', db };
  });

  fastify.get('/', { config: { rateLimit: { max: 100, timeWindow: '1 minute' } } }, async () => ({
    name: 'Master Gift/Discount Card System Backend',
    version: '0.1.0',
  }));

  // NCAA API proxy endpoint to bypass CORS/DNS issues. Upstream is the public
  // ncaa-api.henrygd.me mirror (the old api.ncaa.com endpoints no longer
  // resolve).
  const ncaaSportPattern = /^(football|basketball-men|basketball-women|soccer-men|soccer-women|volleyball-women|baseball|softball|icehockey-men|icehockey-women|lacrosse-men|lacrosse-women)$/;
  const ncaaDivisionPattern = /^(fbs|fcs|d1|d2|d3)$/;
  const ncaaSegmentPattern = /^[\w\-/]+$/;
  const ncaaUpstreamBase = 'https://ncaa-api.henrygd.me';

  fastify.get('/api/proxy/ncaa/scoreboard/:sport/*', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { sport } = request.params as { sport: string };
    const pathPart = (request.params as Record<string, string>)['*'] ?? '';

    // Validate and sanitize parameters to prevent SSRF
    if (!ncaaSportPattern.test(sport)) {
      return reply.code(400).send({ error: 'Invalid sport parameter' });
    }
    if (!ncaaSegmentPattern.test(pathPart)) {
      return reply.code(400).send({ error: 'Invalid path parameter' });
    }

    // Normalize legacy client paths (`{div}/current/all-conf[/conference]`) to
    // the upstream layout. A trailing non-numeric segment is treated as a
    // conference slug and filtered server-side for older app versions.
    const segments = pathPart.split('/').filter((s) => s && s !== 'current' && s !== 'all-conf');
    let conference: string | null = null;
    if (segments.length > 1 && !/^\d+$/.test(segments[segments.length - 1]!)) {
      conference = segments.pop()!;
    }
    if (segments.length > 0) segments[0] = ncaaCoerceDivision(sport, segments[0]!);
    const upstreamPath = segments.map(encodeURIComponent).join('/');
    const ncaaUrl = `${ncaaUpstreamBase}/scoreboard/${encodeURIComponent(sport)}/${upstreamPath}`;

    try {
      const response = await fetch(ncaaUrl, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        return reply.code(response.status).send({ error: `NCAA API error: ${response.status}` });
      }

      const data = await response.json() as { games?: unknown[] };
      const entries = Array.isArray(data?.games) ? data.games : [];
      // The upstream scoreboard endpoint ignores conference path segments, so
      // filtering happens here by matching team conference slugs.
      const filtered = conference
        ? entries.filter(
            (entry) =>
              ncaaTeamInConference((entry as { game?: NcaaUpstreamGame })?.game?.home, conference) ||
              ncaaTeamInConference((entry as { game?: NcaaUpstreamGame })?.game?.away, conference),
          )
        : entries;
      const games = filtered
        .map((entry) => ncaaMapGame(entry, sport, segments[0] ?? ''))
        .filter((game) => game !== null);
      return reply.send({ games });
    } catch (error) {
      console.error('NCAA API proxy error:', error);
      return reply.code(502).send({ error: 'Failed to fetch from NCAA API' });
    }
  });

  // NCAA API proxy endpoint for standings
  const ncaaStandingsHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const { sport, division } = request.params as { sport: string; division: string; conference?: string };
    const pathConference = (request.params as { conference?: string }).conference;
    const { conference: queryConference } = request.query as { conference?: string };
    const conference = pathConference ?? queryConference;

    // Validate and sanitize parameters to prevent SSRF
    if (!ncaaSportPattern.test(sport)) {
      return reply.code(400).send({ error: 'Invalid sport parameter' });
    }
    if (!ncaaDivisionPattern.test(division)) {
      return reply.code(400).send({ error: 'Invalid division parameter' });
    }
    if (conference && !/^[\w-]+$/.test(conference)) {
      return reply.code(400).send({ error: 'Invalid conference parameter' });
    }

    const conferencePath = conference ? `/${encodeURIComponent(conference)}` : '';
    const ncaaUrl = `${ncaaUpstreamBase}/standings/${encodeURIComponent(sport)}/${encodeURIComponent(ncaaCoerceDivision(sport, division))}${conferencePath}`;

    try {
      const response = await fetch(ncaaUrl, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        return reply.code(response.status).send({ error: `NCAA API error: ${response.status}` });
      }

      const data = await response.json() as { data?: { conference?: string; standings?: Record<string, unknown>[] }[] };
      const groups = Array.isArray(data?.data) ? data.data : [];
      const standings: Record<string, unknown>[] = [];
      for (const group of groups) {
        for (const row of group.standings ?? []) {
          const wins = ncaaNumField(row, 'Overall W', 'W');
          const losses = ncaaNumField(row, 'Overall L', 'L');
          const ties = ncaaNumField(row, 'Overall T', 'T', 'Overall Ties');
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
      return reply.send({ standings });
    } catch (error) {
      console.error('NCAA API proxy error:', error);
      return reply.code(502).send({ error: 'Failed to fetch from NCAA API' });
    }
  };

  fastify.get('/api/proxy/ncaa/standings/:sport/:division', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, ncaaStandingsHandler);
  fastify.get('/api/proxy/ncaa/standings/:sport/:division/:conference', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, ncaaStandingsHandler);
}
