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

export const getTodayMatches = async (): Promise<Match[]> => {
  const leagues = [
    { id: '4328', name: 'Premier League', logo: 'https://www.thesportsdb.com/images/media/league/badge/7v97n21548171123.png' },
    { id: '4335', name: 'La Liga', logo: 'https://www.thesportsdb.com/images/media/league/badge/096v7q1548171171.png' },
    { id: '4480', name: 'Champions League', logo: 'https://www.thesportsdb.com/images/media/league/badge/dt6t8m1548171092.png' }
  ];

  const results = await Promise.all(
    leagues.map(l => fetchLeagueMatches(l.id, l.name, l.logo))
  );

  // Flatten and sort by time
  return results.flat().sort((a, b) => {
    if (a.date === b.date) {
      return (a.time || '').localeCompare(b.time || '');
    }
    return (a.date || '').localeCompare(b.date || '');
  }).slice(0, 10); // Limit to top 10 matches
};
