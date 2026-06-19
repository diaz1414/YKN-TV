import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Coffee, Sparkles, AlertCircle, Award, Heart, MessageSquare, CheckCircle } from 'lucide-react';

interface Donor {
  userName?: string;
  name?: string;
  amount: number;
  isVerified: boolean;
  support_message?: string;
  supportMessage?: string;
  created_at?: string;
  createdAt?: string;
}

const STREAMKEY = 'k6OOWWlQNACUlvhsujt0xGGYOh44REgM';
const API_URL = `https://bagibagi.co/api/partnerintegration/top-donator/streamkey?streamkey=${STREAMKEY}`;
const BOT_API_URL = import.meta.env.VITE_BOT_API_URL || 'http://147.135.252.68:20114';

const BagiBagiLeaderboard: React.FC = () => {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    const loadData = async () => {
      // Strategy 1: Fetch through the dedicated Bot Scraper Endpoint
      try {
        const response = await fetch(`${BOT_API_URL}/api/sports/leaderboard`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.data)) {
            if (isMounted) {
              setDonors(data.data);
              setLoading(false);
            }
            return;
          }
        }
      } catch (err) {
        console.warn('[Leaderboard] Bot scraper endpoint failed, trying client-side bypass...', err);
      }

      // Strategy 2: allorigins.win (Client fallback)
      try {
        const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(API_URL)}&nocache=${Date.now()}`);
        if (response.ok) {
          const wrapper = await response.json();
          if (wrapper.contents) {
            const data = JSON.parse(wrapper.contents);
            if (data.success && Array.isArray(data.data)) {
              if (isMounted) {
                setDonors(data.data);
                setLoading(false);
              }
              return;
            }
          }
        }
      } catch (err) {
        console.warn('[Leaderboard] Proxy 1 (AllOrigins) client fallback failed:', err);
      }

      // Strategy 3: codetabs (Client fallback)
      try {
        const response = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(API_URL)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.data)) {
            if (isMounted) {
              setDonors(data.data);
              setLoading(false);
            }
            return;
          }
        }
      } catch (err) {
        console.warn('[Leaderboard] Proxy 2 (CodeTabs) client fallback failed:', err);
      }

      if (isMounted) {
        setError('Gagal memuat leaderboard donatur');
        setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [retryCount]);

  // Format number with Indonesian dot separators
  const formatNumber = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Format Date to friendly Indonesian string
  const formatFriendlyDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr.replace(' ', 'T'));
      if (isNaN(date.getTime())) return dateStr;

      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 60) return `${diffMins || 1} mnt lalu`;
      if (diffHours < 24) return `${diffHours} jam lalu`;
      if (diffDays === 1) return 'Kemarin';
      if (diffDays < 7) return `${diffDays} hari lalu`;

      return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    } catch {
      return dateStr;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
      className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-zinc-900/60 via-zinc-950/90 to-black p-[1px] shadow-2xl group select-none w-full"
    >
      {/* Glow Effects */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-amber-500/10 transition-all duration-700" />
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none group-hover:bg-primary/10 transition-all duration-700" />

      {/* Ambient Border Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5 opacity-100 group-hover:from-amber-500/15 group-hover:to-primary/15 transition-all duration-500 rounded-[2rem] pointer-events-none" />

      {/* Main Content */}
      <div className="relative z-10 bg-zinc-950/95 backdrop-blur-2xl rounded-[1.95rem] p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 group-hover:scale-105 transition-transform duration-300">
              <Trophy size={18} className="relative z-10 fill-amber-500/10" />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider font-display text-white flex items-center gap-1.5 italic leading-none">
                Top Donatur
                <Sparkles size={11} className="text-amber-400 animate-pulse" />
              </h4>
              <p className="text-[8px] font-bold text-amber-500 uppercase tracking-widest leading-none mt-1">Leaderboard BagiBagi.co</p>
            </div>
          </div>
        </div>

        {/* Dynamic Content Panel */}
        <div className="relative w-full h-[280px] rounded-2xl overflow-hidden bg-zinc-900/20 border border-white/5 shadow-inner">
          <AnimatePresence mode="wait">
            {loading ? (
              // Loading Skeleton State
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col justify-between p-4"
              >
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse bg-white/2.5 p-3 rounded-xl border border-white/2.5">
                    <div className="w-6 h-6 bg-white/10 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2.5 bg-white/10 rounded w-24" />
                      <div className="h-2 bg-white/5 rounded w-16" />
                    </div>
                    <div className="h-3 bg-white/10 rounded w-16" />
                  </div>
                ))}
              </motion.div>
            ) : error ? (
              // Error State
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center"
              >
                <AlertCircle size={28} className="text-red-500 mb-2 animate-bounce" />
                <p className="text-zinc-400 font-bold text-[10px] mb-3">{error}</p>
                <button
                  onClick={() => setRetryCount(prev => prev + 1)}
                  className="px-4 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-white font-black text-[9px] uppercase tracking-wider hover:bg-zinc-800 active:scale-95 transition-all cursor-pointer"
                >
                  Coba Lagi
                </button>
              </motion.div>
            ) : donors.length === 0 ? (
              // Empty State
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center"
              >
                <Heart size={32} className="text-amber-500/40 mb-2 animate-pulse" />
                <p className="text-zinc-400 font-extrabold text-[10px] uppercase tracking-wide">Belum ada donasi terdaftar</p>
                <p className="text-zinc-500 font-medium text-[8px] mt-1 max-w-[200px]">Dukung streamer favoritmu dan jadilah penyokong pertama di sini!</p>
              </motion.div>
            ) : (
              // Leaderboard Rankings List
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 overflow-y-auto p-3 space-y-2.5 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent scroll-smooth"
              >
                {donors.map((donor, index) => {
                  const rank = index + 1;
                  const isTop3 = rank <= 3;

                  // Styled variants based on rank
                  const rankConfig = {
                    1: {
                      icon: <Trophy size={13} className="text-yellow-400 fill-yellow-400/20" />,
                      bg: 'bg-gradient-to-r from-yellow-500/10 to-amber-500/5 border-yellow-500/20',
                      text: 'text-yellow-400 font-black',
                      badgeBg: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20'
                    },
                    2: {
                      icon: <Award size={13} className="text-zinc-300 fill-zinc-300/10" />,
                      bg: 'bg-gradient-to-r from-zinc-400/5 to-zinc-500/2 border-zinc-400/10',
                      text: 'text-zinc-300 font-extrabold',
                      badgeBg: 'bg-zinc-400/10 text-zinc-300 border-zinc-400/10'
                    },
                    3: {
                      icon: <Award size={13} className="text-amber-600 fill-amber-600/10" />,
                      bg: 'bg-gradient-to-r from-amber-600/5 to-amber-700/2 border-amber-600/10',
                      text: 'text-amber-500 font-bold',
                      badgeBg: 'bg-amber-600/10 text-amber-500 border-amber-600/10'
                    }
                  }[rank] || {
                    icon: null,
                    bg: 'bg-zinc-900/40 border-white/2.5 hover:border-white/5 hover:bg-zinc-900/60',
                    text: 'text-zinc-400 font-medium',
                    badgeBg: 'bg-zinc-800/80 text-zinc-400 border-white/5'
                  };

                  const donorName = donor.userName || donor.name || 'Anonymous';
                  const donorMessage = donor.support_message || donor.supportMessage;
                  const donorDate = donor.created_at || donor.createdAt;

                  return (
                    <motion.div
                      key={`${donorName}-${donorDate || index}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`relative flex flex-col p-3 rounded-xl border transition-all duration-300 ${rankConfig.bg}`}
                    >
                      {/* Donor Profile Line */}
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Rank Badge */}
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black border shrink-0 ${rankConfig.badgeBg}`}>
                            {rankConfig.icon ? rankConfig.icon : `#${rank}`}
                          </div>

                          {/* Name & Verification */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`text-[10px] tracking-wide truncate ${isTop3 ? rankConfig.text : 'text-white'}`}>
                              {donorName}
                            </span>
                            {donor.isVerified && (
                              <CheckCircle size={10} className="text-sky-400 fill-sky-400/10 shrink-0" />
                            )}
                          </div>
                        </div>

                        {/* Amount */}
                        <div className="flex items-center gap-1 shrink-0">
                          <img
                            src="/bagibagi-coin.png"
                            alt="Coin"
                            className="w-3.5 h-3.5 object-contain select-none"
                          />
                          <span className={`text-[10px] font-black ${isTop3 ? rankConfig.text : 'text-amber-500'}`}>
                            {formatNumber(donor.amount)}
                          </span>
                        </div>
                      </div>

                      {/* Message and Time */}
                      {(donorMessage || donorDate) && (
                        <div className="mt-2 pt-1.5 border-t border-white/2.5 flex items-start justify-between gap-4 text-[7px] text-zinc-500 font-semibold select-text">
                          {donorMessage ? (
                            <div className="flex items-start gap-1 min-w-0">
                              <MessageSquare size={8} className="mt-0.5 shrink-0 text-zinc-600" />
                              <p className="italic leading-normal text-zinc-400 max-w-[170px] truncate-2-lines">{donorMessage}</p>
                            </div>
                          ) : (
                            <div />
                          )}
                          {donorDate && (
                            <span className="shrink-0 text-zinc-600 font-medium">
                              {formatFriendlyDate(donorDate)}
                            </span>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* CTA Button */}
        <a
          href="https://bagibagi.co/Diaww"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-primary hover:from-amber-600 hover:to-primary hover:scale-[1.01] active:scale-[0.99] text-dark font-black text-[9px] uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-amber-500/10 border border-amber-500/20 select-none"
        >
          <Coffee size={12} className="fill-current" />
          <span>Ikut Mendukung & Muncul Di Sini</span>
        </a>
      </div>
    </motion.div>
  );
};

export default BagiBagiLeaderboard;

