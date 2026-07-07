import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Search, Tv, Home, Award, Calendar, Menu, X, Coffee } from 'lucide-react';
import { getTodayMatches, MATCH_SCHEDULE_REFRESH_MS, type Match } from '../services/matchService';
import yknwcLogo from '../assets/yknwc-logo.png';
import { slugify } from '../services/streamService';
import { SupportModal } from '../components/SupportDeveloper';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../services/supabase';
import GlobalAnnouncement from '../components/GlobalAnnouncement';
import { useTvNavigation } from '../hooks/useTvNavigation';
import BackupSiteNotice from '../components/BackupSiteNotice';

// Set true to show mobile burger menu, false to hide it
const SHOW_BURGER_MENU = false;

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

  const { isTvMode, toggleTvMode, toastMessage } = useTvNavigation();

  // Tombol toggle hanya relevan jika Mode TV sudah aktif
  // (auto-detect UA, D-pad, atau sebelumnya manual diaktifkan)
  const showTvToggle = isTvMode;

  const activeTab = searchParams.get('tab') || 'home';
  const isWatchPage = location.pathname.startsWith('/watch/');

  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  // State tambahan eksklusif hanya untuk kontrol buka/tutup burger menu
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminRole, setAdminRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchLiveMatch = async () => {
      try {
        const matches = await getTodayMatches(true); // force refresh for real-time scores
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
    const interval = setInterval(fetchLiveMatch, MATCH_SCHEDULE_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  // Menutup burger menu secara otomatis jika tab navigasi berubah
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname, searchParams]);

  useEffect(() => {
    const checkAdminSession = async () => {
      const loggedIn = (localStorage.getItem('ykn_admin_logged_in') || sessionStorage.getItem('ykn_admin_logged_in')) === 'true';
      const savedUsername = localStorage.getItem('ykn_admin_username') || sessionStorage.getItem('ykn_admin_username') || '';
      const savedToken = localStorage.getItem('ykn_admin_token') || sessionStorage.getItem('ykn_admin_token') || '';

      if (loggedIn && savedUsername && savedToken) {
        // Backup local session check
        const isBackupDev = savedUsername === 'diaww' && savedToken === '63f94390a2807bf1cfc047f0c3c54ec7f1bad40985c32d7983bc16a34edb9d08';
        const isBackupAdmin = savedUsername === 'diaww14' && savedToken === '63f94390a2807bf1cfc047f0c3c54ec7f1bad40985c32d7983bc16a34edb9d08';

        if (isBackupDev || isBackupAdmin) {
          setIsAdminLoggedIn(true);
          const savedRole = localStorage.getItem('ykn_admin_role') || sessionStorage.getItem('ykn_admin_role');
          setAdminRole(savedRole || (isBackupDev ? 'developer' : 'admin'));
          return;
        }

        try {
          const { data } = await supabase
            .from('ykn_users')
            .select('role')
            .eq('username', savedUsername)
            .eq('password', savedToken)
            .single();

          if (data) {
            setIsAdminLoggedIn(true);
            setAdminRole(data.role);
          } else {
            setIsAdminLoggedIn(false);
            setAdminRole(null);
          }
        } catch (err) {
          // Fallback if offline/error, trust local storage/session storage session
          setIsAdminLoggedIn(true);
          const savedRole = localStorage.getItem('ykn_admin_role') || sessionStorage.getItem('ykn_admin_role');
          setAdminRole(savedRole);
        }
      } else {
        setIsAdminLoggedIn(false);
        setAdminRole(null);
      }
    };

    checkAdminSession();

    // Check when localStorage changes (e.g. login/logout from another tab/page)
    // Polling dihapus (hemat ~20.000 Supabase query/menit untuk 1000 user)
    // Storage event sudah cukup untuk detect login/logout antar tab
    window.addEventListener('storage', checkAdminSession);

    return () => {
      window.removeEventListener('storage', checkAdminSession);
    };
  }, []);

  // Protect Developer Tools in Production
  useEffect(() => {
    // Only protect in production mode
    if (!import.meta.env.PROD) return;

    // Check if developer role is logged in
    const savedRole = localStorage.getItem('ykn_admin_role') || sessionStorage.getItem('ykn_admin_role');
    if (savedRole === 'developer' || adminRole === 'developer') return;

    // 1. Disable Right Click
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextMenu);

    // 2. Disable Keyboard Shortcuts (F12, Inspect, View Source)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable F12
      if (e.key === 'F12') {
        e.preventDefault();
        return;
      }

      // Disable Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        return;
      }

      // Disable Ctrl+U
      if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) {
        e.preventDefault();
        return;
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    // 3. Disable Console Output in Production
    const originalLog = window.console.log;
    const originalWarn = window.console.warn;
    const originalError = window.console.error;
    const originalInfo = window.console.info;
    const originalDebug = window.console.debug;

    const dummyFunc = () => { };
    window.console.log = dummyFunc;
    window.console.warn = dummyFunc;
    window.console.error = dummyFunc;
    window.console.info = dummyFunc;
    window.console.debug = dummyFunc;

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);

      // Restore console functions
      window.console.log = originalLog;
      window.console.warn = originalWarn;
      window.console.error = originalError;
      window.console.info = originalInfo;
      window.console.debug = originalDebug;
    };
  }, [adminRole]);

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
      <header
        onClick={(e) => e.stopPropagation()}
        className="h-16 md:h-20 glass border-b border-white/5 flex items-center justify-between px-4 md:px-8 sticky top-0 bg-[#020202]/80 backdrop-blur-xl z-50"
      >
        <div className="flex items-center gap-3 md:gap-8">
          {/* Tombol Burger - Muncul hanya di layar mobile (md:hidden) */}
          {SHOW_BURGER_MENU && (
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 bg-white/5 border border-white/5 rounded-xl text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              {isMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          )}

          {/* Logo YKN TV */}
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 cursor-pointer select-none group tv-focusable rounded-xl p-1"
            tabIndex={0}
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
              {isAdminLoggedIn && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/ykn-c0ntr0l-hq/dashboard');
                  }}
                  className={`ml-2 text-[8px] md:text-[9.5px] border font-black px-2 py-0.5 rounded-full tracking-wider uppercase inline-flex items-center gap-1 cursor-pointer hover:scale-105 active:scale-95 transition-all tv-focusable ${adminRole === 'developer'
                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[0_0_12px_rgba(168,85,247,0.15)] hover:bg-purple-500/20'
                    : 'bg-[#e50914]/10 text-[#e50914] border-[#e50914]/20 shadow-[0_0_12px_rgba(229,9,20,0.15)] hover:bg-[#e50914]/20'
                    }`}
                  tabIndex={0}
                >
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${adminRole === 'developer' ? 'bg-purple-400' : 'bg-red-400'}`}></span>
                    <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${adminRole === 'developer' ? 'bg-purple-400' : 'bg-[#e50914]'}`} />
                  </span>
                  {adminRole === 'developer' ? 'Developer' : 'Admin'}
                </button>
              )}
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <button
              onClick={() => handleTabChange('home')}
              className={`${getActiveTabClass('home')} cursor-pointer flex items-center gap-1.5 tv-focusable rounded-lg px-2 py-1`}
              tabIndex={0}
            >
              <Calendar size={14} />
              Jadwal
            </button>
            <button
              onClick={() => handleTabChange('channels')}
              className={`${getActiveTabClass('channels')} cursor-pointer flex items-center gap-1.5 tv-focusable rounded-lg px-2 py-1`}
              tabIndex={0}
            >
              <Tv size={14} />
              Saluran TV
            </button>
            <button
              onClick={() => handleTabChange('standings')}
              className={`${getActiveTabClass('standings')} cursor-pointer flex items-center gap-1.5 tv-focusable rounded-lg px-2 py-1`}
              tabIndex={0}
            >
              <Award size={14} />
              Klasemen
            </button>
            {showTvToggle && (
              <button
                onClick={toggleTvMode}
                className={`cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all text-xs font-bold uppercase tracking-wider tv-focusable ${isTvMode
                  ? 'bg-primary/20 text-primary border-primary/30 shadow-[0_0_12px_rgba(212,175,55,0.2)]'
                  : 'bg-white/5 text-zinc-400 border-white/5 hover:text-white hover:bg-white/10'
                  }`}
                tabIndex={0}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="2" y="3" width="20" height="15" rx="2" />
                  <path d="M12 18v4M8 22h8" />
                </svg>
                {isTvMode ? 'Mode TV: ON' : 'Mode TV'}
              </button>
            )}
          </nav>
        </div>

        {/* Search & Profile area */}
        <div className="flex items-center gap-3 md:gap-6">
          {/* Search Input - Desktop */}
          {onSearchChange && (
            <div className="hidden md:flex items-center gap-3 bg-white/[0.03] border border-white/5 px-4 py-2 rounded-xl w-64 focus-within:border-primary/40 focus-within:bg-white/[0.05] transition-all tv-focusable" tabIndex={0}>
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
              data-trigger-popunder="true"
              className="flex items-center gap-3 pl-4 md:border-l border-white/10 group cursor-pointer select-none bg-white/5 hover:bg-white/10 py-1.5 px-3 rounded-full transition-all duration-300 tv-focusable"
              tabIndex={0}
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
                  {activeMatch.status === 'live' && activeMatch.liveMinute && (
                    <span className="ml-1 text-red-400 text-[8px] font-black">{activeMatch.liveMinute}</span>
                  )}
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

      {(location.pathname === '/' || location.pathname.startsWith('/watch/')) && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="px-4 md:px-8 pt-3 md:pt-4"
        >
          <BackupSiteNotice
            variant={location.pathname.startsWith('/watch/') ? 'watch' : 'home'}
          />
        </div>
      )}

      {/* Dropdown Menu Tirai untuk Layar Mobile (md:hidden) */}
      {SHOW_BURGER_MENU && (
        <div
          onClick={(e) => e.stopPropagation()}
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
      )}

      {/* Main Content Area */}
      <main className="flex-1 pb-24 md:pb-12 p-4 md:p-8 flex flex-col justify-between min-h-[calc(100vh-80px)]">
        <div className="flex-1">
          {children}
        </div>

        {/* Sleek, Beautiful, Premium Footer */}
        <footer className="mt-16 pt-6 pb-6 px-6 border-t border-white/[0.04] bg-zinc-950/30 backdrop-blur-md rounded-2xl select-none space-y-5">
          {/* Community row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-white/[0.04]">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Ikuti Komunitas Kami</p>
            <div className="flex items-center gap-3">
              <a
                href="https://whatsapp.com/channel/0029Vb8VPpIAjPXPX2SYKN2P"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] font-black text-[9px] uppercase tracking-wider hover:bg-[#25D366]/20 transition-all cursor-pointer"
              >
                <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                WhatsApp
              </a>
              <a
                href="https://t.me/worldcup2026_ykntv"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#229ED9]/10 border border-[#229ED9]/20 text-[#229ED9] font-black text-[9px] uppercase tracking-wider hover:bg-[#229ED9]/20 transition-all cursor-pointer"
              >
                <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
                Telegram
              </a>
            </div>
          </div>
          {/* Bottom row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-zinc-500 text-[10px] font-bold uppercase tracking-widest text-center sm:text-left">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
              <span className="text-white font-black tracking-wide">YKN TV</span>
              <span className="hidden sm:inline text-zinc-700">|</span>
              <span className="text-zinc-500">
                © {new Date().getFullYear()} All Rights Reserved - Powered by{' '}
                <a
                  href="https://movies.ykn.my.id"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-600 hover:text-red-500 hover:underline font-black transition-colors"
                >
                  YKN MOVIES
                </a>
              </span>
            </div>

            <div className="flex items-center gap-6">
              <span onClick={() => handleTabChange('home')} className="hover:text-primary transition-colors cursor-pointer tv-focusable rounded px-1.5 py-0.5" tabIndex={0}>Jadwal</span>
              <span onClick={() => handleTabChange('channels')} className="hover:text-primary transition-colors cursor-pointer tv-focusable rounded px-1.5 py-0.5" tabIndex={0}>Saluran TV</span>
              <span onClick={() => handleTabChange('standings')} className="hover:text-primary transition-colors cursor-pointer tv-focusable rounded px-1.5 py-0.5" tabIndex={0}>Klasemen</span>
              <span onClick={() => setIsSupportOpen(true)} className="text-amber-400 hover:text-amber-300 font-bold transition-colors cursor-pointer flex items-center gap-1 select-none tv-focusable rounded px-1.5 py-0.5" tabIndex={0}>
                <Coffee size={12} className="fill-amber-400/10" />
                Traktir Kopi
              </span>
              {showTvToggle && (
                <span onClick={toggleTvMode} className={`font-bold transition-colors cursor-pointer flex items-center gap-1 select-none tv-focusable rounded px-1.5 py-0.5 ${isTvMode ? 'text-primary' : 'text-zinc-500 hover:text-white'}`} tabIndex={0}>
                  <svg className="w-3.5 h-3.5 inline-block mr-1 align-middle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="2" y="3" width="20" height="15" rx="2" />
                    <path d="M12 18v4M8 22h8" />
                  </svg>
                  {isTvMode ? 'Mode TV: ON' : 'Mode TV'}
                </span>
              )}
            </div>
          </div>
        </footer>
      </main>

      {/* Mobile Sticky Bottom Navigation Bar */}
      <nav
        onClick={(e) => e.stopPropagation()}
        className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#020202]/95 border-t border-white/5 backdrop-blur-xl z-50 flex items-center justify-around px-2 select-none shadow-[0_-10px_30px_rgba(0,0,0,0.8)]"
      >
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

      {/* Floating Action Button (FAB) for Support - Hidden on Watch Page */}
      {!isWatchPage && (
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsSupportOpen(true)}
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-lg shadow-amber-500/20 border border-amber-400/30 hover:shadow-amber-500/35 transition-all select-none cursor-pointer group tv-focusable"
          tabIndex={0}
        >
          <Coffee size={22} className="group-hover:rotate-12 transition-transform duration-300 fill-black/10" />
        </motion.button>
      )}

      {/* Global iOS Style Announcement Banner */}
      <GlobalAnnouncement onlyShowWhenNormal={true} />

      {/* Support Modal overlay */}
      <AnimatePresence>
        {isSupportOpen && (
          <SupportModal onClose={() => setIsSupportOpen(false)} />
        )}
      </AnimatePresence>

      {/* TV Mode Toast Notification */}
      {toastMessage && (
        <div className="tv-toast">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default MainLayout;
