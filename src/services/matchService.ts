import localEvents from '../data/tv-events.json';

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

let cachedMatches: Match[] | null = null;
let cacheTime = 0;
const CACHE_EXPIRY = 20000; // 20 seconds cache for faster live score updates

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

// ESPN live score lookup map: "normalizedHome|normalizedAway" -> { homeScore, awayScore, clock, state }
interface EspnScore {
  homeScore: string;
  awayScore: string;
  clock: string;
  state: string; // "pre" | "in" | "post"
  homeName: string;
  awayName: string;
}

const buildEspnScoreMap = (espnEvents: any[]): Map<string, EspnScore> => {
  const map = new Map<string, EspnScore>();
  for (const event of espnEvents) {
    const comp = event.competitions?.[0];
    if (!comp) continue;
    const competitors = comp.competitors || [];
    const homeComp = competitors.find((c: any) => c.homeAway === 'home');
    const awayComp = competitors.find((c: any) => c.homeAway === 'away');
    if (!homeComp || !awayComp) continue;

    const homeName = normalizeTeamName(homeComp.team?.displayName || '');
    const awayName = normalizeTeamName(awayComp.team?.displayName || '');
    const state = comp.status?.type?.state || 'pre';
    const clock = comp.status?.displayClock || '';

    const score: EspnScore = {
      homeScore: homeComp.score || '0',
      awayScore: awayComp.score || '0',
      clock,
      state,
      homeName,
      awayName,
    };
    // Index both directions so we can find regardless of home/away order
    map.set(`${homeName}|${awayName}`, score);
    map.set(`${awayName}|${homeName}`, score);
  }
  return map;
};

const getEspnScore = (
  player1: string,
  player2: string,
  espnMap: Map<string, EspnScore>
): EspnScore | null => {
  const p1 = normalizeTeamName(player1);
  const p2 = normalizeTeamName(player2);
  return espnMap.get(`${p1}|${p2}`) || espnMap.get(`${p2}|${p1}`) || null;
};

