import { useEffect, useRef, useState, startTransition } from 'react';
import { getTodayMatches, MATCH_SCHEDULE_REFRESH_MS, type Match } from '../services/matchService';
import MatchCard from './MatchCard';
import { useNavigate } from 'react-router-dom';
import { Trophy, Loader2 } from 'lucide-react';
import { slugify } from '../services/streamService';

const MatchSchedule = ({ viewerCounts = {} }: { viewerCounts?: Record<string, number> }) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const lastSignatureRef = useRef<string>('');

  useEffect(() => {
    let mounted = true;

    const getSignature = (data: Match[]) => {
      try {
        return JSON.stringify(data);
      } catch {
        return String(Date.now());
      }
    };

    const applyMatchesSmooth = (data: Match[]) => {
      const nextSignature = getSignature(data);

      // Kalau data sama, jangan setMatches lagi biar card nggak rerender/kedip
      if (nextSignature === lastSignatureRef.current) return;

      lastSignatureRef.current = nextSignature;

      startTransition(() => {
        if (mounted) setMatches(data);
      });
    };

    const fetchMatches = async (silent = false) => {
      if (!silent) setLoading(true);

      try {
        const data = await getTodayMatches(true);

        if (!mounted) return;

        applyMatchesSmooth(data);
      } catch (err) {
        console.warn('[MatchSchedule] Gagal refresh jadwal:', err);
      } finally {
        if (mounted && !silent) setLoading(false);
      }
    };

    // Load pertama: tampilkan loading seperti biasa
    fetchMatches(false);

    // Refresh otomatis background saja, tanpa loading/kedip
    const interval = setInterval(() => {
      fetchMatches(true);
    }, MATCH_SCHEDULE_REFRESH_MS);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleMatchClick = (match: Match) => {
    const slugName = `${match.homeTeam.name} vs ${match.awayTeam.name}`;
    navigate(`/watch/${slugify(slugName)}-${match.id}`);
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-primary border border-white/5 shadow-md">
            <Trophy size={20} className="fill-primary/10" />
          </div>
          <div>
            <h3 className="text-2xl md:text-3xl font-display font-black uppercase tracking-tighter italic leading-none">Jadwal Pertandingan</h3>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">FIFA World Cup 2026 Live Match Feed</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 bg-zinc-950/40 border border-white/5 rounded-[2rem] animate-pulse">
          <Loader2 className="text-primary animate-spin" size={36} />
          <p className="text-zinc-500 font-black uppercase tracking-[0.15em] text-[10px]">Memuat Jadwal Pertandingan...</p>
        </div>
      ) : matches.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {matches.map((match) => (
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
          <p className="text-zinc-500 font-black uppercase tracking-wider text-xs">Tidak ada siaran jadwal pertandingan saat ini.</p>
        </div>
      )}
    </section>
  );
};

export default MatchSchedule;
