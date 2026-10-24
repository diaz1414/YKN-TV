import React, { useState, useEffect } from 'react';
import {
  Crown,
  Plus,
  RefreshCw,
  Copy,
  Check,
  Smartphone,
  Trash2,
  RotateCcw,
  Sparkles,
  Settings,
  Search,
  ExternalLink,
  AlertCircle,
  X,
} from 'lucide-react';
import {
  listVipTokens,
  createVipToken,
  resetVipDevices,
  deleteVipToken,
  getGasApiUrl,
  setGasApiUrl,
  getAdminSecret,
  setAdminSecret,
  type VipTokenRow,
} from '../services/vipService';

export default function VipTokenManager() {
  const [tokens, setTokens] = useState<VipTokenRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [buyerName, setBuyerName] = useState('');
  const [packageType, setPackageType] = useState<'standar' | 'nobar' | 'single' | 'custom'>('standar');
  const [customDevices, setCustomDevices] = useState(10);
  const [durationType, setDurationType] = useState<'permanent' | 'trial'>('permanent');
  const [trialDays, setTrialDays] = useState(3);
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Success Modal
  const [createdTokenModal, setCreatedTokenModal] = useState<{
    token: string;
    buyerName: string;
    maxDevices: number;
    durationDays: number;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedChat, setCopiedChat] = useState(false);

  // Settings Modal (GAS URL & Secret)
  const [showSettings, setShowSettings] = useState(false);
  const [gasUrlInput, setGasUrlInput] = useState(getGasApiUrl());
  const [secretInput, setSecretInput] = useState(getAdminSecret());
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    setLoading(true);
    try {
      const data = await listVipTokens();
      setTokens(data || []);
    } catch {
      setTokens([]);
    } finally {
      setLoading(false);
    }
  };

  const getTargetDevices = (): number => {
    switch (packageType) {
      case 'standar':
        return 2;
      case 'nobar':
        return 5;
      case 'single':
        return 1;
      case 'custom':
        return Math.max(1, customDevices || 1);
    }
  };

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerName.trim()) {
      setCreateMessage({ type: 'error', text: 'Nama pembeli / catatan wajib diisi!' });
      return;
    }

    setCreating(true);
    setCreateMessage(null);

    const maxDev = getTargetDevices();
    const durDays = durationType === 'permanent' ? 0 : Math.max(1, trialDays || 1);

    try {
      const res = await createVipToken({
        buyerName: buyerName.trim(),
        durationDays: durDays,
        maxDevices: maxDev,
      });

      if (res.success && res.token) {
        setCreatedTokenModal({
          token: res.token,
          buyerName: buyerName.trim(),
          maxDevices: maxDev,
          durationDays: durDays,
        });

        // Reset form
        setBuyerName('');
        await loadTokens();
      } else {
        setCreateMessage({ type: 'error', text: res.message || 'Gagal membuat token.' });
      }
    } catch (err: any) {
      setCreateMessage({ type: 'error', text: err?.message || 'Terjadi kesalahan sistem.' });
    } finally {
      setCreating(false);
    }
  };

  const handleResetDevice = async (token: string, name: string) => {
    if (!confirm(`Reset kuota perangkat untuk ${name} (${token})? Sesi perangkat lama akan dikosongkan.`)) {
      return;
    }
    await resetVipDevices(token);
    await loadTokens();
  };

  const handleDeleteToken = async (token: string, name: string) => {
    if (!confirm(`Hapus permanen token ${token} milik ${name}? Pengguna ini tidak akan bisa lagi menikmati fitur VIP.`)) {
      return;
    }
    await deleteVipToken(token);
    await loadTokens();
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setGasApiUrl(gasUrlInput.trim());
    setAdminSecret(secretInput.trim());
    setSettingsSaved(true);
    setTimeout(() => {
      setSettingsSaved(false);
      setShowSettings(false);
      loadTokens();
    }, 1200);
  };

  const getActivationUrl = (tok: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://tv.ykn.my.id';
    return `${origin}/aktivasi?token=${tok}`;
  };

  const getWaChatText = (item: { token: string; buyerName: string; maxDevices: number; durationDays: number }) => {
    const link = getActivationUrl(item.token);
    const durText = item.durationDays === 0 ? 'Permanen Selamanya (Sekali Bayar)' : `Trial ${item.durationDays} Hari`;

    return `Halo kak ${item.buyerName}, terima kasih sudah order VIP No-Ads YKN TV! 👑

Silakan klik link aktivasi berikut di browser HP / Laptop / Smart TV kakak:
👉 ${link}

📋 Rincian Lisensi:
• Masa Aktif: ${durText}
• Kuota Perangkat: Maksimal ${item.maxDevices} Perangkat

💡 Tips Penting:
Simpan pesan ini di WhatsApp. Jika suatu saat kakak ganti HP baru atau tidak sengaja hapus data browser, cukup klik link ini lagi untuk memulihkan VIP tanpa biaya tambahan.

Selamat menonton siaran bola lancar tanpa gangguan iklan redirect! ⚽🔥`;
  };

  const copyToClipboard = async (text: string, isChat = false) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isChat) {
        setCopiedChat(true);
        setTimeout(() => setCopiedChat(false), 2000);
      } else {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
    } catch {
      alert('Gagal menyalin teks ke clipboard.');
    }
  };

  const filteredTokens = tokens.filter((t) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      t.token.toLowerCase().includes(q) ||
      (t.buyer_name || '').toLowerCase().includes(q) ||
      t.status.toLowerCase().includes(q)
    );
  });

  const onlineConnected = !!getGasApiUrl();

  return (
    <div className="flex flex-col gap-6 text-white">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#D4AF37]/15 via-black/40 to-emerald-950/20 border border-[#D4AF37]/25 p-5 sm:p-6 backdrop-blur-md">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(212,175,55,0.25)]">
              <Crown className="w-6 h-6 text-[#D4AF37]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black font-outfit text-white tracking-tight">
                  VIP License & Token Manager
                </h2>
                <span
                  className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    onlineConnected
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {onlineConnected ? 'Google Sheets Sync Online' : 'Mode Offline / Lokal'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 max-w-xl">
                Kelola paket langganan VIP No-Ads (Rp 15k & Rp 35k), buat token trial giveaway, pantau kuota perangkat, dan kirim pesan WhatsApp instan ke pembeli.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setShowSettings(true)}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Koneksi Sheets</span>
            </button>
            <button
              onClick={loadTokens}
              disabled={loading}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#D4AF37]' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Form Generator & Token List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Generator Form (4 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="rounded-2xl bg-[#09090b]/80 border border-white/[0.08] p-5 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/5">
              <Sparkles className="w-4 h-4 text-[#D4AF37]" />
              <h3 className="text-sm font-extrabold font-outfit uppercase tracking-wider text-white">
                Buat Token VIP Baru
              </h3>
            </div>

            {createMessage && (
              <div
                className={`p-3 rounded-xl text-xs mb-4 flex items-center gap-2 ${
                  createMessage.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleCreateToken} className="flex flex-col gap-4 text-xs">
              {/* Nama Pembeli */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-zinc-300">Nama Pembeli / Catatan</label>
                <input
                  type="text"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Misal: Budi WA 081234xxx atau Giveaway Nobar"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/10 focus:border-[#D4AF37] text-white text-xs placeholder:text-zinc-600 outline-none transition-all"
                  required
                />
              </div>

              {/* Pilihan Paket & Batas Device */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-zinc-300">Pilihan Paket & Batas HP</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPackageType('standar')}
                    className={`p-2.5 rounded-xl border text-left flex flex-col transition-all cursor-pointer ${
                      packageType === 'standar'
                        ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-white shadow-[0_0_15px_rgba(212,175,55,0.2)]'
                        : 'bg-white/[0.02] border-white/10 text-zinc-400 hover:bg-white/5'
                    }`}
                  >
                    <span className="font-bold text-[11px] text-[#D4AF37]">🥉 Standar (15rb)</span>
                    <span className="text-[10px] text-zinc-400 mt-0.5 font-mono">Maks. 2 HP</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPackageType('nobar')}
                    className={`p-2.5 rounded-xl border text-left flex flex-col transition-all cursor-pointer ${
                      packageType === 'nobar'
                        ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-white shadow-[0_0_15px_rgba(212,175,55,0.2)]'
                        : 'bg-white/[0.02] border-white/10 text-zinc-400 hover:bg-white/5'
                    }`}
                  >
                    <span className="font-bold text-[11px] text-emerald-400">👑 Nobar (35rb)</span>
                    <span className="text-[10px] text-zinc-400 mt-0.5 font-mono">Maks. 5 HP (Laris)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPackageType('single')}
                    className={`p-2 rounded-xl border text-left flex flex-col transition-all cursor-pointer ${
                      packageType === 'single'
                        ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-white shadow-[0_0_15px_rgba(212,175,55,0.2)]'
                        : 'bg-white/[0.02] border-white/10 text-zinc-400 hover:bg-white/5'
                    }`}
                  >
                    <span className="font-bold text-[11px]">Single (1 HP)</span>
                    <span className="text-[10px] text-zinc-500 mt-0.5">Nonton Sendiri</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPackageType('custom')}
                    className={`p-2 rounded-xl border text-left flex flex-col transition-all cursor-pointer ${
                      packageType === 'custom'
                        ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-white shadow-[0_0_15px_rgba(212,175,55,0.2)]'
                        : 'bg-white/[0.02] border-white/10 text-zinc-400 hover:bg-white/5'
                    }`}
                  >
                    <span className="font-bold text-[11px] text-purple-400">🎁 Custom / Event</span>
                    <span className="text-[10px] text-zinc-500 mt-0.5">Input Angka Bebas</span>
                  </button>
                </div>

                {packageType === 'custom' && (
                  <div className="mt-2 flex items-center gap-2 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <span className="text-[11px] text-purple-300 font-bold shrink-0">Batas Device:</span>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={customDevices}
                      onChange={(e) => setCustomDevices(parseInt(e.target.value) || 1)}
                      className="w-20 px-2 py-1 rounded-lg bg-black border border-purple-500/30 text-white font-mono font-bold text-center text-xs outline-none"
                    />
                    <span className="text-[10px] text-zinc-400">(Contoh: 50 buat giveaway)</span>
                  </div>
                )}
              </div>

              {/* Masa Aktif (Durasi) */}
              <div className="flex flex-col gap-1.5 pt-1">
                <label className="font-bold text-zinc-300">Masa Aktif Lisensi</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDurationType('permanent')}
                    className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                      durationType === 'permanent'
                        ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-[#D4AF37]'
                        : 'bg-white/[0.02] border-white/10 text-zinc-400 hover:bg-white/5'
                    }`}
                  >
                    ♾️ Permanen / Lifetime
                  </button>

                  <button
                    type="button"
                    onClick={() => setDurationType('trial')}
                    className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                      durationType === 'trial'
                        ? 'bg-amber-500/15 border-amber-500 text-amber-400'
                        : 'bg-white/[0.02] border-white/10 text-zinc-400 hover:bg-white/5'
                    }`}
                  >
                    ⏳ Trial / Hari Bebas
                  </button>
                </div>

                {durationType === 'trial' && (
                  <div className="mt-2 flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <span className="text-[11px] text-amber-300 font-bold shrink-0">Durasi Hari:</span>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={trialDays}
                      onChange={(e) => setTrialDays(parseInt(e.target.value) || 1)}
                      className="w-20 px-2 py-1 rounded-lg bg-black border border-amber-500/30 text-white font-mono font-bold text-center text-xs outline-none"
                    />
                    <span className="text-[10px] text-zinc-400">hari sejak diaktivasi pembeli</span>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={creating}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F59E0B] hover:brightness-110 active:scale-[0.98] text-black font-extrabold uppercase tracking-wider text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(212,175,55,0.25)] transition-all cursor-pointer disabled:opacity-50"
              >
                {creating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>Buat Token VIP</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Tokens Table (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="rounded-2xl bg-[#09090b]/80 border border-white/[0.08] p-5 shadow-xl backdrop-blur-md flex flex-col h-full">
            {/* Table Header & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#D4AF37]" />
                <h3 className="text-sm font-extrabold font-outfit uppercase tracking-wider text-white">
                  Daftar Token Terdaftar ({tokens.length})
                </h3>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari token / pembeli..."
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-black/60 border border-white/10 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-[#D4AF37] w-full sm:w-48"
                />
              </div>
            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-x-auto min-h-[300px]">
              {loading && tokens.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-center text-zinc-500 gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#D4AF37]" />
                  <span className="text-xs">Memuat daftar token dari database...</span>
                </div>
              ) : filteredTokens.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-center text-zinc-500 gap-2">
                  <Crown className="w-8 h-8 text-zinc-700" />
                  <span className="text-xs">Belum ada token VIP yang dibuat.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {filteredTokens.map((item) => {
                    const used = item.registered_devices ? item.registered_devices.length : 0;
                    const max = item.max_devices || 1;
                    const isFull = used >= max;
                    const isPerm = item.duration_days === 0 || item.expired_at === 'permanent';

                    return (
                      <div
                        key={item.token}
                        className="p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-[#D4AF37] tracking-wider select-all">
                              {item.token}
                            </span>
                            <span
                              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                isPerm
                                  ? 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/25'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                              }`}
                            >
                              {isPerm ? 'Permanen' : `Trial ${item.duration_days} Hari`}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-zinc-400 text-[11px]">
                            <span className="font-bold text-white">{item.buyer_name || 'Pembeli VIP'}</span>
                            <span>•</span>
                            <span
                              className={`font-mono font-bold ${
                                isFull ? 'text-red-400' : 'text-emerald-400'
                              }`}
                            >
                              {used}/{max} HP Terdaftar
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          <button
                            onClick={() =>
                              copyToClipboard(
                                getWaChatText({
                                  token: item.token,
                                  buyerName: item.buyer_name,
                                  maxDevices: item.max_devices,
                                  durationDays: item.duration_days,
                                }),
                                true
                              )
                            }
                            className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all cursor-pointer"
                            title="Salin Teks WhatsApp"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleResetDevice(item.token, item.buyer_name)}
                            className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-all cursor-pointer"
                            title="Reset Perangkat (Ganti HP)"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteToken(item.token, item.buyer_name)}
                            className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all cursor-pointer"
                            title="Hapus Token"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal: Token Created with Instant WhatsApp Copy */}
      {createdTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-[#09090b] border border-[#D4AF37]/40 p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-[#D4AF37]">
                <Crown className="w-5 h-5" />
                <h3 className="font-extrabold font-outfit text-base text-white">Token VIP Siap Dikirim!</h3>
              </div>
              <button
                onClick={() => setCreatedTokenModal(null)}
                className="text-zinc-500 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-black border border-white/10 flex flex-col items-center justify-center gap-1.5 text-center">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">KODE TOKEN</span>
              <span className="font-mono text-xl font-black text-[#D4AF37] tracking-widest select-all">
                {createdTokenModal.token}
              </span>
              <span className="text-xs text-zinc-400">
                {createdTokenModal.buyerName} • Maks. {createdTokenModal.maxDevices} HP
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() =>
                  copyToClipboard(
                    getWaChatText(createdTokenModal),
                    true
                  )
                }
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:brightness-110 active:scale-[0.98] text-white font-extrabold uppercase tracking-wider text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
              >
                {copiedChat ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Format WhatsApp Berhasil Disalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Salin Format Pesan WhatsApp</span>
                  </>
                )}
              </button>

              <button
                onClick={() =>
                  copyToClipboard(getActivationUrl(createdTokenModal.token), false)
                }
                className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Link Tersalin!</span>
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4" />
                    <span>Salin Hanya Link Aktivasi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal (Google Apps Script Web App URL) */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl bg-[#09090b] border border-white/10 p-6 shadow-2xl flex flex-col gap-4 text-xs">
            <div className="flex items-start justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#D4AF37]" />
                <h3 className="font-extrabold font-outfit text-base text-white">
                  Koneksi Database Google Sheets
                </h3>
              </div>
              <button onClick={() => setShowSettings(false)} className="text-zinc-500 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-zinc-300">Google Apps Script Web App URL</label>
                <input
                  type="url"
                  value={gasUrlInput}
                  onChange={(e) => setGasUrlInput(e.target.value)}
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black border border-white/10 text-white font-mono text-[11px] outline-none focus:border-[#D4AF37]"
                />
                <span className="text-[10px] text-zinc-500">
                  Dapatkan dari menu Deploy Web App di file Google Sheet Anda (lihat panduan di scripts/google-apps-script-vip.js).
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-zinc-300">Admin Secret Key</label>
                <input
                  type="text"
                  value={secretInput}
                  onChange={(e) => setSecretInput(e.target.value)}
                  placeholder="ykn_secret_admin_2026"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black border border-white/10 text-white font-mono text-xs outline-none focus:border-[#D4AF37]"
                />
                <span className="text-[10px] text-zinc-500">
                  Kunci rahasia yang sama persis dengan yang Anda pasang di Google Apps Script.
                </span>
              </div>

              {settingsSaved && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-center">
                  Pengaturan koneksi berhasil disimpan!
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:brightness-110 text-black text-xs font-extrabold uppercase tracking-wider"
                >
                  Simpan Koneksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
