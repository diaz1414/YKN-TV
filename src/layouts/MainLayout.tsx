import React from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Search, Trophy, Tv, Home, Award, Calendar } from 'lucide-react';

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
    <div className="min-h-screen bg-[#020202] text-white flex flex-col font-sans">
      {/* Top Header Navbar - Glassmorphism */}
      <header className="h-16 md:h-20 glass border-b border-white/5 flex items-center justify-between px-4 md:px-8 sticky top-0 bg-[#020202]/80 backdrop-blur-xl z-50">
        <div className="flex items-center gap-6 md:gap-8">
          {/* Logo YKN TV */}
          <div 
            onClick={() => navigate('/')} 
            className="flex items-center gap-2.5 cursor-pointer select-none group"
          >
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-tr from-primary to-emerald-600 flex items-center justify-center text-dark shadow-lg shadow-primary/10 group-hover:scale-105 transition-transform duration-300">
              <Trophy size={16} className="md:w-5 md:h-5 text-black fill-black" />
            </div>
            <div>
              <span className="text-lg md:text-2xl font-black tracking-tighter uppercase font-display italic">
                YKN <span className="text-primary">TV</span>
              </span>
              <span className="hidden sm:inline-block ml-2 text-[9px] bg-netflix-red text-white font-black px-1.5 py-0.5 rounded tracking-widest uppercase">
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

          {/* Profile Badge */}
          <div className="flex items-center gap-2.5 pl-4 md:border-l border-white/10 group cursor-pointer select-none">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-white group-hover:text-primary transition-colors">Diaz Ngoding</p>
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Premium Fan</p>
            </div>
            <div className="w-8 h-8 md:w-9 md:h-9 bg-gradient-to-tr from-primary to-emerald-500 rounded-xl flex items-center justify-center font-black text-dark text-xs md:text-sm shadow-md group-hover:scale-105 transition-transform duration-300">
              DN
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 pb-20 md:pb-8 p-4 md:p-8">
        {children}
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
