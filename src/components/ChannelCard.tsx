import { motion } from 'framer-motion';
import { Play, Tv } from 'lucide-react';
import type { PlayableStream } from '../services/streamService';
import { formatBracketText } from '../utils/textFormatter';

interface ChannelCardProps {
  stream: PlayableStream;
  onClick: () => void;
}

const ChannelCard = ({ stream, onClick }: ChannelCardProps) => {
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
      className="group glass-specular rounded-[1.75rem] p-5 md:p-6 cursor-pointer border border-white/[0.08] hover:border-primary/35 transition-all duration-300 relative overflow-hidden select-none transform-gpu tv-focusable"
      tabIndex={0}
    >
      {/* Ambient Top Light Beam */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all duration-500 pointer-events-none" />

      <div className="flex flex-col gap-5 relative z-10">
        {/* Header: Channel Logo Pod & Broadcast Beacon */}
        <div className="flex justify-between items-start">
          <div className="h-14 w-20 bg-gradient-to-b from-white/[0.08] to-white/[0.02] rounded-2xl flex items-center justify-center p-2.5 border border-white/[0.08] shadow-[inset_0_1px_2px_rgba(255,255,255,0.08)] group-hover:border-primary/30 transition-all duration-300 overflow-hidden">
            {stream.logo ? (
              <img
                src={stream.logo}
                alt={stream.name}
                className="h-full max-w-full object-contain filter drop-shadow-md group-hover:scale-110 transition-transform duration-300"
                loading="lazy"
              />
            ) : (
              <Tv size={24} className="text-zinc-500" />
            )}
          </div>

          {/* Broadcast Live Beacon */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/15 rounded-full border border-emerald-500/30 select-none shadow-[0_0_10px_rgba(16,185,129,0.15)]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">LIVE</span>
          </div>
        </div>

        {/* Channel Details */}
        <div className="min-h-[44px]">
          <h3 className="text-base md:text-lg font-display font-black tracking-tight text-white group-hover:text-primary transition-colors truncate">
            {stream.name}
          </h3>
          <div className="text-[11px] text-zinc-400 font-bold line-clamp-1 mt-1 uppercase tracking-wider flex items-center gap-1.5">
            {formatBracketText(stream.subName) || 'Saluran Resmi 24 Jam'}
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between w-full py-3 px-4 bg-white/[0.04] group-hover:bg-primary group-hover:text-black text-zinc-200 rounded-xl font-black transition-all duration-300 border border-white/[0.06] group-hover:border-transparent group-hover:shadow-[0_0_20px_rgba(212,175,55,0.35)]">
          <span className="text-[11px] uppercase tracking-wider font-display font-bold">Mulai Menonton</span>
          <div className="w-7 h-7 rounded-full bg-white/[0.08] group-hover:bg-black/15 flex items-center justify-center transition-transform group-hover:translate-x-1">
            <Play size={11} fill="currentColor" className="ml-0.5" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ChannelCard;
