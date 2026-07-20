import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  BadgeCheck,
  Cpu,
  Globe2,
  Headphones,
  Layers,
  MonitorPlay,
  PlayCircle,
  Radio,
  RadioTower,
  Server,
  ShieldCheck,
  Signal,
  Smartphone,
  TimerReset,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import heroBg from '../assets/banner2.png';
import yknLogo from '../assets/ykn-tv-logo.png';

interface AboutItem {
  icon: LucideIcon;
  title: string;
  text: string;
}

const principles: AboutItem[] = [
  {
    icon: Zap,
    title: 'Cepat dibuka',
    text: 'Navigasi dibuat ringkas supaya penonton bisa langsung masuk ke jadwal, saluran, dan halaman watch tanpa banyak langkah.',
  },
  {
    icon: MonitorPlay,
    title: 'Fokus ke player',
    text: 'Halaman watch diprioritaskan untuk pengalaman nonton: player besar, kontrol jelas, server mudah dipilih, dan status siaran terbaca.',
  },
  {
    icon: Smartphone,
    title: 'Mobile first',
    text: 'Tampilan dibuat nyaman untuk HP, lalu diperluas ke tablet, laptop, dan desktop tanpa kehilangan rasa aplikasi streaming.',
  },
  {
    icon: ShieldCheck,
    title: 'Fallback siap',
    text: 'Backup website, status page, dan pesan error dibuat supaya penonton tetap punya arah saat stream penuh atau koneksi bermasalah.',
  },
];

const stackItems: AboutItem[] = [
  {
    icon: Radio,
    title: 'Live stream hub',
    text: 'YKN TV merapikan akses pertandingan, saluran olahraga, dan siaran live dalam satu pengalaman yang konsisten.',
  },
  {
    icon: Server,
    title: 'Multi server',
    text: 'Beberapa sumber dan opsi server disiapkan agar penonton bisa pindah jalur saat salah satu koneksi tidak stabil.',
  },
  {
    icon: Signal,
    title: 'Realtime signal',
    text: 'Viewer count, status koneksi, dan indikator live dirancang agar halaman terasa hidup tanpa membuat UI berat.',
  },
  {
    icon: Cpu,
    title: 'Player engine',
    text: 'Player mendukung format streaming modern seperti HLS dan DASH dengan fallback yang disesuaikan untuk perangkat tertentu.',
  },
  {
    icon: Globe2,
    title: 'Akses ringan',
    text: 'Asset visual dipilih seperlunya, animasi memakai CSS transform, dan komponen penting dimuat sesuai kebutuhan halaman.',
  },
  {
    icon: Headphones,
    title: 'Penonton dulu',
    text: 'Setiap detail diarahkan untuk pengalaman nonton yang jelas: tombol besar, status ramah, dan pilihan lanjut yang mudah dipahami.',
  },
];

const timeline = [
  {
    label: '01',
    title: 'Pilih pertandingan atau saluran',
    text: 'Penonton masuk dari jadwal, daftar channel, atau link watch langsung.',
  },
  {
    label: '02',
    title: 'Halaman watch menyiapkan konteks',
    text: 'Nama siaran, status, server, viewer, dan rekomendasi disiapkan sebelum player berjalan penuh.',
  },
  {
    label: '03',
    title: 'Player mulai membaca stream',
    text: 'Manifest stream dibuka, kualitas disesuaikan, dan user tetap punya opsi server kalau koneksi kurang cocok.',
  },
  {
    label: '04',
    title: 'Fallback menjaga arah',
    text: 'Kalau link rusak atau halaman tidak ada, UI error tetap memberi jalan ke beranda, status, dan siaran tersedia.',
  },
];

const stats = [
  { value: '24/7', label: 'Mode siaran siap pantau' },
  { value: 'HD', label: 'Pengalaman player prioritas' },
  { value: 'Multi', label: 'Server dan sumber cadangan' },
  { value: 'Fast', label: 'UI ringan untuk HP' },
];

const AboutRobot = () => (
  <div className="ykn-about-robot-scene" aria-hidden="true">
    <div className="ykn-about-stream-screen">
      <div className="ykn-about-screen-play" />
      <span className="line one" />
      <span className="line two" />
      <span className="line three" />
    </div>
    <div className="ykn-about-signal-ring ring-one" />
    <div className="ykn-about-signal-ring ring-two" />
    <div className="ykn-about-signal-ring ring-three" />
    <div className="ykn-about-bot">
      <div className="ykn-about-bot-antenna">
        <span />
      </div>
      <div className="ykn-about-bot-head">
        <div className="eye left" />
        <div className="eye right" />
        <div className="mouth" />
      </div>
      <div className="ykn-about-bot-body">
        <div className="arm left" />
        <div className="arm right" />
        <img src={yknLogo} alt="" />
        <div className="meter" />
      </div>
    </div>
    <div className="ykn-about-console">
      <span />
      <span />
      <span />
    </div>
    <div className="ykn-about-robot-shadow" />
  </div>
);

