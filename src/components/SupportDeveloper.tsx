import React from 'react';
import { motion } from 'framer-motion';
import { Coffee, Gift, Heart, Sparkles, X, ChevronRight, Check } from 'lucide-react';

interface SupportDeveloperProps {
  variant?: 'card' | 'compact' | 'modal';
  onClose?: () => void;
}

export const SupportCard: React.FC<SupportDeveloperProps> = ({ variant = 'card' }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-zinc-900/80 via-zinc-950/90 to-black p-[1px] shadow-2xl select-none group ${
        variant === 'compact' ? 'max-w-md' : 'w-full'
      }`}
    >
      {/* Decorative Premium Glow Effects */}
      <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-amber-500/15 transition-all duration-700" />
      <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-cyan-500/10 transition-all duration-700" />
      
      {/* Dynamic Ambient Border on Hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 opacity-100 group-hover:from-amber-500/20 group-hover:to-cyan-500/20 transition-all duration-500 rounded-[2rem] pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 bg-zinc-950/95 backdrop-blur-2xl rounded-[1.95rem] p-6 sm:p-7 md:p-8">
        
        {/* Header Header */}
        <div className="flex items-center gap-3.5 mb-3.5">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 group-hover:scale-105 transition-transform duration-300">
            <Coffee size={22} className="relative z-10 fill-amber-500/10" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div>
            <h4 className="text-sm sm:text-base font-black uppercase tracking-wider font-display text-white flex items-center gap-1.5 italic">
              Traktir Kopi Hangat
              <Sparkles size={13} className="text-amber-400 animate-pulse" />
            </h4>
            <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">Dukung Developer YKN TV</p>
          </div>
        </div>

        {/* Informative Description */}
        <p className="text-zinc-400 text-[11px] sm:text-xs font-medium leading-relaxed mb-6 uppercase tracking-wide">
          YKN TV dibuat dengan sepenuh hati secara gratis. Dukung kami dengan secangkir kopi agar server streaming tetap kencang, stabil, dan bebas hambatan!
        </p>

        {/* Buttons Grid */}
        <div className="flex flex-col gap-3.5">
          
          {/* Saweria (Local ID) */}
          <motion.a
            href="https://saweria.co/diaw14"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center justify-between p-4 bg-zinc-900/30 hover:bg-orange-500/[0.03] border border-white/5 hover:border-orange-500/30 rounded-2xl transition-all duration-300 group/btn cursor-pointer shadow-md"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 bg-orange-500/10 group-hover/btn:bg-orange-500/20 rounded-xl flex items-center justify-center border border-orange-500/20 transition-all shrink-0">
                <Heart size={20} className="text-orange-500 fill-orange-500/10" />
              </div>
              <div className="text-left truncate">
                <span className="block text-xs font-black text-white group-hover/btn:text-orange-500 transition-colors uppercase tracking-wider">
                  Saweria (Local ID)
                </span>
                <span className="block text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                  QRIS, Gopay, OVO, Dana, & LinkAja
                </span>
              </div>
            </div>
            <ChevronRight size={14} className="text-zinc-600 group-hover/btn:text-orange-500 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
          </motion.a>

          {/* Local ID Payment Card */}
          <motion.a
            href="https://bagibagi.co/Diaww"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center justify-between p-4 bg-zinc-900/30 hover:bg-amber-500/[0.03] border border-white/5 hover:border-amber-500/30 rounded-2xl transition-all duration-300 group/btn cursor-pointer shadow-md"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 bg-amber-500/10 group-hover/btn:bg-amber-500/20 rounded-xl flex items-center justify-center border border-amber-500/20 transition-all shrink-0">
                <Gift size={20} className="text-amber-500" />
              </div>
              <div className="text-left truncate">
                <span className="block text-xs font-black text-white group-hover/btn:text-amber-500 transition-colors uppercase tracking-wider">
                  BagiBagi (Local ID)
                </span>
                <span className="block text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                  QRIS, E-Wallet, & Bank
                </span>
              </div>
            </div>
            <ChevronRight size={14} className="text-zinc-600 group-hover/btn:text-amber-500 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
          </motion.a>

          {/* Global Payment Card */}
          <motion.a
            href="https://ko-fi.com/diaww14"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center justify-between p-4 bg-zinc-900/30 hover:bg-cyan-500/[0.03] border border-white/5 hover:border-cyan-500/30 rounded-2xl transition-all duration-300 group/btn cursor-pointer shadow-md"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 bg-cyan-500/10 group-hover/btn:bg-cyan-500/20 rounded-xl flex items-center justify-center border border-cyan-500/20 transition-all shrink-0">
                <Coffee size={20} className="text-cyan-400" />
              </div>
              <div className="text-left truncate">
                <span className="block text-xs font-black text-white group-hover/btn:text-cyan-400 transition-colors uppercase tracking-wider">
                  Ko-fi (Global Support)
                </span>
                <span className="block text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                  Paypal & Credit Card
                </span>
              </div>
            </div>
            <ChevronRight size={14} className="text-zinc-600 group-hover/btn:text-cyan-400 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
          </motion.a>

        </div>
      </div>
    </motion.div>
  );
};

export const SupportModal: React.FC<SupportDeveloperProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md">
      {/* Backdrop motion wrapper */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0"
      />

      {/* Modal Card content wrapper */}
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="relative w-full max-w-lg overflow-hidden rounded-[2.5rem] p-[1px] bg-gradient-to-br from-white/10 via-transparent to-white/5 shadow-2xl z-10"
      >
        {/* Glow behind modal */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative bg-zinc-950/98 rounded-[2.45rem] p-6 sm:p-8">
          
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-xl bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer z-20"
          >
            <X size={16} />
          </button>

          {/* Header */}
          <div className="flex flex-col items-center text-center mt-4 mb-8">
            <div className="relative w-16 h-16 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-3xl flex items-center justify-center shadow-lg mb-4">
              <Coffee size={32} className="fill-amber-500/5 animate-pulse" />
              <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-zinc-950 flex items-center justify-center">
                <Check size={8} className="text-black stroke-[4px]" />
              </div>
            </div>
            
            <h3 className="text-xl sm:text-2xl font-black uppercase font-display tracking-tight text-white italic">
              Traktir Kopi Hangat ☕
            </h3>
            <p className="text-xs text-amber-500 font-bold uppercase tracking-widest mt-1.5">Dukungan Anda Menjaga Server Tetap Aktif</p>
            
            <p className="text-zinc-400 text-xs font-semibold leading-relaxed mt-4 max-w-sm uppercase tracking-wider">
              YKN TV berkomitmen memberikan siaran sepak bola berkualitas tinggi secara gratis tanpa iklan mengganggu. Mari bantu kami menutupi biaya operasional server.
            </p>
          </div>

          {/* Grid buttons inside modal */}
          <div className="space-y-4">
            
            {/* Saweria */}
            <a
              href="https://saweria.co/diaw14"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4.5 bg-zinc-900/20 hover:bg-orange-500/[0.04] border border-white/5 hover:border-orange-500/40 rounded-2xl transition-all duration-300 group cursor-pointer"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 bg-orange-500/10 group-hover:bg-orange-500/20 rounded-xl flex items-center justify-center border border-orange-500/20 shrink-0">
                  <Heart size={22} className="text-orange-500 fill-orange-500/10" />
                </div>
                <div className="text-left truncate">
                  <span className="block text-sm font-black text-white group-hover:text-orange-500 transition-colors uppercase tracking-wider">
                    Saweria (Local QRIS & E-Wallet)
                  </span>
                  <span className="block text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                    Gopay, OVO, Dana, LinkAja, & QRIS
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="text-zinc-600 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all shrink-0" />
            </a>

            {/* Local ID */}
            <a
              href="https://bagibagi.co/Diaww"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4.5 bg-zinc-900/20 hover:bg-amber-500/[0.04] border border-white/5 hover:border-amber-500/40 rounded-2xl transition-all duration-300 group cursor-pointer"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 bg-amber-500/10 group-hover:bg-amber-500/20 rounded-xl flex items-center justify-center border border-amber-500/20 shrink-0">
                  <Gift size={22} className="text-amber-500" />
                </div>
                <div className="text-left truncate">
                  <span className="block text-sm font-black text-white group-hover:text-amber-500 transition-colors uppercase tracking-wider">
                    BagiBagi (Local QRIS & E-Wallet)
                  </span>
                  <span className="block text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                    Gopay, OVO, Dana, LinkAja, & Transfer Bank
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="text-zinc-600 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all shrink-0" />
            </a>

            {/* Global Support */}
            <a
              href="https://ko-fi.com/diaww14"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4.5 bg-zinc-900/20 hover:bg-cyan-500/[0.04] border border-white/5 hover:border-cyan-500/40 rounded-2xl transition-all duration-300 group cursor-pointer"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 bg-cyan-500/10 group-hover:bg-cyan-500/20 rounded-xl flex items-center justify-center border border-cyan-500/20 shrink-0">
                  <Coffee size={22} className="text-cyan-400" />
                </div>
                <div className="text-left truncate">
                  <span className="block text-sm font-black text-white group-hover:text-cyan-400 transition-colors uppercase tracking-wider">
                    Ko-fi (Global Support)
                  </span>
                  <span className="block text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                    Paypal, Credit Card, & Stripe
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="text-zinc-600 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all shrink-0" />
            </a>

          </div>

          <div className="mt-8 text-center flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-widest text-zinc-600 select-none">
            <span>DIBUAT DENGAN</span>
            <Heart size={8} className="text-[#e50914] fill-[#e50914]" />
            <span>UNTUK PECINTA SEPAK BOLA</span>
          </div>

        </div>
      </motion.div>
    </div>
  );
};
