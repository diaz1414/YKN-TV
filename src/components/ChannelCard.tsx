import { Play, Wifi } from 'lucide-react';
import type { Channel } from '../services/streamService';

interface ChannelCardProps {
  channel: Channel;
  onClick: () => void;
}

const ChannelCard = ({ channel, onClick }: ChannelCardProps) => {
  return (
    <div 
      onClick={onClick}
      className="group bg-surface hover:bg-surface-hover border border-white/5 rounded-3xl p-6 transition-all duration-300 cursor-pointer hover:border-primary/40 relative overflow-hidden"
    >
      {/* Accent Glow */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all duration-500" />
      
      <div className="flex flex-col gap-6 relative z-10">
        <div className="flex justify-between items-start">
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center p-3 group-hover:scale-105 transition-transform">
            <img src={channel.logo} alt={channel.name} className="w-full h-full object-contain filter brightness-110" />
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 rounded-full border border-primary/20">
            <Wifi size={12} className="text-primary animate-pulse" />
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{channel.status}</span>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-display font-bold mb-1 group-hover:text-primary transition-colors">{channel.name}</h3>
          <p className="text-sm text-white/40 font-medium line-clamp-1 italic">{channel.now_playing}</p>
        </div>

        <button className="flex items-center justify-between w-full py-3 px-4 bg-white/5 group-hover:bg-primary group-hover:text-dark text-white rounded-2xl font-bold transition-all duration-300">
          <span className="text-sm">Start Streaming</span>
          <div className="w-8 h-8 rounded-full bg-white/10 group-hover:bg-dark/10 flex items-center justify-center">
            <Play size={14} fill="currentColor" />
          </div>
        </button>
      </div>
    </div>
  );
};

export default ChannelCard;
