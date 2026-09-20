// NCAA API client for fetching sports data
// Based on https://api.ncaa.com/ - public API limited to 5 requests per second per IP
// Uses backend proxy to bypass CORS/DNS issues

const NCAA_API_BASE = 'https://api.ncaa.com';
const PROXY_API_BASE = 'https://okbolfpndeakmchpznmt.supabase.co/functions/v1/router';

export interface NcaaGame {
  id: number;
  sport: string;
  path: string;
  game_date: string;
  home_team: {
    id: string;
    name: string;
    abbreviation: string;
    score?: number;
  };
  away_team: {
    id: string;
    name: string;
    abbreviation: string;
    score?: number;
  };
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

export async function fetchScoreboard(sport: string, path: string): Promise<NcaaScoreboardResponse> {
  // Try backend proxy first, fall back to direct API
  const proxyUrl = `${PROXY_API_BASE}/proxy/ncaa/scoreboard/${sport}/${path}`;
  const directUrl = `${NCAA_API_BASE}/scoreboard/${sport}/${path}`;
  
  try {
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    if (response.ok) {
      const data = await response.json();
      return { games: data.games || data || [] };
    }
  } catch (error) {
    console.warn('Proxy fetch failed, trying direct API:', error);
  }
  
  // Fallback to direct API
  try {
    const response = await fetch(directUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`NCAA API error: ${response.status}`);
    }
    const data = await response.json();
    return { games: data.games || data || [] };
  } catch (error) {
    console.error('NCAA Scoreboard fetch error:', error);
    if (error instanceof Error && error.message.includes('Failed to fetch')) {
      throw new Error('NCAA API is not accessible in this environment. The API requires a backend proxy to work properly.');
    }
    throw new Error(`Failed to fetch scoreboard: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function fetchStandings(sport: string, division: string, conference?: string): Promise<NcaaStandingsResponse> {
  const conferencePath = conference ? `/${conference}` : '';
  const proxyUrl = `${PROXY_API_BASE}/proxy/ncaa/standings/${sport}/${division}${conferencePath}?conference=${conference || ''}`;
  const directUrl = `${NCAA_API_BASE}/standings/${sport}/${division}${conferencePath}`;
  
  // Try backend proxy first, fall back to direct API
  try {
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    if (response.ok) {
      const data = await response.json();
      return { standings: data.standings || data || [] };
    }
  } catch (error) {
    console.warn('Proxy fetch failed, trying direct API:', error);
  }
  
  // Fallback to direct API
  try {
    const response = await fetch(directUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`NCAA API error: ${response.status}`);
    }
    const data = await response.json();
    return { standings: data.standings || data || [] };
  } catch (error) {
    console.error('NCAA Standings fetch error:', error);
    if (error instanceof Error && error.message.includes('Failed to fetch')) {
      throw new Error('NCAA API is not accessible in this environment. The API requires a backend proxy to work properly.');
    }
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
