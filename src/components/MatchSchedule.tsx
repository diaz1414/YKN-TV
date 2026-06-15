import { useEffect, useState } from 'react';
import { getTodayMatches, type Match } from '../services/matchService';
import MatchCard from './MatchCard';
import { useNavigate } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { slugify } from '../services/streamService';

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
    const slugName = `${match.homeTeam.name} vs ${match.awayTeam.name}`;
    navigate(`/watch/${slugify(slugName)}-${match.id}`);
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-primary border border-white/5 shadow-md">
            <Trophy size={20} className="fill-primary/10" />
          </div>
          <div>
            <h3 className="text-2xl md:text-3xl font-display font-black uppercase tracking-tighter italic leading-none">Jadwal Pertandingan</h3>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">FIFA World Cup 2026 Live Match Feed</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 bg-white/5 rounded-[2rem] animate-pulse border border-white/5" />
          ))}
        </div>
      ) : matches.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {matches.map((match) => (
            <MatchCard 
              key={match.id} 
              match={match} 
              onClick={() => handleMatchClick(match)} 
            />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center bg-white/[0.01] border border-white/5 rounded-[2rem]">
           <p className="text-zinc-500 font-black uppercase tracking-wider text-xs">Tidak ada siaran jadwal pertandingan saat ini.</p>
        </div>
      )}
    </section>
  );
};

export default MatchSchedule;
