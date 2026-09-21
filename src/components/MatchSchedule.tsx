import { startTransition, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RadioTower, Flame } from 'lucide-react';
import { motion } from 'framer-motion';
import MatchCard from './MatchCard';
import { getTodayMatches, MATCH_SCHEDULE_REFRESH_MS, type Match } from '../services/matchService';
import { getXoilacMatches, XOILAC_SPORTS, type XoilacSport } from '../services/xoilacService';
import { slugify } from '../services/streamService';

type SportTab = 'main' | XoilacSport;

interface TabDef {
  id: SportTab;
  label: string;
  icon: string;
  color: string;
}

const TABS: TabDef[] = [
  { id: 'main', label: 'Utama', icon: 'LIVE', color: '#d4af37' },
  ...Object.entries(XOILAC_SPORTS).map(([id, meta]) => ({
    id: id as XoilacSport,
    label: meta.label,
    icon: meta.icon,
    color: meta.color,
  })),
];

const matchBelongsToSport = (match: Match, sport: XoilacSport): boolean => {
  const sportLabel = XOILAC_SPORTS[sport]?.label.toLowerCase() ?? sport.toLowerCase();
  const providerPrefixes = [`esportex-${sport}-`, `xoilac-${sport}-`];

  return (
    providerPrefixes.some((prefix) => match.id.includes(prefix)) ||
    match.league.name.toLowerCase().includes(sportLabel)
  );
};

const MatchSchedule = ({ viewerCounts = {} }: { viewerCounts?: Record<string, number> }) => {
  const [activeTab, setActiveTab] = useState<SportTab>('main');
  const [mainMatches, setMainMatches] = useState<Match[]>([]);
  const [xoilacMatches, setXoilacMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const lastMainSig = useRef<string>('');
  const lastXoilacSig = useRef<string>('');

  const fetchMain = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getTodayMatches(true);
      const sig = JSON.stringify(data);
      if (sig !== lastMainSig.current) {
        lastMainSig.current = sig;
        startTransition(() => setMainMatches(data));
      }
    } catch (err) {
      console.warn('[MatchSchedule] Failed to refresh main matches:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchXoilac = async (silent = false) => {
    if (!silent && activeTab !== 'main') setLoading(true);
    try {
      const data = await getXoilacMatches(true);
      const sig = JSON.stringify(data);
      if (sig !== lastXoilacSig.current) {
        lastXoilacSig.current = sig;
        startTransition(() => setXoilacMatches(data));
      }
    } catch (err) {
      console.warn('[MatchSchedule] Failed to refresh Esportex matches:', err);
    } finally {
      if (!silent && activeTab !== 'main') setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setLoading(true);
      await Promise.all([fetchMain(true), fetchXoilac(true)]);
      if (mounted) setLoading(false);
    };

    init();

    const interval = setInterval(() => {
      fetchMain(true);
      fetchXoilac(true);
    }, MATCH_SCHEDULE_REFRESH_MS);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(t);
  }, [activeTab]);

  const displayedMatches: Match[] = (() => {
    if (activeTab === 'main') return mainMatches;

    const sport = activeTab as XoilacSport;
    return xoilacMatches.filter((match) => matchBelongsToSport(match, sport));
  })();

  const handleMatchClick = (match: Match) => {
    const slugName = `${match.homeTeam.name} vs ${match.awayTeam.name}`;
    navigate(`/watch/${slugify(slugName)}-${match.id}`);
  };

  const liveCounts = TABS.reduce<Record<SportTab, number>>((counts, tab) => {
    if (tab.id === 'main') {
      counts[tab.id] = mainMatches.filter((match) => match.status === 'live').length;
      return counts;
    }

    counts[tab.id] = xoilacMatches.filter((match) => (
      match.status === 'live' && matchBelongsToSport(match, tab.id as XoilacSport)
    )).length;

    return counts;
  }, {} as Record<SportTab, number>);

  const totalLiveAll = Object.values(liveCounts).reduce((a, b) => a + b, 0);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.04,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
  };

  return (
    <section className="space-y-6">
      {/* Section Header with Live Stadium Flair */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-white/[0.06] pb-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-gradient-to-b from-white/[0.08] to-white/[0.02] rounded-2xl flex items-center justify-center text-primary border border-white/[0.09] shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)]">
            <RadioTower size={22} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-2xl md:text-3xl font-display font-black uppercase tracking-tighter italic leading-none text-white">
                Jadwal Pertandingan
              </h3>
              {totalLiveAll > 0 && (
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[9px] font-black uppercase tracking-wider">
                  <Flame size={11} className="animate-bounce" />
                  {totalLiveAll} Live Aktif
                </span>
              )}
            </div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1.5">
              Multi-Sport Live Broadcast Schedule
            </p>
          </div>
        </div>

        {totalLiveAll > 0 && (
          <div className="sm:hidden flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[9px] font-black uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
            {totalLiveAll} Match Live
          </div>
        )}
      </div>

      {/* Multi-Sport Sliding Pill Tabs */}
      <div className="flex gap-2.5 overflow-x-auto pb-2 pt-1 scrollbar-hide select-none">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const liveCount = liveCounts[tab.id] ?? 0;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-colors duration-200 outline-none tv-focusable cursor-pointer ${
                isActive
                  ? 'text-black'
                  : 'text-zinc-400 hover:text-white bg-white/[0.03] border border-white/[0.07] hover:border-white/15'
              }`}
              tabIndex={0}
            >
              {isActive && (
                <motion.div
                  layoutId="activeSportPill"
                  className="absolute inset-0 rounded-2xl shadow-lg"
                  style={{
                    background: tab.color,
                    boxShadow: `0 0 20px ${tab.color}66`,
                  }}
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}
              <span className="relative z-10 text-[10px] font-black">{tab.icon}</span>
              <span className="relative z-10">{tab.label}</span>
              {liveCount > 0 && (
                <span
                  className="relative z-10 px-2 py-0.5 rounded-full text-[9px] font-black flex items-center gap-1 shadow-sm"
                  style={{
                    background: isActive ? 'rgba(0,0,0,0.35)' : 'rgba(239,68,68,0.2)',
                    color: isActive ? '#fff' : '#ef4444',
                    border: isActive ? '1px solid rgba(0,0,0,0.2)' : '1px solid rgba(239,68,68,0.4)',
                  }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current animate-ping" />
                  <span>{liveCount} LIVE</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 glass-specular rounded-[2rem]">
          <Loader2 className="text-primary animate-spin" size={36} />
          <p className="text-zinc-400 font-black uppercase tracking-[0.15em] text-[10px]">
            Sinkronisasi Jadwal Siaran...
          </p>
        </div>
      ) : displayedMatches.length > 0 ? (
        <motion.div
          key={activeTab}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {displayedMatches.map((match) => (
            <motion.div key={match.id} variants={itemVariants}>
              <MatchCard
                match={match}
                onClick={() => handleMatchClick(match)}
                viewerCount={viewerCounts[match.id]}
              />
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <div className="py-20 text-center glass-specular rounded-[2rem] border border-white/[0.06]">
          <p className="text-zinc-400 font-black uppercase tracking-wider text-xs">
            Tidak ada siaran aktif untuk kategori ini saat ini.
          </p>
          <button
            onClick={() => setActiveTab('main')}
            className="mt-3 text-primary text-[10px] font-black uppercase tracking-wider hover:underline"
          >
            Lihat Jadwal Utama
          </button>
        </div>
      )}
    </section>
  );
};

export default MatchSchedule;
