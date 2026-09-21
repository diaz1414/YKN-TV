import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Activity,
  Clock,
  Coffee,
  Cpu,
  ExternalLink,
  Heart,
  MonitorPlay,
  PlayCircle,
  Server,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import heroBg from '../assets/banner2.png';
import yknLogo from '../assets/ykn-tv-logo.png';
import { SupportModal } from '../components/SupportDeveloper';

interface TechSpec {
  label: string;
  value: string;
  detail: string;
  icon: typeof Cpu;
}

const TECH_SPECS: TechSpec[] = [
  {
    label: 'Player Engine',
    value: 'Clappr & Shaka & HLS.js',
    detail: 'Adaptif otomatis sesuai format stream dan kapabilitas browser perangkat.',
    icon: Cpu,
  },
  {
    label: 'Resolusi Siaran',
    value: '1080p 60FPS / 720p',
    detail: 'Kualitas tayangan tajam dengan bitrate dinamis untuk koneksi hemat kuota.',
    icon: MonitorPlay,
  },
  {
    label: 'Sistem Telemetri',
    value: 'Dual Realtime Sync',
    detail: 'Supabase Presence tracking digabung WebSocket monitoring room berkecepatan tinggi.',
    icon: Activity,
  },
  {
    label: 'Multi-Server Failover',
    value: 'Auto Backup Relay',
    detail: 'Pilihan 3+ server cadangan per tayangan dan mirror domain saat trafik puncak.',
    icon: Server,
  },
];

const ARCHITECTURE_PILLARS = [
  {
    id: 'streaming-engine',
    title: 'Low-Latency Streaming Pipeline',
    subtitle: 'Arsitektur Player Mutakhir',
    description: 'YKN TV menggabungkan pipeline pemutaran HLS dan MPEG-DASH modern dengan kemampuan parsing ClearKey DRM otomatis. Penonton dapat beralih antar server secara instan tanpa perlu memuat ulang seluruh halaman.',
    icon: Zap,
    accent: 'text-amber-400',
    borderGlow: 'border-amber-500/20 group-hover:border-amber-500/40',
    tags: ['HLS', 'MPEG-DASH', 'ClearKey DRM', 'Auto-Recover'],
  },
  {
    id: 'telemetry',
    title: 'Real-Time Telemetri & Kehadiran',
    subtitle: 'Presisi Data 100% Riil',
    description: 'Setiap jumlah penonton dan status siaran dihitung secara transparan melalui sinkronisasi Supabase Realtime Presence dan backend WebSocket gateway kami. Tidak ada manipulasi angka penonton buatan.',
    icon: Activity,
    accent: 'text-emerald-400',
    borderGlow: 'border-emerald-500/20 group-hover:border-emerald-500/40',
    tags: ['Supabase Presence', 'WebSocket Rooms', 'Live Telemetry'],
  },
  {
    id: 'smart-tv-mobile',
    title: 'Desain Lintas Perangkat & Smart TV',
    subtitle: '10-Foot UI & Mobile Ergonomics',
    description: 'Dioptimalkan untuk kenyamanan navigasi satu tangan di smartphone lewat Mobile Bottom Dock, serta mendukung navigasi Remote Control D-Pad (tv-focusable) untuk browser Android TV dan Smart TV ruang keluarga.',
    icon: Smartphone,
    accent: 'text-sky-400',
    borderGlow: 'border-sky-500/20 group-hover:border-sky-500/40',
    tags: ['Mobile Dock', 'Remote D-Pad', 'Smart TV Ready', 'PWA Support'],
  },
  {
    id: 'high-availability',
    title: 'Ketahanan Tinggi & Server Cadangan',
    subtitle: 'Zero Downtime Architecture',
    description: 'Saat pertandingan akbar (El Clasico, Liga Champions, Timnas) berlangsung dengan lonjakan trafik ratusan ribu pengguna, sistem secara otomatis mengaktifkan rute mirror CDN dan cadangan server sekunder.',
    icon: ShieldCheck,
    accent: 'text-primary',
    borderGlow: 'border-primary/20 group-hover:border-primary/40',
    tags: ['Multi Server', 'Edge CDN', 'Mirror Fallback', 'Load Balancing'],
  },
];

