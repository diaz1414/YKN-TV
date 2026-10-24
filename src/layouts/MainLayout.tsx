import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Search, Tv, RadioTower, Calendar, Menu, X, Coffee, ShieldCheck, Play } from 'lucide-react';
import { getTodayMatches, MATCH_SCHEDULE_REFRESH_MS, type Match } from '../services/matchService';
import yknLogo from '../assets/ykn-tv-logo.png';
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
  disableLiveBadge?: boolean;
}

const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  searchPlaceholder = "Cari saluran...",
  onSearchChange,
  searchValue = "",
  disableLiveBadge = false
}) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const { isTvMode, toggleTvMode, toastMessage } = useTvNavigation();

  // Tombol toggle hanya relevan jika Mode TV sudah aktif
  // (auto-detect UA, D-pad, atau sebelumnya manual diaktifkan)
  const showTvToggle = isTvMode;

  const activeTabParam = searchParams.get('tab') || 'home';
  const activeTab = activeTabParam === 'standings' ? 'live' : activeTabParam;
  const isWatchPage = location.pathname.startsWith('/watch/');

  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  // State tambahan eksklusif hanya untuk kontrol buka/tutup burger menu
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminRole, setAdminRole] = useState<string | null>(null);

  useEffect(() => {
    if (disableLiveBadge) {
      setActiveMatch(null);
      return;
    }

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
  }, [disableLiveBadge]);

  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 18);
          ticking = false;
        });
        ticking = true;
      }
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
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

  return (
    <div className="min-h-screen bg-transparent text-white flex flex-col font-sans">
      {/* iOS-Style Morphing Dynamic Island Navbar */}
      <header
        onClick={(e) => e.stopPropagation()}
        className="sticky top-0 z-50 pointer-events-none w-full flex justify-center"
      >
        <div
          className={`pointer-events-auto mx-auto flex items-center justify-between select-none transform-gpu relative transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[max-width,border-radius,height,margin,padding] ${
            isScrolled
              ? 'mt-2.5 sm:mt-3 w-[calc(100%-1.25rem)] sm:w-[calc(100%-3rem)] max-w-[1240px] rounded-full min-h-[50px] sm:min-h-[56px] px-3 sm:px-5 py-1.5 sm:py-2 bg-[#070709]/92 backdrop-blur-2xl border border-white/[0.14] shadow-[0_18px_45px_rgba(0,0,0,0.88),inset_0_1px_0_0_rgba(255,255,255,0.18)]'
              : 'mt-0 w-full max-w-full rounded-none min-h-[64px] sm:min-h-[72px] px-4 sm:px-8 py-2 sm:py-3 bg-[#020202]/85 backdrop-blur-xl border-b border-white/[0.08] border-x-0 border-t-0 shadow-[0_4px_24px_rgba(0,0,0,0.45)]'
          } ${
            activeMatch?.status === 'live' && isScrolled
              ? 'border-red-500/35 shadow-[0_18px_45px_rgba(0,0,0,0.88),0_0_24px_rgba(239,68,68,0.15),inset_0_1px_0_0_rgba(255,255,255,0.2)]'
              : ''
          }`}
        >
          {/* Ambient Top Light Beam */}
          {isScrolled && (
            <div className="absolute top-0 inset-x-12 sm:inset-x-24 h-[1px] bg-gradient-to-r from-transparent via-primary/35 to-transparent pointer-events-none" />
          )}

          {/* Left: Brand Identity */}
          <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
            {/* Tombol Burger - Muncul hanya di layar mobile jika SHOW_BURGER_MENU aktif */}
            {SHOW_BURGER_MENU && (
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden p-2 bg-white/5 border border-white/5 rounded-xl text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                {isMenuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            )}

            {/* Logo YKN TV */}
            <motion.div
              onClick={() => navigate('/')}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="flex items-center gap-2 cursor-pointer select-none group tv-focusable rounded-full p-1"
              tabIndex={0}
            >
              <img
                src={yknLogo}
                alt="YKN TV Logo"
                className="h-6 w-[86px] sm:w-[100px] object-contain drop-shadow-[0_6px_16px_rgba(0,0,0,0.65)] transition-transform duration-300 md:h-8 md:w-[124px] lg:w-[136px] shrink-0"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="hidden sm:inline-block text-[8px] sm:text-[9px] bg-gradient-to-r from-primary to-amber-500 text-black font-black px-2 py-0.5 rounded-full tracking-widest uppercase shadow-[0_0_10px_rgba(212,175,55,0.25)]">
                  HUB
                </span>
                {isAdminLoggedIn && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/ykn-c0ntr0l-hq/dashboard');
                    }}
                    className={`text-[7.5px] sm:text-[9px] border font-black px-2 py-0.5 rounded-full tracking-wider uppercase inline-flex items-center gap-1 cursor-pointer hover:scale-105 active:scale-95 transition-all tv-focusable shrink-0 ${
                      adminRole === 'developer'
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[0_0_12px_rgba(168,85,247,0.15)] hover:bg-purple-500/20'
                        : 'bg-[#e50914]/10 text-[#e50914] border-[#e50914]/20 shadow-[0_0_12px_rgba(229,9,20,0.15)] hover:bg-[#e50914]/20'
                    }`}
                    tabIndex={0}
                  >
                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${adminRole === 'developer' ? 'bg-purple-400' : 'bg-red-400'}`} />
                      <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${adminRole === 'developer' ? 'bg-purple-400' : 'bg-[#e50914]'}`} />
                    </span>
                    <span className="hidden sm:inline">{adminRole === 'developer' ? 'Dev' : 'Admin'}</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>

          {/* Center: Desktop Navigation Pills */}
          <nav className="hidden md:flex items-center gap-1 relative text-sm p-1 rounded-full bg-black/40 border border-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            {[
              { id: 'home', label: 'Jadwal', icon: Calendar },
              { id: 'channels', label: 'Saluran TV', icon: Tv },
              { id: 'live', label: 'Live Center', icon: RadioTower },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id && !isWatchPage;
              return (
                <motion.button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  className={`relative cursor-pointer flex items-center gap-2 tv-focusable rounded-full px-4 py-2 text-xs font-black uppercase tracking-wider transition-colors duration-200 select-none ${
                    isActive
                      ? 'text-white'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
                  }`}
                  tabIndex={0}
                >
                  {/* Tactile ambient glass pill when active */}
                  {isActive && (
                    <motion.div
                      layoutId="desktopNavActiveBg"
                      className="absolute inset-0 rounded-full bg-white/[0.08] border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                      transition={{ type: "spring", stiffness: 450, damping: 32 }}
                    />
                  )}

                  {/* Smooth sliding bottom line - Glowing Stadium Specular Gold Line */}
                  {isActive && (
                    <motion.div
                      layoutId="desktopNavActiveLine"
                      className="absolute bottom-0 inset-x-3 h-[2px] rounded-full bg-gradient-to-r from-primary/30 via-primary to-primary/30 shadow-[0_0_12px_rgba(212,175,55,0.85)]"
                      transition={{ type: "spring", stiffness: 450, damping: 32 }}
                    />
                  )}

                  <span className="relative z-10 flex items-center gap-2">
                    <Icon
                      size={13}
                      className={`transition-colors duration-200 ${
                        isActive ? 'text-primary' : 'text-zinc-400'
                      }`}
                    />
                    <span>{item.label}</span>
                    {item.id === 'live' && (
                      <span className="relative flex h-2 w-2 ml-0.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      </span>
                    )}
                  </span>
                </motion.button>
              );
            })}

            {showTvToggle && (
              <button
                onClick={toggleTvMode}
                className={`cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all text-xs font-bold uppercase tracking-wider tv-focusable ml-1 ${
                  isTvMode
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

          {/* Right: Search Capsule & Dynamic Island Live Match Pill */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Desktop Expandable Search Capsule */}
            {onSearchChange && (
              <div className="hidden lg:flex items-center gap-2 bg-black/40 border border-white/[0.08] hover:border-white/15 focus-within:border-primary/50 focus-within:w-56 w-40 px-3 py-1.5 rounded-full transition-all duration-300 tv-focusable relative shadow-inner" tabIndex={0}>
                <Search size={14} className="text-zinc-400 shrink-0" />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchValue}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs w-full placeholder:text-zinc-500 font-medium text-white pr-4"
                />
                {searchValue && (
                  <button
                    type="button"
                    onClick={() => onSearchChange('')}
                    className="absolute right-2 text-zinc-400 hover:text-white cursor-pointer transition-colors p-0.5"
                    title="Hapus pencarian"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}

            {/* Dynamic Island Live Activity Pill */}
            {activeMatch && (
              <motion.div
                layout
                onClick={() => {
                  const slugName = `${activeMatch.homeTeam.name} vs ${activeMatch.awayTeam.name}`;
                  navigate(`/watch/${slugify(slugName)}-${activeMatch.id}`);
                }}
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 450, damping: 28 }}
                data-trigger-popunder="true"
                className="flex items-center gap-2 sm:gap-2.5 py-1 px-2.5 sm:px-3.5 bg-black/55 hover:bg-black/80 rounded-full border border-white/[0.1] hover:border-primary/45 shadow-inner cursor-pointer tv-focusable shrink-0 transition-all max-w-[190px] sm:max-w-none"
                tabIndex={0}
              >
                {/* Pulsing Beacon */}
                <div className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5 shrink-0">
                  {activeMatch.status === 'live' ? (
                    <>
                      <span className="animate-live-dot-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-80" />
                      <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                    </>
                  ) : activeMatch.status === 'finished' ? (
                    <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-zinc-600" />
                  ) : (
                    <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-amber-500" />
                  )}
                </div>

                {/* Score & Teams Display */}
                <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-black tracking-tight text-white min-w-0">
                  <span className="text-zinc-300 truncate max-w-[40px] sm:max-w-none">{getTeamAbbreviation(activeMatch.homeTeam.name)}</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-white/[0.08] text-primary font-display font-black text-[9px] sm:text-xs tabular-nums shadow-sm">
                    {activeMatch.status === 'live' || activeMatch.status === 'finished'
                      ? (activeMatch.score || 'vs')
                      : 'vs'}
                  </span>
                  <span className="text-zinc-300 truncate max-w-[40px] sm:max-w-none">{getTeamAbbreviation(activeMatch.awayTeam.name)}</span>
                  {activeMatch.status === 'live' && activeMatch.liveMinute && (
                    <span className="text-red-400 text-[8.5px] font-black hidden lg:inline ml-0.5">{activeMatch.liveMinute}</span>
                  )}
                </div>

                {activeMatch.status === 'live' && (
                  <span className="hidden sm:inline-block px-1.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-[8px] font-black text-red-400 uppercase tracking-widest shrink-0">
                    LIVE
                  </span>
                )}

                {/* Play Trigger */}
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-r from-primary to-yellow-500 text-black flex items-center justify-center shadow-sm shrink-0">
                  <Play size={8} fill="currentColor" className="ml-0.5 sm:w-2.5 sm:h-2.5" />
                </div>
              </motion.div>
            )}
          </div>
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
                href="/status"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#229ED9]/10 border border-[#229ED9]/20 text-[#229ED9] font-black text-[9px] uppercase tracking-wider hover:bg-[#229ED9]/20 transition-all cursor-pointer"
              >
                <ShieldCheck size={12} />
                Status
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

            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 sm:justify-end">
              <span onClick={() => handleTabChange('home')} className="hover:text-primary transition-colors cursor-pointer tv-focusable rounded px-1.5 py-0.5" tabIndex={0}>Jadwal</span>
              <span onClick={() => handleTabChange('channels')} className="hover:text-primary transition-colors cursor-pointer tv-focusable rounded px-1.5 py-0.5" tabIndex={0}>Saluran TV</span>
              <span onClick={() => handleTabChange('live')} className="hover:text-primary transition-colors cursor-pointer tv-focusable rounded px-1.5 py-0.5" tabIndex={0}>Live Center</span>
              <span onClick={() => navigate('/about')} className="hover:text-primary transition-colors cursor-pointer tv-focusable rounded px-1.5 py-0.5" tabIndex={0}>Tentang</span>
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

      {/* Mobile Floating Bottom Navigation Dock */}
      <div className="md:hidden fixed bottom-4 inset-x-0 z-50 pointer-events-none flex justify-center px-4 pb-[env(safe-area-inset-bottom,0px)]">
        <nav
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto h-16 w-full max-w-sm bg-[#08080a]/95 border border-white/[0.12] backdrop-blur-2xl rounded-2xl flex items-center justify-around px-2 select-none shadow-[0_16px_40px_rgba(0,0,0,0.9),inset_0_1px_0_0_rgba(255,255,255,0.15)]"
        >
          <button
            onClick={() => handleTabChange('home')}
            className={`relative flex flex-col items-center justify-center gap-1 py-1.5 px-3.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'home' && !isWatchPage
                ? 'text-primary font-black'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {activeTab === 'home' && !isWatchPage && (
              <motion.div
                layoutId="activeMobileDockPill"
                className="absolute inset-0 bg-primary/15 border border-primary/30 rounded-xl shadow-[0_0_12px_rgba(212,175,55,0.2)] z-0"
                transition={{ type: "spring", stiffness: 450, damping: 32 }}
              />
            )}
            <span className="relative z-10 flex flex-col items-center gap-1">
              <Calendar size={18} />
              <span className="text-[9px] font-black uppercase tracking-wider">Jadwal</span>
            </span>
          </button>

          <button
            onClick={() => handleTabChange('channels')}
            className={`relative flex flex-col items-center justify-center gap-1 py-1.5 px-3.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'channels' && !isWatchPage
                ? 'text-primary font-black'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {activeTab === 'channels' && !isWatchPage && (
              <motion.div
                layoutId="activeMobileDockPill"
                className="absolute inset-0 bg-primary/15 border border-primary/30 rounded-xl shadow-[0_0_12px_rgba(212,175,55,0.2)] z-0"
                transition={{ type: "spring", stiffness: 450, damping: 32 }}
              />
            )}
            <span className="relative z-10 flex flex-col items-center gap-1">
              <Tv size={18} />
              <span className="text-[9px] font-black uppercase tracking-wider">Saluran</span>
            </span>
          </button>

          <button
            onClick={() => handleTabChange('live')}
            className={`relative flex flex-col items-center justify-center gap-1 py-1.5 px-3.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'live' && !isWatchPage
                ? 'text-primary font-black'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {activeTab === 'live' && !isWatchPage && (
              <motion.div
                layoutId="activeMobileDockPill"
                className="absolute inset-0 bg-primary/15 border border-primary/30 rounded-xl shadow-[0_0_12px_rgba(212,175,55,0.2)] z-0"
                transition={{ type: "spring", stiffness: 450, damping: 32 }}
              />
            )}
            <span className="relative z-10 flex flex-col items-center gap-1">
              <RadioTower size={18} />
              <span className="text-[9px] font-black uppercase tracking-wider">Live</span>
            </span>
          </button>

          <button
            onClick={() => setIsSupportOpen(true)}
            className="relative flex flex-col items-center justify-center gap-1 py-1.5 px-3.5 rounded-xl transition-all cursor-pointer text-amber-400 hover:text-amber-300"
          >
            <span className="relative z-10 flex flex-col items-center gap-1">
              <Coffee size={18} className="fill-amber-400/20" />
              <span className="text-[9px] font-black uppercase tracking-wider">Traktir</span>
            </span>
          </button>
        </nav>
      </div>

      {/* Floating Action Button (FAB) for Support - Desktop only, hidden on Watch Page */}
      {!isWatchPage && (
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsSupportOpen(true)}
          className="hidden md:flex fixed md:bottom-6 md:right-6 z-40 items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-[0_8px_20px_rgba(245,158,11,0.3)] border border-amber-400/40 hover:shadow-[0_0_24px_rgba(245,158,11,0.5)] transition-all select-none cursor-pointer group tv-focusable"
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
