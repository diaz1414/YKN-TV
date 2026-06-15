import { motion } from 'framer-motion';
import type { Match } from '../services/matchService';
import { Play, Radio } from 'lucide-react';

interface MatchCardProps {
  match: Match;
  onClick: () => void;
}

const MatchCard = ({ match, onClick }: MatchCardProps) => {
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';

  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.02 }}
      onClick={onClick}
      className={`relative overflow-hidden rounded-[2rem] p-6 cursor-pointer border transition-all duration-300 backdrop-blur-2xl ${
        isLive 
          ? 'bg-primary/[0.15] border-primary/45 shadow-lg shadow-primary/5' 
          : 'bg-zinc-950/96 border-white/10 hover:border-white/20'
      }`}
    >
      {/* Accent Glow for Live */}
      {isLive && (
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
      )}

      {/* League Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{match.league.name}</span>
        </div>
        {isLive && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 rounded-full border border-amber-500/20 select-none">
            <Radio size={12} className="text-amber-400 animate-pulse-live" />
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">LIVE</span>
          </div>
        )}
        {isFinished && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800/30 rounded-full border border-zinc-700/10 select-none">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Selesai</span>
          </div>
        )}
      </div>

      {/* Score / Teams Matchup */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 mb-6">
        {/* Home Team */}
        <div className="flex flex-col items-center gap-2.5 min-w-0">
          <div className="w-14 h-10 rounded-xl bg-white/5 p-2 flex items-center justify-center border border-white/5 overflow-hidden">
            <img src={match.homeTeam.logo} alt={match.homeTeam.name} className="h-full w-full object-contain" />
          </div>
          <span className="text-xs font-black text-center text-zinc-200 truncate w-full">{match.homeTeam.name}</span>
        </div>

        {/* VS / Score Divider */}
        <div className="flex flex-col items-center">
          {isLive || isFinished ? (
            <div className="text-2xl font-black italic italic-shadow tracking-tighter text-white">
              {match.score}
            </div>
          ) : (
            <div className="text-xs font-black text-zinc-500 uppercase tracking-tighter bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">{match.time}</div>
          )}
          <div className="text-[9px] font-black text-zinc-600 uppercase mt-1.5 select-none">VS</div>
        </div>

        {/* Away Team */}
        <div className="flex flex-col items-center gap-2.5 min-w-0">
          <div className="w-14 h-10 rounded-xl bg-white/5 p-2 flex items-center justify-center border border-white/5 overflow-hidden">
            <img src={match.awayTeam.logo} alt={match.awayTeam.name} className="h-full w-full object-contain" />
          </div>
          <span className="text-xs font-black text-center text-zinc-200 truncate w-full">{match.awayTeam.name}</span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-white/5">
        <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest select-none">
          {isLive ? 'Tonton Langsung' : isFinished ? 'Pertandingan Usai' : 'Akan Datang'}
        </div>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow ${
          isLive ? 'bg-primary text-dark font-black' : 'bg-white/5 text-zinc-400'
        }`}>
          <Play size={12} fill={isLive ? "currentColor" : "none"} className="ml-0.5" />
        </div>
      </div>
    </motion.div>
  );
};

export default MatchCard;