const PLATFORM_VALUES = [
  {
    title: 'Bebas AI-Slop & Desain Berbobot',
    desc: 'Kami menolak antarmuka generik yang hambar. Setiap kartu pertandingan, papan skor, dan status saluran dirancang dengan presisi atmosfer stadion malam (Stadium Nocturne) berkecepatan tinggi.',
    icon: Trophy,
  },
  {
    title: 'Gratis & Terbuka untuk Pecinta Olahraga',
    desc: 'Platform ini dikembangkan dengan semangat komunitas sepak bola dan olahraga tanah air agar seluruh masyarakat dapat menikmati siaran tim favorit mereka dengan akses yang mudah.',
    icon: Heart,
  },
  {
    title: 'Jadwal Siaran Diperbarui Berkala',
    desc: 'Jadwal pertandingan dari liga top Eropa, kompetisi Asia, dan siaran TV nasional diperbarui setiap hari secara otomatis lengkap dengan waktu kickoff zona WIB/WITA/WIT.',
    icon: Clock,
  },
];

const About = () => {
  const navigate = useNavigate();
  const [isSupportOpen, setIsSupportOpen] = useState(false);

  useEffect(() => {
    const originalTitle = document.title;
    document.title = 'Tentang YKN TV | Official Sports & Live TV Hub';
    return () => {
      document.title = originalTitle;
    };
  }, []);

  return (
    <MainLayout>
      <div className="space-y-12 sm:space-y-16 pb-16 max-w-[1360px] mx-auto px-2 sm:px-4 select-none">

        {/* HERO SECTION: Stadium Nocturne Atmosphere */}
        <section className="relative min-h-[440px] sm:min-h-[520px] rounded-[2.5rem] overflow-hidden group shadow-2xl border border-white/[0.08] before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-primary/80 before:via-emerald-400 before:to-white/40 before:z-10 mt-2">
          {/* Background image & gradient overlay */}
          <img
            src={heroBg}
            alt="YKN TV Stadium Nocturne"
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 brightness-[0.38]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#020202] via-[#020202]/85 to-[#020202]/40" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#020202] to-transparent" />

          {/* Ambient Stadium Flare */}
          <div className="absolute -top-24 left-1/4 w-96 h-96 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 right-1/4 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Hero Content */}
          <div className="relative z-10 flex min-h-[440px] sm:min-h-[520px] max-w-4xl flex-col justify-end p-6 sm:p-12 md:p-16">
            <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-black/60 px-4 py-1.5 text-primary shadow-[0_0_16px_rgba(212,175,55,0.2)] backdrop-blur-xl">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-200">
                Official Broadcast Hub & Control Room
              </span>
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-display font-black leading-none mb-4 tracking-tighter uppercase italic text-white">
              Tentang <span className="text-gradient-gold inline-block pr-2">YKN TV</span>
            </h1>

            <p className="text-sm sm:text-base md:text-lg text-zinc-300 max-w-2xl font-bold leading-relaxed">
              Pusat siaran langsung olahraga, saluran hiburan 24 jam, dan jadwal pertandingan terlengkap di Indonesia.
              Dibangun dengan performa server berkecepatan tinggi, navigasi taktil bebas lag, dan komitmen data telemetri yang transparan.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3.5">
              <motion.button
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/')}
                className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-6 py-3.5 text-xs font-black uppercase tracking-wider text-black shadow-[0_0_24px_rgba(212,175,55,0.35)] transition-all cursor-pointer tv-focusable"
                tabIndex={0}
              >
                <PlayCircle size={16} />
                <span>Mulai Menonton</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/status')}
                className="inline-flex items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.05] hover:bg-white/10 px-6 py-3.5 text-xs font-black uppercase tracking-wider text-white backdrop-blur-xl transition-all cursor-pointer tv-focusable"
                tabIndex={0}
              >
                <Activity size={16} className="text-emerald-400" />
                <span>Cek Uptime & Server</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsSupportOpen(true)}
                className="inline-flex items-center justify-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-5 py-3.5 text-xs font-black uppercase tracking-wider text-amber-400 transition-all cursor-pointer tv-focusable"
                tabIndex={0}
              >
                <Coffee size={15} />
                <span>Traktir Kopi</span>
              </motion.button>
            </div>
          </div>
        </section>

        {/* BENTO ARCHITECTURE: 4 CORE PLATFORM PILLARS */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-primary mb-1">
                <Sparkles size={13} />
                <span>Pilar Arsitektur Platform</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-display font-black uppercase tracking-tight italic text-white">
                Direkayasa Khusus Siaran Langsung
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 font-bold max-w-md">
              Dirancang dari nol untuk menahan beban ribuan penonton serentak saat kickoff pertandingan besar.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {ARCHITECTURE_PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.id}
                  className={`glass-card glass-specular group rounded-3xl p-6 sm:p-8 border bg-[#060606]/85 backdrop-blur-xl transition-all duration-300 shadow-xl ${pillar.borderGlow} hover:-translate-y-1`}
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className={`p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] shadow-inner ${pillar.accent}`}>
                      <Icon size={24} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 bg-white/[0.03] px-2.5 py-1 rounded-full border border-white/5">
                      {pillar.subtitle}
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-white mb-2.5 tracking-tight group-hover:text-primary transition-colors">
                    {pillar.title}
                  </h3>
                  <p className="text-sm text-zinc-300 font-bold leading-relaxed mb-6">
                    {pillar.description}
                  </p>

                  <div className="flex flex-wrap gap-2 pt-4 border-t border-white/[0.06]">
                    {pillar.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[9.5px] font-black font-mono uppercase px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-zinc-400 group-hover:text-white group-hover:border-white/20 transition-all"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* TECHNICAL TELEMETRY SPECIFICATIONS TABLE */}
        <section className="glass-card glass-specular rounded-3xl p-6 sm:p-8 border border-white/[0.08] bg-[#070707]/80 backdrop-blur-xl shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <div className="flex items-center gap-2.5">
              <Cpu size={18} className="text-primary" />
              <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight">
                Spesifikasi Teknis Sistem
              </h3>
            </div>
            <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
              Production Release v2.4
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TECH_SPECS.map((spec) => {
              const Icon = spec.icon;
              return (
                <div
                  key={spec.label}
                  className="p-4 sm:p-5 rounded-2xl bg-white/[0.025] border border-white/[0.06] hover:border-white/15 transition-all"
                >
                  <div className="flex items-center gap-2 text-zinc-400 mb-2">
                    <Icon size={14} className="text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest">{spec.label}</span>
                  </div>
                  <div className="text-base sm:text-lg font-black text-white tracking-tight mb-1.5 font-display">
                    {spec.value}
                  </div>
                  <p className="text-xs text-zinc-400 font-bold leading-relaxed">
                    {spec.detail}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* PLATFORM PHILOSOPHY & VALUES */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {PLATFORM_VALUES.map((val) => {
            const Icon = val.icon;
            return (
              <div
                key={val.title}
                className="glass-card rounded-2xl p-6 border border-white/[0.06] bg-[#070707]/60 backdrop-blur-md hover:border-white/10 transition-colors"
              >
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] w-fit text-primary mb-3.5 shadow-inner">
                  <Icon size={20} />
                </div>
                <h4 className="text-base font-black text-white mb-2 tracking-tight">
                  {val.title}
                </h4>
                <p className="text-xs text-zinc-400 font-bold leading-relaxed">
                  {val.desc}
                </p>
              </div>
            );
          })}
        </section>

        {/* DEVELOPER & ECOSYSTEM FOOTPRINT */}
        <section className="glass-card glass-specular rounded-3xl p-6 sm:p-8 md:p-10 border border-white/[0.08] bg-gradient-to-br from-[#0a0a0a] via-[#050505] to-[#020202] shadow-2xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-3">
                <img src={yknLogo} alt="YKN TV" className="h-8 sm:h-9 object-contain" />
                <div className="h-4 w-[1px] bg-zinc-700" />
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                  Developed by YKN DEVELOPER
                </span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-display font-black text-white uppercase italic tracking-tight">
                Mendukung Kemajuan Streaming Olahraga Indonesia
              </h3>
              <p className="text-xs sm:text-sm text-zinc-300 font-bold leading-relaxed">
                YKN TV dirawat secara independen untuk memberikan alternatif siaran langsung yang stabil, ringan, dan ramah pengguna.
                Jika Anda menikmati siaran dan ingin membantu biaya operasional server, Anda dapat berdonasi lewat tombol traktir kopi.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <motion.button
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsSupportOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black px-6 py-3.5 text-xs font-black uppercase tracking-wider shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all cursor-pointer tv-focusable"
                tabIndex={0}
              >
                <Coffee size={15} />
                <span>Traktir Pengembang</span>
              </motion.button>

              <motion.a
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
                href="https://movies.ykn.my.id"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-6 py-3.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer tv-focusable"
                tabIndex={0}
              >
                <span>Partner: YKN Movies</span>
                <ExternalLink size={13} />
              </motion.a>
            </div>
          </div>
        </section>

      </div>

      {/* Support Developer Modal */}
      {isSupportOpen && <SupportModal onClose={() => setIsSupportOpen(false)} />}
    </MainLayout>
  );
};

export default About;
