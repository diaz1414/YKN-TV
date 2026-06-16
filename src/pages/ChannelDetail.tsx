import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import VideoPlayer from '../components/VideoPlayer';
import { getStreamById, getLiveSportsData, slugify, type PlayableStream } from '../services/streamService';
import { ChevronLeft, Wifi, Share2, Play, Calendar, Lock, Coffee, Gift } from 'lucide-react';
import { supabase } from '../services/supabase';

const ChannelDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [stream, setStream] = useState<PlayableStream | null>(null);
  const [sportsTv, setSportsTv] = useState<PlayableStream[]>([]);
  const [liveTv, setLiveTv] = useState<PlayableStream[]>([]);
  const [copied, setCopied] = useState(false);
  const [matchTimeLeft, setMatchTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [matchStatus, setMatchStatus] = useState<'playable' | 'upcoming' | 'finished'>('playable');
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<PlayableStream[]>([]);
  const [activeTab, setActiveTab] = useState<'channels' | 'matches'>('matches');

  useEffect(() => {
    // Scroll to top when entering a new channel/match detail page
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id]);

  useEffect(() => {
    if (stream) {
      setActiveTab(stream.isChannel ? 'channels' : 'matches');
    }
  }, [stream]);

  const [liveBitrate, setLiveBitrate] = useState('6.4 Mbps');
  const [liveLatency, setLiveLatency] = useState('0.9s');
  const [viewerCounts, setViewerCounts] = useState<Record<string, number>>({});

  // Real-time tracking of viewers using Supabase Presence
  useEffect(() => {
    if (!stream) return;
    const channel = supabase.channel('global-live-sports-presence');

    channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const counts: Record<string, number> = {};

        Object.values(presenceState).forEach((presences: any) => {
          presences.forEach((p: any) => {
            if (p.watching) {
              counts[p.watching] = (counts[p.watching] || 0) + 1;
            }
          });
        });

        setViewerCounts(counts);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ watching: stream.id, joined_at: new Date().toISOString() });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [stream?.id]);

  // Interval for specs fluctuations
  useEffect(() => {
    const interval = setInterval(() => {
      const bitrateNum = (6.1 + Math.random() * 0.6).toFixed(1);
      setLiveBitrate(`${bitrateNum} Mbps`);
      const latencyNum = (0.7 + Math.random() * 0.5).toFixed(1);
      setLiveLatency(`${latencyNum}s`);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const getFormattedViewers = (streamId: string) => {
    const rawPresence = viewerCounts[streamId] || 0;
    const count = Math.max(1, rawPresence);
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const parseJadwal = (dateStr?: string): Date => {
    if (!dateStr) return new Date();
    let clean = dateStr.trim();
    if (clean.includes(' ')) {
      clean = clean.replace(' ', 'T');
    }
    const tzMatch = clean.match(/([+-]\d{2})$/);
    if (tzMatch) {
      clean += ':00';
    }
    return new Date(clean);
  };

  const formatMatchTime = (date: Date): string => {
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const optionsTime: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
    const timeStr = date.toLocaleTimeString('id-ID', optionsTime);

    if (date.toDateString() === now.toDateString()) {
      return timeStr;
    } else {
      const optionsDate: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
      const dateStr = date.toLocaleDateString('id-ID', optionsDate);
      return `${dateStr} - ${timeStr}`;
    }
  };

  useEffect(() => {
    if (!stream || stream.isChannel || !stream.jadwal_event) {
      setMatchStatus('playable');
      return;
    }

    const start = parseJadwal(stream.jadwal_event);
    const stop = parseJadwal(stream.jadwal_stop);
    const playableStart = new Date(start.getTime() - 30 * 60 * 1000); // 30 minutes before kickoff

    const checkTime = () => {
      const now = new Date();
      if (now > stop) {
        setMatchStatus('finished');
      } else if (now < playableStart) {
        setMatchStatus('upcoming');
        const diff = playableStart.getTime() - now.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / 1000 / 60) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        setMatchTimeLeft({ days, hours, minutes, seconds });
      } else {
        setMatchStatus('playable');
      }
    };

    checkTime();
    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  }, [stream]);

  // Load active stream and other channels for quick switcher sidebar
  useEffect(() => {
    const fetchStreamData = async () => {
      setLoading(true);
      if (id) {
        const foundStream = await getStreamById(id);
        if (foundStream) {
          setStream(foundStream);
        }
      }
      try {
        const list = await getLiveSportsData();
        setSportsTv(list.sportsTv);
        setLiveTv(list.liveTv);
        setMatches(list.matches);
      } catch (e) {
        console.error('Failed to load other channels:', e);
      }
      setLoading(false);
    };
    fetchStreamData();
  }, [id]);

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </MainLayout>
    );
  }

  if (!stream) {
    return (
      <MainLayout>
        <div className="text-center py-20">
          <h2 className="text-2xl md:text-3xl font-black mb-4 text-netflix-red uppercase tracking-wider font-display">Saluran Tidak Ditemukan</h2>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2.5 bg-primary text-dark font-black rounded-xl hover:scale-105 transition-all uppercase text-xs tracking-wider cursor-pointer"
          >
            Kembali ke Beranda
          </button>
        </div>
      </MainLayout>
    );
  }

  const otherChannels = [...sportsTv, ...liveTv].filter(c => c.id !== stream.id);

  const getMatchStatus = (ch: PlayableStream) => {
    if (!ch.jadwal_event) return { status: 'playable' as const, timeLeft: '' };
    const start = parseJadwal(ch.jadwal_event);
    const stop = parseJadwal(ch.jadwal_stop);
    const playableStart = new Date(start.getTime() - 30 * 60 * 1000);
    const now = new Date();

    if (now > stop) {
      return { status: 'finished' as const, timeLeft: 'Selesai' };
    } else if (now < playableStart) {
      const diff = start.getTime() - now.getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 60) {
        return { status: 'upcoming' as const, timeLeft: `${mins} mnt lagi`, isStartingSoon: true };
      }
      const hours = Math.floor(diff / 3600000);
      if (hours < 24) {
        return { status: 'upcoming' as const, timeLeft: `${hours} jam lagi` };
      }
      const days = Math.floor(hours / 24);
      return { status: 'upcoming' as const, timeLeft: `${days} hari lagi` };
    } else {
      return { status: 'playable' as const, timeLeft: 'LIVE' };
    }
  };

  const otherMatches = matches
    .filter(ch => ch.id !== stream.id)
    .map(ch => {
      const info = getMatchStatus(ch);
      return { ...ch, matchInfo: info };
    })
    .filter(ch => ch.matchInfo.status !== 'finished')
    .sort((a, b) => {
      if (a.matchInfo.status === 'playable' && b.matchInfo.status !== 'playable') return -1;
      if (a.matchInfo.status !== 'playable' && b.matchInfo.status === 'playable') return 1;

      const timeA = a.jadwal_event ? parseJadwal(a.jadwal_event).getTime() : 0;
      const timeB = b.jadwal_event ? parseJadwal(b.jadwal_event).getTime() : 0;
      return timeA - timeB;
    });

  return (
    <MainLayout>
      <div className="max-w-[1440px] mx-auto w-full space-y-6 md:space-y-8 pb-10 px-2 sm:px-4">

        {/* Header Breadcrumbs & Controls */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-all group py-2.5 px-4 bg-zinc-900/50 hover:bg-zinc-800/60 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-widest cursor-pointer select-none"
          >
            <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            <span>KEMBALI</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="py-2.5 px-4 text-zinc-400 hover:text-primary transition-all bg-zinc-900/50 hover:bg-zinc-800/60 rounded-xl border border-white/5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest cursor-pointer select-none"
            >
              <Share2 size={14} />
              <span>{copied ? 'Tersalin' : 'Bagikan'}</span>
            </button>
          </div>
        </div>

        {/* Responsive Grid layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Left Main Stream Section (8 columns on desktop) */}
          <div className="lg:col-span-8 space-y-6 md:space-y-8">

            {/* Embedded Player */}
            <div className="overflow-hidden rounded-3xl border border-white/5 shadow-2xl">
              {matchStatus === 'playable' ? (
                <VideoPlayer servers={stream.servers} />
              ) : matchStatus === 'finished' ? (
                <div className="aspect-video bg-zinc-950/85 backdrop-blur-xl border border-white/5 rounded-3xl flex flex-col items-center justify-center p-6 text-center select-none space-y-4 shadow-inner">
                  <div className="w-14 h-14 rounded-full bg-zinc-800/40 border border-zinc-700/50 flex items-center justify-center text-zinc-400">
                    <Lock size={24} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg md:text-xl font-display font-black uppercase tracking-tight text-white italic">
                      Pertandingan Selesai
                    </h3>
                    <p className="text-[10px] sm:text-xs text-zinc-500 font-bold max-w-md">
                      Siaran langsung pertandingan ini telah berakhir. Silakan pilih World Cup TV untuk tetap menyaksikan siaran langsung.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/watch/worldcup-tv')}
                    className="px-5 py-2 bg-primary text-dark font-black text-[10px] uppercase tracking-wider rounded-xl hover:scale-105 transition-transform cursor-pointer"
                  >
                    Tonton World Cup TV
                  </button>
                </div>
              ) : (
                <div className="aspect-video bg-zinc-950/85 backdrop-blur-xl border border-white/5 rounded-3xl flex flex-col items-center justify-center p-6 text-center select-none space-y-5 sm:space-y-6 shadow-inner relative overflow-hidden">
                  <div className="absolute -top-20 -right-20 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />

                  <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full text-[9px] font-black uppercase tracking-widest">
                    <Calendar size={12} />
                    <span>Belum Dimulai</span>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-base sm:text-xl font-display font-black uppercase tracking-tight text-white">
                      {stream.name}
                    </h3>
                    <p className="text-[10px] sm:text-xs text-zinc-400 font-bold uppercase tracking-wider">
                      Kickoff: {stream.jadwal_event ? formatMatchTime(parseJadwal(stream.jadwal_event)) : ''}
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                      Siaran Live Dibuka 30 Menit Sebelum Kickoff
                    </p>
                  </div>

                  {/* Countdown Timer */}
                  <div className="flex items-center gap-2 sm:gap-3 font-display">
                    {matchTimeLeft.days > 0 && (
                      <>
                        <div className="flex flex-col items-center">
                          <div className="w-10 h-10 sm:w-14 sm:h-14 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-sm sm:text-lg font-black text-white font-mono">
                            {matchTimeLeft.days}
                          </div>
                          <span className="text-[8px] sm:text-[9px] font-black uppercase text-zinc-500 tracking-wider mt-1">Hari</span>
                        </div>
                        <span className="text-lg sm:text-xl font-black text-zinc-700 -translate-y-2">:</span>
                      </>
                    )}
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 sm:w-14 sm:h-14 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-sm sm:text-lg font-black text-white font-mono">
                        {String(matchTimeLeft.hours).padStart(2, '0')}
                      </div>
                      <span className="text-[8px] sm:text-[9px] font-black uppercase text-zinc-500 tracking-wider mt-1">Jam</span>
                    </div>
                    <span className="text-lg sm:text-xl font-black text-zinc-700 -translate-y-2">:</span>
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 sm:w-14 sm:h-14 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-sm sm:text-lg font-black text-white font-mono">
                        {String(matchTimeLeft.minutes).padStart(2, '0')}
                      </div>
                      <span className="text-[8px] sm:text-[9px] font-black uppercase text-zinc-500 tracking-wider mt-1">Menit</span>
                    </div>
                    <span className="text-lg sm:text-xl font-black text-zinc-700 -translate-y-2">:</span>
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 sm:w-14 sm:h-14 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-sm sm:text-lg font-black text-white font-mono">
                        {String(matchTimeLeft.seconds).padStart(2, '0')}
                      </div>
                      <span className="text-[8px] sm:text-[9px] font-black uppercase text-zinc-500 tracking-wider mt-1">Detik</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Stream info detail box */}
            <div className="glass-card rounded-[2rem] p-6 md:p-8 relative overflow-hidden">
              <div className="absolute top-6 right-6 select-none flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-[#e50914]/10 text-[#e50914] border border-[#e50914]/20 rounded-full text-[9px] font-black uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#e50914] animate-pulse" />
                  <span>{getFormattedViewers(stream.id)} WATCHING</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[9px] font-black uppercase tracking-widest hidden sm:flex">
                  <Wifi size={12} className="animate-pulse" />
                  <span>ONLINE</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8 select-none">
                {!stream.isChannel ? (
                  <div className="flex items-center -space-x-4 select-none shrink-0">
                    <div className="h-16 w-16 bg-zinc-900 rounded-2xl flex items-center justify-center p-2 border border-white/10 overflow-hidden shadow-lg">
                      <img src={stream.logo || "https://flagcdn.com/w80/un.png"} alt={stream.player1} className="w-full h-full object-contain filter brightness-110" />
                    </div>
                    <div className="h-16 w-16 bg-zinc-900 rounded-2xl flex items-center justify-center p-2 border border-white/10 overflow-hidden shadow-lg z-10">
                      <img src={stream.logo2 || "https://flagcdn.com/w80/un.png"} alt={stream.player2} className="w-full h-full object-contain filter brightness-110" />
                    </div>
                  </div>
                ) : stream.isBase64Logo && stream.logo ? (
                  <div className="h-16 w-24 bg-white/5 rounded-2xl flex items-center justify-center p-2 border border-white/5 overflow-hidden shrink-0">
                    <img src={stream.logo} alt={stream.name} className="h-full max-w-full object-contain filter brightness-110" />
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center p-3 border border-white/5 shrink-0">
                    <img src={stream.logo || "https://flagcdn.com/w80/un.png"} alt={stream.name} className="w-full h-full object-contain filter brightness-110" />
                  </div>
                )}
                <div>
                  <h1 className="text-2xl md:text-3xl font-display font-black tracking-tight text-white leading-tight">{stream.name}</h1>
                  <p className="text-sm md:text-base text-primary font-bold italic mt-1.5">{stream.subName}</p>
                  <div className="flex items-center gap-2.5 mt-3.5">
                    <span className="px-2.5 py-1 bg-white/5 border border-white/5 rounded-lg text-[9px] font-black text-zinc-400 uppercase tracking-wider">
                      {stream.isChannel ? 'Saluran TV' : 'Live Match'}
                    </span>
                    <span className="px-2.5 py-1 bg-white/5 border border-white/5 rounded-lg text-[9px] font-black text-zinc-400 uppercase tracking-wider">
                      1080p Ultra HD
                    </span>
                  </div>
                </div>
              </div>

              {/* Stream Specs grid */}
              <div className="pt-6 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center select-none">
                <StatItem label="Bitrate" value={liveBitrate} />
                <StatItem label="Latensi" value={liveLatency} />
                <StatItem label="Format" value={stream.servers[0]?.type.toUpperCase() || 'HLS'} />
                <StatItem label="Penonton" value={`${getFormattedViewers(stream.id)} Live`} />
              </div>
            </div>
          </div>

          {/* Right Sidebar Quick Switcher Section (4 columns on desktop) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="glass-card rounded-[2rem] p-6 flex flex-col max-h-[520px] md:max-h-[620px] relative overflow-hidden">
              {/* Tab Selector Segment Control */}
              <div className="flex bg-zinc-950/60 p-1 rounded-[1.25rem] border border-white/5 gap-1 select-none mb-6">
                <button
                  onClick={() => setActiveTab('channels')}
                  className={`flex-1 py-2 text-center text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${activeTab === 'channels'
                    ? 'bg-primary text-dark font-black shadow-lg shadow-primary/10'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                  Saluran TV
                </button>
                <button
                  onClick={() => setActiveTab('matches')}
                  className={`flex-1 py-2 text-center text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === 'matches'
                    ? 'bg-primary text-dark font-black shadow-lg shadow-primary/10'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                  Jadwal Live
                  {otherMatches.filter(m => m.matchInfo.status === 'playable').length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-netflix-red animate-pulse" />
                  )}
                </button>
              </div>

              {/* Scrollable list */}
              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
                {activeTab === 'channels' ? (
                  otherChannels.length === 0 ? (
                    <p className="text-zinc-600 text-xs font-bold text-center py-10 uppercase tracking-wider select-none">Tidak ada saluran lain</p>
                  ) : (
                    otherChannels.map((ch) => (
                      <div
                        key={ch.id}
                        onClick={() => navigate(`/watch/${slugify(ch.name)}`)}
                        className="flex items-center justify-between p-3.5 bg-zinc-950/40 hover:bg-zinc-900/50 border border-white/5 hover:border-white/10 rounded-[1.25rem] transition-all duration-300 cursor-pointer group select-none"
                      >
                        <div className="flex items-center gap-3.5 truncate">
                          {ch.isBase64Logo && ch.logo ? (
                            <div className="h-10 w-14 bg-white/5 rounded-xl flex items-center justify-center p-1.5 border border-white/5 overflow-hidden shrink-0 group-hover:border-primary/20 transition-all duration-300">
                              <img src={ch.logo} alt={ch.name} className="h-full max-w-full object-contain filter brightness-110" />
                            </div>
                          ) : (
                            <div className="h-10 w-10 bg-white/5 rounded-xl flex items-center justify-center p-2 border border-white/5 shrink-0 group-hover:border-primary/20 transition-all duration-300">
                              <img src={ch.logo || "https://flagcdn.com/w80/un.png"} alt={ch.name} className="w-full h-full object-contain filter brightness-110" />
                            </div>
                          )}
                          <div className="truncate">
                            <h5 className="text-xs sm:text-sm font-black text-white group-hover:text-primary transition-colors truncate">{ch.name}</h5>
                            <p className="text-[10px] text-zinc-500 font-bold truncate uppercase tracking-wider mt-1">{ch.subName}</p>
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-white/5 text-zinc-400 group-hover:bg-primary group-hover:text-dark flex items-center justify-center transition-all duration-300 shadow shrink-0">
                          <Play size={12} fill="none" className="ml-0.5 group-hover:fill-dark transition-all" />
                        </div>
                      </div>
                    ))
                  )
                ) : (
                  otherMatches.length === 0 ? (
                    <p className="text-zinc-600 text-xs font-bold text-center py-10 uppercase tracking-wider select-none">Tidak ada jadwal pertandingan</p>
                  ) : (
                    otherMatches.map((ch) => {
                      const isLive = ch.matchInfo.status === 'playable';
                      const isSoon = ch.matchInfo.isStartingSoon;
                      return (
                        <div
                          key={ch.id}
                          onClick={() => navigate(`/watch/${slugify(ch.name)}-${ch.id}`)}
                          className={`flex items-center justify-between p-3.5 border rounded-[1.25rem] transition-all duration-300 cursor-pointer group select-none ${isLive
                            ? 'bg-primary/[0.03] border-primary/20 hover:border-primary/45 shadow-lg shadow-primary/5'
                            : isSoon
                              ? 'bg-amber-500/[0.03] border-amber-500/20 hover:border-amber-500/45'
                              : 'bg-zinc-950/40 border-white/5 hover:border-white/10 hover:bg-zinc-900/50'
                            }`}
                        >
                          <div className="flex items-center gap-3.5 truncate">
                            <div className="flex items-center -space-x-3 shrink-0 select-none">
                              <div className="h-8 w-8 bg-zinc-900 rounded-xl flex items-center justify-center p-1.5 border border-white/10 overflow-hidden shadow-md group-hover:border-primary/20 transition-all duration-300">
                                <img
                                  src={ch.logo || "https://flagcdn.com/w80/un.png"}
                                  alt={ch.player1 || 'Home'}
                                  className="w-full h-full object-contain filter brightness-110"
                                />
                              </div>
                              <div className="h-8 w-8 bg-zinc-900 rounded-xl flex items-center justify-center p-1.5 border border-white/10 overflow-hidden shadow-md z-10 group-hover:border-primary/20 transition-all duration-300">
                                <img
                                  src={ch.logo2 || "https://flagcdn.com/w80/un.png"}
                                  alt={ch.player2 || 'Away'}
                                  className="w-full h-full object-contain filter brightness-110"
                                />
                              </div>
                            </div>
                            <div className="truncate">
                              <h5 className="text-xs sm:text-sm font-black text-white group-hover:text-primary transition-colors truncate">
                                {ch.name}
                              </h5>
                              <p className="text-[10px] text-zinc-500 font-bold truncate uppercase tracking-wider mt-1">
                                {ch.subName}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-2">
                            {isLive ? (
                              <span className="px-2.5 py-1 bg-netflix-red/10 text-netflix-red border border-netflix-red/25 rounded-full text-[9px] font-black uppercase tracking-widest animate-pulse-live">
                                LIVE
                              </span>
                            ) : (
                              <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${isSoon
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
                                : 'bg-zinc-900/50 text-zinc-400 border border-zinc-800/35'
                                }`}>
                                {ch.matchInfo.timeLeft}
                              </span>
                            )}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 shadow ${isLive
                              ? 'bg-primary text-dark group-hover:scale-105'
                              : 'bg-white/5 text-zinc-400 group-hover:bg-primary group-hover:text-dark'
                              }`}>
                              <Play
                                size={12}
                                className="ml-0.5"
                                fill={isLive ? "currentColor" : "none"}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )
                )}
              </div>
            </div>            {/* Support Developer Box */}
            <div className="bg-gradient-to-br from-zinc-900/60 to-zinc-950/80 border border-white/5 rounded-[2rem] p-6 shadow-xl select-none relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all duration-500" />

              <h4 className="text-sm font-black mb-2 uppercase tracking-wider font-display flex items-center gap-2 text-white">
                <Coffee size={16} className="text-primary fill-primary/10 animate-bounce" />
                Beli Kopi Hangat
              </h4>

              <p className="text-zinc-400 text-[11px] font-bold leading-relaxed mb-5 uppercase tracking-wide">
                YKN TV dibuat dengan sepenuh hati. Yuk traktir developer secangkir kopi agar tetap semangat menjaga kualitas dan kestabilan server streaming!
              </p>

              <div className="flex flex-col gap-3">
                <a
                  href="https://bagibagi.co/Diaww"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-3 bg-zinc-950/40 hover:bg-[#e8a317]/5 border border-white/5 hover:border-[#e8a317]/20 rounded-2xl transition-all duration-300 group cursor-pointer"
                >
                  <div className="w-10 h-10 bg-[#e8a317]/10 group-hover:bg-[#e8a317]/20 rounded-xl flex items-center justify-center border border-[#e8a317]/20 transition-all shrink-0">
                    <Gift size={20} className="text-[#e8a317]" />
                  </div>
                  <div className="text-left truncate">
                    <span className="block text-xs font-black text-white group-hover:text-[#e8a317] transition-colors uppercase tracking-wider truncate">
                      BagiBagi (Local ID)
                    </span>
                    <span className="block text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5 truncate">
                      Traktir via Qris / E-Wallet
                    </span>
                  </div>
                </a>

                <a
                  href="https://ko-fi.com/diaww14"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-3 bg-zinc-950/40 hover:bg-[#13C3FF]/5 border border-white/5 hover:border-[#13C3FF]/20 rounded-2xl transition-all duration-300 group cursor-pointer"
                >
                  <div className="w-10 h-10 bg-[#13C3FF]/10 group-hover:bg-[#13C3FF]/20 rounded-xl flex items-center justify-center border border-[#13C3FF]/20 transition-all shrink-0">
                    <Coffee size={20} className="text-[#13C3FF]" />
                  </div>
                  <div className="text-left truncate">
                    <span className="block text-xs font-black text-white group-hover:text-[#13C3FF] transition-colors uppercase tracking-wider truncate">
                      Ko-fi (Global)
                    </span>
                    <span className="block text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5 truncate">
                      Support via Paypal / Card
                    </span>
                  </div>
                </a>
              </div>
            </div>

          </div>
        </div>
      </div>
    </MainLayout>
  );
};

const StatItem = ({ label, value }: { label: string; value: string }) => (
  <div className="text-center">
    <p className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider mb-1">{label}</p>
    <p className="text-sm font-black text-white">{value}</p>
  </div>
);

export default ChannelDetail;
