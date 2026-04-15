import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import VideoPlayer from '../components/VideoPlayer';
import { getChannelById } from '../services/streamService';
import type { Channel } from '../services/streamService';
import { ChevronLeft, Info, Wifi, Share2, Heart } from 'lucide-react';

const ChannelDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChannel = async () => {
      setLoading(true);
      if (id) {
        const data = await getChannelById(id);
        if (data) setChannel(data);
      }
      setLoading(false);
    };
    fetchChannel();
  }, [id]);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </MainLayout>
    );
  }

  if (!channel) {
    return (
      <MainLayout>
        <div className="text-center py-20">
          <h2 className="text-3xl font-bold mb-4 text-red-500">Channel Not Found</h2>
          <button onClick={() => navigate('/')} className="text-primary hover:underline">Back to Dashboard</button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-white/40 hover:text-white transition-all group py-2 px-4 hover:bg-white/5 rounded-xl border border-transparent hover:border-white/10"
          >
            <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-bold tracking-tight">Return to Grid</span>
          </button>

          <div className="flex items-center gap-4">
            <button className="p-3 text-white/40 hover:text-primary transition-colors bg-white/5 rounded-2xl border border-white/5">
              <Share2 size={20} />
            </button>
            <button className="p-3 text-white/40 hover:text-red-500 transition-colors bg-white/5 rounded-2xl border border-white/5">
              <Heart size={20} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Player Area */}
          <div className="lg:col-span-2 space-y-8">
            <VideoPlayer servers={[{ name: channel.name, url: channel.url, type: 'direct' }]} />
            
            <div className="glass rounded-[2.5rem] p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8">
                <div className="flex items-center gap-2 py-1 px-3 bg-primary/10 text-primary border border-primary/20 rounded-full">
                  <Wifi size={14} className="animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{channel.status}</span>
                </div>
              </div>

              <div className="flex items-start gap-8 mb-8">
                <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center p-4 ring-1 ring-white/10">
                  <img src={channel.logo} alt={channel.name} className="w-full h-full object-contain" />
                </div>
                <div>
                  <h1 className="text-4xl font-display font-black mb-2 tracking-tighter">{channel.name}</h1>
                  <p className="text-xl text-primary font-bold italic mb-4">Now Playing: {channel.now_playing}</p>
                  <div className="flex items-center gap-4">
                    <span className="px-3 py-1 bg-white/5 rounded-lg text-[10px] font-bold text-white/40 uppercase tracking-widest">{channel.category}</span>
                    <span className="px-3 py-1 bg-white/5 rounded-lg text-[10px] font-bold text-white/40 uppercase tracking-widest">1080p Ultra HD</span>
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-white/5 grid grid-cols-3 gap-6">
                <StatItem label="Bitrate" value="8.5 Mbps" />
                <StatItem label="Latency" value="1.2s" />
                <StatItem label="Viewers" value="14.2K" />
              </div>
            </div>
          </div>

          {/* Sidebar Area */}
          <div className="space-y-6">
            <div className="glass rounded-[2.5rem] p-8 border border-white/10">
              <h4 className="text-lg font-bold mb-6 flex items-center gap-3">
                <div className="w-3 h-3 bg-primary rounded-full animate-pulse shadow-[0_0_10px_rgba(0,255,136,0.5)]" />
                Broadcast Notes
              </h4>
              <div className="space-y-6">
                <InfoPoint icon={<Info size={16} />} title="Network Stability" desc="Stream performance is currently optimal. No issues reported." />
                <InfoPoint icon={<Info size={16} />} title="Audio Sync" desc="Use 'Server 2' if you experience a slight delay in audio peaks." />
              </div>
            </div>

            <div className="bg-gradient-to-br from-primary/30 to-emerald-600/30 border border-primary/20 rounded-[2.5rem] p-8 shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
              <h4 className="text-2xl font-black mb-2 italic">GO PREMIUM</h4>
              <p className="text-white/60 text-sm mb-6 leading-relaxed">Remove all ads and unlock 4K multi-server access for just $4.99/mo.</p>
              <button className="w-full py-4 bg-primary text-dark font-black rounded-2xl hover:scale-[1.03] transition-transform shadow-xl uppercase tracking-widest text-xs">
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

const StatItem = ({ label, value }: { label: string; value: string }) => (
  <div className="text-center">
    <p className="text-[10px] uppercase font-bold text-white/20 tracking-widest mb-1">{label}</p>
    <p className="text-lg font-black">{value}</p>
  </div>
);

const InfoPoint = ({ icon, title, desc }: { icon: React.ReactNode; title: string, desc: string }) => (
  <div className="flex gap-4">
    <div className="p-2 bg-white/5 rounded-xl text-primary h-fit">{icon}</div>
    <div>
      <p className="text-xs font-bold mb-1">{title}</p>
      <p className="text-[10px] text-white/40 leading-relaxed font-medium">{desc}</p>
    </div>
  </div>
);

export default ChannelDetail;
