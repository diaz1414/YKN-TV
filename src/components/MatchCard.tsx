import { motion } from 'framer-motion';
import type { Match } from '../services/matchService';
import { formatBracketText } from '../utils/textFormatter';
import { Play, Radio } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SHOW_VIEWER_COUNT } from '../config/features';
import { slugify } from '../services/streamService';

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
    if (!isLive || !SHOW_VIEWER_COUNT) {
      setViewers('');
      return;
    }
    const rawPresence = viewerCount || 0;
    if (rawPresence <= 0) {
      setViewers('');
      return;
    }
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

  const handleShareWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    const slugName = `${match.homeTeam.name} vs ${match.awayTeam.name}`;
    const url = typeof window !== 'undefined' ? `${window.location.origin}/watch/${slugify(slugName)}-${match.id}` : '';
    const shareText = encodeURIComponent(`Nonton siaran langsung ${match.homeTeam.name} vs ${match.awayTeam.name} di YKN TV:\n${url}`);
    window.open(`https://api.whatsapp.com/send?text=${shareText}`, '_blank');
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

        <div className="flex items-center gap-2 shrink-0">
          {/* WhatsApp Quick Share Button */}
          <button
            onClick={handleShareWhatsApp}
            title="Bagikan ke WhatsApp"
            className="w-6 h-6 rounded-full bg-[#25D366]/10 hover:bg-[#25D366]/25 border border-[#25D366]/20 text-[#25D366] flex items-center justify-center transition-all cursor-pointer tv-focusable opacity-75 group-hover:opacity-100"
            tabIndex={0}
          >
            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
          </button>

          {isLive && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/15 rounded-full border border-red-500/30 select-none shadow-[0_0_12px_rgba(239,68,68,0.25)] shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-live-dot-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              <span className="text-[9px] font-black text-red-400 uppercase tracking-widest flex items-center gap-1">
                LIVE {SHOW_VIEWER_COUNT && viewers ? (
                  <span className="text-zinc-300 font-bold tracking-tight">· {viewers}</span>
                ) : null}
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
      </div>

      {/* Arena Matchup: Home vs Away & Stadium Scoreboard */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-6">
        {/* Home Team Pod */}
        <div className="flex flex-col items-center gap-2 min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-2.5 flex items-center justify-center border border-white/[0.09] shadow-[inset_0_1px_2px_rgba(255,255,255,0.08)] overflow-hidden group-hover:border-primary/35 transition-all duration-300">
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
              {isLive ? (
                <span className="text-[8px] font-black uppercase tracking-widest text-red-400 mt-0.5 animate-pulse">
                  Babak Live
                </span>
              ) : (
                <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500 mt-0.5">
                  Skor Akhir
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <div className="flex flex-col items-center px-2.5 py-1 bg-white/[0.04] rounded-xl border border-white/[0.08] shadow-inner font-display">
                <span className="text-[8px] font-black uppercase tracking-widest text-primary/80">
                  Mulai Jam
                </span>
                <span className="text-xs md:text-sm font-black text-white tabular-nums tracking-wider">
                  {match.time || '--:--'} <span className="text-[9px] text-zinc-400 font-bold">WIB</span>
                </span>
              </div>
              <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest select-none mt-0.5">VS</span>
            </div>
          )}
        </div>

        {/* Away Team Pod */}
        <div className="flex flex-col items-center gap-2 min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-2.5 flex items-center justify-center border border-white/[0.09] shadow-[inset_0_1px_2px_rgba(255,255,255,0.08)] overflow-hidden group-hover:border-primary/35 transition-all duration-300">
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
        <div className="flex items-center gap-1.5 min-w-0 pr-2">
          {isLive ? (
            <div className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase tracking-wider">
              <Radio size={12} className="text-red-500 animate-pulse shrink-0" />
              <span className="truncate">Tonton Siaran Langsung</span>
            </div>
          ) : (
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider tabular-nums truncate">
              {isStartingSoon
                ? (timeLeftStr ? `Siap Tayang (${timeLeftStr})` : 'Siap Tayang')
                : isFinished
                  ? (isGracePeriod ? 'Tonton Siaran' : 'Pertandingan Selesai')
                  : (timeLeftStr ? `Buka Siaran (${timeLeftStr})` : `Mulai Jam ${match.time || ''} WIB`)}
            </span>
          )}
        </div>

        {/* Magnetic Action Button */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 shadow-md shrink-0 ${isLive || (isFinished && isGracePeriod)
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
