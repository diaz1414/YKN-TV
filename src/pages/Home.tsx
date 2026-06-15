import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import ChannelCard from '../components/ChannelCard';
import MatchSchedule from '../components/MatchSchedule';
import WorldCupDashboard from '../components/WorldCupDashboard';
import { getLiveSportsData, type PlayableStream } from '../services/streamService';
import { Zap, Tv, Search, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Home = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Detect active tab from query parameters
  const activeTab = searchParams.get('tab') || 'home';

  const [sportsTv, setSportsTv] = useState<PlayableStream[]>([]);
  const [liveTv, setLiveTv] = useState<PlayableStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'sports' | 'general'>('sports');

  // Load stream data on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await getLiveSportsData();
        setSportsTv(data.sportsTv);
        setLiveTv(data.liveTv);
      } catch (err) {
        console.error('Error loading live sports configs:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleChannelClick = (id: string) => {
    navigate(`/watch/${id}`);
  };

  // Filter channels based on search and selected sub tab
  const filteredChannels = useMemo(() => {
    const list = activeSubTab === 'sports' ? sportsTv : liveTv;
    if (!searchTerm.trim()) return list;
    return list.filter(ch => ch.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [sportsTv, liveTv, activeSubTab, searchTerm]);

  return (
    <MainLayout 
      searchPlaceholder={activeSubTab === 'sports' ? "Cari Saluran Olahraga..." : "Cari Saluran Hiburan..."}
      onSearchChange={activeTab === 'channels' ? setSearchTerm : undefined}
      searchValue={searchTerm}
    >
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Render Tab Contents */}
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="tab-home"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-10"
            >
              {/* World Cup themed Hero section */}
              <section className="relative h-[250px] sm:h-[400px] rounded-[2rem] overflow-hidden group shadow-2xl border border-white/5">
                <img
                  src="https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&q=80&w=2000"
                  alt="FIFA World Cup 2026"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 brightness-50"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/30 to-transparent" />

                <div className="absolute inset-x-0 bottom-0 p-6 sm:p-12 flex flex-col items-start select-none">
                  <div className="flex items-center gap-2 py-1 px-3 bg-primary/20 text-primary border border-primary/30 rounded-full mb-3 sm:mb-5 shadow-lg shadow-primary/5">
                    <Zap size={12} fill="currentColor" className="animate-pulse" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Live FIFA World Cup 2026 Hub</span>
                  </div>
                  <h2 className="text-3xl sm:text-6xl font-display font-black leading-none mb-3 sm:mb-5 tracking-tighter uppercase italic text-white">
                    YKN <span className="text-primary">SPORTS</span> TV
                  </h2>
                  <p className="text-xs sm:text-base text-zinc-300 max-w-xl font-bold leading-relaxed mb-1 hidden sm:block">
                    Tonton pertandingan Piala Dunia 2026 dan saluran TV olahraga premium terlengkap secara langsung tanpa gangguan.
                  </p>
                </div>
              </section>

              {/* Match Schedule grid */}
              <MatchSchedule />
            </motion.div>
          )}

          {activeTab === 'channels' && (
            <motion.div
              key="tab-channels"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              {/* Sub tabs for Channel Categories */}
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-primary border border-white/5 shadow">
                    <Tv size={18} />
                  </div>
                  <div>
                    <h3 className="text-xl md:text-2xl font-display font-black uppercase tracking-tighter italic leading-none">Saluran TV</h3>
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Siaran Langsung 24 Jam</p>
                  </div>
                </div>

                {/* Sub Tab Switcher */}
                <div className="flex p-1 bg-white/[0.02] border border-white/5 rounded-xl select-none">
                  <button
                    onClick={() => setActiveSubTab('sports')}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      activeSubTab === 'sports'
                        ? 'bg-primary text-dark font-black shadow-md'
                        : 'text-zinc-500 hover:text-white'
                    }`}
                  >
                    Olahraga
                  </button>
                  <button
                    onClick={() => setActiveSubTab('general')}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      activeSubTab === 'general'
                        ? 'bg-primary text-dark font-black shadow-md'
                        : 'text-zinc-500 hover:text-white'
                    }`}
                  >
                    Hiburan & Lokal
                  </button>
                </div>
              </div>

              {/* Search Bar - Mobile View */}
              <div className="md:hidden relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                <input
                  type="text"
                  placeholder={activeSubTab === 'sports' ? "Cari Saluran Olahraga..." : "Cari Saluran Hiburan..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#080808]/50 border border-white/5 rounded-2xl py-3.5 pl-11 pr-4 text-xs font-bold focus:outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/5 transition-all placeholder:text-zinc-600"
                />
              </div>

              {/* Channels Grid */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="text-primary animate-spin" size={36} />
                  <p className="text-zinc-500 font-black uppercase tracking-[0.15em] text-[10px]">Memuat Saluran TV...</p>
                </div>
              ) : filteredChannels.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {filteredChannels.map((stream) => (
                    <ChannelCard
                      key={stream.id}
                      stream={stream}
                      onClick={() => handleChannelClick(stream.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center bg-[#080808]/20 border border-white/5 rounded-[2rem]">
                  <p className="text-zinc-500 text-lg font-black uppercase italic tracking-wider">Tidak Ada Saluran Ditemukan</p>
                  <button onClick={() => setSearchTerm('')} className="text-primary font-black mt-2 text-xs uppercase tracking-wider hover:underline">Bersihkan Pencarian</button>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'standings' && (
            <motion.div
              key="tab-standings"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
            >
              {/* Standings Dashboard component */}
              <WorldCupDashboard lang="id" />
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </MainLayout>
  );
};

export default Home;