const About = () => {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroImageY = useTransform(scrollYProgress, [0, 1], ['0%', '18%']);
  const heroImageScale = useTransform(scrollYProgress, [0, 1], [1.04, 1.13]);
  const heroContentY = useTransform(scrollYProgress, [0, 0.85], [0, 120]);
  const heroContentOpacity = useTransform(scrollYProgress, [0, 0.72], [1, 0.16]);
  const robotY = useTransform(scrollYProgress, [0, 0.9], [0, 165]);
  const robotOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0.18]);

  useEffect(() => {
    const originalTitle = document.title;
    document.title = 'Tentang YKN TV | YKN DEVELOPER';
    return () => {
      document.title = originalTitle;
    };
  }, []);

  return (
    <MainLayout>
      <div className="-mx-4 -mt-4 overflow-hidden md:-mx-8 md:-mt-8">
        <section
          ref={heroRef}
          className="relative flex min-h-[calc(100svh-64px)] items-center overflow-hidden px-4 pb-28 pt-12 sm:px-6 md:min-h-[calc(100svh-80px)] md:px-8 md:pb-32 md:pt-20"
        >
          <motion.img
            src={heroBg}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ y: heroImageY, scale: heroImageScale }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,2,2,0.97)_0%,rgba(2,2,2,0.82)_44%,rgba(2,2,2,0.50)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_24%,rgba(212,175,55,0.20),transparent_28%),radial-gradient(circle_at_22%_72%,rgba(16,185,129,0.15),transparent_30%)]" />
          <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-b from-transparent via-[#020202]/84 to-[#020202]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.12),transparent_66%)]" />
          <div className="ykn-about-data-rain" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>

          <div className="relative z-10 mx-auto grid w-full max-w-[1320px] gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65 }}
              className="max-w-4xl"
              style={{ y: heroContentY, opacity: heroContentOpacity }}
            >
              <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-primary/25 bg-black/55 px-4 py-2 text-primary shadow-lg shadow-primary/10 backdrop-blur-xl">
                <RadioTower size={16} />
                <span className="text-xs font-black uppercase">Live streaming control room</span>
              </div>

              <h1 className="font-display text-4xl font-black uppercase leading-[1.02] text-white sm:text-6xl lg:text-7xl">
                Tentang <span className="text-primary">YKN TV</span>
              </h1>

              <p className="mt-6 max-w-3xl text-base font-bold leading-relaxed text-zinc-300 sm:text-lg">
                YKN TV adalah ruang streaming yang dibuat untuk penonton yang ingin masuk cepat ke pertandingan,
                saluran olahraga, dan siaran live tanpa tampilan yang membingungkan. Fokusnya sederhana:
                player jelas, informasi padat, server mudah dipilih, dan pengalaman nonton tetap nyaman di HP maupun desktop.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  onClick={() => navigate('/')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-xs font-black uppercase text-dark shadow-xl shadow-primary/15 transition-all hover:bg-yellow-400 active:scale-95 cursor-pointer tv-focusable"
                >
                  <PlayCircle size={16} />
                  Mulai Nonton
                </button>
                <button
                  onClick={() => navigate('/status')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/[0.12] bg-white/[0.07] px-6 py-4 text-xs font-black uppercase text-white backdrop-blur-xl transition-all hover:border-primary/35 hover:bg-white/[0.12] active:scale-95 cursor-pointer tv-focusable"
                >
                  <Signal size={16} />
                  Cek Status
                </button>
              </div>

              <div className="mt-10 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
                {stats.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-black/50 p-4 backdrop-blur-xl">
                    <div className="text-2xl font-black text-primary">{item.value}</div>
                    <p className="mt-1 text-[11px] font-bold leading-snug text-zinc-400">{item.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.75, delay: 0.12 }}
              className="flex justify-center lg:justify-end"
              style={{ y: robotY, opacity: robotOpacity }}
            >
              <AboutRobot />
            </motion.div>
          </div>
        </section>

      </div>

      <section className="relative mx-auto max-w-[1320px] pb-12 pt-10 sm:pb-16 sm:pt-14">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.55 }}
          className="mb-8 max-w-3xl"
        >
          <p className="text-xs font-black uppercase text-primary">Apa itu YKN TV</p>
          <h2 className="mt-3 font-display text-3xl font-black uppercase text-white sm:text-4xl">
            Platform nonton yang dibuat untuk momen live.
          </h2>
          <p className="mt-4 text-sm font-bold leading-relaxed text-zinc-400 sm:text-base">
            YKN TV bukan sekadar daftar link. Halaman ini dirancang seperti pusat kendali siaran:
            ada jadwal, channel, status, fallback, dan player yang menempatkan video sebagai fokus utama.
          </p>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {principles.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.article
                key={item.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.45, delay: index * 0.05 }}
                className="group rounded-[1.75rem] border border-white/10 bg-zinc-950/78 p-5 shadow-xl shadow-black/20 backdrop-blur-xl transition-all hover:border-primary/30 hover:bg-zinc-900/82"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary transition-transform group-hover:scale-105">
                  <Icon size={22} />
                </div>
                <h3 className="text-lg font-black text-white">{item.title}</h3>
                <p className="mt-3 text-sm font-bold leading-relaxed text-zinc-400">{item.text}</p>
              </motion.article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] border-y border-white/10 py-12 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <motion.div
            initial={{ opacity: 0, x: -18 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.55 }}
          >
            <p className="text-xs font-black uppercase text-primary">Gaya streaming</p>
            <h2 className="mt-3 font-display text-3xl font-black uppercase text-white sm:text-4xl">
              UI dibuat hidup, tapi tetap hemat tenaga.
            </h2>
            <p className="mt-4 text-sm font-bold leading-relaxed text-zinc-400 sm:text-base">
              Animasi di YKN TV diarahkan untuk membantu rasa aplikasi streaming: sinyal live, badge status,
              transisi card, halaman error, dan loading player. Efeknya dibuat memakai transform, opacity, dan CSS ringan.
            </p>
            <div className="mt-7 rounded-[1.75rem] border border-primary/20 bg-primary/10 p-5 text-sm font-bold leading-relaxed text-zinc-200">
              Developed by <span className="font-black text-primary">YKN DEVELOPER</span>. Dibangun dengan rasa cepat,
              gelap, tajam, dan siap dipakai penonton ramai.
            </div>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2">
            {stackItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.article
                  key={item.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.45, delay: index * 0.04 }}
                  className="rounded-[1.5rem] border border-white/10 bg-black/45 p-5 backdrop-blur-xl transition-all hover:border-emerald-500/25 hover:bg-zinc-950/75"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                      <Icon size={19} />
                    </div>
                    <h3 className="text-base font-black text-white">{item.title}</h3>
                  </div>
                  <p className="text-sm font-bold leading-relaxed text-zinc-400">{item.text}</p>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] py-12 sm:py-16">
        <div className="grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.55 }}
          >
            <p className="text-xs font-black uppercase text-primary">Alur pengalaman</p>
            <h2 className="mt-3 font-display text-3xl font-black uppercase text-white">
              Dari klik card sampai player siap.
            </h2>
            <p className="mt-4 text-sm font-bold leading-relaxed text-zinc-400">
              YKN TV memisahkan hal yang ringan dan berat. UI boleh tampil dulu, sementara player baru mulai bekerja
              saat halaman watch benar-benar dibuka.
            </p>
          </motion.div>

          <div className="grid gap-4 md:grid-cols-2">
            {timeline.map((item, index) => (
              <motion.article
                key={item.label}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.45, delay: index * 0.05 }}
                className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-zinc-950/70 p-5 backdrop-blur-xl"
              >
                <div className="absolute right-5 top-4 text-5xl font-black text-white/[0.035]">{item.label}</div>
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-sm font-black text-dark">
                  {item.label}
                </div>
                <h3 className="text-lg font-black text-white">{item.title}</h3>
                <p className="mt-3 text-sm font-bold leading-relaxed text-zinc-400">{item.text}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mb-8 max-w-[1320px] overflow-hidden rounded-[2rem] border border-white/10 bg-black/60 p-6 backdrop-blur-2xl sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center">
          <div>
            <div className="mb-5 flex items-center gap-3">
              <img src={yknLogo} alt="YKN TV" className="h-12 w-36 object-contain" />
              <div>
                <p className="text-xs font-black uppercase text-primary">YKN TV</p>
                <h2 className="text-2xl font-black text-white sm:text-3xl">Streaming hub untuk penonton live.</h2>
              </div>
            </div>
            <p className="max-w-3xl text-sm font-bold leading-relaxed text-zinc-400 sm:text-base">
              Tujuan YKN TV adalah membuat pengalaman nonton terasa dekat: buka cepat, lihat jadwal,
              masuk player, pilih server, dan tetap punya jalur cadangan kalau kondisi stream berubah.
              Desainnya dibuat gelap, fokus, dan sinematik supaya cocok dengan suasana siaran live.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Layers, label: 'Layout responsif' },
              { icon: TimerReset, label: 'Loading jelas' },
              { icon: Users, label: 'Viewer aware' },
              { icon: BadgeCheck, label: 'Fallback rapi' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <Icon size={20} className="text-primary" />
                  <p className="mt-3 text-xs font-black uppercase text-zinc-300">{item.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </MainLayout>
  );
};

export default About;
