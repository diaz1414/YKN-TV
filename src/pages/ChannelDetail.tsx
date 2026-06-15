import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import VideoPlayer from '../components/VideoPlayer';
import { getStreamById, getLiveSportsData, type PlayableStream } from '../services/streamService';
import { ChevronLeft, Wifi, Share2, Award, Play, Radio } from 'lucide-react';

const ChannelDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [stream, setStream] = useState<PlayableStream | null>(null);
  const [sportsTv, setSportsTv] = useState<PlayableStream[]>([]);
  const [liveTv, setLiveTv] = useState<PlayableStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Load active stream and other channels for quick switcher sidebar
  useEffect(() => {
    const fetchStreamData = async () => {
      setLoading(true);
      if (id) {
        const foundStream = await getStreamById(id);
        if (foundStream) {
          setStream(foundStream);
        }
      }
      try {
        const list = await getLiveSportsData();
        setSportsTv(list.sportsTv);
        setLiveTv(list.liveTv);
      } catch (e) {
        console.error('Failed to load other channels:', e);
      }
      setLoading(false);
    };
    fetchStreamData();
  }, [id]);

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </MainLayout>
    );
  }

  if (!stream) {
    return (
      <MainLayout>
        <div className="text-center py-20">
          <h2 className="text-2xl md:text-3xl font-black mb-4 text-netflix-red uppercase tracking-wider font-display">Saluran Tidak Ditemukan</h2>
          <button 
            onClick={() => navigate('/')} 
            className="px-6 py-2.5 bg-primary text-dark font-black rounded-xl hover:scale-105 transition-all uppercase text-xs tracking-wider cursor-pointer"
          >
            Kembali ke Beranda
          </button>
        </div>
      </MainLayout>
    );
  }

  const otherChannels = [...sportsTv, ...liveTv].filter(c => c.id !== stream.id);

  return (
    <MainLayout>
      <div className="max-w-[1440px] mx-auto w-full space-y-6 md:space-y-8 pb-10 px-2 sm:px-4">
        
        {/* Header Breadcrumbs & Controls */}
        <div className="flex items-center justify-between">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-all group py-2 px-4 bg-white/5 rounded-xl border border-white/5 text-xs font-black uppercase tracking-wider cursor-pointer"
          >
            <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span>Kembali ke Grid</span>
          </button>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleShare}
              className="p-2.5 text-zinc-400 hover:text-primary transition-all bg-white/5 rounded-xl border border-white/5 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider cursor-pointer"
            >
              <Share2 size={16} />
              <span>{copied ? 'Tersalin' : 'Bagikan'}</span>
            </button>
          </div>
        </div>

        {/* Responsive Grid layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Main Stream Section (8 columns on desktop) */}
          <div className="lg:col-span-8 space-y-6 md:space-y-8">
            
            {/* Embedded Player */}
            <div className="overflow-hidden rounded-3xl border border-white/5 shadow-2xl">
              <VideoPlayer servers={stream.servers} />
            </div>
            
            {/* Stream info detail box */}
            <div className="glass-card rounded-[2rem] p-6 md:p-8 relative overflow-hidden">
              <div className="absolute top-6 right-6 select-none">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                  <Wifi size={12} className="animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-widest">ONLINE</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8 select-none">
                {stream.isBase64Logo && stream.logo ? (
                  <div className="h-16 w-24 bg-white/5 rounded-2xl flex items-center justify-center p-2 border border-white/5 overflow-hidden shrink-0">
                    <img src={stream.logo} alt={stream.name} className="h-full max-w-full object-contain filter brightness-110" />
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center p-3 border border-white/5 shrink-0">
                    <img src={stream.logo || "https://flagcdn.com/w80/un.png"} alt={stream.name} className="w-full h-full object-contain filter brightness-110" />
                  </div>
                )}
                <div>
                  <h1 className="text-2xl md:text-3xl font-display font-black tracking-tight text-white leading-tight">{stream.name}</h1>
                  <p className="text-sm md:text-base text-primary font-bold italic mt-1.5">{stream.subName}</p>
                  <div className="flex items-center gap-2.5 mt-3.5">
                    <span className="px-2.5 py-1 bg-white/5 border border-white/5 rounded-lg text-[9px] font-black text-zinc-400 uppercase tracking-wider">
                      {stream.isChannel ? 'Saluran TV' : 'Live Match'}
                    </span>
                    <span className="px-2.5 py-1 bg-white/5 border border-white/5 rounded-lg text-[9px] font-black text-zinc-400 uppercase tracking-wider">
                      1080p Ultra HD
                    </span>
                  </div>
                </div>
              </div>

              {/* Stream Specs grid */}
              <div className="pt-6 border-t border-white/5 grid grid-cols-3 gap-4 text-center select-none">
                <StatItem label="Bitrate" value="6.4 Mbps" />
                <StatItem label="Latensi" value="0.9s" />
                <StatItem label="Format" value={stream.servers[0]?.type.toUpperCase() || 'HLS'} />
              </div>
            </div>
          </div>

          {/* Right Sidebar Quick Switcher Section (4 columns on desktop) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="glass-card rounded-[2rem] p-6 flex flex-col max-h-[500px] md:max-h-[600px]">
              <div className="flex items-center gap-2.5 mb-5 select-none border-b border-white/5 pb-3">
                <Radio size={16} className="text-primary animate-pulse-live" />
                <h4 className="text-sm font-black uppercase tracking-wider font-display">Saluran Lainnya</h4>
              </div>

              {/* Scrollable list */}
              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
                {otherChannels.length === 0 ? (
                  <p className="text-zinc-600 text-xs font-bold text-center py-10 uppercase tracking-wider select-none">Tidak ada saluran lain</p>
                ) : (
                  otherChannels.map((ch) => (
                    <div
                      key={ch.id}
                      onClick={() => navigate(`/watch/${ch.id}`)}
                      className="flex items-center justify-between p-3 bg-white/[0.01] hover:bg-white/5 border border-white/5 hover:border-white/10 rounded-2xl transition-all duration-200 cursor-pointer group select-none"
                    >
                      <div className="flex items-center gap-3 truncate">
                        {ch.isBase64Logo && ch.logo ? (
                          <div className="h-8 w-12 bg-white/5 rounded-lg flex items-center justify-center p-1 border border-white/5 overflow-hidden shrink-0">
                            <img src={ch.logo} alt={ch.name} className="h-full max-w-full object-contain filter brightness-110" />
                          </div>
                        ) : (
                          <div className="h-8 w-8 bg-white/5 rounded-lg flex items-center justify-center p-2 border border-white/5 shrink-0">
                            <img src={ch.logo || "https://flagcdn.com/w80/un.png"} alt={ch.name} className="w-full h-full object-contain filter brightness-110" />
                          </div>
                        )}
                        <div className="truncate">
                          <h5 className="text-xs font-bold text-white group-hover:text-primary transition-colors truncate">{ch.name}</h5>
                          <p className="text-[9px] text-zinc-500 font-bold truncate uppercase tracking-wider mt-0.5">{ch.subName}</p>
                        </div>
                      </div>
                      <Play size={10} className="text-zinc-500 group-hover:text-primary group-hover:scale-110 transition-all ml-2 shrink-0" fill="none" />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Premium World Cup Box */}
            <div className="bg-gradient-to-br from-primary/10 to-emerald-950/20 border border-primary/20 rounded-[2rem] p-6 shadow-xl select-none relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all duration-500" />
              <h4 className="text-xl font-black mb-2 italic tracking-tighter uppercase font-display flex items-center gap-2">
                <Award size={18} className="text-primary fill-primary/10" />
                Dukung Tim Favorit!
              </h4>
              <p className="text-zinc-400 text-[11px] font-bold leading-relaxed mb-5">Gabung bersama jutaan suporter untuk menikmati tayangan berkualitas tinggi UHD 4K bebas iklan.</p>
              <button className="w-full py-3 bg-primary text-dark font-black rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-md uppercase tracking-wider text-[10px] cursor-pointer">
                Gabung Member Premium
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
    <p className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider mb-1">{label}</p>
    <p className="text-sm font-black text-white">{value}</p>
  </div>
);

export default ChannelDetail;
