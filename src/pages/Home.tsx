import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import ChannelCard from '../components/ChannelCard';
import MatchSchedule from '../components/MatchSchedule';
import { getLiveSportsData, slugify, type PlayableStream } from '../services/streamService';
import { Clock3, Loader2, MonitorPlay, Radio, Search, ShieldCheck, Tv, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import heroBg from '../assets/banner2.png';
import { supabase } from '../services/supabase';
import axios from 'axios';


const HUB_STRIP_ITEMS = [
  'Live TV',
  'Sports',
  'News',
  'Entertainment',
  'Multi Server',
  'Mobile Ready',
  'Low Buffer',
  'Status Monitor',
];

const HUB_STRIP = [...HUB_STRIP_ITEMS, ...HUB_STRIP_ITEMS];

const HERO_FEATURES = [
  { icon: MonitorPlay, label: 'Live TV 24 Jam' },
  { icon: ShieldCheck, label: 'Server Cadangan' },
  { icon: Clock3, label: 'Jadwal Update' },
];
const Home = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Detect active tab from query parameters
  const activeTabParam = searchParams.get('tab') || 'home';
  const activeTab = activeTabParam === 'standings' ? 'live' : activeTabParam;

  // Smooth scroll to top when active tab changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  // Load stream data on mount
  const [sportsTv, setSportsTv] = useState<PlayableStream[]>([]);
  const [liveTv, setLiveTv] = useState<PlayableStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'sports' | 'general'>('sports');
  const [viewerCounts, setViewerCounts] = useState<Record<string, number>>({});
  const [fallbackViewerCounts, setFallbackViewerCounts] = useState<Record<string, number>>({});

  // Real-time tracking of viewers using Supabase Presence
  useEffect(() => {
    const channel = supabase.channel('global-live-sports-presence');

    channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const counts: Record<string, number> = {};

        Object.values(presenceState).forEach((presences: any) => {
          presences.forEach((p: any) => {
            if (p.watching) {
              counts[p.watching] = (counts[p.watching] || 0) + 1;
            }
          });
        });

        setViewerCounts(counts);
      })
      .subscribe(async (status: any) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ watching: 'home', joined_at: new Date().toISOString() });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, []);

  // Periodic fallback viewer tracking from WebSocket monitoring API
  useEffect(() => {
    const fetchFallbackViewers = async () => {
      try {
        const envVal = import.meta.env.VITE_BOT_API_URL;
        const apiBase = envVal === '/api' ? '' : (envVal || 'https://api.ykn.my.id');
        const res = await axios.get<any[]>(`${apiBase}/api/sports/monitoring`);

        const mapping: Record<string, number> = {};
        if (Array.isArray(res.data)) {
          res.data.forEach((room: any) => {
            if (room && room.roomId) {
              mapping[room.roomId] = room.viewers;
            }
          });
        }
        setFallbackViewerCounts(mapping);
      } catch (err) {
        console.warn('[Viewer Tracking Fallback] Failed to fetch websocket monitoring data:', err);
      }
    };

    fetchFallbackViewers();
    // Interval dinaikkan 8s → 60s (hemat ~7.500 req/menit saat 1000 user)
    // Supabase Presence sudah handle real-time, ini hanya fallback
    const interval = setInterval(fetchFallbackViewers, 60000);
    return () => clearInterval(interval);
  }, []);

  const mergedViewerCounts = useMemo(() => {
    const merged: Record<string, number> = { ...viewerCounts };
    Object.entries(fallbackViewerCounts).forEach(([id, val]) => {
      merged[id] = Math.max(merged[id] || 0, val);
    });
    return merged;
  }, [viewerCounts, fallbackViewerCounts]);

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
    const ch = [...sportsTv, ...liveTv].find(c => c.id === id);
    if (ch) {
      navigate(`/watch/${slugify(ch.name)}`);
    } else {
      navigate(`/watch/${id}`);
    }
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
      {/* Partner banner */}
      <div className="-mx-4 md:-mx-8 flex items-center justify-center gap-2 py-1.5 bg-zinc-950/60 border-b border-white/[0.03] select-none">
        <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Powered by</span>
        <a
          href="https://movies.ykn.my.id"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[9px] font-black uppercase tracking-widest text-red-600 hover:text-red-400 transition-colors hover:underline"
        >
          YKN MOVIES
        </a>
      </div>

      <div className="-mx-4 md:-mx-8 bg-[#080808]/40 border-b border-white/5 py-2.5 overflow-hidden select-none mb-6 relative shadow-lg">
        <div className="animate-marquee gap-6 items-center flex">
          {HUB_STRIP.map((item, idx) => (
            <div key={`${item}-${idx}`} className="flex items-center gap-2 px-2 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/80 shadow-[0_0_10px_rgba(212,175,55,0.35)]" />
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{item}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto w-full space-y-10 px-2 sm:px-4">

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
              <section className="relative min-h-[320px] sm:min-h-[430px] rounded-[2rem] overflow-hidden group shadow-2xl border border-white/5 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-primary before:via-emerald before:to-white/30 before:z-10">
                <img
                  src={heroBg}
                  alt="YKN TV live broadcast hub"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 brightness-[0.46]"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-dark via-dark/70 to-dark/20" />
                <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-dark to-transparent" />

                <div className="relative z-10 flex min-h-[320px] max-w-3xl flex-col justify-end p-6 sm:min-h-[430px] sm:p-12 select-none">
                  <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-black/45 px-3 py-1 text-primary shadow-lg shadow-primary/5 backdrop-blur-xl">
                    <Radio size={12} className="animate-pulse" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Live TV Hub</span>
                  </div>
                  <h2 className="text-4xl sm:text-6xl font-display font-black leading-none mb-4 tracking-tighter uppercase italic text-white">
                    YKN <span className="text-gradient-gold inline-block pr-2">TV</span>
                  </h2>
                  <p className="text-sm sm:text-base text-zinc-300 max-w-2xl font-bold leading-relaxed">
                    Jadwal pertandingan, saluran olahraga, berita, dan hiburan dalam satu tempat yang ringan dipakai di HP maupun desktop.
                  </p>

                  <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <button
                      onClick={() => navigate('/?tab=channels')}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-xs font-black uppercase tracking-widest text-dark shadow-lg shadow-primary/10 transition-all hover:bg-yellow-400 active:scale-95 cursor-pointer tv-focusable"
                    >
                      <Tv size={15} />
                      Buka Saluran
                    </button>
                    <button
                      onClick={() => navigate('/?tab=live')}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.08] px-5 py-3 text-xs font-black uppercase tracking-widest text-white backdrop-blur-xl transition-all hover:border-primary/30 hover:bg-white/[0.12] active:scale-95 cursor-pointer tv-focusable"
                    >
                      <Zap size={15} />
                      Live Center
                    </button>
                  </div>

                  <div className="mt-7 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
                    {HERO_FEATURES.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/45 px-3 py-3 backdrop-blur-xl">
                          <Icon size={15} className="text-primary" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-300">{item.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* Match Schedule grid */}
              <MatchSchedule viewerCounts={mergedViewerCounts} />

              {/* Join Community Banner */}
              <section className="relative overflow-hidden rounded-[2rem] border border-white/5 bg-zinc-950/80 backdrop-blur-xl shadow-xl">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-emerald-600/5 pointer-events-none" />
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                <div className="relative px-6 py-7 sm:px-10 sm:py-9 flex flex-col sm:flex-row items-center justify-between gap-6">
                  {/* Text */}
                  <div className="text-center sm:text-left space-y-1.5">
                    <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
                        Komunitas Resmi
                      </span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-display font-black uppercase tracking-tight text-white italic">
                      Gabung Komunitas <span className="text-primary">YKN TV</span>
                    </h3>
                    <p className="text-[10px] sm:text-xs text-zinc-400 font-bold max-w-sm leading-relaxed">
                      Update jadwal, info siaran, dan status server langsung ke HP kamu. Gratis.
                    </p>
                  </div>
                  {/* Buttons */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto shrink-0">
                    <a
                      href="https://whatsapp.com/channel/0029Vb8VPpIAjPXPX2SYKN2P"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl bg-[#25D366] hover:bg-[#1ebe5d] text-white font-black text-[10px] uppercase tracking-wider transition-all hover:scale-105 hover:shadow-[0_0_24px_rgba(37,211,102,0.3)] active:scale-95 tv-focusable"
                      tabIndex={0}
                    >
                      <svg className="w-4 h-4 fill-white shrink-0" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                      Join WhatsApp Channel
                    </a>
                    <button
                      onClick={() => navigate('/status')}
                      className="flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white font-black text-[10px] uppercase tracking-wider transition-all hover:scale-105 active:scale-95 tv-focusable"
                      tabIndex={0}
                    >
                      <ShieldCheck size={15} />
                      Cek Status Server
                    </button>
                  </div>
                </div>
              </section>
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
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer tv-focusable ${activeSubTab === 'sports'
                      ? 'bg-primary text-dark font-black shadow-md'
                      : 'text-zinc-500 hover:text-white'
                      }`}
                    tabIndex={0}
                  >
                    Olahraga
                  </button>
                  <button
                    onClick={() => setActiveSubTab('general')}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer tv-focusable ${activeSubTab === 'general'
                      ? 'bg-primary text-dark font-black shadow-md'
                      : 'text-zinc-500 hover:text-white'
                      }`}
                    tabIndex={0}
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

          {activeTab === 'live' && (
            <motion.div
              key="tab-live"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
              className="space-y-8"
            >
              <section className="rounded-[2rem] border border-white/10 bg-zinc-950/70 p-6 shadow-xl backdrop-blur-xl sm:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="max-w-2xl">
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-primary">
                      <Radio size={12} />
                      <span className="text-[9px] font-black uppercase tracking-widest">Live Center</span>
                    </div>
                    <h2 className="font-display text-3xl font-black uppercase italic tracking-tight text-white sm:text-4xl">
                      Pantau Siaran Aktif
                    </h2>
                    <p className="mt-3 text-sm font-bold leading-relaxed text-zinc-400">
                      Semua jadwal utama dan kategori olahraga ada di sini, lengkap dengan status live, waktu buka, dan jalur menuju halaman watch.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/?tab=channels')}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:border-primary/30 hover:bg-white/[0.1] active:scale-95 cursor-pointer tv-focusable"
                  >
                    <Tv size={15} />
                    Saluran TV
                  </button>
                </div>
              </section>
              <MatchSchedule viewerCounts={mergedViewerCounts} />
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </MainLayout>
  );
};

export default Home;
