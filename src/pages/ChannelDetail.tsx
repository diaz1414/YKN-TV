import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import VideoPlayer from '../components/VideoPlayer';
import { getStreamById, getLiveSportsData, slugify, type PlayableStream } from '../services/streamService';
import { ChevronLeft, Wifi, Share2, Play, Calendar, Lock, MessageSquare, Shuffle, Send, Trophy, ExternalLink } from 'lucide-react';
import { supabase } from '../services/supabase';
import { SupportCard } from '../components/SupportDeveloper';
import { io } from 'socket.io-client';
import yknwcLogo from '../assets/yknwc-logo.png';

const ChannelDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [stream, setStream] = useState<PlayableStream | null>(null);
  const [sportsTv, setSportsTv] = useState<PlayableStream[]>([]);
  const [liveTv, setLiveTv] = useState<PlayableStream[]>([]);
  const [copied, setCopied] = useState(false);
  const [matchTimeLeft, setMatchTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [matchStatus, setMatchStatus] = useState<'playable' | 'upcoming' | 'finished'>('playable');
  const [kickoffSecondsLeft, setKickoffSecondsLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<PlayableStream[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'channels' | 'matches'>('chat');
  const [channelSubTab, setChannelSubTab] = useState<'all' | 'sports' | 'general'>('all');

  // Socket.io live chat state
  const [socket, setSocket] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [nickname, setNickname] = useState('');
  const [chatAvatar, setChatAvatar] = useState('');
  const [connected, setConnected] = useState(false);
  const [participantsCount, setParticipantsCount] = useState(1);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [tempNickname, setTempNickname] = useState('');
  const [isJoined, setIsJoined] = useState(!!localStorage.getItem('ykn_chat_nickname'));
  const [joinError, setJoinError] = useState('');

  const chatContainerRef = useRef<HTMLDivElement>(null);

  const generateRandomNickname = () => {
    const randomId = Math.floor(1000 + Math.random() * 9000);
    const prefixes = [
      'Suporter', 'Pendukung', 'Fans', 'Kiper', 'Striker', 'Gelandang', 'Bek',
      'Winger', 'Playmaker', 'Sobat', 'Squad', 'Komentator', 'Wasit', 'Ultras', 'Kolektor'
    ];
    const nouns = [
      'Garuda', 'MerahPutih', 'Bola', 'Gawang', 'Tribun', 'Lapangan', 'Sepatu',
      'Jersei', 'Peluit', 'Piala', 'Kapten', 'Stadion', 'YKN', 'Nusantara'
    ];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${prefix} ${noun} #${randomId}`;
  };

  useEffect(() => {
    // Scroll to top when entering a new channel/match detail page
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id]);

  useEffect(() => {
    if (stream) {
      // Default to live chat if playable, else default to scheduling/channels
      if (matchStatus === 'playable') {
        setActiveTab('chat');
      } else {
        setActiveTab(stream.isChannel ? 'channels' : 'matches');
      }
    }
  }, [stream, matchStatus]);

  useEffect(() => {
    if (!stream) return;

    const savedNickname = localStorage.getItem('ykn_chat_nickname');
    const savedAvatar = localStorage.getItem('ykn_chat_avatar');

    if (savedNickname) {
      setNickname(savedNickname);
      setChatAvatar(savedAvatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(savedNickname)}`);
      setIsJoined(true);
    } else {
      const suggestion = generateRandomNickname();
      setTempNickname(suggestion);
      setIsJoined(false);
    }

    const isProduction = import.meta.env.PROD;
    const socketUrl = isProduction ? window.location.origin : 'http://147.135.252.68:20114';
    const newSocket = io(socketUrl, {
      transports: isProduction ? ['polling'] : ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000
    });

    newSocket.on('connect', () => {
      console.log('[Socket] Connected!');
      setConnected(true);

      if (savedNickname) {
        newSocket.emit('join_room', {
          roomId: stream.id,
          username: savedNickname,
          avatar: savedAvatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(savedNickname)}`,
          role: 'user'
        });
      } else {
        // Connect in read-only mode first to view messages
        newSocket.emit('join_room', {
          roomId: stream.id,
          username: 'Penonton',
          avatar: '',
          role: 'reader'
        });
      }
    });

    newSocket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      setConnected(false);
    });

    newSocket.on('chat_history', (history: any[]) => {
      setChatMessages(history);
    });

    newSocket.on('receive_message', (msgObj: any) => {
      setChatMessages(prev => {
        if (prev.some(m => m.id === msgObj.id)) return prev;
        const next = [...prev, msgObj];
        if (next.length > 50) next.shift();
        return next;
      });
    });

    newSocket.on('room_participants_count', (count: number) => {
      setParticipantsCount(count);
    });

    newSocket.on('join_success', ({ username, avatar }: { username: string; avatar: string }) => {
      setNickname(username);
      setChatAvatar(avatar);
      setIsJoined(true);
      setShowJoinModal(false);
      setJoinError('');
      localStorage.setItem('ykn_chat_nickname', username);
      localStorage.setItem('ykn_chat_avatar', avatar);
    });

    newSocket.on('join_error', ({ message }: { message: string }) => {
      setJoinError(message);
      setIsJoined(false);
      localStorage.removeItem('ykn_chat_nickname');
      localStorage.removeItem('ykn_chat_avatar');
      setShowJoinModal(true);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [stream?.id]);

  const handleConfirmJoin = (newNick: string) => {
    if (!newNick.trim()) return;
    let cleanNick = newNick.trim().substring(0, 25);
    let avatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(cleanNick)}`;

    // Special Admin Passcode handler
    if (cleanNick === 'YKNTV#admin123') {
      cleanNick = 'YKN TV';
      avatar = yknwcLogo;
    }

    setJoinError('');

    if (socket && connected && stream) {
      socket.emit('join_room', {
        roomId: stream.id,
        username: cleanNick,
        avatar: avatar,
        role: 'user'
      });
    }
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || !socket || !connected || !stream || !isJoined) return;

    socket.emit('send_message', {
      roomId: stream.id,
      username: nickname,
      message: chatInput.trim(),
      avatar: chatAvatar,
      role: 'user'
    });

    setChatInput('');
  };

  const handleSendReaction = (emoji: string) => {
    if (!socket || !connected || !stream || !isJoined) return;
    socket.emit('send_message', {
      roomId: stream.id,
      username: nickname,
      message: emoji,
      avatar: chatAvatar,
      role: 'user'
    });
  };

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    // Scroll instantly on initial switch or when page changes
    scrollToBottom();
  }, [activeTab]);

  useEffect(() => {
    // When messages arrive, scroll to bottom
    scrollToBottom();
  }, [chatMessages]);

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
    const playableEnd = new Date(stop.getTime() + 30 * 60 * 1000); // 30 minutes after stop

    const checkTime = () => {
      const now = new Date();
      if (now > playableEnd) {
        setMatchStatus('finished');
        setKickoffSecondsLeft(null);
      } else if (now < playableStart) {
        setMatchStatus('upcoming');
        const diff = playableStart.getTime() - now.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / 1000 / 60) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        setMatchTimeLeft({ days, hours, minutes, seconds });
        setKickoffSecondsLeft(null);
      } else {
        setMatchStatus('playable');
        if (now < start) {
          const diff = start.getTime() - now.getTime();
          setKickoffSecondsLeft(Math.floor(diff / 1000));
        } else {
          setKickoffSecondsLeft(null);
        }
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

  const otherChannels = [...sportsTv, ...liveTv];
  const filteredOtherChannels = channelSubTab === 'sports'
    ? sportsTv
    : channelSubTab === 'general'
      ? liveTv
      : otherChannels;

  const getMatchStatus = (ch: PlayableStream) => {
    if (!ch.jadwal_event) return { status: 'playable' as const, timeLeft: '', isFinishedMatch: false };
    const start = parseJadwal(ch.jadwal_event);
    const stop = parseJadwal(ch.jadwal_stop);
    const playableStart = new Date(start.getTime() - 30 * 60 * 1000);
    const playableEnd = new Date(stop.getTime() + 30 * 60 * 1000);
    const now = new Date();

    if (now > playableEnd) {
      return { status: 'finished' as const, timeLeft: 'Selesai', isFinishedMatch: true };
    } else if (now < playableStart) {
      const diff = start.getTime() - now.getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 60) {
        return { status: 'upcoming' as const, timeLeft: `${mins} mnt lagi`, isStartingSoon: true, isFinishedMatch: false };
      }
      const hours = Math.floor(diff / 3600000);
      if (hours < 24) {
        return { status: 'upcoming' as const, timeLeft: `${hours} jam lagi`, isFinishedMatch: false };
      }
      const days = Math.floor(hours / 24);
      return { status: 'upcoming' as const, timeLeft: `${days} hari lagi`, isFinishedMatch: false };
    } else {
      if (now > stop) {
        return { status: 'playable' as const, timeLeft: 'Selesai', isFinishedMatch: true };
      }
      return { status: 'playable' as const, timeLeft: 'LIVE', isFinishedMatch: false };
    }
  };

  const otherMatches = matches
    .map(ch => {
      const info = getMatchStatus(ch);
      return { ...ch, matchInfo: info };
    })
    .filter(ch => ch.matchInfo.status !== 'finished')
    .sort((a, b) => {
      const aFinished = a.matchInfo.isFinishedMatch;
      const bFinished = b.matchInfo.isFinishedMatch;

      // If one is finished and the other is not, the finished one goes to the bottom
      if (aFinished && !bFinished) return 1;
      if (!aFinished && bFinished) return -1;

      // If both are finished, or both are not finished, sort by status then time
      if (a.matchInfo.status === b.matchInfo.status) {
        const timeA = a.jadwal_event ? parseJadwal(a.jadwal_event).getTime() : 0;
        const timeB = b.jadwal_event ? parseJadwal(b.jadwal_event).getTime() : 0;
        return timeA - timeB;
      }
      if (a.matchInfo.status === 'playable') return -1;
      if (b.matchInfo.status === 'playable') return 1;
      return 0;
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
                <div className="min-h-[280px] sm:aspect-video bg-zinc-950/85 backdrop-blur-xl border border-white/5 rounded-3xl flex flex-col items-center justify-center p-5 sm:p-8 text-center select-none gap-4 shadow-inner relative overflow-hidden">
                  <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-zinc-800/40 border border-zinc-700/50 flex items-center justify-center text-zinc-400 shrink-0">
                    <Lock size={20} />
                  </div>
                  <div className="space-y-2 max-w-xs sm:max-w-sm">
                    <h3 className="text-base sm:text-lg md:text-xl font-display font-black uppercase tracking-tight text-white italic">
                      Pertandingan Selesai
                    </h3>
                    <p className="text-[10px] sm:text-xs text-zinc-400 font-bold leading-relaxed">
                      Pertandingan ini telah usai. Masih ingin menikmati serunya Piala Dunia?{' '}
                      <span className="text-primary">Yuk, lanjut nonton lewat Channel World Cup TV</span> yang masih mengudara!
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/watch/worldcup-tv')}
                    className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-primary text-dark font-black text-[9px] sm:text-[10px] uppercase tracking-wider rounded-xl hover:scale-105 hover:shadow-[0_0_20px_rgba(212,175,55,0.35)] active:scale-95 transition-all cursor-pointer shrink-0"
                  >
                    <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" viewBox="0 0 24 24"><path d="M21 3L3 10.53v.98l6.84 2.65L12.48 21h.98L21 3z" /></svg>
                    Tonton Channel World Cup TV
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

            {/* Kickoff Countdown Banner */}
            {kickoffSecondsLeft !== null && kickoffSecondsLeft > 0 && (
              <div className="bg-[#090909]/95 backdrop-blur-md border-l-4 border-l-amber-500 border-y border-r border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xl shadow-black/40 select-none">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                  <span className="bg-amber-500 text-black px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-md shadow-amber-500/10 shrink-0">
                    INFO KICKOFF
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-300 font-bold flex-wrap">
                  <span>Pertandingan dimulai dalam</span>
                  {Math.floor(kickoffSecondsLeft / 60) > 0 && (
                    <>
                      <span className="text-amber-400 font-mono font-black text-sm bg-white/5 px-2.5 py-0.5 rounded-lg border border-white/5 shadow-inner">
                        {Math.floor(kickoffSecondsLeft / 60)}
                      </span>
                      <span>menit</span>
                    </>
                  )}
                  <span className="text-amber-400 font-mono font-black text-sm bg-white/5 px-2.5 py-0.5 rounded-lg border border-white/5 shadow-inner">
                    {kickoffSecondsLeft % 60}
                  </span>
                  <span>detik</span>
                </div>
              </div>
            )}

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
            <div className="glass-card rounded-[2rem] p-4 sm:p-6 flex flex-col h-[480px] sm:h-[520px] lg:h-[620px] relative overflow-hidden">
              {/* Tab Selector Segment Control */}
              <div className="flex bg-zinc-950/60 p-1 rounded-[1.25rem] border border-white/5 gap-1 select-none mb-4 shrink-0">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`flex-1 py-2 text-center text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${activeTab === 'chat'
                    ? 'bg-primary text-dark font-black shadow-lg shadow-primary/10'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                  <span>Chat</span>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${connected ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
                    <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${connected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('channels')}
                  className={`flex-1 py-2 text-center text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${activeTab === 'channels'
                    ? 'bg-primary text-dark font-black shadow-lg shadow-primary/10'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                  Saluran
                </button>
                <button
                  onClick={() => setActiveTab('matches')}
                  className={`flex-1 py-2 text-center text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${activeTab === 'matches'
                    ? 'bg-primary text-dark font-black shadow-lg shadow-primary/10'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                  <span>Jadwal</span>
                  {otherMatches.filter(m => m.matchInfo.status === 'playable').length > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-netflix-red animate-pulse" />
                  )}
                </button>
              </div>

              {/* Sub-tab pills — only visible on Saluran TV tab */}
              {activeTab === 'channels' && (
                <div className="flex bg-zinc-950/50 p-0.5 rounded-xl border border-white/5 gap-0.5 select-none mb-3 shrink-0">
                  {([
                    { key: 'all', label: 'Semua', icon: <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg> },
                    { key: 'sports', label: 'Olahraga', icon: <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg> },
                    { key: 'general', label: 'Hiburan', icon: <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="7" width="20" height="15" rx="2" /><polyline points="17 2 12 7 7 2" /></svg> },
                  ] as const).map(({ key: t, label, icon }) => (
                    <button
                      key={t}
                      onClick={() => setChannelSubTab(t)}
                      className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${channelSubTab === t
                          ? 'bg-white/10 text-white'
                          : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {/* Tab Contents */}
              {activeTab === 'chat' && (
                <div className="flex-1 flex flex-col overflow-hidden min-h-0 relative">
                  {/* Chat Stats Header */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5 select-none shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                        {connected ? 'Live Chat Terhubung' : 'Terputus...'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                      <span className="text-[10px] font-black text-white">{participantsCount} online</span>
                    </div>
                  </div>

                  {/* Nickname & Avatar bar (Only shown when joined) */}
                  {isJoined && (
                    <div className="flex items-center justify-between p-2 mb-2 bg-white/5 border border-white/5 rounded-xl text-xs select-none shrink-0">
                      <div className="flex items-center gap-2 truncate">
                        <img src={chatAvatar} alt="avatar" className="w-5 h-5 rounded-full bg-zinc-800 border border-white/10 shrink-0" />
                        <span className="font-bold text-zinc-300 truncate">
                          Sebagai: <span className="text-primary font-black">{nickname}</span>
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setTempNickname(nickname);
                          setShowJoinModal(true);
                        }}
                        className="text-[9px] font-black text-primary uppercase tracking-wider hover:underline cursor-pointer select-none"
                      >
                        Ubah
                      </button>
                    </div>
                  )}

                  {/* Messages Area (Always visible so they can read in real-time) */}
                  <div
                    ref={chatContainerRef}
                    className="flex-1 overflow-y-auto custom-scrollbar pr-1 mb-2 min-h-0 select-none"
                  >
                    <div className="min-h-full flex flex-col justify-end space-y-4 pb-2">
                      {chatMessages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-4 my-auto">
                          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 mb-2 border border-white/5 mx-auto">
                            <MessageSquare size={16} className="text-zinc-500" />
                          </div>
                          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Belum ada obrolan</p>
                          <p className="text-zinc-600 text-[9px] font-bold mt-1">Mulai obrolan pertama kamu!</p>
                        </div>
                      ) : (
                        chatMessages.map((msg) => {
                          if (msg.role === 'system') {
                            return (
                              <div key={msg.id} className="text-center py-0.5">
                                <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-950/40 px-2.5 py-0.5 rounded-full border border-white/5">
                                  {msg.message}
                                </span>
                              </div>
                            );
                          }

                          const isMe = msg.username === nickname;
                          const isAdmin = msg.username === 'YKN TV' || (msg.avatar && msg.avatar.includes('yknwc-logo'));

                          const getNameColor = (name: string) => {
                            if (name === nickname) return 'text-primary';
                            const colors = [
                              'text-emerald-400',
                              'text-sky-400',
                              'text-indigo-400',
                              'text-purple-400',
                              'text-pink-400',
                              'text-orange-400',
                              'text-amber-400',
                              'text-cyan-400',
                              'text-teal-400'
                            ];
                            let hash = 0;
                            for (let i = 0; i < name.length; i++) {
                              hash = name.charCodeAt(i) + ((hash << 5) - hash);
                            }
                            return colors[Math.abs(hash) % colors.length];
                          };

                          return (
                            <div key={msg.id} className={`flex items-start gap-2.5 max-w-full ${isMe ? 'flex-row-reverse' : ''}`}>
                              <img
                                src={msg.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(msg.username)}`}
                                alt="avatar"
                                className="w-7 h-7 rounded-full bg-zinc-900 border border-white/10 shrink-0 select-none mt-1"
                              />
                              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%] min-w-[80px]`}>
                                {/* Username */}
                                <span className={`text-[9.5px] font-black mb-1 px-1 flex items-center gap-1.5 ${
                                  isAdmin
                                    ? 'text-primary drop-shadow-[0_0_8px_rgba(212,175,55,0.45)]'
                                    : isMe
                                      ? 'text-primary'
                                      : getNameColor(msg.username)
                                }`}>
                                  {isMe ? (isAdmin ? 'Admin (Anda)' : 'Anda') : msg.username}
                                  {isAdmin && (
                                    <span className="px-1 py-0.2 bg-primary text-dark font-black text-[7px] uppercase tracking-widest rounded flex items-center justify-center scale-90">
                                      HOST
                                    </span>
                                  )}
                                </span>
                                {/* Bubble */}
                                <div className={`px-3 py-2 rounded-2xl text-xs font-bold leading-relaxed break-words w-full ${
                                  isAdmin
                                    ? `bg-primary/15 border border-primary/35 text-zinc-100 shadow-[0_0_12px_rgba(212,175,55,0.1)] ${isMe ? 'rounded-tr-none' : 'rounded-tl-none'}`
                                    : isMe
                                      ? 'bg-primary/10 border border-primary/20 text-zinc-100 rounded-tr-none'
                                      : 'bg-zinc-900/90 border border-white/5 text-zinc-200 rounded-tl-none'
                                }`}>
                                  <p className="break-words whitespace-pre-wrap">
                                    {(() => {
                                      const text = msg.message;
                                      const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
                                      const parts = text.split(urlRegex);
                                      if (parts.length === 1) return text;
                                      return parts.map((part: string, index: number) => {
                                        if (urlRegex.test(part)) {
                                          const href = part.startsWith('http') ? part : `https://${part}`;
                                          return (
                                            <a
                                              key={index}
                                              href={href}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-primary hover:underline font-black inline-flex items-center gap-0.5"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              {part}
                                              <ExternalLink size={10} className="inline shrink-0" />
                                            </a>
                                          );
                                        }
                                        return part;
                                      });
                                    })()}
                                   </p>
                                   <div className="text-right mt-1 select-none leading-none h-2">
                                     <span className="text-[7.5px] text-zinc-500 font-mono font-bold">
                                       {new Date(msg.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                     </span>
                                   </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Input area or Join Banner based on status */}
                  {isJoined ? (
                    <>
                      {/* Quick Reactions Bar */}
                      <div className="flex items-center gap-1.5 overflow-x-auto py-2 px-1 mb-2 shrink-0 select-none custom-scrollbar-horizontal border-t border-white/5">
                        {['⚽', '🔥', '🏆', '👏', '😮', '😂', '👑', '🐐', '⚡', '❤️'].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleSendReaction(emoji)}
                            disabled={!connected}
                            className="w-8 h-8 rounded-full bg-zinc-950/60 hover:bg-primary/20 hover:border-primary/30 hover:scale-115 active:scale-90 border border-white/5 flex items-center justify-center text-base transition-all duration-200 cursor-pointer shrink-0 disabled:opacity-30 disabled:pointer-events-none hover:shadow-[0_0_12px_rgba(212,175,55,0.25)]"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>

                      {/* Chat Input Form */}
                      <form onSubmit={handleSendMessage} className="flex gap-2 shrink-0">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder={connected ? "Ketik pesan..." : "Menghubungkan obrolan..."}
                          disabled={!connected}
                          maxLength={150}
                          className="flex-1 bg-zinc-950/70 border border-white/5 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-zinc-500 focus:outline-none focus:border-primary/50 transition-all disabled:opacity-50"
                        />
                        <button
                          type="submit"
                          disabled={!connected || !chatInput.trim()}
                          className="bg-primary text-dark font-black hover:scale-105 active:scale-95 transition-all text-[10px] uppercase tracking-widest px-4 rounded-xl flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-45 disabled:pointer-events-none"
                        >
                          Kirim <Send size={11} />
                        </button>
                      </form>
                    </>
                  ) : (
                    /* Lock Screen Banner */
                    <div className="p-4 bg-zinc-950/70 border border-white/5 rounded-2xl text-center space-y-3 shrink-0 select-none backdrop-blur-sm shadow-inner">
                      <p className="text-[10.5px] font-bold text-zinc-400">Pilih nickname Anda untuk mengirim pesan</p>
                      <button
                        onClick={() => {
                          const suggestion = generateRandomNickname();
                          setTempNickname(suggestion);
                          setShowJoinModal(true);
                        }}
                        className="w-full py-2.5 bg-primary text-dark font-black text-[10px] uppercase tracking-widest rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-primary/20"
                      >
                        Set Nickname & Gabung
                      </button>
                    </div>
                  )}

                  {/* Join Modal Overlay */}
                  {showJoinModal && (
                    <div className="absolute inset-0 bg-zinc-950/98 backdrop-blur-md rounded-[1.25rem] p-6 flex flex-col justify-center select-none z-50 border border-white/5 animate-fade-in">
                      <div className="space-y-5">
                        <div className="text-center space-y-1.5">
                          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center text-primary mx-auto animate-bounce">
                            <Trophy size={20} className="text-primary" />
                          </div>
                          <h4 className="text-base font-display font-black uppercase tracking-wider text-white">Gabung Live Chat</h4>
                          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Tentukan nama obrolan Anda terlebih dahulu</p>
                        </div>

                        {/* Avatar Preview */}
                        <div className="flex justify-center">
                          <div className="relative">
                            <img
                              src={tempNickname === 'YKNTV#admin123' ? yknwcLogo : `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(tempNickname || 'Guest')}`}
                              alt="avatar preview"
                              className="w-16 h-16 rounded-full bg-zinc-900 border-2 border-primary/30 p-1 transition-all"
                            />
                            <span className="absolute bottom-0 right-0 w-4.5 h-4.5 bg-emerald-500 border-2 border-zinc-950 rounded-full animate-pulse" />
                          </div>
                        </div>

                        <div className="space-y-3">
                          {/* Nickname Input & Randomizer */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Nickname Anda</label>
                              <button
                                type="button"
                                onClick={() => setTempNickname(generateRandomNickname())}
                                className="text-[9px] font-black text-primary uppercase tracking-wider hover:underline flex items-center gap-1.5 cursor-pointer select-none"
                              >
                                <Shuffle size={10} />
                                <span>Acak Nama</span>
                              </button>
                            </div>
                            <input
                              type="text"
                              value={tempNickname}
                              onChange={(e) => {
                                setTempNickname(e.target.value);
                                if (joinError) setJoinError('');
                              }}
                              placeholder="Ketik nickname kamu..."
                              maxLength={20}
                              className="w-full bg-zinc-900/80 border border-white/10 rounded-xl px-4 py-3 text-xs font-black text-white focus:outline-none focus:border-primary/50 transition-all placeholder-zinc-600"
                            />
                            {joinError && (
                              <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider mt-1 px-1">
                                ⚠️ {joinError}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setShowJoinModal(false)}
                            className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-black text-[10px] uppercase tracking-widest py-3.5 rounded-xl border border-white/5 transition-all cursor-pointer"
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConfirmJoin(tempNickname)}
                            disabled={!tempNickname.trim()}
                            className="flex-1 bg-primary text-dark font-black text-[10px] uppercase tracking-widest py-3.5 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-primary/10"
                          >
                            Gabung Obrolan
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab !== 'chat' && (
                <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1 min-h-0">
                  {activeTab === 'channels' ? (
                    filteredOtherChannels.length === 0 ? (
                      <p className="text-zinc-600 text-xs font-bold text-center py-10 uppercase tracking-wider select-none">Tidak ada saluran</p>
                    ) : (
                      filteredOtherChannels.map((ch) => {
                        const isActive = ch.id === stream.id;
                        return (
                          <div
                            key={ch.id}
                            onClick={() => navigate(`/watch/${slugify(ch.name)}`)}
                            className={`flex items-center justify-between p-3.5 border rounded-[1.25rem] transition-all duration-300 cursor-pointer group select-none ${isActive
                                ? 'bg-primary/10 border-primary shadow-lg shadow-primary/5'
                                : 'bg-zinc-950/40 hover:bg-zinc-900/50 border-white/5 hover:border-white/10'
                              }`}
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
                                <h5 className={`text-xs sm:text-sm font-black transition-colors truncate ${isActive ? 'text-primary' : 'text-white group-hover:text-primary'}`}>{ch.name}</h5>
                                <p className="text-[10px] text-zinc-500 font-bold truncate uppercase tracking-wider mt-1">{ch.subName}</p>
                              </div>
                            </div>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 shadow shrink-0 ${isActive
                                ? 'bg-primary text-dark scale-105'
                                : 'bg-white/5 text-zinc-400 group-hover:bg-primary group-hover:text-dark'
                              }`}>
                              <Play size={12} fill={isActive ? 'currentColor' : 'none'} className="ml-0.5" />
                            </div>
                          </div>
                        );
                      })
                    )
                  ) : (
                    otherMatches.length === 0 ? (
                      <p className="text-zinc-600 text-xs font-bold text-center py-10 uppercase tracking-wider select-none">Tidak ada jadwal pertandingan</p>
                    ) : (
                      otherMatches.map((ch) => {
                        const isLive = ch.matchInfo.status === 'playable';
                        const isSoon = ch.matchInfo.isStartingSoon;
                        const isActive = ch.id === stream.id;
                        const isFinished = ch.matchInfo.isFinishedMatch;
                        return (
                          <div
                            key={ch.id}
                            onClick={() => navigate(`/watch/${slugify(ch.name)}-${ch.id}`)}
                            className={`flex items-center gap-3 p-3 sm:p-3.5 border rounded-[1.25rem] transition-all duration-300 cursor-pointer group select-none ${isActive
                                ? 'bg-primary/10 border-primary shadow-lg shadow-primary/5'
                                : isLive && !isFinished
                                  ? 'bg-primary/[0.03] border-primary/20 hover:border-primary/45 shadow-lg shadow-primary/5'
                                  : isSoon
                                    ? 'bg-amber-500/[0.03] border-amber-500/20 hover:border-amber-500/45'
                                    : 'bg-zinc-950/40 border-white/5 hover:border-white/10 hover:bg-zinc-900/50'
                              }`}
                          >
                            <div className="flex items-center -space-x-3 shrink-0 select-none">
                              <div className="h-8 w-8 bg-zinc-900 rounded-xl flex items-center justify-center p-1.5 border border-white/10 overflow-hidden shadow-md group-hover:border-primary/20 transition-all">
                                <img src={ch.logo || 'https://flagcdn.com/w80/un.png'} alt={ch.player1 || 'Home'} className="w-full h-full object-contain filter brightness-110" />
                              </div>
                              <div className="h-8 w-8 bg-zinc-900 rounded-xl flex items-center justify-center p-1.5 border border-white/10 overflow-hidden shadow-md z-10 group-hover:border-primary/20 transition-all">
                                <img src={ch.logo2 || 'https://flagcdn.com/w80/un.png'} alt={ch.player2 || 'Away'} className="w-full h-full object-contain filter brightness-110" />
                              </div>
                            </div>

                            <div className="flex-1 min-w-0">
                              <h5 className={`text-xs font-black transition-colors leading-snug line-clamp-2 lg:line-clamp-1 ${isActive ? 'text-primary' : 'text-white group-hover:text-primary'
                                }`}>
                                {ch.name}
                              </h5>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">{ch.subName}</p>
                                {isLive && !isFinished ? (
                                  <span className="px-2 py-0.5 bg-netflix-red/10 text-netflix-red border border-netflix-red/25 rounded-full text-[8px] font-black uppercase tracking-widest animate-pulse-live">
                                    LIVE
                                  </span>
                                ) : (
                                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${isFinished
                                      ? 'bg-zinc-800/30 text-zinc-500 border border-zinc-700/10'
                                      : isSoon
                                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
                                        : 'bg-zinc-900/50 text-zinc-400 border border-zinc-800/35'
                                    }`}>
                                    {ch.matchInfo.timeLeft}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 shadow shrink-0 ${isActive || (isLive && !isFinished)
                                ? 'bg-primary text-dark group-hover:scale-105'
                                : 'bg-white/5 text-zinc-400 group-hover:bg-primary group-hover:text-dark'
                              }`}>
                              <Play size={12} className="ml-0.5" fill={isActive || (isLive && !isFinished) ? 'currentColor' : 'none'} />
                            </div>
                          </div>
                        );
                      })
                    )
                  )}
                </div>
              )}
            </div>
            <SupportCard />

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
