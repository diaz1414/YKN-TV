import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import ChannelCard from '../components/ChannelCard';
import MatchSchedule from '../components/MatchSchedule';
import WorldCupDashboard from '../components/WorldCupDashboard';
import { getLiveSportsData, slugify, type PlayableStream } from '../services/streamService';
import { Zap, Tv, Search, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import heroBg from '../assets/banner3.png';
import { supabase } from '../services/supabase';

// World Cup 2026 Participating Countries & Flags for Marquee (All 48 qualified teams)
const COUNTRIES_MARQUEE = [
  // Hosts
  { code: 'us', name: 'USA' },
  { code: 'mx', name: 'Mexico' },
  { code: 'ca', name: 'Canada' },
  // CONMEBOL (South America)
  { code: 'ar', name: 'Argentina' },
  { code: 'br', name: 'Brazil' },
  { code: 'co', name: 'Colombia' },
  { code: 'ec', name: 'Ecuador' },
  { code: 'py', name: 'Paraguay' },
  { code: 'uy', name: 'Uruguay' },
  // UEFA (Europe)
  { code: 'es', name: 'Spain' },
  { code: 'fr', name: 'France' },
  { code: 'de', name: 'Germany' },
  { code: 'pt', name: 'Portugal' },
  { code: 'gb-eng', name: 'England' },
  { code: 'nl', name: 'Netherlands' },
  { code: 'be', name: 'Belgium' },
  { code: 'hr', name: 'Croatia' },
  { code: 'at', name: 'Austria' },
  { code: 'ch', name: 'Switzerland' },
  { code: 'gb-sct', name: 'Scotland' },
  { code: 'tr', name: 'Türkiye' },
  { code: 'cz', name: 'Czechia' },
  { code: 'ba', name: 'Bosnia and Herzegovina' },
  { code: 'no', name: 'Norway' },
  { code: 'se', name: 'Sweden' },
  // CAF (Africa)
  { code: 'ma', name: 'Morocco' },
  { code: 'sn', name: 'Senegal' },
  { code: 'dz', name: 'Algeria' },
  { code: 'eg', name: 'Egypt' },
  { code: 'tn', name: 'Tunisia' },
  { code: 'gh', name: 'Ghana' },
  { code: 'za', name: 'South Africa' },
  { code: 'ci', name: "Côte d'Ivoire" },
  { code: 'cv', name: 'Cabo Verde' },
  { code: 'cd', name: 'DR Congo' },
  // AFC (Asia)
  { code: 'jp', name: 'Japan' },
  { code: 'kr', name: 'South Korea' },
  { code: 'sa', name: 'Saudi Arabia' },
  { code: 'ir', name: 'Iran' },
  { code: 'au', name: 'Australia' },
  { code: 'jo', name: 'Jordan' },
  { code: 'uz', name: 'Uzbekistan' },
  { code: 'qa', name: 'Qatar' },
  { code: 'iq', name: 'Iraq' },
  // CONCACAF (North/Central America)
  { code: 'cw', name: 'Curaçao' },
  { code: 'ht', name: 'Haiti' },
  { code: 'pa', name: 'Panama' },
  // OFC (Oceania)
  { code: 'nz', name: 'New Zealand' },
];

const MARQUEE_FLAGS = [...COUNTRIES_MARQUEE, ...COUNTRIES_MARQUEE];

// Countdown to the FIFA World Cup 2026 Grand Final
// Kickoff: 20 Juli 2026 02:00 WIB = 19 Juli 2026 19:00 UTC
const WorldCupCountdown = () => {
  const targetDate = useMemo(() => new Date('2026-07-19T19:00:00Z'), []);

  // Format kickoff time in the user's local timezone (auto-detected by browser)
  const localKickoff = useMemo(() => {
    try {
      const dateStr = new Intl.DateTimeFormat(undefined, {
        day: 'numeric', month: 'long', year: 'numeric',
      }).format(targetDate);
      const timeStr = new Intl.DateTimeFormat(undefined, {
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(targetDate);
      return `${dateStr} • ${timeStr}`;
    } catch {
      return '20 Juli 2026 • 02:00';
    }
  }, [targetDate]);

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
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
          New York New Jersey • {localKickoff}
        </p>
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

  // Smooth scroll to top when active tab changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  const [sportsTv, setSportsTv] = useState<PlayableStream[]>([]);
  const [liveTv, setLiveTv] = useState<PlayableStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'sports' | 'general'>('sports');
  const [viewerCounts, setViewerCounts] = useState<Record<string, number>>({});

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
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ watching: 'home', joined_at: new Date().toISOString() });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, []);

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
      {/* Powered by YKN MOVIES banner above flags */}
      <div className="-mx-4 md:-mx-8 flex items-center justify-center gap-2 py-1.5 bg-zinc-950/60 border-b border-white/[0.03] select-none">
        <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Powered by</span>
        <a
          href="https://yknmovies.diaww.my.id/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[9px] font-black uppercase tracking-widest text-red-600 hover:text-red-400 transition-colors hover:underline"
        >
          YKN MOVIES
        </a>
      </div>

      {/* Dynamic Flag Marquee for World Cup Festive Vibe - All 48 WC2026 Nations */}
      <div className="-mx-4 md:-mx-8 bg-[#080808]/40 border-b border-white/5 py-2.5 overflow-hidden select-none mb-6 relative shadow-lg">
        <div className="animate-marquee gap-6 items-center flex">
          {MARQUEE_FLAGS.map((flag, idx) => (
            <div key={idx} className="flex items-center gap-1.5 px-2 shrink-0">
              <img
                src={`https://flagcdn.com/w40/${flag.code}.png`}
                alt={flag.name}
                className="h-3 sm:h-4 object-contain rounded-sm shadow-sm"
                loading="lazy"
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
              <MatchSchedule viewerCounts={viewerCounts} />

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
                      Update jadwal, skor live, dan notifikasi pertandingan langsung ke HP kamu. Gratis!
                    </p>
                  </div>
                  {/* Buttons */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto shrink-0">
                    <a
                      href="https://whatsapp.com/channel/0029Vb8VPpIAjPXPX2SYKN2P"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl bg-[#25D366] hover:bg-[#1ebe5d] text-white font-black text-[10px] uppercase tracking-wider transition-all hover:scale-105 hover:shadow-[0_0_24px_rgba(37,211,102,0.3)] active:scale-95"
                    >
                      <svg className="w-4 h-4 fill-white shrink-0" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      Join WhatsApp Channel
                    </a>
                    <a
                      href="https://t.me/worldcup2026_ykntv"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl bg-[#229ED9] hover:bg-[#1a8fc4] text-white font-black text-[10px] uppercase tracking-wider transition-all hover:scale-105 hover:shadow-[0_0_24px_rgba(34,158,217,0.3)] active:scale-95"
                    >
                      <svg className="w-4 h-4 fill-white shrink-0" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                      Join Telegram Channel
                    </a>
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
