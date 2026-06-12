import { motion } from 'framer-motion';
import type { Match } from '../services/matchService';
import { Play } from 'lucide-react';

interface MatchCardProps {
  match: Match;
  onClick: () => void;
}

const MatchCard = ({ match, onClick }: MatchCardProps) => {
  const isLive = match.status === 'live';

  return (
    <motion.div
      whileHover={{ y: -5 }}
      onClick={onClick}
      className={`relative overflow-hidden rounded-[2rem] p-6 cursor-pointer border transition-all duration-300 ${
        isLive ? 'bg-primary/5 border-primary/20 shadow-lg shadow-primary/5' : 'bg-surface border-white/5 hover:border-white/10'
      }`}
    >
      {/* League Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <img src={match.league.logo} alt={match.league.name} className="w-6 h-6 object-contain" />
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{match.league.name}</span>
        </div>
        {isLive && (
          <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 rounded-full">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Live</span>
          </div>
        )}
      </div>

      {/* Score / Teams */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 mb-6">
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-2xl bg-white/5 p-3 flex items-center justify-center">
            <img src={match.homeTeam.logo} alt={match.homeTeam.name} className="w-full h-full object-contain" />
          </div>
          <span className="text-xs font-bold text-center">{match.homeTeam.name}</span>
        </div>

        <div className="flex flex-col items-center">
          {isLive || match.status === 'finished' ? (
            <div className="text-3xl font-black italic italic-shadow tracking-tighter">
              {match.score}
            </div>
          ) : (
            <div className="text-sm font-black text-white/20 uppercase tracking-tighter">{match.time}</div>
          )}
          <div className="text-[10px] font-bold text-white/20 uppercase mt-1">VS</div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-2xl bg-white/5 p-3 flex items-center justify-center">
            <img src={match.awayTeam.logo} alt={match.awayTeam.name} className="w-full h-full object-contain" />
          </div>
          <span className="text-xs font-bold text-center">{match.awayTeam.name}</span>
        </div>
      </div>

      {/* Action */}
      <div className="flex items-center justify-between pt-4 border-t border-white/5">
        <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
          {isLive ? 'Tap to watch' : 'Scheduled'}
        </div>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isLive ? 'bg-primary text-dark' : 'bg-white/5 text-white/40'}`}>
          <Play size={12} fill={isLive ? "currentColor" : "none"} />
        </div>
      </div>
    </motion.div>
  );
};

export default MatchCard;