export const getTodayMatches = async (forceRefresh = false): Promise<Match[]> => {
  const now = Date.now();
  if (!forceRefresh && cachedMatches && (now - cacheTime < CACHE_EXPIRY)) {
    return cachedMatches;
  }

  const fetchAndProcess = async (): Promise<Match[]> => {
    try {
      let eventsData: any[] = [];
      let wcGames: any[] = [];
      let espnMap = new Map<string, EspnScore>();

      // Parallel fetching: bot events + worldcup26 (fallback scores) + ESPN (live scores)
      const [eventsResult, wcGamesResult, espnResult] = await Promise.allSettled([
        (async () => {
          try {
            const envVal = import.meta.env.VITE_BOT_API_URL;
            const BOT_API_URL = envVal === '/api' ? '' : (envVal || 'http://147.135.252.68:20114');
            const res = await fetchWithTimeout(`${BOT_API_URL}/api/sports/events`, {}, 3000);
            return await res.json();
          } catch (botErr) {
            console.warn('Failed to fetch from Bot API, trying GitHub raw fallback...', botErr);
            try {
              const res = await fetchWithTimeout('https://raw.githubusercontent.com/movietrailersxxi-pixel/web/main/assets/tv-events.dat', {}, 3000);
              return await res.json();
            } catch (githubErr) {
              console.warn('Failed to fetch events from GitHub, falling back to local JSON data...', githubErr);
              return localEvents;
            }
          }
        })(),
        (async () => {
          try {
            const res = await fetchWithTimeout('https://worldcup26.ir/get/games', {}, 3000);
            const json = await res.json();
            return json?.games || [];
          } catch (wcErr) {
            console.warn('Failed to fetch World Cup games scores', wcErr);
            return [];
          }
        })(),
        (async () => {
          try {
            // ESPN public live scoreboard — real-time scores
            const res = await fetchWithTimeout(
              'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard',
              {}, 4000
            );
            const json = await res.json();
            return json?.events || [];
          } catch (espnErr) {
            console.warn('Failed to fetch ESPN live scores', espnErr);
            return [];
          }
        })(),
      ]);

      if (eventsResult.status === 'fulfilled') {
        eventsData = eventsResult.value;
      } else {
        eventsData = localEvents;
      }

      if (wcGamesResult.status === 'fulfilled') {
        wcGames = wcGamesResult.value;
      }

      // Build ESPN score map from fetched ESPN events
      if (espnResult.status === 'fulfilled' && espnResult.value.length > 0) {
        espnMap = buildEspnScoreMap(espnResult.value);
        console.log('[ESPN] Score map built with', espnMap.size / 2, 'matches');
      }

      if (eventsData.length > 0) {
        const parsedMatches: Match[] = [];
        const seenRtbMatchups = new Set<string>();
        eventsData.forEach((event: any) => {
          const homeTeamName = event.player_1 || 'TBD';
          const awayTeamName = event.player_2 || 'TBD';

          const homeTeamFlag = event.logo_1 || getFlagByName(homeTeamName);
          const awayTeamFlag = event.logo_2 || getFlagByName(awayTeamName);

          const start = parseJadwal(event.jadwal_event);
          const stop = parseJadwal(event.jadwal_stop);
          const nowTime = new Date();

          let status: 'live' | 'upcoming' | 'finished' = 'upcoming';
          if (nowTime > stop) {
            status = 'finished';
          } else if (nowTime >= new Date(start.getTime() - 30 * 60 * 1000)) {
            status = 'live';
          }

          const matchedGame = findWcGame(homeTeamName, awayTeamName, wcGames);

          // Show score for both live and finished matches
          // Priority: ESPN (real-time) > worldcup26.ir (fallback)
          let score: string | undefined = undefined;
          let liveMinute: string | undefined = undefined;

          if (status === 'live' || status === 'finished') {
            // 1) Try ESPN score first (real-time, updated every few seconds)
            const espnScore = getEspnScore(homeTeamName, awayTeamName, espnMap);
            if (espnScore) {
              // Determine which team is home in our event vs ESPN's home/away
              const p1Norm = normalizeTeamName(homeTeamName);
              const espnHomeNorm = espnScore.homeName;
              if (p1Norm === espnHomeNorm) {
                score = `${espnScore.homeScore} - ${espnScore.awayScore}`;
              } else {
                // Our player_1 is ESPN's away team, flip the score
                score = `${espnScore.awayScore} - ${espnScore.homeScore}`;
              }
              // ESPN clock as live minute
              if (espnScore.state === 'in' && espnScore.clock) {
                liveMinute = espnScore.clock;
              }
              console.log(`[ESPN] ${homeTeamName} vs ${awayTeamName}: ${score} (${espnScore.state})`);
            } else {
              // 2) Fallback to worldcup26.ir
              const isWc = event.nama_event && event.nama_event.toLowerCase().includes("fifa world cup");
              const wcScore = getWcScore(homeTeamName, matchedGame);
              if (isWc) {
                score = wcScore || '0 - 0';
              } else {
                score = wcScore || undefined;
              }
              if (matchedGame && matchedGame.time_elapsed &&
                  matchedGame.time_elapsed !== 'notstarted' &&
                  matchedGame.time_elapsed !== 'finished') {
                liveMinute = matchedGame.time_elapsed;
              }
            }
          }

          const timeStr = formatMatchTime(start);

          const originalMatch: Match = {
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
            stopDate: event.jadwal_stop,
            status: status,
            score: score,
            liveMinute: liveMinute,
            channelId: event.id_event
          };

          parsedMatches.push(originalMatch);

          const isStartingSoonOrLive = nowTime.getTime() >= start.getTime() - 60 * 60 * 1000;
          const matchupKey = `${homeTeamName.toLowerCase().trim()} vs ${awayTeamName.toLowerCase().trim()}`;
          if (event.nama_event && event.nama_event.toLowerCase().includes("fifa world cup") && isStartingSoonOrLive) {
            if (!seenRtbMatchups.has(matchupKey)) {
              seenRtbMatchups.add(matchupKey);
              parsedMatches.push({
                ...originalMatch,
                id: `${event.id_event}9`,
                parentMatchId: event.id_event,
                league: {
                  name: "FIFA World Cup [RTB Go]",
                  logo: '/favicon.svg'
                },
                channelId: `${event.id_event}9`
              });
            }
          }
        });

        // Sort matches: Live first, then Upcoming (earliest kickoff first), then Finished
        const sorted = [...parsedMatches].sort((a, b) => {
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

          // Group by their base match ID (parentMatchId or id) to keep RTB Go version with its parent match
          const baseIdA = a.parentMatchId || a.id;
          const baseIdB = b.parentMatchId || b.id;
          if (baseIdA !== baseIdB) {
            return baseIdA.localeCompare(baseIdB);
          }

          // Put RTB Go version directly after the original match
          const isRtbA = a.league.name.includes("[RTB Go]");
          const isRtbB = b.league.name.includes("[RTB Go]");
          if (isRtbA && !isRtbB) return 1;
          if (!isRtbA && isRtbB) return -1;
          return 0;
        });

        return sorted;
      }
    } catch (error) {
      console.error('Failed to resolve matches schedule:', error);
    }

    // Fallback to local events if everything fails
    try {
      const parsedMatches: Match[] = [];
      const seenRtbMatchups = new Set<string>();
      (localEvents as any[]).forEach((event: any) => {
        const homeTeamName = event.player_1 || 'TBD';
        const awayTeamName = event.player_2 || 'TBD';

        const homeTeamFlag = event.logo_1 || getFlagByName(homeTeamName);
        const awayTeamFlag = event.logo_2 || getFlagByName(awayTeamName);

        const start = parseJadwal(event.jadwal_event);
        const stop = parseJadwal(event.jadwal_stop);
        const nowTime = new Date();

        let status: 'live' | 'upcoming' | 'finished' = 'upcoming';
        if (nowTime > stop) {
          status = 'finished';
        } else if (nowTime >= new Date(start.getTime() - 30 * 60 * 1000)) {
          status = 'live';
        }

        const timeStr = formatMatchTime(start);

        const originalMatch: Match = {
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
          stopDate: event.jadwal_stop,
          status: status,
          channelId: event.id_event
        };

        parsedMatches.push(originalMatch);

        const isStartingSoonOrLive = nowTime.getTime() >= start.getTime() - 60 * 60 * 1000;
        const matchupKey = `${homeTeamName.toLowerCase().trim()} vs ${awayTeamName.toLowerCase().trim()}`;
        if (event.nama_event && event.nama_event.toLowerCase().includes("fifa world cup") && isStartingSoonOrLive) {
          if (!seenRtbMatchups.has(matchupKey)) {
            seenRtbMatchups.add(matchupKey);
            parsedMatches.push({
              ...originalMatch,
              id: `${event.id_event}9`,
              parentMatchId: event.id_event,
              league: {
                name: "FIFA World Cup [RTB Go]",
                logo: '/favicon.svg'
              },
              channelId: `${event.id_event}9`
            });
          }
        }
      });
      const sorted = [...parsedMatches].sort((a, b) => {
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

        // Group by their base match ID (parentMatchId or id) to keep RTB Go version with its parent match
        const baseIdA = a.parentMatchId || a.id;
        const baseIdB = b.parentMatchId || b.id;
        if (baseIdA !== baseIdB) {
          return baseIdA.localeCompare(baseIdB);
        }

        // Put RTB Go version directly after the original match
        const isRtbA = a.league.name.includes("[RTB Go]");
        const isRtbB = b.league.name.includes("[RTB Go]");
        if (isRtbA && !isRtbB) return 1;
        if (!isRtbA && isRtbB) return -1;
        return 0;
      });

      return sorted;
    } catch (err) {
      console.error('Failed fallback mapping', err);
      return [];
    }
  };

  const result = await fetchAndProcess();
  cachedMatches = result;
  cacheTime = Date.now();
  return result;
};
