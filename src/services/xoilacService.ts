/**
 * xoilacService.ts
 * Fetches and maps multi-sport match schedules scraped from Xoilacz (fameandpartners.com)
 * into the Match interface used by matchService.
 */

import localXoilacEvents from '../data/xoilac-events.json';
import { type Match } from './matchService';
import { parseJadwalDate, formatMatchTimeForUserZone } from '../utils/indonesiaTime';

// ─── Raw event shape from xoilac-events.json ──────────────────────────────
interface XoilacEvent {
  id_event: string;
  nama_event: string;
  player_1: string;
  player_2: string;
  logo_1: string;
  logo_2: string;
  jadwal_event: string;
  jadwal_stop: string;
  url_iptv: string;
  jenis: string;
  sport_type: string;
  xoilac_slug?: string;
  xoilac_url?: string;
  home_scores?: number[];
  away_scores?: number[];
  status_id?: number;
  is_hot?: number;
  streams_all?: string[];
}

// Sport categories & display names (match Xoilac's sport_list)
export const XOILAC_SPORTS = {
  football: { label: 'Sepak Bola', icon: '⚽', color: '#22c55e' },
  basketball: { label: 'Bola Basket', icon: '🏀', color: '#f97316' },
  tennis: { label: 'Tenis', icon: '🎾', color: '#eab308' },
  badminton: { label: 'Bulu Tangkis', icon: '🏸', color: '#a855f7' },
  volleyball: { label: 'Bola Voli', icon: '🏐', color: '#06b6d4' },
  esports: { label: 'Esports', icon: '🎮', color: '#8b5cf6' },
} as const;

export type XoilacSport = keyof typeof XOILAC_SPORTS;

// Status IDs considered "live" per sport
const LIVE_STATUS_IDS: Record<string, Set<number>> = {
  football: new Set([2, 3, 4, 5, 6, 7]),
  basketball: new Set([2, 3, 4, 5, 6, 7, 8, 9]),
  tennis: new Set([3, 51, 52, 53, 54, 55]),
  badminton: new Set([3, 51, 331, 52, 332, 53, 333, 54, 334, 55]),
  volleyball: new Set([3, 432, 434, 436, 438, 440]),
  esports: new Set([2]),
};

// Status IDs considered "finished" per sport
const FINISHED_STATUS_IDS: Record<string, Set<number>> = {
  football: new Set([8, 10, 11, 12]),
  basketball: new Set([10, 11, 12, 13, 14]),
  tennis: new Set([16, 100, 20, 21]),
  badminton: new Set([16, 100, 20, 21]),
  volleyball: new Set([16, 100]),
  esports: new Set([3, 12]),
};

const parseJadwal = parseJadwalDate;
const formatMatchTime = formatMatchTimeForUserZone;

// ─── RAW CDN URL (mirrors of xoilac-events.json pushed to GitHub) ──────────
const RAW_XOILAC_URL = 'https://raw.githubusercontent.com/diaz1414/YKN-TV/main/data/xoilac-events.json';

async function fetchXoilacEventsRemote(): Promise<XoilacEvent[] | null> {
  try {
    const bucket = Math.floor(Date.now() / 30000); // cache bust every 30s
    const res = await fetch(`${RAW_XOILAC_URL}?t=${bucket}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data)) return data as XoilacEvent[];
  } catch (err) {
    console.warn('[XoilacService] Remote fetch failed, using local data:', err);
  }
  return null;
}

function mapEventToMatch(ev: XoilacEvent): Match {
  const start = parseJadwal(ev.jadwal_event);
  const stop = parseJadwal(ev.jadwal_stop);
  const now = new Date();

  const playableStart = new Date(start.getTime() - 30 * 60 * 1000);
  const playableEnd = new Date(stop.getTime() + 30 * 60 * 1000);

  let status: Match['status'] = 'upcoming';

  // Prefer status_id from API when available
  if (ev.status_id !== undefined && ev.sport_type) {
    if (FINISHED_STATUS_IDS[ev.sport_type]?.has(ev.status_id)) {
      status = 'finished';
    } else if (LIVE_STATUS_IDS[ev.sport_type]?.has(ev.status_id)) {
      status = 'live';
    } else if (now > playableEnd) {
      status = 'finished';
    } else if (now >= playableStart) {
      status = 'upcoming'; // still scheduled, hasn't started
    }
  } else {
    if (now > playableEnd) {
      status = 'finished';
    } else if (now >= playableStart) {
      status = 'live';
    }
  }

  // Compute score from home_scores/away_scores arrays
  // Index 0 = current total, index 1 = HT, 2–6 = extra
  let score: string | undefined;
  if (
    (status === 'live' || status === 'finished') &&
    ev.home_scores?.length && ev.away_scores?.length
  ) {
    const h = ev.home_scores[0] ?? 0;
    const a = ev.away_scores[0] ?? 0;
    score = `${h} - ${a}`;
  }

  return {
    id: ev.id_event,
    homeTeam: {
      name: ev.player_1 || 'TBD',
      logo: ev.logo_1 || '',
    },
    awayTeam: {
      name: ev.player_2 || 'TBD',
      logo: ev.logo_2 || '',
    },
    league: {
      name: ev.nama_event || 'Unknown League',
      logo: '/favicon.svg',
    },
    time: formatMatchTime(start),
    date: ev.jadwal_event,
    stopDate: ev.jadwal_stop,
    status,
    score,
    channelId: ev.id_event,
    // Extra xoilac-specific data (carried on the Match for nav routing)
  };
}

// ─── Main export ──────────────────────────────────────────────────────────
let cachedXoilacMatches: Match[] | null = null;
let xoilacCacheTime = 0;
const CACHE_TTL = 30_000; // 30s

export async function getXoilacMatches(forceRefresh = false): Promise<Match[]> {
  const now = Date.now();
  if (!forceRefresh && cachedXoilacMatches && now - xoilacCacheTime < CACHE_TTL) {
    return cachedXoilacMatches;
  }

  let events: XoilacEvent[] = [];

  // Try remote first
  const remote = await fetchXoilacEventsRemote();
  if (remote) {
    events = remote;
  } else {
    events = (localXoilacEvents as XoilacEvent[]);
  }

  const matches = events.map(mapEventToMatch);
  cachedXoilacMatches = matches;
  xoilacCacheTime = now;
  return matches;
}

/**
 * Returns unique sport types present in the local/remote events.
 */
export function getAvailableSports(): XoilacSport[] {
  const events = localXoilacEvents as XoilacEvent[];
  const seen = new Set<XoilacSport>();
  events.forEach(ev => {
    if (ev.sport_type && ev.sport_type in XOILAC_SPORTS) {
      seen.add(ev.sport_type as XoilacSport);
    }
  });
  return Array.from(seen);
}

/**
 * Filter matches by sport type. Pass null/'all' for all sports.
 */
export function filterBySport(matches: Match[], sport: XoilacSport | 'all' | null): Match[] {
  if (!sport || sport === 'all') return matches;
  return matches.filter(m => m.league.name.toLowerCase().includes(
    XOILAC_SPORTS[sport]?.label.toLowerCase() ?? sport.toLowerCase()
  ));
}
