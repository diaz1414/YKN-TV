import { ArrowRight, CalendarClock, Home, Radio, RefreshCcw, SearchX, Tv } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { slugify, type PlayableStream } from '../services/streamService';

type EmptyWatchStateVariant = 'route' | 'channel';

interface EmptyWatchStateProps {
  variant?: EmptyWatchStateVariant;
  requestedLabel?: string;
  recommendations?: PlayableStream[];
}

const getWatchPath = (stream: PlayableStream) => {
  if (stream.isChannel) return `/watch/${slugify(stream.name)}`;
  return `/watch/${slugify(stream.name)}-${stream.id}`;
};

const NotFoundRobot = () => (
  <div className="ykn-404-robot-wrap" aria-hidden="true">
    <div className="ykn-404-robot-orbit" />
    <div className="ykn-404-robot">
      <div className="ykn-404-robot-antenna">
        <span />
      </div>
      <div className="ykn-404-robot-head">
        <div className="ykn-404-robot-eye left" />
        <div className="ykn-404-robot-eye right" />
        <div className="ykn-404-robot-mouth" />
      </div>
      <div className="ykn-404-robot-neck" />
      <div className="ykn-404-robot-body">
        <div className="ykn-404-robot-arm left" />
        <div className="ykn-404-robot-arm right" />
        <span>404</span>
        <div className="ykn-404-robot-panel" />
      </div>
    </div>
    <div className="ykn-404-robot-shadow" />
  </div>
);

const EmptyWatchState = ({
  variant = 'channel',
  requestedLabel,
  recommendations = [],
}: EmptyWatchStateProps) => {
  const navigate = useNavigate();
  const isRouteMissing = variant === 'route';
  const visibleRecommendations = recommendations
    .filter((stream) => stream.servers?.length || stream.jadwal_event)
    .slice(0, 4);

  return (
    <section className="mx-auto w-full max-w-[1180px] py-8 sm:py-12 lg:py-16">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] lg:items-stretch">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/90 p-6 shadow-2xl backdrop-blur-2xl sm:p-8 lg:p-10">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />

          <div className={`grid h-full gap-8 lg:items-center ${isRouteMissing ? 'lg:grid-cols-[minmax(0,1fr)_240px]' : ''}`}>
            <div className="flex min-w-0 flex-col justify-center">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-lg shadow-primary/5">
                  <SearchX size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">
                    {isRouteMissing ? '404 Page' : 'Tidak Tersedia'}
                  </p>
                  {requestedLabel && (
                    <p className="mt-1 max-w-full truncate font-mono text-[10px] font-bold text-zinc-500">
                      {requestedLabel}
                    </p>
                  )}
                </div>
              </div>

              <h1 className="max-w-3xl font-display text-3xl font-black uppercase leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
                {isRouteMissing ? 'Halaman Tidak Ditemukan' : 'Saluran Tidak Ditemukan'}
              </h1>

              <p className="mt-4 max-w-2xl text-sm font-bold leading-relaxed text-zinc-400 sm:text-base">
                {isRouteMissing
                  ? 'Alamat yang kamu buka tidak tersedia di YKN TV. Kamu bisa kembali ke beranda atau pilih siaran aktif yang tersedia.'
                  : 'Link saluran ini mungkin berubah, belum aktif, atau sudah dipindahkan. Pilih siaran lain yang tersedia tanpa perlu refresh halaman.'}
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  onClick={() => navigate('/')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-xs font-black uppercase tracking-widest text-dark shadow-lg shadow-primary/10 transition-all hover:bg-yellow-400 active:scale-95 cursor-pointer tv-focusable"
                >
                  <Home size={15} />
                  Beranda
                </button>
                <button
                  onClick={() => navigate('/?tab=channels')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:border-primary/30 hover:bg-white/10 active:scale-95 cursor-pointer tv-focusable"
                >
                  <Tv size={15} />
                  Saluran TV
                </button>
                <button
                  onClick={() => navigate('/status')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-zinc-950/70 px-5 py-3 text-xs font-black uppercase tracking-widest text-zinc-300 transition-all hover:border-white/20 hover:text-white active:scale-95 cursor-pointer tv-focusable"
                >
                  <RefreshCcw size={15} />
                  Status
                </button>
              </div>
            </div>

            {isRouteMissing && (
              <div className="order-first lg:order-none">
                <NotFoundRobot />
              </div>
            )}
          </div>
        </div>

        <aside className="rounded-[2rem] border border-white/10 bg-black/55 p-4 shadow-2xl backdrop-blur-2xl sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Rekomendasi</p>
              <h2 className="mt-1 text-base font-black text-white">Siaran Tersedia</h2>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
              <Radio size={18} />
            </div>
          </div>

          {visibleRecommendations.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {visibleRecommendations.map((stream) => (
                <button
                  key={stream.id}
                  onClick={() => navigate(getWatchPath(stream))}
                  className="group flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-zinc-950/70 p-3 text-left transition-all hover:border-primary/35 hover:bg-zinc-900/85 active:scale-[0.99] cursor-pointer tv-focusable"
                >
                  {stream.isChannel ? (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5 p-2">
                      <img
                        src={stream.logo || 'https://flagcdn.com/w80/un.png'}
                        alt={stream.name}
                        className="h-full w-full object-contain"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="flex shrink-0 items-center -space-x-3">
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-zinc-900 p-1.5">
                        <img src={stream.logo || 'https://flagcdn.com/w80/un.png'} alt={stream.player1 || stream.name} className="h-full w-full object-contain" loading="lazy" />
                      </div>
                      <div className="z-10 flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-zinc-900 p-1.5">
                        <img src={stream.logo2 || 'https://flagcdn.com/w80/un.png'} alt={stream.player2 || stream.name} className="h-full w-full object-contain" loading="lazy" />
                      </div>
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-black text-white transition-colors group-hover:text-primary">
                      {stream.name}
                    </h3>
                    <div className="mt-1 flex items-center gap-2">
                      {stream.isChannel ? <Tv size={12} className="text-zinc-500" /> : <CalendarClock size={12} className="text-zinc-500" />}
                      <p className="truncate text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        {stream.subName || (stream.isChannel ? 'Saluran TV' : 'Live Match')}
                      </p>
                    </div>
                  </div>

                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-zinc-400 transition-all group-hover:bg-primary group-hover:text-dark">
                    <ArrowRight size={14} />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-white/10 bg-zinc-950/45 p-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-400">
                <Tv size={24} />
              </div>
              <h3 className="text-base font-black text-white">Belum Ada Saluran Aktif</h3>
              <p className="mt-2 max-w-xs text-xs font-bold leading-relaxed text-zinc-500">
                Daftar siaran sedang kosong atau belum berhasil dimuat. Coba cek status server atau kembali ke beranda.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
};

export default EmptyWatchState;
