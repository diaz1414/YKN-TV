import { useEffect, useRef, useState, startTransition } from 'react';
import { getTodayMatches, MATCH_SCHEDULE_REFRESH_MS, type Match } from '../services/matchService';
import { getXoilacMatches, XOILAC_SPORTS, type XoilacSport } from '../services/xoilacService';
import MatchCard from './MatchCard';
import { useNavigate } from 'react-router-dom';
import { Trophy, Loader2 } from 'lucide-react';
import { slugify } from '../services/streamService';

type SportTab = 'wc' | XoilacSport;

interface TabDef {
  id: SportTab;
  label: string;
  icon: string;
  color: string;
}

const TABS: TabDef[] = [
  { id: 'wc', label: 'Jadwal Utama', icon: '🏆', color: '#f59e0b' },
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
  const [activeTab, setActiveTab] = useState<SportTab>('wc');
  const [wcMatches, setWcMatches] = useState<Match[]>([]);
  const [xoilacMatches, setXoilacMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const lastWcSig = useRef<string>('');
  const lastXoilacSig = useRef<string>('');

  const fetchWc = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getTodayMatches(true);
      const sig = JSON.stringify(data);
      if (sig !== lastWcSig.current) {
        lastWcSig.current = sig;
        startTransition(() => setWcMatches(data));
      }
    } catch (err) {
      console.warn('[MatchSchedule] Failed to refresh WC matches:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchXoilac = async (silent = false) => {
    if (!silent && activeTab !== 'wc') setLoading(true);
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
      if (!silent && activeTab !== 'wc') setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setLoading(true);
      await Promise.all([fetchWc(true), fetchXoilac(true)]);
      if (mounted) setLoading(false);
    };

    init();

    const interval = setInterval(() => {
      fetchWc(true);
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
    if (activeTab === 'wc') return wcMatches;

    const sport = activeTab as XoilacSport;
    return xoilacMatches.filter(m => matchBelongsToSport(m, sport));
  })();

  const handleMatchClick = (match: Match) => {
    const slugName = `${match.homeTeam.name} vs ${match.awayTeam.name}`;
    navigate(`/watch/${slugify(slugName)}-${match.id}`);
  };

  const liveCounts = TABS.reduce<Record<SportTab, number>>((counts, tab) => {
    if (tab.id === 'wc') {
      counts[tab.id] = wcMatches.filter(m => m.status === 'live').length;
      return counts;
    }

    counts[tab.id] = xoilacMatches.filter(m => (
      m.status === 'live' && matchBelongsToSport(m, tab.id as XoilacSport)
    )).length;

    return counts;
  }, {} as Record<SportTab, number>);

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-primary border border-white/5 shadow-md">
            <Trophy size={20} className="fill-primary/10" />
          </div>
          <div>
            <h3 className="text-2xl md:text-3xl font-display font-black uppercase tracking-tighter italic leading-none">
              Jadwal Pertandingan
            </h3>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
              Multi-Sport Live Schedule
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          const liveCount = liveCounts[tab.id] ?? 0;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-200 border',
                isActive
                  ? 'text-black border-transparent shadow-lg scale-105'
                  : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10 hover:text-white',
              ].join(' ')}
              style={isActive ? { background: tab.color, boxShadow: `0 0 16px ${tab.color}55` } : {}}
            >
              <span className="text-sm">{tab.icon}</span>
              <span>{tab.label}</span>
              {liveCount > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-[9px] font-black"
                  style={{
                    background: isActive ? 'rgba(0,0,0,0.25)' : tab.color,
                    color: isActive ? '#fff' : '#000',
                  }}
                >
                  {liveCount} LIVE
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 bg-zinc-950/40 border border-white/5 rounded-[2rem] animate-pulse">
          <Loader2 className="text-primary animate-spin" size={36} />
          <p className="text-zinc-500 font-black uppercase tracking-[0.15em] text-[10px]">
            Memuat Jadwal...
          </p>
        </div>
      ) : displayedMatches.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedMatches.map(match => (
            <MatchCard
              key={match.id}
              match={match}
              onClick={() => handleMatchClick(match)}
              viewerCount={viewerCounts[match.id]}
            />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center bg-white/[0.01] border border-white/5 rounded-[2rem]">
          <p className="text-zinc-500 font-black uppercase tracking-wider text-xs">
            Tidak ada pertandingan untuk kategori ini.
          </p>
        </div>
      )}
    </section>
  );
};

export default MatchSchedule;
