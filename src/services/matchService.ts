
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

const getMatchStatus = (dateStr: string, timeStr: string): 'live' | 'upcoming' | 'finished' => {
  try {
    const matchDate = new Date(`${dateStr}T${timeStr}`);
    const now = new Date();
    const diffMs = now.getTime() - matchDate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 0) {
      return 'upcoming';
    } else if (diffHours >= 0 && diffHours < 2) {
      return 'live';
    } else {
      return 'finished';
    }
  } catch {
    return 'upcoming';
  }
};

const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMockMatches = (): Match[] => [
  {
    id: 'mock-1',
    homeTeam: {
      name: 'Manchester City',
      logo: 'https://www.thesportsdb.com/images/media/team/badge/vwpvry1467468683.png'
    },
    awayTeam: {
      name: 'Liverpool',
      logo: 'https://www.thesportsdb.com/images/media/team/badge/65db8i1673891480.png'
    },
    league: {
      name: 'Premier League',
      logo: 'https://www.thesportsdb.com/images/media/league/badge/7v97n21548171123.png'
    },
    time: '19:45',
    date: getTodayDateString(),
    status: 'live',
    score: '2 - 1',
    channelId: 'alkass-4'
  },
  {
    id: 'mock-2',
    homeTeam: {
      name: 'Real Madrid',
      logo: 'https://www.thesportsdb.com/images/media/team/badge/qg29qy1683477169.png'
    },
    awayTeam: {
      name: 'Barcelona',
      logo: 'https://www.thesportsdb.com/images/media/team/badge/08vfol1673892780.png'
    },
    league: {
      name: 'La Liga',
      logo: 'https://www.thesportsdb.com/images/media/league/badge/096v7q1548171171.png'
    },
    time: '21:00',
    date: getTodayDateString(),
    status: 'upcoming',
    channelId: 'alkass-6'
  },
  {
    id: 'mock-3',
    homeTeam: {
      name: 'Al Nassr',
      logo: 'https://www.thesportsdb.com/images/media/team/badge/px87181673896590.png'
    },
    awayTeam: {
      name: 'Al Hilal',
      logo: 'https://www.thesportsdb.com/images/media/team/badge/xvytrw1473523455.png'
    },
    league: {
      name: 'Saudi Pro League',
      logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Saudi_Pro_League_Logo.svg/1200px-Saudi_Pro_League_Logo.svg.png'
    },
    time: '20:30',
    date: getTodayDateString(),
    status: 'live',
    score: '0 - 0',
    channelId: 'ssc-sports-1'
  },
  {
    id: 'mock-4',
    homeTeam: {
      name: 'Persib Bandung',
      logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/3/3a/Persib_Bandung_crest.svg/1200px-Persib_Bandung_crest.svg.png'
    },
    awayTeam: {
      name: 'Persija Jakarta',
      logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f6/Persija_Jakarta_logo.svg/1200px-Persija_Jakarta_logo.svg.png'
    },
    league: {
      name: 'Liga 1 Indonesia',
      logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b2/Liga_1_Indonesia_Logo.png'
    },
    time: '15:30',
    date: getTodayDateString(),
    status: 'upcoming',
    channelId: 'indosiar'
  }
];

export const getTodayMatches = async (): Promise<Match[]> => {
  const dateStr = getTodayDateString();
  const url = `https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${dateStr}&s=Soccer`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    
    if (data.events && data.events.length > 0) {
      const channelRotation = ['alkass-4', 'alkass-1', 'bein-1', 'bein-2', 'ssc-sports-1', 'alkass-3', 'alkass-6', 'indosiar'];
      
      const parsedMatches: Match[] = data.events.map((event: any, idx: number) => {
        let channelId = channelRotation[idx % channelRotation.length];
        const leagueName = (event.strLeague || '').toLowerCase();
        
        if (leagueName.includes('premier league')) {
          channelId = 'alkass-4'; // Alkass Four HD
        } else if (leagueName.includes('champions league') || leagueName.includes('ucl')) {
          channelId = 'alkass-1'; // Alkass One
        } else if (leagueName.includes('europa league')) {
          channelId = 'alkass-3'; // Alkass Three
        } else if (leagueName.includes('la liga') || leagueName.includes('laliga')) {
          channelId = 'alkass-6'; // Alkass Six
        } else if (leagueName.includes('serie a') || leagueName.includes('italy')) {
          channelId = 'bein-1'; // beIN Sports XTRA
        } else if (leagueName.includes('bundesliga') || leagueName.includes('germany')) {
          channelId = 'bein-2'; // beIN Sports XTRA ES
        } else if (leagueName.includes('saudi') || leagueName.includes('gulf') || leagueName.includes('qatar')) {
          channelId = 'ssc-sports-1'; // Bahrain Sports
        } else if (leagueName.includes('indonesia') || leagueName.includes('liga 1')) {
          channelId = 'indosiar';
        } else if (leagueName.includes('india') || leagueName.includes('isl')) {
          channelId = 'dd-sports';
        }

        const timeStr = event.strTime || '12:00:00';
        const dateStrVal = event.dateEvent || dateStr;
        const status = getMatchStatus(dateStrVal, timeStr);

        const homeScore = event.intHomeScore;
        const awayScore = event.intAwayScore;
        const score = (homeScore !== null && awayScore !== null) ? `${homeScore} - ${awayScore}` : undefined;

        return {
          id: event.idEvent,
          homeTeam: {
            name: event.strHomeTeam,
            logo: event.strHomeTeamBadge || 'https://www.thesportsdb.com/images/media/team/badge/placeholder.png'
          },
          awayTeam: {
            name: event.strAwayTeam,
            logo: event.strAwayTeamBadge || 'https://www.thesportsdb.com/images/media/team/badge/placeholder.png'
          },
          league: {
            name: event.strLeague,
            logo: event.strLeagueBadge || 'https://www.thesportsdb.com/images/media/league/badge/placeholder.png'
          },
          time: timeStr.substring(0, 5),
          date: dateStrVal,
          status: status,
          score: score,
          channelId: channelId
        };
      });

      const activeMatches = parsedMatches.filter(m => m.status === 'live' || m.status === 'upcoming');
      if (activeMatches.length > 0) {
        return activeMatches.sort((a, b) => (a.time || '').localeCompare(b.time || '')).slice(0, 10);
      }
    }
  } catch (error) {
    console.error('Failed to fetch real-time matches from TheSportsDB:', error);
  }

  return getMockMatches().filter(m => m.status === 'live' || m.status === 'upcoming');
};
