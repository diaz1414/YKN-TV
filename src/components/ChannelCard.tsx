import { Play, Radio } from 'lucide-react';
import type { PlayableStream } from '../services/streamService';

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
    <div
      onClick={handleClick}
      className="group bg-zinc-950/96 backdrop-blur-2xl hover:bg-zinc-900/98 border border-white/10 rounded-3xl p-6 transition-all duration-300 cursor-pointer hover:border-primary/30 relative overflow-hidden shadow-xl tv-focusable"
      tabIndex={0}
    >
      {/* Gold Accent Glow */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all duration-500" />

      <div className="flex flex-col gap-6 relative z-10">
        <div className="flex justify-between items-start">
          {stream.isBase64Logo && stream.logo ? (
            <div className="h-14 w-20 bg-white/5 rounded-2xl flex items-center justify-center p-2 group-hover:scale-105 transition-transform overflow-hidden border border-white/5">
              <img src={stream.logo} alt={stream.name} className="h-full max-w-full object-contain filter brightness-110" />
            </div>
          ) : (
            <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center p-3 group-hover:scale-105 transition-transform border border-white/5">
              <img src={stream.logo || "https://flagcdn.com/w80/un.png"} alt={stream.name} className="w-full h-full object-contain filter brightness-110" />
            </div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20 select-none">
            <Radio size={12} className="text-emerald-400 animate-pulse-live" />
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">LIVE</span>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-display font-black tracking-tight text-white group-hover:text-primary transition-colors">{stream.name}</h3>
          <p className="text-xs text-zinc-500 font-bold line-clamp-1 italic mt-1 uppercase tracking-wider">{stream.subName}</p>
        </div>

        <button className="flex items-center justify-between w-full py-3.5 px-4 bg-white/5 group-hover:bg-primary group-hover:text-dark text-white rounded-2xl font-black transition-all duration-300">
          <span className="text-xs uppercase tracking-wider">Mulai Menonton</span>
          <div className="w-7 h-7 rounded-full bg-white/10 group-hover:bg-dark/10 flex items-center justify-center">
            <Play size={12} fill="currentColor" className="ml-0.5" />
          </div>
        </button>
      </div>
    </div>
  );
};

export default ChannelCard;
