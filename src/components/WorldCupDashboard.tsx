import React, { useEffect, useState } from 'react';
import { Award, Clock, X, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface TeamStats {
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  teamId?: string;
}

export interface MatchScore {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  group: string;
  status: string; // 'FT', 'LIVE', 'UPCOMING'
  time?: string;
  rawTimeElapsed: string;
  date: string;
  homeScorers: string[];
  awayScorers: string[];
  stadiumId: string;
  homeTeamId: string;
  awayTeamId: string;
}

export interface APITeamStats {
  team_id: string;
  mp: string;
  w: string;
  l: string;
  d: string;
  pts: string;
  gf: string;
  ga: string;
  gd: string;
}

export interface APIGroup {
  _id: string;
  name: string;
  teams: APITeamStats[];
}

export interface APITeamInfo {
  id: string;
  name_en: string;
  flag: string;
  iso2: string;
  groups: string;
}

export interface APIStadium {
  id: string;
  name_en: string;
  city_en: string;
  country_en: string;
  capacity: number;
}

export interface APIGame {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: string;
  away_score: string;
  home_scorers: string | null;
  away_scorers: string | null;
  group: string;
  local_date: string;
  stadium_id: string;
  finished: string;
  time_elapsed: string;
  home_team_name_en?: string;
  home_team_name_fa?: string;
  away_team_name_en?: string;
  away_team_name_fa?: string;
  home_team_label?: string;
  away_team_label?: string;
}

// Local translation dictionary since react-i18next is not installed in ykn-tv
const t = (key: string, lang: string = 'id'): string => {
  const translations: Record<string, Record<string, string>> = {
    id: {
      'live_standings': 'Klasemen Live',
      'live_results': 'Hasil & Skor Live',
      'group_stage': 'Babak Grup',
      'matches': 'Pertandingan',
      'no_matches': 'Tidak ada pertandingan hari ini.',
      'stadium': 'Stadion',
      'capacity': 'Kapasitas',
      'played_short': 'M',
      'won_short': 'M',
      'drawn_short': 'S',
      'lost_short': 'K',
      'gf_short': 'GM',
      'ga_short': 'GK',
      'gd_short': 'SG',
      'points_short': 'Poin',
      'loading_data': 'Memuat Data Piala Dunia...',
      'error_loading': 'Gagal memuat data live dari API.',
      'match_timeline': 'Linimasa Pertandingan',
      'stats_standings': 'Klasemen & Skor',
      'match_ended': 'Selesai',
      'goals': 'Gol',
      'goal_scorers': 'Pencetak Gol',
      'live': 'LANGSUNG',
      'match_details': 'Detail Pertandingan',
      'close': 'Tutup',
      'timeline': 'Lini Masa',
      'stats': 'Statistik',
      'tbd': 'Belum Ditentukan',
      'upcoming': 'Akan Datang',
      'team': 'Tim',
      'pos': 'Pos',
      'qualify': 'Lolos ke Babak Gugur',
      'not_started_title': 'Pertandingan Belum Mulai',
      'not_started_desc': 'Siaran langsung dan statistik pertandingan ini akan tersedia segera setelah peluit kickoff dibunyikan.'
    },
    en: {
      'live_standings': 'Live Standings',
      'live_results': 'Live Results & Scores',
      'group_stage': 'Group Stage',
      'matches': 'Matches',
      'no_matches': 'No matches today.',
      'stadium': 'Stadium',
      'capacity': 'Capacity',
      'played_short': 'P',
      'won_short': 'W',
      'drawn_short': 'D',
      'lost_short': 'L',
      'gf_short': 'GF',
      'ga_short': 'GA',
      'gd_short': 'GD',
      'points_short': 'Pts',
      'loading_data': 'Loading World Cup Data...',
      'error_loading': 'Failed to fetch live World Cup standings API.',
      'match_timeline': 'Match Timeline',
      'stats_standings': 'Stats & Standings',
      'match_ended': 'Ended',
      'goals': 'Goals',
      'goal_scorers': 'Goal Scorers',
      'live': 'LIVE',
      'match_details': 'Match Details',
      'close': 'Close',
      'timeline': 'Timeline',
      'stats': 'Stats',
      'tbd': 'TBD',
      'upcoming': 'Upcoming',
      'team': 'Team',
      'pos': 'Pos',
      'qualify': 'Qualify to Knockout Stage',
      'not_started_title': 'Match Has Not Started',
      'not_started_desc': 'Live streams, log events, and stats for this matchup will activate as soon as the referee blows the kickoff whistle.'
    }
  };
  return translations[lang]?.[key] || translations['en']?.[key] || key;
};

const translateEventText = (text: string, lang: string): string => {
  if (!lang.startsWith('id')) return text;
  return text
    .replace(/Kickoff! The stadium is roaring for the hosts\./g, 'Kickoff! Stadion bergemuruh untuk tuan rumah.')
    .replace(/Kickoff!/g, 'Kickoff! Pertandingan dimulai.')
    .replace(/slots it into the bottom corner/g, 'menyarangkan bola ke pojok bawah gawang')
    .replace(/with a brilliant curl shot/g, 'dengan tendangan melengkung yang gemilang')
    .replace(/scores a trademark free-kick/g, 'mencetak gol tendangan bebas khasnya')
    .replace(/wins it/g, 'memenangkan pertandingan')
    .replace(/equalizes/g, 'menyamakan kedudukan')
    .replace(/tap-in/g, 'sontekan jarak dekat')
    .replace(/dribbles past two defenders/g, 'melewati dua pemain bertahan')
    .replace(/shocks the stadium with a goal!/g, 'mengejutkan stadion dengan gol!')
    .replace(/with a class penalty/g, 'dengan penalti berkelas')
    .replace(/header from a corner/g, 'sundulan dari tendangan sudut')
    .replace(/penalty/g, 'penalti')
    .replace(/volley/g, 'tendangan voli')
    .replace(/late winner/g, 'gol kemenangan di menit akhir')
    .replace(/stunning long-range strike/g, 'tendangan jarak jauh yang spektakuler')
    .replace(/header/g, 'sundulan')
    .replace(/solo run/g, 'aksi individu')
    .replace(/freekick/g, 'tendangan bebas')
    .replace(/Half Time/g, 'Istirahat Babak Pertama')
    .replace(/Full Time/g, 'Pertandingan Selesai (Full Time)')
    .replace(/Goal!/gi, 'GOL!')
    .replace(/scored by/gi, 'dicetak oleh')
    .replace(/Yellow Card/g, 'Kartu Kuning')
    .replace(/Red Card/g, 'Kartu Merah')
    .replace(/replaces/g, 'menggantikan')
    .replace(/assist by/g, 'umpan oleh')
    .replace(/for a late tackle/g, 'karena pelanggaran terlambat')
    .replace(/for protesting/g, 'karena melakukan protes')
    .replace(/Team heads into the tunnel/g, 'Pemain masuk ke lorong stadion')
    .replace(/The teams head into the tunnel/g, 'Pemain masuk ke lorong stadion')
    .replace(/Second Half starts/g, 'Babak Kedua Dimulai')
    .replace(/Match is currently live and intense!/g, 'Pertandingan sedang berlangsung sengit!');
};

const parseScorers = (scorersStr: string | null): string[] => {
  if (!scorersStr || scorersStr === 'null') return [];
  try {
    const cleaned = scorersStr
      .replace(/^[{[“"]/, '')
      .replace(/[}\]”"]$/, '')
      .replace(/\\"/g, '"')
      .replace(/”/g, '"')
      .replace(/“/g, '"');

    const parts = cleaned.split(/","|", "|",/);
    return parts.map(p => p.replace(/^['"]|['"]$/g, '').trim()).filter(Boolean);
  } catch (e) {
    return [scorersStr];
  }
};

const getTimelineFromScorers = (
  homeTeam: string,
  awayTeam: string,
  homeScorers: string[],
  awayScorers: string[],
  status: string,
  currentMinuteStr: string
): string[] => {
  const events: { min: number; text: string }[] = [];

  let currentMinuteNum = 90;
  if (status === 'LIVE') {
    currentMinuteNum = parseInt(currentMinuteStr.replace(/[^0-9]/g, '')) || 45;
  }

  homeScorers.forEach(s => {
    const match = s.match(/(.+?)\s+(\d+)(.*)/);
    if (match) {
      const name = match[1].trim();
      const minBase = parseInt(match[2]);
      const suffix = match[3] || '';

      const extraMatch = suffix.match(/\+(\d+)/);
      const extraTime = extraMatch ? `+${extraMatch[1]}` : '';
      const displayMin = `${minBase}'${extraTime ? `${extraTime}'` : ''}`;

      const isOG = suffix.toUpperCase().includes('(OG)');
      const displayName = `${name}${isOG ? ' (OG)' : ''}`;

      if (status !== 'LIVE' || minBase <= currentMinuteNum) {
        events.push({
          min: minBase,
          text: `${displayMin} ⚽ GOAL! ${homeTeam} scored by ${displayName}`
        });
      }
    } else {
      events.push({ min: 35, text: `⚽ GOAL! ${homeTeam} scored by ${s}` });
    }
  });

  awayScorers.forEach(s => {
    const match = s.match(/(.+?)\s+(\d+)(.*)/);
    if (match) {
      const name = match[1].trim();
      const minBase = parseInt(match[2]);
      const suffix = match[3] || '';

      const extraMatch = suffix.match(/\+(\d+)/);
      const extraTime = extraMatch ? `+${extraMatch[1]}` : '';
      const displayMin = `${minBase}'${extraTime ? `${extraTime}'` : ''}`;

      const isOG = suffix.toUpperCase().includes('(OG)');
      const displayName = `${name}${isOG ? ' (OG)' : ''}`;

      if (status !== 'LIVE' || minBase <= currentMinuteNum) {
        events.push({
          min: minBase,
          text: `${displayMin} ⚽ GOAL! ${awayTeam} scored by ${displayName}`
        });
      }
    } else {
      events.push({ min: 38, text: `⚽ GOAL! ${awayTeam} scored by ${s}` });
    }
  });

  events.sort((a, b) => a.min - b.min);

  const timeline: string[] = ["0' ⏱️ Kickoff! The match has started."];
  let addedHalfTime = false;

  events.forEach(e => {
    if (e.min > 45 && !addedHalfTime) {
      if (status !== 'LIVE' || currentMinuteNum >= 45) {
        timeline.push("45' ⏱️ Half Time.");
        addedHalfTime = true;
      }
    }
    timeline.push(e.text);
  });

  if (!addedHalfTime && (status !== 'LIVE' || currentMinuteNum >= 45)) {
    timeline.push("45' ⏱️ Half Time.");
  }

  if (status === 'FT') {
    timeline.push("90' 🏁 Full Time! The referee blows the final whistle.");
  } else if (status === 'LIVE') {
    timeline.push(`${currentMinuteNum}' ⏱️ Match is currently live and intense!`);
  }

  return timeline;
};

const parseMatchDate = (dateStr: string, stadiumId?: string): number => {
  if (!dateStr) return 0;
  const parsed = Date.parse(dateStr);
  if (!isNaN(parsed) && !stadiumId) return parsed;

  try {
    const [datePart, timePart] = dateStr.split(' ');
    const [m, d, y] = datePart.split('/');
    const [h, min] = timePart.split(':');

    let offset = '-05:00'; // Default Central
    if (stadiumId) {
      const sId = String(stadiumId).trim();
      if (['7', '8', '9', '10', '11', '12'].includes(sId)) {
        offset = '-04:00'; // Eastern (EDT)
      } else if (['13', '14', '15', '16'].includes(sId)) {
        offset = '-07:00'; // Western (PDT)
      }
    }

    const isoString = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${min.padStart(2, '0')}:00${offset}`;
    const dateObj = new Date(isoString);
    return isNaN(dateObj.getTime()) ? 0 : dateObj.getTime();
  } catch (e) {
    return 0;
  }
};

const formatMatchDateToLocal = (dateStr: string, stadiumId: string, lang: string = 'id'): string => {
  if (!dateStr) return '';
  try {
    const [datePart, timePart] = dateStr.split(' ');
    const [m, d, y] = datePart.split('/');
    const [h, min] = timePart.split(':');

    let offset = '-05:00'; // Default Central (CDT)
    const sId = String(stadiumId).trim();
    if (['7', '8', '9', '10', '11', '12'].includes(sId)) {
      offset = '-04:00'; // Eastern (EDT)
    } else if (['13', '14', '15', '16'].includes(sId)) {
      offset = '-07:00'; // Western (PDT)
    }

    const isoString = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${min.padStart(2, '0')}:00${offset}`;
    const dateObj = new Date(isoString);
    if (isNaN(dateObj.getTime())) return dateStr;

    const localeCode = lang.startsWith('id') ? 'id-ID' : 'en-US';

    const formatted = dateObj.toLocaleDateString(localeCode, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const timeZoneOffset = dateObj.getTimezoneOffset(); // in minutes
    let tzLabel = '';
    if (lang.startsWith('id')) {
      if (timeZoneOffset === -420) tzLabel = ' WIB';
      else if (timeZoneOffset === -480) tzLabel = ' WITA';
      else if (timeZoneOffset === -540) tzLabel = ' WIT';
      else {
        const hoursOffset = -timeZoneOffset / 60;
        tzLabel = ` GMT${hoursOffset >= 0 ? '+' : ''}${hoursOffset}`;
      }
    }

    return `${formatted}${tzLabel}`;
  } catch (e) {
    return dateStr;
  }
};

const calculateLiveMatchMinute = (apiTimeElapsed: string, kickoffDateStr: string, fetchTimeMs: number, stadiumId?: string): string => {
  if (apiTimeElapsed === 'finished') return 'FT';
  if (apiTimeElapsed === 'notstarted') return '';

  const baseMin = parseInt(apiTimeElapsed);
  if (!isNaN(baseMin)) {
    const elapsedMins = Math.floor((Date.now() - fetchTimeMs) / 60000);
    const currentMin = baseMin + elapsedMins;
    if (currentMin > 90) {
      return `90'+${currentMin - 90}`;
    }
    return `${currentMin}'`;
  }

  const kickoffMs = parseMatchDate(kickoffDateStr, stadiumId);
  if (kickoffMs > 0) {
    const elapsedSinceKickoff = Math.floor((Date.now() - kickoffMs) / 60000);
    if (elapsedSinceKickoff >= 0 && elapsedSinceKickoff <= 130) {
      if (elapsedSinceKickoff <= 45) {
        return `${elapsedSinceKickoff}'`;
      }
      if (elapsedSinceKickoff <= 60) {
        return 'HT';
      }
      if (elapsedSinceKickoff <= 105) {
        const gameMin = elapsedSinceKickoff - 15;
        return `${gameMin}'`;
      }
      const extra = elapsedSinceKickoff - 105;
      return `90'+${extra}`;
    }
  }

  return 'LIVE';
};

interface WorldCupDashboardProps {
  lang?: 'id' | 'en';
}

export const WorldCupDashboard: React.FC<WorldCupDashboardProps> = ({ lang = 'id' }) => {
  // API states
  const [matches, setMatches] = useState<MatchScore[]>([]);
  const [groups, setGroups] = useState<APIGroup[]>([]);
  const [teamsMap, setTeamsMap] = useState<Record<string, APITeamInfo>>({});
  const [stadiumsMap, setStadiumsMap] = useState<Record<string, APIStadium>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchTimestamp, setFetchTimestamp] = useState<number>(Date.now());

  const [goalAlert, setGoalAlert] = useState<{ title: string; body: string } | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchScore | null>(null);
  const [modalTab, setModalTab] = useState<'timeline' | 'stats'>('timeline');
  const [selectedGroup, setSelectedGroup] = useState<string>('Group A');
  const [showGroupDropdown, setShowGroupDropdown] = useState<boolean>(false);

  // Trigger re-render every 10 seconds to keep live match minutes ticking in real-time
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(prev => prev + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Close group dropdown on outside click
  useEffect(() => {
    if (!showGroupDropdown) return;
    const closeDropdown = () => setShowGroupDropdown(false);
    window.addEventListener('click', closeDropdown);
    return () => window.removeEventListener('click', closeDropdown);
  }, [showGroupDropdown]);

  // Fetch data from the API
  useEffect(() => {
    let active = true;
    const fetchData = async (isInitial = false) => {
      try {
        if (isInitial) {
          setLoading(true);
        }
        setError(null);

        const [gamesRes, groupsRes, teamsRes, stadiumsRes] = await Promise.all([
          fetch('https://worldcup26.ir/get/games').then(r => r.json()),
          fetch('https://worldcup26.ir/get/groups').then(r => r.json()),
          fetch('https://worldcup26.ir/get/teams').then(r => r.json()),
          fetch('https://worldcup26.ir/get/stadiums').then(r => r.json())
        ]);

        if (!active) return;

        // Map stadiums
        const stadiums: Record<string, APIStadium> = {};
        stadiumsRes.stadiums.forEach((std: any) => {
          stadiums[std.id] = {
            id: std.id,
            name_en: std.name_en,
            city_en: std.city_en,
            country_en: std.country_en,
            capacity: std.capacity
          };
        });
        setStadiumsMap(stadiums);

        // Map teams
        const teams: Record<string, APITeamInfo> = {};
        teamsRes.teams.forEach((t: any) => {
          teams[t.id] = {
            id: t.id,
            name_en: t.name_en,
            flag: t.flag || `https://flagcdn.com/w40/${t.iso2.toLowerCase()}.png`,
            iso2: t.iso2,
            groups: t.groups
          };
        });
        setTeamsMap(teams);

        // Map matches
        const mappedMatches: MatchScore[] = gamesRes.games.map((g: APIGame) => {
          const homeScorers = parseScorers(g.home_scorers);
          const awayScorers = parseScorers(g.away_scorers);

          return {
            homeTeam: g.home_team_name_en || g.home_team_label || 'TBD',
            awayTeam: g.away_team_name_en || g.away_team_label || 'TBD',
            homeScore: parseInt(g.home_score) || 0,
            awayScore: parseInt(g.away_score) || 0,
            group: `Group ${g.group}`,
            status: g.time_elapsed === 'finished' ? 'FT' : (g.time_elapsed === 'notstarted' ? 'UPCOMING' : 'LIVE'),
            time: g.time_elapsed === 'finished' ? 'FT' : (g.time_elapsed === 'notstarted' ? '' : `${g.time_elapsed}'`),
            rawTimeElapsed: g.time_elapsed,
            date: g.local_date,
            homeScorers,
            awayScorers,
            stadiumId: g.stadium_id,
            homeTeamId: g.home_team_id,
            awayTeamId: g.away_team_id
          };
        });

        mappedMatches.sort((a, b) => {
          const timeA = parseMatchDate(a.date, a.stadiumId);
          const timeB = parseMatchDate(b.date, b.stadiumId);
          return timeA - timeB;
        });

        // Detect live goals
        setMatches(prevMatches => {
          if (prevMatches && prevMatches.length > 0) {
            mappedMatches.forEach(newMatch => {
              if (newMatch.status === 'LIVE') {
                const oldMatch = prevMatches.find(m => m.homeTeam === newMatch.homeTeam && m.awayTeam === newMatch.awayTeam);
                if (oldMatch && oldMatch.status === 'LIVE') {
                  const homeGoalDiff = newMatch.homeScore - oldMatch.homeScore;
                  const awayGoalDiff = newMatch.awayScore - oldMatch.awayScore;
                  if (homeGoalDiff > 0 || awayGoalDiff > 0) {
                    const scorerTeam = homeGoalDiff > 0 ? newMatch.homeTeam : newMatch.awayTeam;
                    const oppTeam = homeGoalDiff > 0 ? newMatch.awayTeam : newMatch.homeTeam;
                    setGoalAlert({
                      title: "⚽ GOL!",
                      body: `${scorerTeam} scores! ${scorerTeam} ${newMatch.homeScore} - ${newMatch.awayScore} ${oppTeam}`
                    });
                    setTimeout(() => setGoalAlert(null), 5000);
                  }
                }
              }
            });
          }
          return mappedMatches;
        });

        setFetchTimestamp(Date.now());
        setGroups(groupsRes.groups);

      } catch (err: any) {
        console.error('Failed to load World Cup data', err);
        if (isInitial) {
          setError(t('error_loading', lang));
        }
      } finally {
        if (isInitial && active) {
          setLoading(false);
        }
      }
    };

    fetchData(true);
    const interval = setInterval(() => {
      fetchData(false);
    }, 30000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [lang]);

  // Sync selected match
  useEffect(() => {
    if (!selectedMatch) return;
    const updated = matches.find(m => m.homeTeam === selectedMatch.homeTeam && m.awayTeam === selectedMatch.awayTeam);
    if (updated) setSelectedMatch(updated);
  }, [matches, selectedMatch]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 min-h-[300px]">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4 bg-white/[0.02] border border-white/5 rounded-3xl p-8">
        <Award className="text-primary" size={48} />
        <h3 className="text-lg font-bold text-white">{error}</h3>
      </div>
    );
  }

  const getGroupStandings = (groupLetter: string): TeamStats[] => {
    const groupName = groupLetter.replace('Group ', '');
    const apiGroup = groups.find(g => g.name === groupName);
    if (!apiGroup) return [];

    const teamsList: TeamStats[] = apiGroup.teams.map(t => {
      const teamInfo = teamsMap[t.team_id];
      return {
        name: teamInfo ? teamInfo.name_en : `Team ${t.team_id}`,
        played: parseInt(t.mp) || 0,
        won: parseInt(t.w) || 0,
        drawn: parseInt(t.d) || 0,
        lost: parseInt(t.l) || 0,
        gf: parseInt(t.gf) || 0,
        ga: parseInt(t.ga) || 0,
        gd: parseInt(t.gd) || 0,
        points: parseInt(t.pts) || 0,
        teamId: t.team_id
      };
    });

    return teamsList.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.name.localeCompare(b.name);
    });
  };

  const currentStandings = getGroupStandings(selectedGroup);

  const getMatchEventsList = (match: MatchScore): string[] => {
    const liveTime = calculateLiveMatchMinute(match.rawTimeElapsed, match.date, fetchTimestamp, match.stadiumId);
    return getTimelineFromScorers(match.homeTeam, match.awayTeam, match.homeScorers, match.awayScorers, match.status, liveTime);
  };

  const selectedMatchEvents = selectedMatch ? getMatchEventsList(selectedMatch) : [];
  const selectedMatchStats = selectedMatch
    ? getMatchStats(selectedMatch, selectedMatch.status === 'LIVE' ? (selectedMatch.time ? parseInt(selectedMatch.time.replace(/[^0-9]/g, '')) || 82 : 82) : undefined)
    : null;
  const stadium = selectedMatch ? stadiumsMap[selectedMatch.stadiumId] : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-white relative">
      {/* Floating Goal Alert Banner */}
      <AnimatePresence>
        {goalAlert && (
          <motion.div
            initial={{ opacity: 0, y: -80, scale: 0.9, x: '-50%' }}
            animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
            exit={{ opacity: 0, y: -30, scale: 0.9, x: '-50%' }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-[#0c0c0c] border border-primary/30 text-white py-4 px-8 rounded-2xl shadow-[0_20px_50px_rgba(212,175,55,0.3)] backdrop-blur-md flex items-center gap-4 border-l-4 border-l-primary select-none min-w-[280px] sm:min-w-[400px]"
          >
            <span className="text-3xl animate-bounce shrink-0">⚽</span>
            <div>
              <h4 className="text-sm md:text-base font-black font-display uppercase tracking-wider text-primary">{goalAlert.title}</h4>
              <p className="text-xs md:text-sm font-bold text-zinc-100">{goalAlert.body}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Left Column: Group Standings */}
      <div className="lg:col-span-7 xl:col-span-8 space-y-6">
        <div className="bg-zinc-950/90 border border-white/10 p-5 md:p-8 rounded-3xl backdrop-blur-xl shadow-xl">
          <div className="flex flex-col gap-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg md:text-xl font-black font-display uppercase tracking-wider text-white flex items-center gap-2">
                  <Award className="text-primary w-5 h-5" />
                  {t('live_standings', lang)}
                </h3>
                <p className="text-[10px] md:text-xs font-black text-zinc-500 uppercase tracking-widest mt-1">
                  FIFA World Cup 2026
                </p>
              </div>
            </div>

            {/* Group Selection Dropdown */}
            <div className="relative inline-block w-48 select-none">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowGroupDropdown(!showGroupDropdown);
                }}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-black text-xs md:text-sm hover:bg-white/10 transition-all cursor-pointer focus:outline-none"
              >
                <span>
                  {lang === 'id'
                    ? selectedGroup.replace('Group', 'Grup')
                    : selectedGroup}
                </span>
                <ChevronDown
                  size={16}
                  className={`text-zinc-400 transition-transform duration-300 ${showGroupDropdown ? 'rotate-180 text-white' : ''
                    }`}
                />
              </button>

              <AnimatePresence>
                {showGroupDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-12 left-0 z-30 w-full bg-[#080808] border border-white/10 rounded-xl p-1.5 flex flex-col gap-1 backdrop-blur-md shadow-2xl max-h-60 overflow-y-auto no-scrollbar"
                  >
                    {['Group A', 'Group B', 'Group C', 'Group D', 'Group E', 'Group F', 'Group G', 'Group H', 'Group I', 'Group J', 'Group K', 'Group L'].map(groupName => {
                      const isActive = selectedGroup === groupName;
                      return (
                        <button
                          key={groupName}
                          onClick={() => {
                            setSelectedGroup(groupName);
                            setShowGroupDropdown(false);
                          }}
                          className={`text-left px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${isActive
                              ? 'bg-primary text-dark font-black shadow-md'
                              : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                            }`}
                        >
                          {lang === 'id'
                            ? groupName.replace('Group', 'Grup')
                            : groupName}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Standings Table */}
          <div className="overflow-x-auto w-full no-scrollbar">
            <table className="w-full text-left border-collapse select-none">
              <thead>
                <tr className="border-b border-white/5 text-zinc-500 text-[10px] md:text-xs uppercase font-black tracking-wider">
                  <th className="pb-3 w-8 text-center">{t('pos', lang)}</th>
                  <th className="pb-3 pl-2">{t('team', lang)}</th>
                  <th className="pb-3 text-center w-10">P</th>
                  <th className="pb-3 text-center w-10">W</th>
                  <th className="pb-3 text-center w-10">D</th>
                  <th className="pb-3 text-center w-10">L</th>
                  <th className="pb-3 text-center w-12">GD</th>
                  <th className="pb-3 text-center w-12 text-primary">Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02]">
                {currentStandings.map((team, idx) => {
                  const teamInfo = Object.values(teamsMap).find(t => t.name_en === team.name);
                  const flag = teamInfo ? teamInfo.flag : `https://flagcdn.com/w40/un.png`;
                  const isPlayingLive = matches.some(m => m.status === 'LIVE' && (m.homeTeam === team.name || m.awayTeam === team.name));

                  return (
                    <tr
                      key={team.name}
                      className={`hover:bg-white/[0.02] transition-all duration-300 group/row text-xs md:text-sm font-black ${isPlayingLive ? 'text-amber-400 bg-amber-500/[0.02]' : 'text-white/95'
                        }`}
                    >
                      <td className="py-4 text-center">
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-black ${idx < 2 ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-zinc-800/30 text-zinc-400 border border-zinc-700/10'
                          }`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-4 pl-2 font-black">
                        <div className="flex items-center gap-3">
                          <img
                            src={flag}
                            alt=""
                            className="w-5 h-3.5 object-cover rounded shadow border border-white/5"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <span className="group-hover/row:text-white transition-colors flex items-center gap-2">
                            {team.name}
                            {isPlayingLive && (
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 text-center text-zinc-500 font-bold">{team.played}</td>
                      <td className="py-4 text-center text-zinc-500 font-bold">{team.won}</td>
                      <td className="py-4 text-center text-zinc-500 font-bold">{team.drawn}</td>
                      <td className="py-4 text-center text-zinc-500 font-bold">{team.lost}</td>
                      <td className={`py-4 text-center font-bold ${team.gd > 0 ? 'text-green-500' : team.gd < 0 ? 'text-red-500' : 'text-zinc-500'}`}>
                        {team.gd > 0 ? `+${team.gd}` : team.gd}
                      </td>
                      <td className="py-4 text-center text-primary font-black text-sm">{team.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-4 mt-6 pt-4 border-t border-white/5 text-[9px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-primary/10 border border-primary/30" />
              <span>{t('qualify', lang)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Recent Results & Match Scores */}
      <div className="lg:col-span-5 xl:col-span-4 space-y-6">
        <div className="bg-zinc-950/90 border border-white/10 p-5 md:p-8 rounded-3xl backdrop-blur-xl shadow-xl flex flex-col h-full">
          <div className="mb-6">
            <h3 className="text-lg md:text-xl font-black font-display uppercase tracking-wider text-white flex items-center gap-2 select-none">
              <Clock className="text-primary w-5 h-5" />
              {t('live_results', lang)}
            </h3>
            <p className="text-[10px] md:text-xs font-black text-zinc-500 uppercase tracking-widest mt-1 select-none">
              FIFA World Cup 2026
            </p>
          </div>

          {/* Scores list */}
          <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1 custom-scrollbar">
            {matches.map((match, idx) => {
              const homeTeamInfo = Object.values(teamsMap).find(t => t.name_en === match.homeTeam);
              const awayTeamInfo = Object.values(teamsMap).find(t => t.name_en === match.awayTeam);
              const homeFlag = homeTeamInfo ? homeTeamInfo.flag : `https://flagcdn.com/w40/un.png`;
              const awayFlag = awayTeamInfo ? awayTeamInfo.flag : `https://flagcdn.com/w40/un.png`;
              const isLive = match.status === 'LIVE';

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedMatch(match)}
                  className={`bg-white/[0.01] hover:bg-white/5 border border-white/5 hover:border-white/10 p-3.5 rounded-2xl transition-all duration-300 cursor-pointer ${isLive ? 'border-primary/20 shadow-md shadow-primary/5' : ''
                    }`}
                >
                  <div className="flex items-center justify-between text-[8px] md:text-[9px] font-black uppercase tracking-wider text-zinc-500 mb-2 select-none">
                    <span>{match.group}</span>
                    <span className="flex items-center gap-1">
                      {isLive ? (
                        <span className="flex items-center gap-1.5 text-amber-400 font-black animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                          <span>
                            {(() => {
                              const liveTime = calculateLiveMatchMinute(match.rawTimeElapsed, match.date, fetchTimestamp, match.stadiumId);
                              return liveTime.toUpperCase().includes('LIVE') || liveTime === 'HT'
                                ? liveTime
                                : `LIVE ${liveTime}`;
                            })()}
                          </span>
                        </span>
                      ) : match.status === 'UPCOMING' ? (
                        <span className="text-primary font-black flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                          {formatMatchDateToLocal(match.date, match.stadiumId, lang)}
                        </span>
                      ) : (
                        <span>{formatMatchDateToLocal(match.date, match.stadiumId, lang)}</span>
                      )}
                    </span>
                  </div>

                  {/* Team matchups */}
                  <div className="grid grid-cols-12 items-center gap-2 select-none">
                    <div className="col-span-5 flex items-center gap-2 truncate">
                      <img
                        src={homeFlag}
                        alt=""
                        className="w-5 h-3.5 object-cover rounded shadow border border-white/5"
                      />
                      <span className="text-xs font-black truncate">{match.homeTeam}</span>
                    </div>

                    <div className="col-span-2 flex items-center justify-center gap-1 text-center bg-black/45 border border-white/5 py-1 px-2 rounded-lg shrink-0">
                      {match.status === 'UPCOMING' ? (
                        <span className="text-[9px] font-black text-zinc-500">VS</span>
                      ) : (
                        <>
                          <span className={`text-xs font-black ${isLive ? 'text-amber-400 animate-pulse' : 'text-white'}`}>{match.homeScore}</span>
                          <span className="text-zinc-600 text-[10px] font-bold">-</span>
                          <span className={`text-xs font-black ${isLive ? 'text-amber-400 animate-pulse' : 'text-white'}`}>{match.awayScore}</span>
                        </>
                      )}
                    </div>

                    <div className="col-span-5 flex items-center justify-end gap-2 truncate text-right">
                      <span className="text-xs font-black truncate">{match.awayTeam}</span>
                      <img
                        src={awayFlag}
                        alt=""
                        className="w-5 h-3.5 object-cover rounded shadow border border-white/5"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dynamic Match Center Modal */}
      <AnimatePresence>
        {selectedMatch && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#050505] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)]"
            >
              {/* Modal Header */}
              <div className="p-5 md:p-6 border-b border-white/10 relative">
                <button
                  onClick={() => setSelectedMatch(null)}
                  className="text-zinc-400 hover:text-white transition-colors cursor-pointer w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center absolute top-5 right-5"
                >
                  <X size={16} />
                </button>
                <div className="text-center">
                  <span className="text-[9px] md:text-xs font-black text-zinc-500 uppercase tracking-widest select-none">
                    {selectedMatch.group} • {formatMatchDateToLocal(selectedMatch.date, selectedMatch.stadiumId, lang)}
                  </span>

                  <div className="flex items-center justify-center gap-4 md:gap-8 mt-4 select-none">
                    <div className="flex flex-col items-center gap-2 w-1/3 text-center">
                      <img
                        src={Object.values(teamsMap).find(t => t.name_en === selectedMatch.homeTeam)?.flag || 'https://flagcdn.com/w40/un.png'}
                        alt=""
                        className="w-12 h-8 md:w-16 md:h-11 object-cover rounded shadow border border-white/10"
                      />
                      <span className="text-xs md:text-sm font-black text-white truncate max-w-full">{selectedMatch.homeTeam}</span>
                    </div>

                    <div className="flex flex-col items-center justify-center w-1/3">
                      {selectedMatch.status === 'UPCOMING' ? (
                        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-zinc-400 text-xs font-black uppercase tracking-wider">
                          VS
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="text-2xl md:text-4xl font-black">{selectedMatch.homeScore}</span>
                          <span className="text-zinc-600 text-xl font-bold">:</span>
                          <span className="text-2xl md:text-4xl font-black">{selectedMatch.awayScore}</span>
                        </div>
                      )}

                      {selectedMatch.status === 'LIVE' ? (
                        <span className="mt-2.5 px-3 py-1 bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[9px] font-black rounded-full uppercase tracking-wider animate-pulse select-none flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-amber-400 animate-ping" />
                          <span>
                            {(() => {
                              const liveTime = calculateLiveMatchMinute(selectedMatch.rawTimeElapsed, selectedMatch.date, fetchTimestamp, selectedMatch.stadiumId);
                              return liveTime.toUpperCase().includes('LIVE') || liveTime === 'HT'
                                ? liveTime
                                : `LIVE ${liveTime}`;
                            })()}
                          </span>
                        </span>
                      ) : selectedMatch.status === 'FT' ? (
                        <span className="mt-2.5 px-3 py-1 bg-zinc-800/50 border border-zinc-700/20 text-zinc-400 text-[9px] font-black rounded-full uppercase tracking-wider select-none">
                          FULL TIME
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-col items-center gap-2 w-1/3 text-center">
                      <img
                        src={Object.values(teamsMap).find(t => t.name_en === selectedMatch.awayTeam)?.flag || 'https://flagcdn.com/w40/un.png'}
                        alt=""
                        className="w-12 h-8 md:w-16 md:h-11 object-cover rounded shadow border border-white/10"
                      />
                      <span className="text-xs md:text-sm font-black text-white truncate max-w-full">{selectedMatch.awayTeam}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs selector */}
              {selectedMatch.status !== 'UPCOMING' && (
                <div className="flex bg-white/[0.02] border-b border-white/5 shrink-0 select-none">
                  <button
                    onClick={() => setModalTab('timeline')}
                    className={`flex-1 py-3 font-black text-xs md:text-sm uppercase tracking-wider transition-colors cursor-pointer border-b-2 ${modalTab === 'timeline'
                        ? 'border-primary text-white bg-white/[0.02]'
                        : 'border-transparent text-zinc-500 hover:text-white'
                      }`}
                  >
                    {t('timeline', lang)}
                  </button>
                  <button
                    onClick={() => setModalTab('stats')}
                    className={`flex-1 py-3 font-black text-xs md:text-sm uppercase tracking-wider transition-colors cursor-pointer border-b-2 ${modalTab === 'stats'
                        ? 'border-primary text-white bg-white/[0.02]'
                        : 'border-transparent text-zinc-500 hover:text-white'
                      }`}
                  >
                    {t('stats', lang)}
                  </button>
                </div>
              )}

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {selectedMatch.status === 'UPCOMING' ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center gap-4 select-none">
                    <Clock size={40} className="text-primary animate-pulse" />
                    <div>
                      <h4 className="text-sm font-black uppercase text-white">{t('not_started_title', lang)}</h4>
                      <p className="text-xs text-zinc-500 mt-1.5 max-w-xs leading-relaxed">
                        {t('not_started_desc', lang)}
                      </p>
                    </div>
                  </div>
                ) : modalTab === 'timeline' ? (
                  <div className="space-y-4 pr-1">
                    {selectedMatchEvents.length === 0 ? (
                      <div className="text-center text-zinc-600 font-bold text-xs py-10 select-none">
                        No events logged yet.
                      </div>
                    ) : (
                      selectedMatchEvents.slice().reverse().map((ev, i) => (
                        <div key={i} className="flex gap-4 items-start select-none">
                          <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1.5 shrink-0 shadow-md shadow-primary/20" />
                          <p className="text-xs md:text-sm font-black text-zinc-200 leading-relaxed">
                            {translateEventText(ev, lang)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  selectedMatchStats && (
                    <div className="space-y-6 select-none">
                      {/* Possession */}
                      <div>
                        <div className="flex justify-between text-xs font-black uppercase mb-1.5 text-zinc-400">
                          <span>{selectedMatchStats.possession[0]}%</span>
                          <span className="text-[10px] tracking-wider text-zinc-500">Penguasaan Bola</span>
                          <span>{selectedMatchStats.possession[1]}%</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden flex bg-zinc-800 border border-white/5">
                          <div className="bg-primary h-full transition-all duration-500" style={{ width: `${selectedMatchStats.possession[0]}%` }} />
                          <div className="bg-zinc-700 h-full flex-1 transition-all duration-500" />
                        </div>
                      </div>

                      {/* Shots */}
                      <div>
                        <div className="flex justify-between text-xs font-black uppercase mb-1.5 text-zinc-400">
                          <span>{selectedMatchStats.shots[0]}</span>
                          <span className="text-[10px] tracking-wider text-zinc-500">Tembakan</span>
                          <span>{selectedMatchStats.shots[1]}</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden flex bg-zinc-800 border border-white/5">
                          {(() => {
                            const total = selectedMatchStats.shots[0] + selectedMatchStats.shots[1] || 1;
                            const homePct = (selectedMatchStats.shots[0] / total) * 100;
                            return (
                              <>
                                <div className="bg-primary h-full transition-all duration-500" style={{ width: `${homePct}%` }} />
                                <div className="bg-zinc-700 h-full flex-1 transition-all duration-500" />
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Shots on Target */}
                      <div>
                        <div className="flex justify-between text-xs font-black uppercase mb-1.5 text-zinc-400">
                          <span>{selectedMatchStats.shotsOnTarget[0]}</span>
                          <span className="text-[10px] tracking-wider text-zinc-500">Tembakan Tepat Sasaran</span>
                          <span>{selectedMatchStats.shotsOnTarget[1]}</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden flex bg-zinc-800 border border-white/5">
                          {(() => {
                            const total = selectedMatchStats.shotsOnTarget[0] + selectedMatchStats.shotsOnTarget[1] || 1;
                            const homePct = (selectedMatchStats.shotsOnTarget[0] / total) * 100;
                            return (
                              <>
                                <div className="bg-primary h-full transition-all duration-500" style={{ width: `${homePct}%` }} />
                                <div className="bg-zinc-700 h-full flex-1 transition-all duration-500" />
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Corners */}
                      <div>
                        <div className="flex justify-between text-xs font-black uppercase mb-1.5 text-zinc-400">
                          <span>{selectedMatchStats.corners[0]}</span>
                          <span className="text-[10px] tracking-wider text-zinc-500">Tendangan Sudut</span>
                          <span>{selectedMatchStats.corners[1]}</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden flex bg-zinc-800 border border-white/5">
                          {(() => {
                            const total = selectedMatchStats.corners[0] + selectedMatchStats.corners[1] || 1;
                            const homePct = (selectedMatchStats.corners[0] / total) * 100;
                            return (
                              <>
                                <div className="bg-primary h-full transition-all duration-500" style={{ width: `${homePct}%` }} />
                                <div className="bg-zinc-700 h-full flex-1 transition-all duration-500" />
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  )
                )}

                {stadium && (
                  <div className="mt-6 p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-[10px] sm:text-xs text-zinc-400 select-none">
                    <h5 className="font-black text-white uppercase tracking-wider mb-1">🏟️ {stadium.name_en}</h5>
                    <p>
                      <strong>Venue:</strong> {stadium.city_en} ({stadium.country_en}) • <strong>Capacity:</strong> {stadium.capacity.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-white/[0.01] border-t border-white/5 text-center shrink-0">
                <button
                  onClick={() => setSelectedMatch(null)}
                  className="w-full sm:w-auto px-8 py-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all font-black text-xs uppercase tracking-wider cursor-pointer"
                >
                  {t('close', lang)}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const getMatchStats = (match: MatchScore, liveMinute?: number) => {
  const progress = match.status === 'LIVE' ? (liveMinute || 82) / 90 : 1;
  let homePossession = 50;
  let homeShots = Math.round(5 + 10 * progress + match.homeScore);
  let awayShots = Math.round(3 + 6 * progress + match.awayScore);
  let homeFouls = Math.round(4 + 8 * progress);
  let awayFouls = Math.round(5 + 10 * progress);

  if (match.homeTeam === 'Morocco' && match.awayTeam === 'Haiti') {
    homePossession = Math.round(56 + Math.sin((liveMinute || 82) * 0.1) * 3);
    homeShots = Math.round(6 + 12 * progress + match.homeScore);
    awayShots = Math.round(2 + 4 * progress + match.awayScore);
  } else if (match.homeTeam === 'Germany' && match.awayTeam === 'Ecuador') {
    homePossession = Math.round(52 + Math.sin((liveMinute || 0) * 0.1) * 4);
    homeShots = Math.round(5 + 11 * progress + match.homeScore);
    awayShots = Math.round(3 + 7 * progress + match.awayScore);
  } else {
    homePossession = match.homeScore > match.awayScore ? 55 : (match.homeScore < match.awayScore ? 45 : 50);
    homeShots = Math.round(6 + match.homeScore * 2.5);
    awayShots = Math.round(5 + match.awayScore * 2.5);
    homeFouls = 11;
    awayFouls = 12;
  }

  const awayPossession = 100 - homePossession;

  return {
    possession: [homePossession, awayPossession],
    shots: [homeShots, awayShots],
    shotsOnTarget: [Math.round(homeShots * 0.5), Math.round(awayShots * 0.4)],
    fouls: [homeFouls, awayFouls],
    corners: [Math.round(homeShots * 0.4), Math.round(awayShots * 0.3)],
    passAccuracy: [84, 76]
  };
};

export default WorldCupDashboard;
