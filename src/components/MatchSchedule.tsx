import { useEffect, useState } from 'react';
import { getTodayMatches, type Match } from '../services/matchService';
import MatchCard from './MatchCard';
import { useNavigate } from 'react-router-dom';
import { Trophy, ChevronRight } from 'lucide-react';

const MatchSchedule = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMatches = async () => {
      setLoading(true);
      const data = await getTodayMatches();
      setMatches(data);
      setLoading(false);
    };
    fetchMatches();
  }, []);

  const handleMatchClick = (match: Match) => {
    if (match.channelId) {
      navigate(`/watch/${match.channelId}`);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-primary border border-white/5">
            <Trophy size={20} />
          </div>
          <div>
            <h3 className="text-3xl font-display font-black uppercase tracking-tighter italic leading-none">Match Center</h3>
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mt-1">Live from TheSportsDB</p>
          </div>
        </div>
        <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary hover:gap-3 transition-all">
          Full Schedule <ChevronRight size={14} />
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-white/5 rounded-[2rem] animate-pulse border border-white/5" />
          ))}
        </div>
      ) : matches.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {matches.map((match) => (
            <MatchCard 
              key={match.id} 
              match={match} 
              onClick={() => handleMatchClick(match)} 
            />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center bg-white/5 rounded-[2rem] border border-white/5">
           <p className="text-white/20 font-bold uppercase tracking-widest text-sm">No Upcoming Matches Found</p>
        </div>
      )}
    </section>
  );
};

export default MatchSchedule;
