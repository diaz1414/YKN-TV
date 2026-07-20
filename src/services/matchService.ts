import localEvents from '../data/tv-events.json';
import { getActiveCustomEvents } from './customEventService';
import { formatMatchTimeForUserZone, parseJadwalDate } from '../utils/indonesiaTime';

export interface Match {
  id: string;
  parentMatchId?: string;
  homeTeam: {
    name: string;
    logo: string;
  };
  awayTeam: {
    name: string;
    logo: string;
  };
  league: {
    name: string;
    logo: string;
  };
  time: string;
  status: 'live' | 'upcoming' | 'finished';
  score?: string;
  liveMinute?: string;
  channelId?: string;
  date?: string;
  stopDate?: string;
}



// Synonym maps to help flag resolution
const countryIsoCodes: Record<string, string> = {
  'brazil': 'br', 'morocco': 'ma', 'haiti': 'ht', 'scotland': 'gb-sct', 'australia': 'au',
  'turkiye': 'tr', 'germany': 'de', 'curacao': 'cw', 'netherlands': 'nl', 'japan': 'jp',
  'cote d`ivoire': 'ci', 'cote d\'ivoire': 'ci', 'ecuador': 'ec', 'sweden': 'se',
  'tunisia': 'tn', 'spain': 'es', 'cabo verde': 'cv', 'belgium': 'be', 'egypt': 'eg',
  'saudi arabia': 'sa', 'uruguay': 'uy', 'ir iran': 'ir', 'new zealand': 'nz',
  'france': 'fr', 'senegal': 'sn', 'iraq': 'iq', 'norway': 'no', 'argentina': 'ar',
  'algeria': 'dz', 'austria': 'at', 'jordan': 'jo', 'portugal': 'pt', 'dr congo': 'cd',
  'england': 'gb-eng', 'croatia': 'hr', 'ghana': 'gh', 'panama': 'pa', 'uzbekistan': 'uz',
  'colombia': 'co', 'usa': 'us', 'mexico': 'mx', 'canada': 'ca', 'italy': 'it', 'korea': 'kr'
};

const getFlagByName = (name: string): string => {
  const code = countryIsoCodes[name.toLowerCase().trim()];
  if (code) {
    return `https://flagcdn.com/w80/${code}.png`;
  }
  return 'https://flagcdn.com/w80/un.png';
};

const RAW_EVENTS_URL = 'https://raw.githubusercontent.com/movietrailersxxi-pixel/web/main/assets/tv-events.dat';
const RAW_EVENTS_CACHE_BUST_MS = 5000;
export const MATCH_SCHEDULE_REFRESH_MS = 5000;

export const getRawEventsUrl = () => {
  const bucket = Math.floor(Date.now() / RAW_EVENTS_CACHE_BUST_MS);
  return `${RAW_EVENTS_URL}?t=${bucket}`;
};

const parseJadwal = parseJadwalDate;
const formatMatchTime = formatMatchTimeForUserZone;

const normalizeTeamName = (name: string): string => {
  let lower = name.toLowerCase().trim();
  if (lower.includes('ivoire') || lower.includes('ivory')) return 'ivorycoast';
  if (lower.includes('curacao') || lower.includes('curaçao')) return 'curacao';
  if (lower.includes('cabo verde') || lower.includes('cape verde')) return 'capeverde';
  if (lower.includes('iran')) return 'iran';
  if (lower.includes('dr congo') || lower.includes('democratic republic of the congo')) return 'congo';
  return lower.replace(/[^a-z0-9]/g, '').trim();
};

const getMatchGroupKey = (match: Match): string => {
  const teams = [
    normalizeTeamName(match.homeTeam.name),
    normalizeTeamName(match.awayTeam.name)
  ].sort().join('|');

  const kickoff = match.date ? parseJadwal(match.date).getTime() : 0;

  return `${kickoff}|${teams}`;
};

const getChannelOrder = (match: Match): number => {
  const leagueName = match.league?.name || '';
  const bracketRaw = leagueName.match(/\[([^\]]+)\]/)?.[1]?.trim() || '';
  const bracket = bracketRaw.toUpperCase().replace(/\s+/g, '');

  // CH harus paling depan: CH1, CH2, CH3, CH4
  const chMatch = bracket.match(/^CH(\d+)$/);
  if (chMatch) return Number(chMatch[1]);

  // S setelah CH: S1, S2, S3
  const sMatch = bracket.match(/^S(\d+)$/);
  if (sMatch) return 30 + Number(sMatch[1]);

  // iOS setelah CH/S: IOS, IOS1, IOS2
  const iosMatch = bracket.match(/^IOS(\d+)?$/);
  if (iosMatch) {
    const num = iosMatch[1] ? Number(iosMatch[1]) : 1;
    return 80 + num;
  }

  // Custom events (non-CH/IOS/RTB brackets) — tampil setelah IOS
  if (bracket && !bracket.includes('RTB')) return 90;

  // RTB paling belakang
  if (bracket.includes('RTB')) return 95;

  // Unknown jangan 0, taruh belakang
  return 99;
};

const sortMatchesNeatly = (matches: Match[]): Match[] => {
  const groupOrder = new Map<string, number>();

  matches.forEach((match) => {
    const key = getMatchGroupKey(match);

    if (!groupOrder.has(key)) {
      groupOrder.set(key, groupOrder.size);
    }
  });

  return [...matches].sort((a, b) => {
    if (a.status !== b.status) {
      if (a.status === 'live') return -1;
      if (b.status === 'live') return 1;

      if (a.status === 'upcoming' && b.status === 'finished') return -1;
      if (a.status === 'finished' && b.status === 'upcoming') return 1;

      return 0;
    }

    const dateA = a.date ? parseJadwal(a.date).getTime() : 0;
    const dateB = b.date ? parseJadwal(b.date).getTime() : 0;

    if (dateA !== dateB) {
      return dateA - dateB;
    }

    const groupA = getMatchGroupKey(a);
    const groupB = getMatchGroupKey(b);

    const orderA = groupOrder.get(groupA) ?? 9999;
    const orderB = groupOrder.get(groupB) ?? 9999;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    const channelA = getChannelOrder(a);
    const channelB = getChannelOrder(b);

    if (channelA !== channelB) {
      return channelA - channelB;
    }

    return (a.parentMatchId || a.id).localeCompare(b.parentMatchId || b.id);
  });
};

