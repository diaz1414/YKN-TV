/**
 * xoilacService.ts
 * Legacy service name kept for existing imports, but the data source is now
 * EmbedSportex: https://api.esportex.site/api/streams
 */

import { type Match } from './matchService';
import { parseJadwalDate, formatMatchTimeForUserZone } from '../utils/indonesiaTime';

interface EsportexIframe {
  server?: string;
  url?: string;
}

interface EsportexMatch {
  slug?: string;
  tag?: string;
  kickoff?: string;
  endTime?: string;
  poster?: string | null;
  iframes?: EsportexIframe[];
  league?: string;
}

interface EsportexStreamsResponse {
  success?: boolean;
  timestamp?: number;
  READ_ME?: string;
  [key: string]: unknown;
}

export interface EsportexEvent {
  id_event: string;
  nama_event: string;
  player_1: string;
  player_2: string;
  logo_1: string;
  logo_2: string;
  jadwal_event: string;
  jadwal_stop: string;
  url_iptv: string;
  url_license?: string;
  jenis: 'iframe';
  sport_type: XoilacSport;
  poster?: string;
  esportex_slug?: string;
  deskripsi?: string;
  deskripsi_en?: string;
  streams_all: Array<{
    server: string;
    url: string;
  }>;
}

interface SportMeta {
  label: string;
  icon: string;
  color: string;
}

// Export name kept for UI compatibility. Keys mirror EmbedSportex categories.
export const XOILAC_SPORTS = {
  football: { label: 'Sepak Bola', icon: '⚽', color: '#22c55e' },
  basketball: { label: 'Bola Basket', icon: '🏀', color: '#f97316' },
  amfootball: { label: 'American Football', icon: '🏈', color: '#84cc16' },
  baseball: { label: 'Baseball', icon: '⚾', color: '#ef4444' },
  badminton: { label: 'Bulu Tangkis', icon: '🏸', color: '#a855f7' },
  volleyball: { label: 'Bola Voli', icon: '🏐', color: '#06b6d4' },
  tennis: { label: 'Tenis', icon: '🎾', color: '#eab308' },
  race: { label: 'Balapan', icon: '🏁', color: '#64748b' },
  fight: { label: 'Combat', icon: '🥊', color: '#f43f5e' },
  hockey: { label: 'Hockey', icon: '🏒', color: '#38bdf8' },
  rugby: { label: 'Rugby', icon: '🏉', color: '#14b8a6' },
  cricket: { label: 'Cricket', icon: '🏏', color: '#10b981' },
  other: { label: 'Lainnya', icon: '🎯', color: '#f59e0b' },
} as const satisfies Record<string, SportMeta>;

export type XoilacSport = keyof typeof XOILAC_SPORTS;

export const ESPORTEX_STREAMS_URL = 'https://api.esportex.site/api/streams';

const ESPORTEX_SPORT_KEYS = Object.keys(XOILAC_SPORTS) as XoilacSport[];
const CACHE_TTL = 30_000;
const FETCH_TIMEOUT_MS = 8_000;
const DEFAULT_EVENT_DURATION_MS = 3 * 60 * 60 * 1000;
const FALLBACK_LOGO = '/favicon.svg';

const parseJadwal = parseJadwalDate;
const formatMatchTime = formatMatchTimeForUserZone;

let cachedEsportexEvents: EsportexEvent[] | null = null;
let esportexCacheTime = 0;
let esportexInFlight: Promise<EsportexEvent[]> | null = null;
let cachedXoilacMatches: Match[] | null = null;
let xoilacCacheTime = 0;

const cleanText = (value?: string | null): string => (
  (value || '').replace(/\s+/g, ' ').trim()
);

const makeSafeSlug = (value: string): string => (
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
);

