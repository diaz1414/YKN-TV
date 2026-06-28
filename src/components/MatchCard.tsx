import { motion } from 'framer-motion';
import type { Match } from '../services/matchService';
import { Play, Radio } from 'lucide-react';
import { useEffect, useState } from 'react';

interface MatchCardProps {
  match: Match;
  onClick: () => void;
  viewerCount?: number;
}

const MatchCard = ({ match, onClick, viewerCount }: MatchCardProps) => {
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';

  const [timeLeftStr, setTimeLeftStr] = useState<string>('');
  const [isStartingSoon, setIsStartingSoon] = useState(false);
  const [isGracePeriod, setIsGracePeriod] = useState(false);
  const [viewers, setViewers] = useState<string>('0');

  useEffect(() => {
    if (!isLive) return;
    const rawPresence = viewerCount || 0;
    const format = (v: number) => {
      if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
      if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
      return v.toString();
    };
    setViewers(format(rawPresence));
  }, [isLive, viewerCount]);

  useEffect(() => {
    if (match.status !== 'upcoming' || !match.date) return;

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

    const kickoff = parseJadwal(match.date);
    const playableStart = new Date(kickoff.getTime() - 30 * 60 * 1000);

    const updateTimer = () => {
      const now = new Date();
      const diffToPlayable = playableStart.getTime() - now.getTime();
      const diffToKickoff = kickoff.getTime() - now.getTime();

      if (diffToPlayable <= 0) {
        setTimeLeftStr('Buka Sekarang');
        setIsStartingSoon(true);
      } else if (diffToKickoff < 60 * 60 * 1000) {
        const mins = Math.ceil(diffToPlayable / (1000 * 60));
        setTimeLeftStr(`Buka dlm ${mins}m`);
        setIsStartingSoon(true);
      } else if (diffToKickoff < 24 * 60 * 60 * 1000) {
        const hours = Math.floor(diffToKickoff / (1000 * 60 * 60));
        const mins = Math.floor((diffToKickoff / (1000 * 60)) % 60);
        setTimeLeftStr(`${hours}j ${mins}m lagi`);
        setIsStartingSoon(false);
      } else {
        setTimeLeftStr('');
        setIsStartingSoon(false);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 30000);
    return () => clearInterval(interval);
  }, [match]);

  useEffect(() => {
    if (match.status !== 'finished' || !match.stopDate) {
      setIsGracePeriod(false);
      return;
    }

    const parseJadwalDate = (dateStr?: string): Date => {
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

    const stop = parseJadwalDate(match.stopDate);
    const graceEnd = new Date(stop.getTime() + 30 * 60 * 1000);

    const updateGrace = () => {
      const now = new Date();
      setIsGracePeriod(now <= graceEnd);
    };

    updateGrace();
    const interval = setInterval(updateGrace, 10000);
    return () => clearInterval(interval);
  }, [match]);

  const handleClick = () => {
    if (typeof window !== 'undefined' && window.yknAdRedirect) {
      try {
        window.yknAdRedirect();
      } catch (err) {
        console.error('[Ads] Redirect error:', err);
      }
    }
    onClick();
  };

  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.02 }}
      onClick={handleClick}
      className={`relative overflow-hidden rounded-[2rem] p-6 cursor-pointer border transition-all duration-300 backdrop-blur-2xl bg-[#090909]/98 tv-focusable ${
        isLive 
          ? 'border-primary/45 shadow-lg shadow-primary/5' 
          : isStartingSoon
            ? 'border-amber-500/40 shadow-lg shadow-amber-500/5'
            : isFinished
              ? (isGracePeriod ? 'border-primary/20 hover:border-primary/40 opacity-90' : 'border-white/5 opacity-80')
              : 'border-white/10 hover:border-white/20'
      }`}
      tabIndex={0}
    >
      {/* Accent Glow for Live / Starting Soon */}
      {isLive && (
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
      )}
      {isStartingSoon && (
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl" />
      )}

      {/* League Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{match.league.name}</span>
        </div>
        {isLive && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 rounded-full border border-red-500/25 select-none">
            <Radio size={12} className="text-red-500 animate-pulse-live" />
            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">LIVE {viewers && `• ${viewers}`}</span>
          </div>
        )}
        {isStartingSoon && !isLive && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 rounded-full border border-amber-500/25 select-none animate-pulse">
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">SEGERA MULAI</span>
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
        <div className="flex flex-col items-center gap-2.5 min-w-0">
          <div className="w-14 h-10 rounded-xl bg-white/5 p-2 flex items-center justify-center border border-white/5 overflow-hidden">
            <img src={match.homeTeam.logo} alt={match.homeTeam.name} className="h-full w-full object-contain" />
          </div>
          <span className="text-xs font-black text-center text-zinc-200 truncate w-full">{match.homeTeam.name}</span>
        </div>

        <div className="flex flex-col items-center">
          {(isLive || isFinished) && match.score ? (
            <div className="text-2xl font-black italic italic-shadow tracking-tighter text-white">
              {match.score}
            </div>
          ) : (
            <div className="text-xs font-black text-zinc-500 uppercase tracking-tighter bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">{match.time}</div>
          )}
          <div className="text-[9px] font-black text-zinc-600 uppercase mt-1.5 select-none">VS</div>
        </div>

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
          {isLive 
            ? 'Tonton Langsung' 
            : isStartingSoon
              ? timeLeftStr
              : isFinished 
                ? (isGracePeriod ? 'Tonton Siaran' : 'Pertandingan Selesai')
                : timeLeftStr || 'Akan Datang'}
        </div>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow ${
          isLive || (isFinished && isGracePeriod)
            ? 'bg-primary text-dark font-black hover:scale-105' 
            : 'bg-white/5 text-zinc-500 border border-white/5'
        }`}>
          <Play size={12} fill={isLive || (isFinished && isGracePeriod) ? "currentColor" : "none"} className={isLive || (isFinished && isGracePeriod) ? "ml-0.5" : "opacity-30"} />
        </div>
      </div>
    </motion.div>
  );
};

export default MatchCard;
