import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Award, Check, Coffee, Heart, Sparkles } from 'lucide-react';

interface LeaderboardEntry {
  userName: string;
  amount: number;
  isVerified: boolean;
  isAnonymous: boolean;
}

const BagiBagiLeaderboard: React.FC = () => {
  const [donors, setDonors] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        if (isLocalhost) {
          // Simulasi delay pemuatan data lokal di localhost untuk menghindari CORS block
          await new Promise((resolve) => setTimeout(resolve, 800));
          setDonors([
            {
              userName: "Sultan YKN",
              amount: 250000,
              isVerified: true,
              isAnonymous: false
            },
            {
              userName: "Wasit Gacor",
              amount: 150000,
              isVerified: false,
              isAnonymous: false
            },
            {
              userName: "Seseorang",
              amount: 50000,
              isVerified: false,
              isAnonymous: true
            }
          ]);
          setLoading(false);
          return;
        }

        const response = await fetch(
          'https://bagibagi.co/api/partnerintegration/top-donator/streamkey?streamkey=k6OOWWlQNACUlvhsujt0xGGYOh44REgM'
        );
        if (!response.ok) {
          throw new Error('Gagal memuat papan peringkat');
        }
        const json = await response.json();
        if (json.success && Array.isArray(json.data)) {
          setDonors(json.data);
        } else {
          throw new Error(json.message || 'Data tidak sesuai format');
        }
      } catch (err: any) {
        console.error('Error fetching leaderboard:', err);
        setError('Gagal memuat donatur');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
    // Refresh otomatis setiap 60 detik
    const interval = setInterval(fetchLeaderboard, 60000);
    return () => clearInterval(interval);
  }, []);

  const getRankBadge = (index: number) => {
    if (index === 0) {
      return (
        <div className="relative w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.25)] shrink-0 select-none animate-pulse">
          <Trophy size={15} className="fill-amber-500/10" />
        </div>
      );
    }
    if (index === 1) {
      return (
        <div className="w-8 h-8 rounded-xl bg-zinc-400/10 border border-zinc-400/30 flex items-center justify-center text-zinc-300 shrink-0 select-none">
          <Award size={15} />
        </div>
      );
    }
    if (index === 2) {
      return (
        <div className="w-8 h-8 rounded-xl bg-amber-700/10 border border-amber-700/30 flex items-center justify-center text-amber-600/90 shrink-0 select-none">
          <Award size={15} />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-500 font-display font-black text-xs shrink-0 select-none">
        {index + 1}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
      className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-zinc-900/60 via-zinc-950/90 to-black p-[1px] shadow-2xl group select-none w-full"
    >
      {/* Glow Effects */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none group-hover:bg-primary/10 transition-all duration-700" />
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-amber-500/10 transition-all duration-700" />

      {/* Ambient Border Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5 opacity-100 group-hover:from-primary/15 group-hover:to-amber-500/15 transition-all duration-500 rounded-[2rem] pointer-events-none" />

      {/* Main Content */}
      <div className="relative z-10 bg-zinc-950/95 backdrop-blur-2xl rounded-[1.95rem] p-6">
        {/* Header */}
        <div className="flex items-center gap-3.5 mb-5 select-none">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 group-hover:scale-105 transition-transform duration-300">
            <Trophy size={20} className="relative z-10 fill-amber-500/10" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider font-display text-white flex items-center gap-1.5 italic">
              Penyokong Teratas
              <Sparkles size={12} className="text-amber-400 animate-pulse animate-duration-1000" />
            </h4>
            <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest leading-none mt-1">Leaderboard BagiBagi.co</p>
          </div>
        </div>

        {/* Leaderboard List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-zinc-900/10 border border-white/5 rounded-2xl animate-pulse">
                <div className="flex items-center gap-3 w-2/3">
                  <div className="w-8 h-8 rounded-xl bg-zinc-900 shrink-0" />
                  <div className="h-3 bg-zinc-900 rounded-full w-24" />
                </div>
                <div className="h-3 bg-zinc-900 rounded-full w-16" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-6 select-none">
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Gagal memuat papan peringkat</p>
            <p className="text-[9px] text-zinc-600 font-bold mt-1">Hubungan API terputus sementara waktu.</p>
          </div>
        ) : donors.length === 0 ? (
          <div className="text-center py-6 select-none">
            <Heart size={20} className="text-zinc-700 mx-auto mb-2 animate-pulse" />
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Belum ada donatur minggu ini</p>
            <p className="text-[9px] text-zinc-600 font-bold mt-1">Mari jadilah penyokong pertama YKN TV!</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {donors.slice(0, 5).map((donor, index) => {
              const isFirst = index === 0;
              return (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-zinc-900/20 hover:bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-2xl transition-all duration-300 group/item"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {getRankBadge(index)}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`text-xs font-black truncate max-w-[120px] uppercase tracking-wide ${isFirst ? 'text-amber-400' : 'text-zinc-200 group-hover/item:text-primary transition-colors'
                        }`}>
                        {donor.userName}
                      </span>
                      {donor.isVerified && (
                        <span className="w-3.5 h-3.5 rounded-full bg-blue-500 border border-zinc-950 flex items-center justify-center shrink-0 shadow" title="Terverifikasi">
                          <Check size={8} className="text-white stroke-[4px]" />
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs font-mono font-black shrink-0 ${isFirst ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.2)]' : 'text-zinc-400'
                    }`}>
                    Rp {donor.amount.toLocaleString('id-ID')}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* CTA Button */}
        <a
          href="https://bagibagi.co/Diaww"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 w-full flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-primary hover:from-amber-600 hover:to-primary hover:scale-[1.01] active:scale-[0.99] text-dark font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-amber-500/10 border border-amber-500/20 select-none"
        >
          <Coffee size={12} className="fill-current" />
          <span>Ikut Mendukung & Muncul Di Sini</span>
        </a>
      </div>
    </motion.div>
  );
};

export default BagiBagiLeaderboard;
