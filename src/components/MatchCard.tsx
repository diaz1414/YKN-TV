import { motion } from 'framer-motion';
import type { Match } from '../services/matchService';
import { formatBracketText } from '../utils/textFormatter';
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

    // Card tetap dianggap LIVE selama 30 menit setelah jadwal_stop
    const graceEnd = new Date(stop.getTime() + 30 * 60 * 1000);

    const updateGrace = () => {
      const now = new Date();
      setIsGracePeriod(now <= graceEnd);
    };

    updateGrace();

    const interval = setInterval(updateGrace, 10000);

    return () => clearInterval(interval);
  }, [match.status, match.stopDate]);

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
      whileHover={{ y: -5, scale: 1.015, transition: { type: "spring", stiffness: 350, damping: 25 } }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      className={`group relative overflow-hidden rounded-[1.75rem] p-5 md:p-6 cursor-pointer border transition-all duration-300 transform-gpu tv-focusable select-none ${isLive
        ? 'glass-specular border-red-500/40 shadow-[0_12px_35px_-8px_rgba(239,68,68,0.22),inset_0_1px_0_0_rgba(255,255,255,0.15)] glow-card-live'
        : isStartingSoon
          ? 'glass-specular border-amber-500/35 shadow-[0_12px_35px_-8px_rgba(245,158,11,0.18),inset_0_1px_0_0_rgba(255,255,255,0.12)]'
          : isFinished
            ? (isGracePeriod ? 'glass-specular border-primary/30 opacity-95' : 'bg-[#08080a]/90 border-white/[0.06] opacity-75 hover:opacity-100 hover:border-white/15')
            : 'glass-specular hover:border-primary/40 hover:shadow-[0_16px_36px_-10px_rgba(212,175,55,0.15)]'
        }`}
      tabIndex={0}
    >
      {/* Dynamic Stadium Ambient Glow */}
      {isLive && (
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-gradient-to-br from-red-500/20 via-primary/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      )}
      {isStartingSoon && !isLive && (
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
      )}

      {/* Top Header: League & Status Badge */}
      <div className="flex items-center justify-between gap-2 mb-5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="h-1.5 w-1.5 rounded-full bg-primary/70 shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 truncate">
            {formatBracketText(match.league.name)}
          </span>
        </div>

        {isLive && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/15 rounded-full border border-red-500/30 select-none shadow-[0_0_12px_rgba(239,68,68,0.25)] shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-live-dot-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span className="text-[9px] font-black text-red-400 uppercase tracking-widest flex items-center gap-1">
              LIVE {viewers && <span className="text-zinc-300 font-bold tracking-tight">· {viewers}</span>}
            </span>
          </div>
        )}

        {isStartingSoon && !isLive && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/15 rounded-full border border-amber-500/30 select-none shadow-[0_0_10px_rgba(245,158,11,0.2)] shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
            <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest">SEGERA MULAI</span>
          </div>
        )}

        {isFinished && (
          <div className="flex items-center gap-1 px-2.5 py-0.5 bg-white/[0.04] rounded-full border border-white/5 select-none shrink-0">
            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Selesai</span>
          </div>
        )}
      </div>

      {/* Arena Matchup: Home vs Away & Stadium Scoreboard */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-6">
        {/* Home Team Pod */}
        <div className="flex flex-col items-center gap-2 min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-2.5 flex items-center justify-center border border-white/[0.08] shadow-[inset_0_1px_2px_rgba(255,255,255,0.08)] overflow-hidden group-hover:border-primary/30 transition-all duration-300">
            <img
              src={match.homeTeam.logo}
              alt={match.homeTeam.name}
              className="h-full w-full object-contain filter drop-shadow-md group-hover:scale-110 transition-transform duration-300"
              loading="lazy"
            />
          </div>
          <span className="text-xs font-black text-center text-zinc-100 truncate w-full group-hover:text-primary transition-colors">
            {match.homeTeam.name}
          </span>
        </div>

        {/* Center: Digital Stadium Score / Kickoff Clock */}
        <div className="flex flex-col items-center justify-center px-2">
          {(isLive || isFinished) && match.score ? (
            <div className="flex flex-col items-center">
              <div className="text-2xl md:text-3xl font-black font-display tracking-tight text-white scoreboard-digital italic">
                {match.score}
              </div>
              {isLive && (
                <span className="text-[8px] font-black uppercase tracking-widest text-red-400 mt-0.5">
                  Babak Live
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <div className="text-xs font-black text-zinc-200 tracking-wider bg-white/[0.05] px-3 py-1.5 rounded-xl border border-white/[0.08] shadow-inner font-display tabular-nums">
                {match.time}
              </div>
              <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest select-none">VS</span>
            </div>
          )}
        </div>

        {/* Away Team Pod */}
        <div className="flex flex-col items-center gap-2 min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-2.5 flex items-center justify-center border border-white/[0.08] shadow-[inset_0_1px_2px_rgba(255,255,255,0.08)] overflow-hidden group-hover:border-primary/30 transition-all duration-300">
            <img
              src={match.awayTeam.logo}
              alt={match.awayTeam.name}
              className="h-full w-full object-contain filter drop-shadow-md group-hover:scale-110 transition-transform duration-300"
              loading="lazy"
            />
          </div>
          <span className="text-xs font-black text-center text-zinc-100 truncate w-full group-hover:text-primary transition-colors">
            {match.awayTeam.name}
          </span>
        </div>
      </div>

      {/* Action Footer: Status & Tactile Play Trigger */}
      <div className="flex items-center justify-between pt-3.5 border-t border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          {isLive ? (
            <div className="flex items-center gap-1 text-[10px] font-black text-primary uppercase tracking-wider">
              <Radio size={11} className="text-red-500 animate-pulse" />
              <span>Tonton Langsung</span>
            </div>
          ) : (
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider tabular-nums">
              {isStartingSoon
                ? timeLeftStr
                : isFinished
                  ? (isGracePeriod ? 'Tonton Siaran' : 'Pertandingan Selesai')
                  : timeLeftStr || 'Akan Datang'}
            </span>
          )}
        </div>

        {/* Magnetic Action Button */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 shadow-md ${isLive || (isFinished && isGracePeriod)
          ? 'bg-gradient-to-r from-primary to-yellow-500 text-black font-black group-hover:scale-110 group-hover:shadow-[0_0_16px_rgba(212,175,55,0.4)]'
          : 'bg-white/[0.05] text-zinc-400 border border-white/[0.08] group-hover:border-white/20 group-hover:text-white group-hover:bg-white/[0.1]'
          }`}>
          <Play
            size={12}
            fill={isLive || (isFinished && isGracePeriod) ? "currentColor" : "none"}
            className={`${isLive || (isFinished && isGracePeriod) ? "ml-0.5" : "opacity-40 group-hover:opacity-90"} transition-transform group-hover:translate-x-0.5`}
          />
        </div>
      </div>
    </motion.div>
  );
};

export default MatchCard;
