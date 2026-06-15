import localEvents from '../data/tv-events.json';

export interface Match {
  id: string;
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
  channelId?: string;
  date?: string;
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

const parseJadwal = (dateStr?: string): Date => {
  if (!dateStr) return new Date();
  let clean = dateStr.trim();
  if (clean.includes(' ')) {
    clean = clean.replace(' ', 'T');
  }
  const tzMatch = clean.match(/([+-]\d{2})$/);
  if (tzMatch) {
    clean += ':00';
  }
  return new Date(clean);
};

const formatMatchTime = (date: Date): string => {
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const optionsTime: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
  const timeStr = date.toLocaleTimeString('id-ID', optionsTime);

  // Check if it's the same calendar day
  if (date.toDateString() === now.toDateString()) {
    return timeStr;
  } else {
    const optionsDate: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    const dateStr = date.toLocaleDateString('id-ID', optionsDate);
    return `${dateStr} - ${timeStr}`;
  }
};

const normalizeTeamName = (name: string): string => {
  let lower = name.toLowerCase().trim();
  if (lower.includes('ivoire') || lower.includes('ivory')) return 'ivorycoast';
  if (lower.includes('curacao') || lower.includes('curaçao')) return 'curacao';
  if (lower.includes('cabo verde') || lower.includes('cape verde')) return 'capeverde';
  if (lower.includes('iran')) return 'iran';
  if (lower.includes('dr congo') || lower.includes('democratic republic of the congo')) return 'congo';
  return lower.replace(/[^a-z0-9]/g, '').trim();
};

const findWcGame = (player1: string, player2: string, wcGames: any[]) => {
  if (!player1 || !player2) return null;
  const p1 = normalizeTeamName(player1);
  const p2 = normalizeTeamName(player2);

  return wcGames.find(g => {
    const home = normalizeTeamName(g.home_team_name_en || g.home_team_label || '');
    const away = normalizeTeamName(g.away_team_name_en || g.away_team_label || '');
    return (home === p1 && away === p2) || (home === p2 && away === p1);
  });
};

const getWcScore = (player1: string, game: any) => {
  if (!game) return null;
  const p1 = normalizeTeamName(player1);
  const home = normalizeTeamName(game.home_team_name_en || game.home_team_label || '');
  
  const homeScore = game.home_score;
  const awayScore = game.away_score;
  
  if (home === p1) {
    return `${homeScore} - ${awayScore}`;
  } else {
    return `${awayScore} - ${homeScore}`;
  }
};

export const getTodayMatches = async (): Promise<Match[]> => {
  try {
    let eventsData: any[] = [];
    try {
      const BOT_API_URL = import.meta.env.VITE_BOT_API_URL || 'http://147.135.252.68:20114';
      const res = await fetch(`${BOT_API_URL}/api/sports/events`);
      eventsData = await res.json();
    } catch (botErr) {
      console.warn('Failed to fetch from Bot API, trying GitHub raw fallback...', botErr);
      try {
        const res = await fetch('https://raw.githubusercontent.com/movietrailersxxi-pixel/web/main/assets/tv-events.dat');
        eventsData = await res.json();
      } catch (githubErr) {
        console.warn('Failed to fetch events from GitHub, falling back to local JSON data...', githubErr);
        eventsData = localEvents;
      }
    }

    let wcGames: any[] = [];
    try {
      const res = await fetch('https://worldcup26.ir/get/games');
      const json = await res.json();
      if (json && json.games) {
        wcGames = json.games;
      }
    } catch (wcErr) {
      console.warn('Failed to fetch World Cup games scores', wcErr);
    }

    if (eventsData.length > 0) {
      const parsedMatches: Match[] = eventsData.map((event: any) => {
        const homeTeamName = event.player_1 || 'TBD';
        const awayTeamName = event.player_2 || 'TBD';

        const homeTeamFlag = event.logo_1 || getFlagByName(homeTeamName);
        const awayTeamFlag = event.logo_2 || getFlagByName(awayTeamName);

        const start = parseJadwal(event.jadwal_event);
        const stop = parseJadwal(event.jadwal_stop);
        const now = new Date();

        let status: 'live' | 'upcoming' | 'finished' = 'upcoming';
        if (now > stop) {
          status = 'finished';
        } else if (now >= new Date(start.getTime() - 20 * 60 * 1000)) {
          status = 'live';
        }

        const matchedGame = findWcGame(homeTeamName, awayTeamName, wcGames);
        const score = (status !== 'upcoming') ? (getWcScore(homeTeamName, matchedGame) || '0 - 0') : undefined;

        const timeStr = formatMatchTime(start);

        return {
          id: event.id_event,
          homeTeam: {
            name: homeTeamName,
            logo: homeTeamFlag
          },
          awayTeam: {
            name: awayTeamName,
            logo: awayTeamFlag
          },
          league: {
            name: event.nama_event || 'FIFA World Cup',
            logo: '/favicon.svg'
          },
          time: timeStr,
          date: event.jadwal_event,
          status: status,
          score: score,
          channelId: event.id_event
        };
      });

      // Sort matches: Live first, then Upcoming (earliest kickoff first), then Finished
      const sorted = [...parsedMatches].sort((a, b) => {
        if (a.status === b.status) {
          const dateA = a.date ? parseJadwal(a.date).getTime() : 0;
          const dateB = b.date ? parseJadwal(b.date).getTime() : 0;
          return dateA - dateB;
        }
        if (a.status === 'live') return -1;
        if (b.status === 'live') return 1;
        if (a.status === 'upcoming' && b.status === 'finished') return -1;
        if (a.status === 'finished' && b.status === 'upcoming') return 1;
        return 0;
      });

      return sorted;
    }
  } catch (error) {
    console.error('Failed to resolve matches schedule:', error);
  }

  // Fallback to local events if everything fails
  try {
    const parsedMatches: Match[] = (localEvents as any[]).map((event: any) => {
      const homeTeamName = event.player_1 || 'TBD';
      const awayTeamName = event.player_2 || 'TBD';

      const homeTeamFlag = event.logo_1 || getFlagByName(homeTeamName);
      const awayTeamFlag = event.logo_2 || getFlagByName(awayTeamName);

      const start = parseJadwal(event.jadwal_event);
      const stop = parseJadwal(event.jadwal_stop);
      const now = new Date();

      let status: 'live' | 'upcoming' | 'finished' = 'upcoming';
      if (now > stop) {
        status = 'finished';
      } else if (now >= new Date(start.getTime() - 20 * 60 * 1000)) {
        status = 'live';
      }

      const timeStr = formatMatchTime(start);

      return {
        id: event.id_event,
        homeTeam: {
          name: homeTeamName,
          logo: homeTeamFlag
        },
        awayTeam: {
          name: awayTeamName,
          logo: awayTeamFlag
        },
        league: {
          name: event.nama_event || 'FIFA World Cup',
          logo: '/favicon.svg'
        },
        time: timeStr,
        date: event.jadwal_event,
        status: status,
        channelId: event.id_event
      };
    });

    return parsedMatches;
  } catch (err) {
    console.error('Failed fallback mapping', err);
    return [];
  }
};
