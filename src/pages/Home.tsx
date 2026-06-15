import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import ChannelCard from '../components/ChannelCard';
import MatchSchedule from '../components/MatchSchedule';
import WorldCupDashboard from '../components/WorldCupDashboard';
import { getLiveSportsData, type PlayableStream } from '../services/streamService';
import { Zap, Tv, Search, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import heroBg from '../assets/banner.png';

// World Cup 2026 Participating Countries & Flags for Marquee
const COUNTRIES_MARQUEE = [
  { code: 'us', name: 'USA' },
  { code: 'mx', name: 'Mexico' },
  { code: 'ca', name: 'Canada' },
  { code: 'br', name: 'Brazil' },
  { code: 'ar', name: 'Argentina' },
  { code: 'fr', name: 'France' },
  { code: 'es', name: 'Spain' },
  { code: 'pt', name: 'Portugal' },
  { code: 'gb-eng', name: 'England' },
  { code: 'de', name: 'Germany' },
  { code: 'it', name: 'Italy' },
  { code: 'nl', name: 'Netherlands' },
  { code: 'ma', name: 'Morocco' },
  { code: 'jp', name: 'Japan' },
  { code: 'hr', name: 'Croatia' },
  { code: 'be', name: 'Belgium' },
  { code: 'uy', name: 'Uruguay' },
  { code: 'sn', name: 'Senegal' },
  { code: 'co', name: 'Colombia' },
  { code: 'sa', name: 'Saudi Arabia' }
];

const MARQUEE_FLAGS = [...COUNTRIES_MARQUEE, ...COUNTRIES_MARQUEE, ...COUNTRIES_MARQUEE];

// Countdown to the FIFA World Cup 2026 Grand Final (July 19, 2026)
const WorldCupCountdown = () => {
  const targetDate = useMemo(() => new Date('2026-07-19T20:00:00-04:00'), []);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isCelebration, setIsCelebration] = useState(false);

  useEffect(() => {
    const calculateTime = () => {
      const difference = targetDate.getTime() - new Date().getTime();
      if (difference <= 0) {
        setIsCelebration(true);
        return;
      }
      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);
      setTimeLeft({ days, hours, minutes, seconds });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (isCelebration) {
    return (
      <div className="bg-gradient-to-r from-primary/20 via-emerald-600/20 to-brand-purple/20 border border-primary/20 rounded-[2rem] p-6 shadow-xl text-center glow-card-wc select-none">
        <h4 className="text-xl font-black uppercase font-display italic tracking-tighter text-gradient-gold">
          🏆 GRAND FINAL PIALA DUNIA 2026 SEDANG BERLANGSUNG! 🏆
        </h4>
        <p className="text-xs text-zinc-300 font-bold mt-2">Saksikan pertandingan terbesar sejarah sepak bola sekarang secara live di YKN TV.</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-950/96 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl relative overflow-hidden group select-none">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all duration-500" />
      <div className="space-y-1 text-center md:text-left shrink-0">
        <span className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">Road to MetLife Stadium</span>
        <h4 className="text-lg sm:text-xl font-black uppercase font-display tracking-tight text-white mt-2">Menuju Final Piala Dunia FIFA 2026</h4>
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">New York New Jersey • 19 Juli 2026</p>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 font-display">
        <TimeSegment value={timeLeft.days} label="Hari" />
        <span className="text-xl sm:text-2xl font-black text-zinc-700 -translate-y-2">:</span>
        <TimeSegment value={timeLeft.hours} label="Jam" />
        <span className="text-xl sm:text-2xl font-black text-zinc-700 -translate-y-2">:</span>
        <TimeSegment value={timeLeft.minutes} label="Menit" />
        <span className="text-xl sm:text-2xl font-black text-zinc-700 -translate-y-2">:</span>
        <TimeSegment value={timeLeft.seconds} label="Detik" />
      </div>
    </div>
  );
};

const TimeSegment = ({ value, label }: { value: number; label: string }) => (
  <div className="flex flex-col items-center">
    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-lg sm:text-2xl font-black text-white font-mono shadow-inner">
      {String(value).padStart(2, '0')}
    </div>
    <span className="text-[9px] sm:text-[10px] font-black uppercase text-zinc-500 tracking-widest mt-1.5">{label}</span>
  </div>
);

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
      {/* Dynamic Flag Marquee for World Cup Festive Vibe */}
      <div className="w-full bg-[#080808]/40 border-y border-white/5 py-2.5 overflow-hidden select-none mb-6 rounded-2xl relative shadow-lg">
        <div className="animate-marquee gap-8 items-center flex">
          {MARQUEE_FLAGS.map((flag, idx) => (
            <div key={idx} className="flex items-center gap-2 px-2 shrink-0">
              <img
                src={`https://flagcdn.com/w40/${flag.code === 'gb-eng' ? 'gb-eng' : flag.code}.png`}
                alt={flag.name}
                className="h-3 sm:h-4 object-contain rounded-sm shadow-sm"
              />
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{flag.name}</span>
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
              {/* World Cup themed Hero section */}
              <section className="relative h-[250px] sm:h-[400px] rounded-[2rem] overflow-hidden group shadow-2xl border border-white/5 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-brand-purple before:via-primary before:to-emerald before:z-10">
                <img
                  src={heroBg}
                  alt="FIFA World Cup 2026"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 brightness-[0.45]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/40 to-transparent" />

                <div className="absolute inset-x-0 bottom-0 p-6 sm:p-12 flex flex-col items-start select-none">
                  <div className="flex items-center gap-2 py-1 px-3 bg-primary/10 text-primary border border-primary/20 rounded-full mb-3 sm:mb-5 shadow-lg shadow-primary/5">
                    <Zap size={12} fill="currentColor" className="animate-pulse" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Live FIFA World Cup 2026 Hub</span>
                  </div>
                  <h2 className="text-3xl sm:text-6xl font-display font-black leading-none mb-3 sm:mb-5 tracking-tighter uppercase italic text-white">
                    YKN <span className="text-gradient-gold inline-block pr-2">SPORTS</span> TV
                  </h2>
                  <p className="text-xs sm:text-base text-zinc-300 max-w-xl font-bold leading-relaxed mb-1 hidden sm:block">
                    Tonton pertandingan Piala Dunia 2026 dan saluran TV olahraga premium terlengkap secara langsung tanpa gangguan.
                  </p>
                </div>
              </section>

              {/* World Cup Countdown Timer */}
              <WorldCupCountdown />

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
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${activeSubTab === 'sports'
                      ? 'bg-primary text-dark font-black shadow-md'
                      : 'text-zinc-500 hover:text-white'
                      }`}
                  >
                    Olahraga
                  </button>
                  <button
                    onClick={() => setActiveSubTab('general')}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${activeSubTab === 'general'
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
