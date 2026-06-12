const BASE_URL = 'https://www.thesportsdb.com/api/v1/json/123';

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

// Memory cache for team logos to avoid hitting rate limits
const teamCache: Record<string, string> = {};

const fetchLeagueTeams = async (leagueId: string) => {
  try {
    const response = await fetch(`${BASE_URL}/lookup_all_teams.php?id=${leagueId}`);
    const data = await response.json();
    if (data.teams) {
      data.teams.forEach((team: any) => {
        teamCache[team.idTeam] = team.strTeamBadge;
      });
    }
  } catch (error) {
    console.error(`Error fetching teams for league ${leagueId}:`, error);
  }
};

const fetchLeagueMatches = async (leagueId: string, leagueName: string, leagueLogo: string): Promise<Match[]> => {
  try {
    // Ensure we have logos for this league
    await fetchLeagueTeams(leagueId);

    const response = await fetch(`${BASE_URL}/eventsnextleague.php?id=${leagueId}`);
    const data = await response.json();
    
    if (!data.events) return [];

    return data.events.map((event: any) => ({
      id: event.idEvent,
      homeTeam: {
        name: event.strHomeTeam,
        logo: teamCache[event.idHomeTeam] || 'https://www.thesportsdb.com/images/media/team/badge/placeholder.png'
      },
      awayTeam: {
        name: event.strAwayTeam,
        logo: teamCache[event.idAwayTeam] || 'https://www.thesportsdb.com/images/media/team/badge/placeholder.png'
      },
      league: {
        name: leagueName,
        logo: leagueLogo
      },
      time: event.strTime?.substring(0, 5) || 'TBA',
      date: event.dateEvent,
      status: 'upcoming', // Free API doesn't have live scores readily available in this endpoint
      channelId: 'bein-1' // Default channel for demo
    }));
  } catch (error) {
    console.error(`Error fetching matches for league ${leagueId}:`, error);
    return [];
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
    channelId: 'bein-1'
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
    channelId: 'bein-2'
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
    status: 'finished',
    score: '3 - 2',
    channelId: 'indosiar'
  }
];

export const getTodayMatches = async (): Promise<Match[]> => {
  const leagues = [
    { id: '4328', name: 'Premier League', logo: 'https://www.thesportsdb.com/images/media/league/badge/7v97n21548171123.png' },
    { id: '4335', name: 'La Liga', logo: 'https://www.thesportsdb.com/images/media/league/badge/096v7q1548171171.png' },
    { id: '4480', name: 'Champions League', logo: 'https://www.thesportsdb.com/images/media/league/badge/dt6t8m1548171092.png' }
  ];

  try {
    const results = await Promise.all(
      leagues.map(l => fetchLeagueMatches(l.id, l.name, l.logo))
    );
    const apiMatches = results.flat().filter(m => m.status === 'live' || m.status === 'upcoming');
    if (apiMatches.length > 0) {
      return apiMatches.sort((a, b) => {
        if (a.date === b.date) {
          return (a.time || '').localeCompare(b.time || '');
        }
        return (a.date || '').localeCompare(b.date || '');
      }).slice(0, 10);
    }
  } catch (error) {
    console.error('Failed to fetch API matches, using mocks:', error);
  }

  return getMockMatches().filter(m => m.status === 'live' || m.status === 'upcoming');
};
