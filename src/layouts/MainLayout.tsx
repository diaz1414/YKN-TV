import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Search, Tv, Home, Award, Calendar, Menu, X } from 'lucide-react';
import { getTodayMatches, type Match } from '../services/matchService';
import yknwcLogo from '../assets/yknwc-logo.png';
import { slugify } from '../services/streamService';


interface MainLayoutProps {
  children: React.ReactNode;
  searchPlaceholder?: string;
  onSearchChange?: (val: string) => void;
  searchValue?: string;
}

const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  searchPlaceholder = "Cari saluran...",
  onSearchChange,
  searchValue = ""
}) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = searchParams.get('tab') || 'home';
  const isWatchPage = location.pathname.startsWith('/watch/');

  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  // State tambahan eksklusif hanya untuk kontrol buka/tutup burger menu
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const fetchLiveMatch = async () => {
      try {
        const matches = await getTodayMatches();
        if (matches && matches.length > 0) {
          // Priority 1: Match that is currently live
          const live = matches.find(m => m.status === 'live');
          if (live) {
            setActiveMatch(live);
            return;
          }
          // Priority 2: Upcoming match
          const upcoming = matches.find(m => m.status === 'upcoming');
          if (upcoming) {
            setActiveMatch(upcoming);
            return;
          }
          // Priority 3: First match
          setActiveMatch(matches[0]);
        }
      } catch (err) {
        console.error('Error fetching live match for badge:', err);
      }
    };

    fetchLiveMatch();
    const interval = setInterval(fetchLiveMatch, 30000);
    return () => clearInterval(interval);
  }, []);

  // Menutup burger menu secara otomatis jika tab navigasi berubah
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname, searchParams]);

  const getTeamAbbreviation = (name: string): string => {
    if (!name) return 'TBD';
    if (name.length <= 4) return name.toUpperCase();
    const mapping: Record<string, string> = {
      'spain': 'ESP',
      'cabo verde': 'CPV',
      'cape verde': 'CPV',
      'brazil': 'BRA',
      'morocco': 'MAR',
      'argentina': 'ARG',
      'germany': 'GER',
      'france': 'FRA',
      'england': 'ENG',
      'portugal': 'POR',
      'italy': 'ITA',
      'netherlands': 'NED',
      'belgium': 'BEL',
      'croatia': 'CRO',
      'uruguay': 'URU',
      'senegal': 'SEN',
      'colombia': 'COL',
      'mexico': 'MEX',
      'usa': 'USA',
      'canada': 'CAN',
      'japan': 'JPN',
      'korea': 'KOR',
      'saudi arabia': 'KSA',
    };
    const lower = name.toLowerCase().trim();
    if (mapping[lower]) return mapping[lower];
    return name.substring(0, 3).toUpperCase();
  };

  const handleTabChange = (tab: string) => {
    if (tab === 'home') {
      navigate('/');
    } else {
      navigate(`/?tab=${tab}`);
    }
  };

  const getActiveTabClass = (tab: string) => {
    const isActive = activeTab === tab && !isWatchPage;
    return isActive
      ? 'text-primary font-black scale-105 border-b-2 border-primary pb-1'
      : 'text-zinc-400 hover:text-white transition-all font-semibold';
  };

  const getMobileTabClass = (tab: string) => {
    const isActive = activeTab === tab && !isWatchPage;
    return isActive
      ? 'text-primary scale-110 font-bold'
      : 'text-zinc-500 hover:text-zinc-300';
  };

  return (
    <div className="min-h-screen bg-transparent text-white flex flex-col font-sans">
      {/* Top Header Navbar - Glassmorphism */}
      <header className="h-16 md:h-20 glass border-b border-white/5 flex items-center justify-between px-4 md:px-8 sticky top-0 bg-[#020202]/80 backdrop-blur-xl z-50">
        <div className="flex items-center gap-3 md:gap-8">
          {/* Tombol Burger - Muncul hanya di layar mobile (md:hidden) */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 bg-white/5 border border-white/5 rounded-xl text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            {isMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          {/* Logo YKN TV */}
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 cursor-pointer select-none group"
          >
            <img
              src={yknwcLogo}
              alt="YKN TV Logo"
              className="w-9 h-9 md:w-11 md:h-11 object-contain rounded-xl shadow-lg shadow-primary/10 group-hover:scale-105 transition-transform duration-300"
            />
            <div>
              <span className="text-lg md:text-2xl font-black tracking-tighter uppercase font-display italic">
                YKN <span className="text-primary">TV</span>
              </span>
              <span className="hidden sm:inline-block ml-2 text-[9px] bg-gradient-to-r from-primary to-emerald-500 text-black font-black px-1.5 py-0.5 rounded tracking-widest uppercase shadow-[0_0_10px_rgba(212,175,55,0.2)]">
                WC 2026
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <button
              onClick={() => handleTabChange('home')}
              className={`${getActiveTabClass('home')} cursor-pointer flex items-center gap-1.5`}
            >
              <Calendar size={14} />
              Jadwal
            </button>
            <button
              onClick={() => handleTabChange('channels')}
              className={`${getActiveTabClass('channels')} cursor-pointer flex items-center gap-1.5`}
            >
              <Tv size={14} />
              Saluran TV
            </button>
            <button
              onClick={() => handleTabChange('standings')}
              className={`${getActiveTabClass('standings')} cursor-pointer flex items-center gap-1.5`}
            >
              <Award size={14} />
              Klasemen
            </button>
          </nav>
        </div>

        {/* Search & Profile area */}
        <div className="flex items-center gap-3 md:gap-6">
          {/* Search Input - Desktop */}
          {onSearchChange && (
            <div className="hidden md:flex items-center gap-3 bg-white/[0.03] border border-white/5 px-4 py-2 rounded-xl w-64 focus-within:border-primary/40 focus-within:bg-white/[0.05] transition-all">
              <Search size={16} className="text-zinc-500" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                className="bg-transparent border-none outline-none text-xs w-full placeholder:text-zinc-600"
              />
            </div>
          )}

          {/*Live Streaming Info Match Badge */}
          {activeMatch && (
            <div
              onClick={() => {
                const slugName = `${activeMatch.homeTeam.name} vs ${activeMatch.awayTeam.name}`;
                navigate(`/watch/${slugify(slugName)}-${activeMatch.id}`);
              }}
              className="flex items-center gap-3 pl-4 md:border-l border-white/10 group cursor-pointer select-none bg-white/5 hover:bg-white/10 py-1.5 px-3 rounded-full transition-all duration-300"
            >
              {/* Indikator Live Berkedip / Upcoming status */}
              <div className="relative flex h-2 w-2">
                {activeMatch.status === 'live' ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </>
                ) : activeMatch.status === 'finished' ? (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-600"></span>
                ) : (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                )}
              </div>

              {/* Info Match yang lagi hot */}
              <div className="text-right block">
                <p className="text-[8px] sm:text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  {activeMatch.status === 'live'
                    ? 'Sedang Berlangsung'
                    : activeMatch.status === 'finished'
                      ? 'Selesai'
                      : 'Akan Datang'}
                </p>
                <p className="text-[10px] sm:text-xs font-black text-white group-hover:text-amber-400 transition-colors">
                  {getTeamAbbreviation(activeMatch.homeTeam.name)}{' '}
                  <span className="text-amber-400">
                    {activeMatch.status === 'live' || activeMatch.status === 'finished'
                      ? activeMatch.score || 'vs'
                      : 'vs'}
                  </span>{' '}
                  {getTeamAbbreviation(activeMatch.awayTeam.name)}
                </p>
              </div>

              {/* Tombol Tonton Langsung */}
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-dark shadow-lg group-hover:scale-105 transition-transform duration-300">
                <svg className="w-4 h-4 fill-black translate-x-[1px]" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Dropdown Menu Tirai untuk Layar Mobile (md:hidden) */}
      <div
        className={`fixed inset-x-0 top-16 bg-[#020202]/95 backdrop-blur-2xl border-b border-white/5 z-40 md:hidden flex flex-col p-4 gap-2.5 transition-all duration-300 transform origin-top ${isMenuOpen ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-0 pointer-events-none'
          }`}
      >
        {/* Kolom Pencarian khusus di Mobile (Hanya muncul jika prop onSearchChange dikirim) */}
        {onSearchChange && (
          <div className="flex items-center gap-3 bg-white/[0.03] border border-white/5 px-4 py-2 rounded-xl w-full mb-1">
            <Search size={16} className="text-zinc-500" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="bg-transparent border-none outline-none text-xs w-full placeholder:text-zinc-600"
            />
          </div>
        )}

        {/* List Menu Link Navigasi Mobile */}
        <button
          onClick={() => handleTabChange('home')}
          className={`flex items-center gap-3 p-3 rounded-xl font-bold text-xs uppercase tracking-wider text-left transition-colors ${activeTab === 'home' && !isWatchPage ? 'bg-primary/10 text-primary' : 'text-zinc-400 bg-white/[0.01]'
            }`}
        >
          <Calendar size={14} />
          Jadwal Pertandingan
        </button>

        <button
          onClick={() => handleTabChange('channels')}
          className={`flex items-center gap-3 p-3 rounded-xl font-bold text-xs uppercase tracking-wider text-left transition-colors ${activeTab === 'channels' && !isWatchPage ? 'bg-primary/10 text-primary' : 'text-zinc-400 bg-white/[0.01]'
            }`}
        >
          <Tv size={14} />
          Saluran TV Langsung
        </button>

        <button
          onClick={() => handleTabChange('standings')}
          className={`flex items-center gap-3 p-3 rounded-xl font-bold text-xs uppercase tracking-wider text-left transition-colors ${activeTab === 'standings' && !isWatchPage ? 'bg-primary/10 text-primary' : 'text-zinc-400 bg-white/[0.01]'
            }`}
        >
          <Award size={14} />
          Klasemen Grup
        </button>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 pb-24 md:pb-12 p-4 md:p-8 flex flex-col justify-between min-h-[calc(100vh-80px)]">
        <div className="flex-1">
          {children}
        </div>

        {/* Sleek, Beautiful, Premium Footer */}
        <footer className="mt-16 pt-6 pb-6 px-6 border-t border-white/[0.04] bg-zinc-950/30 backdrop-blur-md rounded-2xl select-none">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-zinc-500 text-[10px] font-bold uppercase tracking-widest text-center sm:text-left">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
              <span className="text-white font-black tracking-wide">YKN TV</span>
              <span className="hidden sm:inline text-zinc-700">|</span>
              <span className="text-zinc-500">© {new Date().getFullYear()} All Rights Reserved</span>
            </div>

            <div className="flex items-center gap-6">
              <span onClick={() => handleTabChange('home')} className="hover:text-primary transition-colors cursor-pointer">Jadwal</span>
              <span onClick={() => handleTabChange('channels')} className="hover:text-primary transition-colors cursor-pointer">Saluran TV</span>
              <span onClick={() => handleTabChange('standings')} className="hover:text-primary transition-colors cursor-pointer">Klasemen</span>
            </div>
          </div>
        </footer>
      </main>

      {/* Mobile Sticky Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#020202]/95 border-t border-white/5 backdrop-blur-xl z-50 flex items-center justify-around px-2 select-none shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
        <button
          onClick={() => handleTabChange('home')}
          className={`flex flex-col items-center gap-1 cursor-pointer ${getMobileTabClass('home')}`}
        >
          <Home size={20} />
          <span className="text-[9px] font-black uppercase tracking-wider">Jadwal</span>
        </button>

        <button
          onClick={() => handleTabChange('channels')}
          className={`flex flex-col items-center gap-1 cursor-pointer ${getMobileTabClass('channels')}`}
        >
          <Tv size={20} />
          <span className="text-[9px] font-black uppercase tracking-wider">Saluran</span>
        </button>

        <button
          onClick={() => handleTabChange('standings')}
          className={`flex flex-col items-center gap-1 cursor-pointer ${getMobileTabClass('standings')}`}
        >
          <Award size={20} />
          <span className="text-[9px] font-black uppercase tracking-wider">Klasemen</span>
        </button>
      </nav>
    </div>
  );
};

export default MainLayout;