const formatDateTimeInWib = (date: Date): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day} ${byType.hour}:${byType.minute}`;
};

const getEndTime = (match: EsportexMatch): string => {
  const explicitEnd = cleanText(match.endTime);
  if (explicitEnd) return explicitEnd;

  const start = parseJadwal(match.kickoff);
  if (isNaN(start.getTime())) return '';

  return formatDateTimeInWib(new Date(start.getTime() + DEFAULT_EVENT_DURATION_MS));
};

const splitMatchTitle = (
  title: string,
  fallbackLeague: string,
  fallbackSportLabel: string
): { home: string; away: string } => {
  const cleanTitle = cleanText(title);
  const separators = [/\s+vs\.?\s+/i, /\s+v\.?\s+/i, /\s+@\s+/i];

  for (const separator of separators) {
    const parts = cleanTitle.split(separator).map(cleanText).filter(Boolean);
    if (parts.length === 2) {
      return { home: parts[0], away: parts[1] };
    }
  }

  return {
    home: cleanTitle || 'Live Event',
    away: fallbackLeague || fallbackSportLabel || 'Live Event',
  };
};

const getLeagueName = (match: EsportexMatch, sport: XoilacSport): string => {
  const sportLabel = XOILAC_SPORTS[sport].label;
  const league = cleanText(match.league) || sportLabel;

  return league.toLowerCase().includes(sportLabel.toLowerCase())
    ? league
    : `${sportLabel} - ${league}`;
};

const toStreams = (iframes?: EsportexIframe[]): EsportexEvent['streams_all'] => (
  (iframes || [])
    .map((iframe, index) => ({
      server: cleanText(iframe.server) || `Server ${index + 1}`,
      url: cleanText(iframe.url),
    }))
    .filter((iframe) => iframe.url.length > 0)
);

const toEsportexEvent = (
  match: EsportexMatch,
  sport: XoilacSport,
  index: number,
  seenIds: Set<string>
): EsportexEvent | null => {
  const title = cleanText(match.tag);
  const kickoff = cleanText(match.kickoff);
  if (!title || !kickoff) return null;

  const sportLabel = XOILAC_SPORTS[sport].label;
  const leagueName = getLeagueName(match, sport);
  const teams = splitMatchTitle(title, cleanText(match.league), sportLabel);
  const baseSlug = cleanText(match.slug) || makeSafeSlug(`${title}-${kickoff}`);
  const safeSlug = makeSafeSlug(baseSlug) || `${sport}-${index}`;
  const baseId = `esportex-${sport}-${safeSlug}`;
  const id = seenIds.has(baseId) ? `${baseId}-${index}` : baseId;
  const streams = toStreams(match.iframes);
  const poster = cleanText(match.poster) || FALLBACK_LOGO;

  seenIds.add(id);

  return {
    id_event: id,
    nama_event: leagueName,
    player_1: teams.home,
    player_2: teams.away,
    logo_1: poster,
    logo_2: poster,
    jadwal_event: kickoff,
    jadwal_stop: getEndTime(match),
    url_iptv: streams[0]?.url || '',
    url_license: '',
    jenis: 'iframe',
    sport_type: sport,
    poster,
    esportex_slug: safeSlug,
    streams_all: streams,
  };
};

const flattenEsportexResponse = (data: EsportexStreamsResponse): EsportexEvent[] => {
  const seenIds = new Set<string>();
  const events: EsportexEvent[] = [];

  for (const sport of ESPORTEX_SPORT_KEYS) {
    const category = data[sport];
    if (!Array.isArray(category)) continue;

    category.forEach((match, index) => {
      const event = toEsportexEvent(match as EsportexMatch, sport, index, seenIds);
      if (event) events.push(event);
    });
  }

  return events;
};

const fetchEsportexEventsRemote = async (): Promise<EsportexEvent[]> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const cacheBucket = Math.floor(Date.now() / CACHE_TTL);

  try {
    const response = await fetch(`${ESPORTEX_STREAMS_URL}?cache=${cacheBucket}`, {
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json() as EsportexStreamsResponse;
    return flattenEsportexResponse(data);
  } finally {
    window.clearTimeout(timeout);
  }
};

export async function getEsportexEvents(forceRefresh = false): Promise<EsportexEvent[]> {
  const now = Date.now();

  if (
    cachedEsportexEvents &&
    now - esportexCacheTime < CACHE_TTL &&
    (!forceRefresh || now - esportexCacheTime < CACHE_TTL)
  ) {
    return cachedEsportexEvents;
  }

  if (esportexInFlight) return esportexInFlight;

  const request = fetchEsportexEventsRemote();
  esportexInFlight = request;

  try {
    const events = await request;
    cachedEsportexEvents = events;
    esportexCacheTime = Date.now();
    return events;
  } catch (err) {
    console.warn('[EsportexService] Remote fetch failed:', err);
    return cachedEsportexEvents || [];
  } finally {
    if (esportexInFlight === request) {
      esportexInFlight = null;
    }
  }
}

const getStatus = (start: Date, stop: Date): Match['status'] => {
  const now = new Date();

  if (!isNaN(stop.getTime()) && now > stop) return 'finished';
  if (!isNaN(start.getTime()) && now >= start) return 'live';

  return 'upcoming';
};

function mapEventToMatch(ev: EsportexEvent): Match {
  const start = parseJadwal(ev.jadwal_event);
  const stop = parseJadwal(ev.jadwal_stop);

  return {
    id: ev.id_event,
    homeTeam: {
      name: ev.player_1 || 'TBD',
      logo: ev.logo_1 || FALLBACK_LOGO,
    },
    awayTeam: {
      name: ev.player_2 || 'TBD',
      logo: ev.logo_2 || FALLBACK_LOGO,
    },
    league: {
      name: ev.nama_event || XOILAC_SPORTS[ev.sport_type].label,
      logo: ev.poster || FALLBACK_LOGO,
    },
    time: formatMatchTime(start),
    date: ev.jadwal_event,
    stopDate: ev.jadwal_stop,
    status: getStatus(start, stop),
    channelId: ev.id_event,
  };
}

const sortMatches = (matches: Match[]): Match[] => (
  [...matches].sort((a, b) => {
    if (a.status !== b.status) {
      if (a.status === 'live') return -1;
      if (b.status === 'live') return 1;
      if (a.status === 'upcoming') return -1;
      if (b.status === 'upcoming') return 1;
    }

    const timeA = a.date ? parseJadwal(a.date).getTime() : 0;
    const timeB = b.date ? parseJadwal(b.date).getTime() : 0;
    return timeA - timeB;
  })
);

export async function getXoilacMatches(forceRefresh = false): Promise<Match[]> {
  const now = Date.now();
  if (cachedXoilacMatches && now - xoilacCacheTime < CACHE_TTL) {
    return cachedXoilacMatches;
  }

  const events = await getEsportexEvents(forceRefresh);
  const matches = sortMatches(events.map(mapEventToMatch));

  cachedXoilacMatches = matches;
  xoilacCacheTime = Date.now();
  return matches;
}

export function getAvailableSports(): XoilacSport[] {
  return [...ESPORTEX_SPORT_KEYS];
}

export function filterBySport(matches: Match[], sport: XoilacSport | 'all' | null): Match[] {
  if (!sport || sport === 'all') return matches;

  const label = XOILAC_SPORTS[sport]?.label.toLowerCase() ?? sport.toLowerCase();
  const providerPrefixes = [`esportex-${sport}-`, `xoilac-${sport}-`];

  return matches.filter((match) => (
    providerPrefixes.some((prefix) => match.id.includes(prefix)) ||
    match.league.name.toLowerCase().includes(label)
  ));
}
