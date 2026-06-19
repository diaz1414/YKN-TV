import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Share2, MoreHorizontal } from 'lucide-react';
import { 
  FaWhatsapp, 
  FaTelegram, 
  FaFacebookF, 
  FaXTwitter, 
  FaInstagram 
} from 'react-icons/fa6';
import yknwcLogo from '../assets/yknwc-logo.png';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
  shareTitle: string;
  logo?: string;
  logo2?: string;
  isChannel?: boolean;
}

const ShareModal: React.FC<ShareModalProps> = ({ 
  isOpen, 
  onClose, 
  shareUrl, 
  shareTitle,
  logo,
  logo2,
  isChannel
}) => {
  const [copied, setCopied] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  // Deteksi ukuran layar untuk animasi responsif
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Tutup modal saat menekan tombol Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Efek auto-hide untuk toast notification
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const handleCopyLink = (isInstagram: boolean = false) => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      if (isInstagram) {
        setToastMessage('Tautan berhasil disalin! Silakan bagikan ke Story atau Bio Instagram Anda.');
      } else {
        setToastMessage('Tautan berhasil disalin ke papan klip!');
      }
      setShowToast(true);
    }).catch((err) => {
      console.error('Gagal menyalin tautan:', err);
    });
  };

  const handleNativeShare = () => {
    if (navigator.share) {
      navigator.share({
        title: shareTitle,
        text: `Nonton siaran langsung ${shareTitle} gratis di YKN TV!`,
        url: shareUrl
      }).catch((err) => {
        // Abaikan jika pengguna membatalkan share menu bawaan
        if (err.name !== 'AbortError') {
          console.warn('Native share failed:', err);
          handleCopyLink(false);
        }
      });
    } else {
      handleCopyLink(false);
    }
  };

  const shareOptions = [
    {
      name: 'WhatsApp',
      icon: FaWhatsapp,
      colorClass: 'text-emerald-400 group-hover:text-emerald-300',
      bgClass: 'bg-emerald-500/10 group-hover:bg-emerald-500/25 border-emerald-500/20 group-hover:border-emerald-500/40',
      glowClass: 'group-hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]',
      onClick: () => {
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareTitle + '\n' + shareUrl)}`, '_blank', 'noopener,noreferrer');
      }
    },
    {
      name: 'Telegram',
      icon: FaTelegram,
      colorClass: 'text-sky-400 group-hover:text-sky-300',
      bgClass: 'bg-sky-500/10 group-hover:bg-sky-500/25 border-sky-500/20 group-hover:border-sky-500/40',
      glowClass: 'group-hover:shadow-[0_0_20px_rgba(56,189,248,0.4)]',
      onClick: () => {
        window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`, '_blank', 'noopener,noreferrer');
      }
    },
    {
      name: 'Facebook',
      icon: FaFacebookF,
      colorClass: 'text-blue-500 group-hover:text-blue-400',
      bgClass: 'bg-blue-600/10 group-hover:bg-blue-600/25 border-blue-600/20 group-hover:border-blue-600/40',
      glowClass: 'group-hover:shadow-[0_0_20px_rgba(37,99,235,0.4)]',
      onClick: () => {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank', 'noopener,noreferrer');
      }
    },
    {
      name: 'Twitter / X',
      icon: FaXTwitter,
      colorClass: 'text-white group-hover:text-zinc-200',
      bgClass: 'bg-zinc-800/40 group-hover:bg-zinc-800/80 border-zinc-700/40 group-hover:border-zinc-500/60',
      glowClass: 'group-hover:shadow-[0_0_20px_rgba(255,255,255,0.15)]',
      onClick: () => {
        window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`, '_blank', 'noopener,noreferrer');
      }
    },
    {
      name: 'Instagram',
      icon: FaInstagram,
      colorClass: 'text-pink-400 group-hover:text-pink-300',
      bgClass: 'bg-pink-500/10 group-hover:bg-gradient-to-tr group-hover:from-indigo-500/20 group-hover:via-pink-500/20 group-hover:to-yellow-500/20 border-pink-500/20 group-hover:border-pink-500/40',
      glowClass: 'group-hover:shadow-[0_0_20px_rgba(236,72,153,0.4)]',
      onClick: () => {
        handleCopyLink(true);
      }
    },
    {
      name: 'Lainnya',
      icon: MoreHorizontal,
      colorClass: 'text-zinc-400 group-hover:text-white',
      bgClass: 'bg-zinc-800/30 group-hover:bg-zinc-800/70 border-zinc-800/50 group-hover:border-zinc-700',
      glowClass: 'group-hover:shadow-[0_0_20px_rgba(161,161,170,0.25)]',
      onClick: () => {
        handleNativeShare();
      }
    }
  ];

  // Konfigurasi animasi Framer Motion berbasis responsivitas perangkat
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 }
  };

  const modalVariants: any = isMobile
    ? {
        hidden: { y: '100%', opacity: 0.8 },
        visible: { 
          y: 0, 
          opacity: 1,
          transition: { type: 'spring', damping: 25, stiffness: 220 }
        },
        exit: { 
          y: '100%', 
          opacity: 0.8,
          transition: { ease: 'easeInOut', duration: 0.25 }
        }
      }
    : {
        hidden: { scale: 0.92, opacity: 0, y: 15 },
        visible: { 
          scale: 1, 
          opacity: 1, 
          y: 0,
          transition: { type: 'spring', damping: 22, stiffness: 280 }
        },
        exit: { 
          scale: 0.92, 
          opacity: 0, 
          y: 15,
          transition: { ease: 'easeIn', duration: 0.2 }
        }
      };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center md:items-center p-0 md:p-6 bg-black/80 backdrop-blur-md">
          {/* Backdrop Overlay */}
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={backdropVariants}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="absolute inset-0 cursor-pointer"
          />

          {/* Modal Container */}
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={modalVariants}
            className="w-full max-h-[85vh] md:max-h-none bg-zinc-950/98 rounded-t-[2.5rem] md:rounded-[2rem] border-t border-x border-white/10 md:border md:border-white/10 p-6 pb-8 md:p-8 md:max-w-md shadow-2xl relative select-none overflow-y-auto custom-scrollbar z-10"
          >
            {/* Drag Handle on Mobile */}
            {isMobile && (
              <div 
                onClick={onClose}
                className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-5 cursor-pointer active:scale-95 transition-transform" 
              />
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 p-2.5 rounded-xl bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer z-20"
              aria-label="Tutup"
            >
              <X size={15} />
            </button>

            {/* Header Content */}
            <div className="flex flex-col items-center text-center mt-2 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mb-3">
                <Share2 size={22} />
              </div>
              <h3 className="text-base font-black uppercase font-display tracking-wider text-white">Bagikan Siaran</h3>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-1.5">Ajak teman menonton bersama di YKN TV</p>
            </div>

            {/* Stream Info Preview Card */}
            <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-4 mb-6 flex items-center gap-3">
              {isChannel || !logo2 ? (
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center p-1.5 overflow-hidden shrink-0 select-none">
                  <img 
                    src={logo || yknwcLogo} 
                    alt={shareTitle} 
                    className="w-full h-full object-contain filter brightness-110" 
                    onError={(e) => {
                      e.currentTarget.src = yknwcLogo;
                    }}
                  />
                </div>
              ) : (
                <div className="flex items-center -space-x-3 shrink-0 select-none">
                  <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center p-1 border border-white/10 overflow-hidden shadow-md">
                    <img 
                      src={logo || 'https://flagcdn.com/w80/un.png'} 
                      alt="Team A" 
                      className="w-full h-full object-contain filter brightness-110" 
                      onError={(e) => {
                        e.currentTarget.src = yknwcLogo;
                      }}
                    />
                  </div>
                  <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center p-1 border border-white/10 overflow-hidden shadow-md z-10">
                    <img 
                      src={logo2 || 'https://flagcdn.com/w80/un.png'} 
                      alt="Team B" 
                      className="w-full h-full object-contain filter brightness-110" 
                      onError={(e) => {
                        e.currentTarget.src = yknwcLogo;
                      }}
                    />
                  </div>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-black text-white truncate uppercase tracking-wider leading-none">{shareTitle}</span>
                <span className="block text-[9px] text-primary font-bold uppercase tracking-widest mt-1.5 leading-none">
                  {isChannel ? 'Saluran TV' : 'Live Match'} Langsung HD
                </span>
              </div>
            </div>

            {/* Grid of Social Media Options */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {shareOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.name}
                    onClick={option.onClick}
                    className="group flex flex-col items-center gap-2 p-3 bg-zinc-900/20 hover:bg-zinc-900/50 border border-white/5 hover:border-white/10 rounded-2xl transition-all duration-300 cursor-pointer text-center select-none active:scale-95"
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-all ${option.bgClass} ${option.glowClass}`}>
                      <Icon size={20} className={`${option.colorClass} transition-colors`} />
                    </div>
                    <span className="text-[9px] font-black text-zinc-400 group-hover:text-white uppercase tracking-wider transition-colors">
                      {option.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Copy Link Section */}
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block px-1">Salin Tautan</label>
              <div className="flex items-center gap-2 bg-zinc-900/60 border border-white/5 rounded-2xl p-1.5 pl-4 focus-within:border-primary/40 focus-within:bg-zinc-900/90 transition-all">
                <span className="text-zinc-500 select-all text-[9.5px] font-mono truncate flex-1 leading-none py-1.5">
                  {shareUrl}
                </span>
                <button
                  onClick={() => handleCopyLink(false)}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-primary text-dark font-black text-[9px] uppercase tracking-widest rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shrink-0 shadow-lg shadow-primary/10 select-none"
                >
                  {copied ? (
                    <>
                      <Check size={11} className="stroke-[3px] text-dark" />
                      <span>Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy size={11} />
                      <span>Salin</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>

          {/* Floating Toast Notification */}
          <AnimatePresence>
            {showToast && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className="fixed top-6 left-1/2 -translate-x-1/2 z-[110] px-5 py-3.5 bg-zinc-950 border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl flex items-center gap-3 max-w-sm w-[90%] text-center justify-center pointer-events-none select-none"
              >
                <div className="w-5 h-5 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                  <Check size={12} className="stroke-[3px]" />
                </div>
                <span className="text-[10px] font-black text-white uppercase tracking-wider leading-relaxed">
                  {toastMessage}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ShareModal;