let cachedMatches: Match[] | null = null;
let cacheTime = 0;
const CACHE_EXPIRY = MATCH_SCHEDULE_REFRESH_MS;

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 3500) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

export const getTodayMatches = async (forceRefresh = false): Promise<Match[]> => {
  const now = Date.now();
  if (!forceRefresh && cachedMatches && (now - cacheTime < CACHE_EXPIRY)) {
    return cachedMatches;
  }

  const loadEvents = async (): Promise<any[]> => {
    try {
      const res = await fetchWithTimeout(getRawEventsUrl(), { cache: 'no-store' }, 3000);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (githubErr) {
      console.warn('Failed to fetch events from GitHub raw, trying Bot API fallback...', githubErr);
      try {
        const envVal = import.meta.env.VITE_BOT_API_URL;
        const BOT_API_URL = envVal === '/api' ? '' : (envVal || 'https://api.ykn.my.id');
        const res = await fetchWithTimeout(`${BOT_API_URL}/api/sports/events`, {}, 3000);
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch (botErr) {
        console.warn('Failed to fetch events from Bot API, falling back to local JSON data...', botErr);
        return Array.isArray(localEvents) ? localEvents : [];
      }
    }
  };

  const getEventStatus = (start: Date, stop: Date): 'live' | 'upcoming' | 'finished' => {
    const nowTime = new Date();
    const playableStart = new Date(start.getTime() - 30 * 60 * 1000);
    const playableEnd = new Date(stop.getTime() + 30 * 60 * 1000);

    if (nowTime > playableEnd) return 'finished';
    if (nowTime >= playableStart) return 'live';
    return 'upcoming';
  };

  const mapEventToMatch = (event: any): Match => {
    const homeTeamName = event.player_1 || 'TBD';
    const awayTeamName = event.player_2 || 'TBD';
    const start = parseJadwal(event.jadwal_event);
    const stop = event.jadwal_stop
      ? parseJadwal(event.jadwal_stop)
      : new Date(start.getTime() + 2 * 60 * 60 * 1000);

    return {
      id: event.id_event,
      homeTeam: {
        name: homeTeamName,
        logo: event.logo_1 || getFlagByName(homeTeamName),
      },
      awayTeam: {
        name: awayTeamName,
        logo: event.logo_2 || getFlagByName(awayTeamName),
      },
      league: {
        name: event.nama_event || 'Live Event',
        logo: '/favicon.png',
      },
      time: formatMatchTime(start),
      date: event.jadwal_event,
      stopDate: event.jadwal_stop,
      status: getEventStatus(start, stop),
      channelId: event.id_event,
    };
  };

  try {
    const eventsData = await loadEvents();
    const parsedMatches = eventsData.map(mapEventToMatch);
    const finalMatches: Match[] = [...parsedMatches];

    try {
      const customEvents = await getActiveCustomEvents();
      customEvents.forEach((ev) => {
        if (finalMatches.some((match) => match.id === ev.id_event)) return;

        const start = ev.jadwal_event ? parseJadwal(ev.jadwal_event) : new Date(0);
        const stop = ev.jadwal_stop
          ? parseJadwal(ev.jadwal_stop)
          : new Date(start.getTime() + 2 * 60 * 60 * 1000);

        const p1 = normalizeTeamName(ev.player_1);
        const p2 = normalizeTeamName(ev.player_2);
        const existingMatch = parsedMatches.find((match) => {
          const home = normalizeTeamName(match.homeTeam.name);
          const away = normalizeTeamName(match.awayTeam.name);
          return (home === p1 && away === p2) || (home === p2 && away === p1);
        });

        const groupDate = existingMatch ? existingMatch.date : ev.jadwal_event;
        const groupStatus = existingMatch ? existingMatch.status : getEventStatus(start, stop);
        const groupHomeTeam = existingMatch
          ? existingMatch.homeTeam
          : { name: ev.player_1, logo: ev.logo_1 || getFlagByName(ev.player_1) };
        const groupAwayTeam = existingMatch
          ? existingMatch.awayTeam
          : { name: ev.player_2, logo: ev.logo_2 || getFlagByName(ev.player_2) };

        finalMatches.push({
          id: ev.id_event,
          parentMatchId: existingMatch?.id,
          homeTeam: groupHomeTeam,
          awayTeam: groupAwayTeam,
          league: { name: ev.nama_event || 'Live Event', logo: '/favicon.png' },
          time: existingMatch ? existingMatch.time : formatMatchTime(start),
          date: groupDate,
          stopDate: ev.jadwal_stop || undefined,
          status: groupStatus,
          score: existingMatch?.score,
          liveMinute: existingMatch?.liveMinute,
          channelId: ev.id_event,
        });
      });
    } catch (ceErr) {
      console.warn('[matchService] Failed to inject custom events:', ceErr);
    }

    const sorted = sortMatchesNeatly(finalMatches);
    cachedMatches = sorted;
    cacheTime = Date.now();
    return sorted;
  } catch (error) {
    console.error('Failed to resolve matches schedule:', error);
    cachedMatches = [];
    cacheTime = Date.now();
    return [];
  }
};
