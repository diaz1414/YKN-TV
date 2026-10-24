import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Crown,
  ShieldCheck,
  Smartphone,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  MessageCircle,
  RefreshCw,
  KeyRound,
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { verifyVipToken, getVipInfo, type VipVerifyResult } from '../services/vipService';

export default function AktivasiVIP() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const tokenParam = searchParams.get('token') || '';
  const [tokenInput, setTokenInput] = useState(tokenParam);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VipVerifyResult | null>(null);
  const [existingVip, setExistingVip] = useState(getVipInfo());

  // Auto-verify if token is present in URL
  useEffect(() => {
    if (tokenParam.trim()) {
      handleVerify(tokenParam.trim());
    }
  }, [tokenParam]);

  const handleVerify = async (codeToVerify: string) => {
    if (!codeToVerify.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await verifyVipToken(codeToVerify);
      setResult(res);
      setExistingVip(getVipInfo());
    } catch {
      setResult({
        success: false,
        message: 'Terjadi kendala jaringan saat memverifikasi token. Silakan coba lagi.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    handleVerify(tokenInput.trim());
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString || isoString === 'permanent') return 'Selamanya (Permanen)';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }) + ' WIB';
    } catch {
      return isoString;
    }
  };

  return (
    <MainLayout>
      <div className="relative min-h-[85vh] flex items-center justify-center px-4 py-12 md:py-16 overflow-hidden">
        {/* Ambient Stadium Light Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-gradient-to-b from-[#D4AF37]/15 to-transparent rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-[#10B981]/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative w-full max-w-xl mx-auto">
          {/* Main Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="relative rounded-3xl bg-[#09090b]/90 border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl p-6 sm:p-8 overflow-hidden"
          >
            {/* Specular Top Bevel */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent" />

            {/* Header Badge */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className="relative mb-4">
                <div className="w-16 h-16 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center shadow-[0_0_30px_rgba(212,175,55,0.25)]">
                  <Crown className="w-8 h-8 text-[#D4AF37] animate-pulse" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-black rounded-full p-1 border border-white/10">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                </div>
              </div>

              <span className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37] bg-[#D4AF37]/10 px-3 py-1 rounded-full border border-[#D4AF37]/20 mb-2">
                YKN TV VIP License Hub
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-outfit">
                Aktivasi Akun <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] via-[#F59E0B] to-[#FFE58F]">VIP No-Ads</span>
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 mt-2 max-w-sm">
                Nikmati siaran live sports & TV tanpa gangguan iklan redirect dengan server prioritas.
              </p>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="py-12 flex flex-col items-center justify-center text-center gap-4">
                <div className="relative">
                  <RefreshCw className="w-10 h-10 text-[#D4AF37] animate-spin" />
                  <div className="absolute inset-0 rounded-full blur-md bg-[#D4AF37]/30 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Memverifikasi Token VIP...</h3>
                  <p className="text-xs text-zinc-400 mt-1">Menghubungkan ke sistem otorisasi perangkat YKN TV</p>
                </div>
              </div>
            )}

            {/* Result State: Success */}
            {!loading && result && result.success && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center text-center gap-5 my-2"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                  <CheckCircle2 className="w-9 h-9 text-emerald-400" />
                </div>

                <div>
                  <h3 className="text-xl font-black text-white font-outfit">
                    {result.message}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Browser ini telah terdaftar resmi. Iklan redirect dinonaktifkan total.
                  </p>
                </div>

                {/* Info Pod */}
                <div className="w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 text-left flex flex-col gap-2.5 text-xs">
                  {result.buyerName && (
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <span className="text-zinc-400 font-medium">Pemilik Lisensi:</span>
                      <span className="text-white font-bold">{result.buyerName}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-zinc-400 font-medium">Tipe Lisensi:</span>
                    <span className="text-[#D4AF37] font-bold">
                      {result.isPermanent ? 'VIP Permanen (Selamanya)' : 'VIP Trial'}
                    </span>
                  </div>
                  {result.maxDevices && (
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <span className="text-zinc-400 font-medium">Batas Perangkat:</span>
                      <span className="text-emerald-400 font-bold">
                        {result.usedDevices ?? 1} / {result.maxDevices} Perangkat
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400 font-medium">Masa Berlaku:</span>
                    <span className="text-zinc-200 font-mono font-medium">
                      {formatDate(result.expiredAt)}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="w-full flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={() => navigate('/')}
                    className="flex-1 py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F59E0B] text-black font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_4px_20px_rgba(212,175,55,0.3)] cursor-pointer"
                  >
                    <span>Mulai Nonton Sekarang</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Result State: Failed / Quota Full */}
            {!loading && result && !result.success && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center text-center gap-4 my-2"
              >
                <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center shadow-[0_0_25px_rgba(239,68,68,0.25)]">
                  <AlertTriangle className="w-7 h-7 text-red-400" />
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white font-outfit">
                    Aktivasi Belum Berhasil
                  </h3>
                  <p className="text-xs text-red-300/90 mt-1 max-w-md">
                    {result.message}
                  </p>
                </div>

                <div className="w-full flex flex-col sm:flex-row gap-2.5 pt-3">
                  <button
                    onClick={() => {
                      setResult(null);
                      setTokenInput('');
                    }}
                    className="flex-1 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs uppercase tracking-wider transition-all"
                  >
                    Coba Token Lain
                  </button>
                  <a
                    href="https://wa.me/?text=Halo%20Admin%20YKN%20TV,%20saya%20butuh%20bantuan%20reset%20perangkat%20token%20VIP%20saya"
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Hubungi Admin WA</span>
                  </a>
                </div>
              </motion.div>
            )}

            {/* Manual Form State (When not loading and no result shown yet) */}
            {!loading && !result && (
              <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
                    <span>Masukkan Token VIP Anda</span>
                    <span className="text-[10px] text-zinc-500 font-normal">Contoh: YKN-VIP-8F92-KL41</span>
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="text"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                      placeholder="YKN-VIP-XXXX-YYYY"
                      className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-black/60 border border-white/10 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] text-white font-mono font-bold tracking-wider text-sm placeholder:text-zinc-600 outline-none transition-all"
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!tokenInput.trim()}
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F59E0B] text-black font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(212,175,55,0.25)] cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Aktifkan VIP Sekarang</span>
                </button>
              </form>
            )}

            {/* Currently Active Badge (if device already has VIP) */}
            {existingVip.isActive && (
              <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-between bg-[#D4AF37]/5 -mx-6 -mb-6 sm:-mx-8 sm:-mb-8 px-6 sm:px-8 py-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="text-[11px] font-bold text-zinc-300">
                    Status Browser: <span className="text-[#D4AF37]">VIP Aktif</span>
                  </span>
                </div>
                <button
                  onClick={() => navigate('/')}
                  className="text-[11px] font-bold text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <span>Ke Beranda</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </motion.div>

          {/* Quick FAQ / Information Pod */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-zinc-400">
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex gap-3 items-start">
              <Smartphone className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-white text-xs mb-1">Pindah HP / Hapus Cache?</h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Cukup buka kembali link dari chat WhatsApp Admin. Sistem otomatis mengenali perangkat Anda tanpa biaya tambahan.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex gap-3 items-start">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-white text-xs mb-1">Belum Punya Token VIP?</h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Beli via chat WhatsApp Admin. Tersedia Paket Standar (15rb) dan Paket Nobar (35rb).
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
