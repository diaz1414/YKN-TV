import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { Key, ShieldAlert, RefreshCw, LogOut, ExternalLink, Tv, Activity, CheckCircle, Users, Radio, Search } from 'lucide-react';
import axios from 'axios';
import { getLiveSportsData, slugify, type PlayableStream } from '../services/streamService';
import yknwcLogo from '../assets/yknwc-logo.png';
import { io } from 'socket.io-client';

interface MonitorRoom {
  roomId: string;
  viewers: number;
}

// Helper functions for match schedules and statuses
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

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [passcode, setPasscode] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapeSuccess, setScrapeSuccess] = useState(false);

  // Monitoring States
  const [channels, setChannels] = useState<PlayableStream[]>([]);
  const [monitoringData, setMonitoringData] = useState<Record<string, number>>({});
  const [loadingData, setLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [monitorTab, setMonitorTab] = useState<'all' | 'channels' | 'matches'>('all');

  // Chat States for monitoring
  const [selectedChannel, setSelectedChannel] = useState<PlayableStream | null>(null);
  const [socket, setSocket] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [roomViewers, setRoomViewers] = useState(0);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Automatically scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  // Connect / disconnect to room socket.io when selected channel changes
  useEffect(() => {
    if (!isLoggedIn || !selectedChannel) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setChatMessages([]);
      setConnected(false);
      return;
    }

    const isProduction = import.meta.env.PROD;
    const socketUrl = isProduction ? window.location.origin : 'http://147.135.252.68:20114';
    const newSocket = io(socketUrl, {
      transports: isProduction ? ['polling'] : ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000
    });

    newSocket.on('connect', () => {
      setConnected(true);
      newSocket.emit('join_room', {
        roomId: selectedChannel.id,
        username: 'YKN TV',
        avatar: yknwcLogo,
        role: 'user'
      });
    });

    newSocket.on('disconnect', () => {
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
      setRoomViewers(count);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [selectedChannel?.id, isLoggedIn]);

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || !socket || !connected || !selectedChannel) return;

    socket.emit('send_message', {
      roomId: selectedChannel.id,
      username: 'YKN TV',
      message: chatInput.trim(),
      avatar: yknwcLogo,
      role: 'user'
    });

    setChatInput('');
  };

  // Check existing session
  useEffect(() => {
    const adminSession = localStorage.getItem('ykn_admin_logged_in');
    if (adminSession === 'true') {
      setIsLoggedIn(true);
    }
  }, []);

  // Fetch Channels & Real-time Active Viewers
  useEffect(() => {
    if (!isLoggedIn) return;

    const loadInitialData = async () => {
      try {
        const data = await getLiveSportsData();
        // Combine all channels and matches
        const allChannels = [
          ...data.sportsTv.map(c => ({ ...c, isChannel: true })),
          ...data.liveTv.map(c => ({ ...c, isChannel: true })),
          ...data.matches.map(m => ({ ...m, isChannel: false }))
        ];
        setChannels(allChannels);
      } catch (err) {
        console.error('Failed to load channels for monitoring:', err);
      }
    };

    const fetchRealtimeViewers = async () => {
      try {
        const isProd = import.meta.env.PROD;
        const apiBase = isProd ? '' : 'http://147.135.252.68:20114';
        const res = await axios.get<MonitorRoom[]>(`${apiBase}/api/sports/monitoring`);

        // Convert array to record mapping: roomId -> viewers
        const mapping: Record<string, number> = {};
        res.data.forEach(room => {
          mapping[room.roomId] = room.viewers;
        });

        setMonitoringData(mapping);
      } catch (err) {
        console.error('Failed to fetch real-time monitoring data:', err);
      } finally {
        setLoadingData(false);
      }
    };

    loadInitialData();
    fetchRealtimeViewers();

    // Set real-time refresh interval every 4 seconds
    const interval = setInterval(fetchRealtimeViewers, 4000);
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Admin passcode check
    if (passcode === 'Ferdiaz140104') {
      localStorage.setItem('ykn_admin_logged_in', 'true');
      localStorage.setItem('ykn_chat_nickname', 'YKN TV');
      localStorage.setItem('ykn_chat_avatar', yknwcLogo);
      setIsLoggedIn(true);
      setError('');
    } else {
      setError('Kode akses salah! Hubungi developer jika lupa.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ykn_admin_logged_in');
    localStorage.removeItem('ykn_chat_nickname');
    localStorage.removeItem('ykn_chat_avatar');
    setIsLoggedIn(false);
    setPasscode('');
    navigate('/');
  };

  const triggerScraper = async () => {
    setScraping(true);
    setScrapeSuccess(false);
    try {
      const isProd = import.meta.env.PROD;
      const apiBase = isProd ? '' : 'http://147.135.252.68:20114';
      await axios.post(`${apiBase}/api/sports/scrape`);
      setScrapeSuccess(true);
      setTimeout(() => setScrapeSuccess(false), 3000);
    } catch (err) {
      alert('Gagal menjalankan scraper: ' + (err as Error).message);
    } finally {
      setScraping(false);
    }
  };

  // Filter channels based on search query and active tab
  const filteredChannels = channels.filter(ch => {
    if (monitorTab === 'channels' && !ch.isChannel) return false;
    if (monitorTab === 'matches' && ch.isChannel) return false;

    return (
      ch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ch.subName && ch.subName.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  // Total active rooms and viewers sum
  const activeRoomsCount = Object.keys(monitoringData).length;
  const totalLiveViewers = Object.values(monitoringData).reduce((sum, val) => sum + val, 0);

  return (
    <MainLayout>
      <div className="max-w-[1200px] mx-auto w-full py-8 px-4 select-none">
        {!isLoggedIn ? (
          /* Login Form */
          <div className="max-w-md mx-auto">
            <div className="glass-card rounded-[2rem] p-6 md:p-8 border border-white/5 space-y-6 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />

              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto">
                  <ShieldAlert size={20} />
                </div>
                <h1 className="text-xl font-display font-black uppercase tracking-wider text-white">YKN Admin Gate</h1>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Akses Terbatas Khusus Pengembang & Admin</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Kode Akses</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500">
                      <Key size={14} />
                    </span>
                    <input
                      type="password"
                      value={passcode}
                      onChange={(e) => {
                        setPasscode(e.target.value);
                        if (error) setError('');
                      }}
                      placeholder="Masukkan kode rahasia..."
                      className="w-full bg-zinc-950/70 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-xs font-black text-white focus:outline-none focus:border-primary/50 transition-all placeholder-zinc-700"
                    />
                  </div>
                  {error && (
                    <p className="text-[9.5px] text-red-500 font-bold uppercase tracking-wider mt-1 px-1">
                      ⚠️ {error}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-primary text-dark font-black text-[10px] uppercase tracking-widest rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-primary/10"
                >
                  Masuk Dashboard
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* Layout Dashboard Baru - Grid Split Layout */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* Left Column: Quick Actions & Server Info (4 columns) */}
            <div className="lg:col-span-4 space-y-6">

              {/* Profile Card */}
              <div className="glass-card rounded-[2rem] p-6 border border-white/5 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary/5 rounded-full blur-2xl animate-pulse" />
                <div className="flex items-center gap-4">
                  <img
                    src={yknwcLogo}
                    alt="YKN TV Logo"
                    className="w-12 h-12 rounded-full bg-zinc-900 border border-primary/30 p-1 shrink-0 shadow-lg"
                  />
                  <div className="truncate">
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-sm font-black text-white tracking-wide uppercase">YKN TV Admin</h2>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">Pengendali Utama</p>
                  </div>
                </div>
              </div>

              {/* Server Realtime Stats */}
              <div className="glass-card rounded-[2rem] p-6 border border-white/5 space-y-4">
                <h3 className="text-[9.5px] font-black uppercase tracking-widest text-zinc-400">Statistik Real-time</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-950/60 border border-white/5 rounded-2xl p-4 text-center">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary mx-auto mb-2">
                      <Users size={14} />
                    </div>
                    <p className="text-[8px] font-black uppercase text-zinc-500 tracking-wider">Total Penonton</p>
                    <p className="text-lg font-black text-white mt-1">{totalLiveViewers}</p>
                  </div>

                  <div className="bg-zinc-950/60 border border-white/5 rounded-2xl p-4 text-center">
                    <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400 mx-auto mb-2">
                      <Radio size={14} />
                    </div>
                    <p className="text-[8px] font-black uppercase text-zinc-500 tracking-wider">Channel Aktif</p>
                    <p className="text-lg font-black text-white mt-1">{activeRoomsCount}</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="glass-card rounded-[2rem] p-6 border border-white/5 space-y-4">
                <h3 className="text-[9.5px] font-black uppercase tracking-widest text-zinc-400">Kontrol Bot & Scraper</h3>

                {/* Trigger Scraper */}
                <button
                  onClick={triggerScraper}
                  disabled={scraping}
                  className="w-full p-3.5 bg-zinc-950/60 hover:bg-zinc-900/50 border border-white/5 hover:border-primary/25 rounded-xl flex items-center justify-between transition-all group cursor-pointer disabled:opacity-40"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center text-primary group-hover:scale-105 transition-all">
                      <RefreshCw size={14} className={scraping ? 'animate-spin' : ''} />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-black text-white">Scrape Jadwal Baru</p>
                      <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">Sinkron ke database VPS</p>
                    </div>
                  </div>
                  {scrapeSuccess ? (
                    <CheckCircle size={14} className="text-emerald-500" />
                  ) : (
                    <Activity size={14} className="text-zinc-500 group-hover:text-primary transition-all" />
                  )}
                </button>

                {/* View Web */}
                <button
                  onClick={() => navigate('/')}
                  className="w-full p-3.5 bg-zinc-950/60 hover:bg-zinc-900/50 border border-white/5 hover:border-sky-500/25 rounded-xl flex items-center justify-between transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/15 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-all">
                      <Tv size={14} />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-black text-white">Lihat Halaman Utama</p>
                      <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">Mulai menonton live stream</p>
                    </div>
                  </div>
                  <ExternalLink size={14} className="text-zinc-500 group-hover:text-sky-400 transition-all" />
                </button>

                {/* Logout */}
                <button
                  onClick={handleLogout}
                  className="w-full py-3 bg-red-500/10 hover:bg-red-500/15 text-red-500 border border-red-500/20 font-black text-[9px] uppercase tracking-widest rounded-xl hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-4"
                >
                  <LogOut size={12} />
                  <span>Keluar Sesi</span>
                </button>
              </div>

            </div>

            {/* Right Column: Realtime Active Channels Monitor (8 columns) */}
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-12 gap-6 items-start">

              {/* Left Part: Channels List (5 columns or full if no chat open) */}
              <div className={`${selectedChannel ? 'md:col-span-6' : 'md:col-span-12'} glass-card rounded-[2rem] p-6 border border-white/5 space-y-5 transition-all duration-300`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Live Channels Monitor</h3>
                    <p className="text-[9.5px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">Daftar pemantauan penonton real-time di setiap saluran</p>
                  </div>

                  {/* Search Input */}
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-500">
                      <Search size={12} />
                    </span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari saluran..."
                      className="w-full bg-zinc-950/70 border border-white/5 rounded-xl pl-8 pr-4 py-2 text-[10px] font-black text-white focus:outline-none focus:border-primary/50 transition-all placeholder-zinc-700"
                    />
                  </div>
                </div>

                {/* Tab Selector for Monitoring */}
                <div className="flex bg-zinc-950/60 p-1 rounded-xl border border-white/5 gap-1 select-none w-full sm:w-fit">
                  <button
                    onClick={() => setMonitorTab('all')}
                    className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${monitorTab === 'all'
                      ? 'bg-primary text-dark font-black shadow-lg shadow-primary/10'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    Semua
                  </button>
                  <button
                    onClick={() => setMonitorTab('channels')}
                    className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${monitorTab === 'channels'
                      ? 'bg-primary text-dark font-black shadow-lg shadow-primary/10'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    Saluran TV
                  </button>
                  <button
                    onClick={() => setMonitorTab('matches')}
                    className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${monitorTab === 'matches'
                      ? 'bg-primary text-dark font-black shadow-lg shadow-primary/10'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    Jadwal Pertandingan
                  </button>
                </div>

                {loadingData ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Memuat monitoring data...</p>
                  </div>
                ) : filteredChannels.length === 0 ? (
                  <p className="text-center py-16 text-zinc-600 text-xs font-bold uppercase tracking-wider">Tidak ada saluran ditemukan</p>
                ) : (
                  /* Monitoring List Grid */
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                    {filteredChannels.map(ch => {
                      const viewers = monitoringData[ch.id] || 0;
                      const hasActiveViewers = viewers > 0;
                      const isSelected = selectedChannel?.id === ch.id;

                      return (
                        <div
                          key={ch.id}
                          onClick={() => setSelectedChannel(ch)}
                          className={`flex items-center justify-between p-3.5 bg-zinc-950/40 border rounded-[1.25rem] transition-all hover:bg-zinc-900/40 cursor-pointer ${
                            isSelected 
                              ? 'border-primary shadow-lg shadow-primary/10' 
                              : hasActiveViewers 
                                ? 'border-primary/25 shadow-md shadow-primary/[0.02]' 
                                : 'border-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-3.5 truncate pr-4">
                            {/* Logo */}
                            {!ch.isChannel ? (
                              <div className="flex items-center -space-x-3 shrink-0 select-none">
                                <div className="h-9 w-9 bg-zinc-900 rounded-xl flex items-center justify-center p-1.5 border border-white/10 overflow-hidden shadow-md">
                                  <img src={ch.logo || 'https://flagcdn.com/w80/un.png'} alt={ch.player1 || 'Home'} className="w-full h-full object-contain filter brightness-110" />
                                </div>
                                <div className="h-9 w-9 bg-zinc-900 rounded-xl flex items-center justify-center p-1.5 border border-white/10 overflow-hidden shadow-md z-10">
                                  <img src={ch.logo2 || 'https://flagcdn.com/w80/un.png'} alt={ch.player2 || 'Away'} className="w-full h-full object-contain filter brightness-110" />
                                </div>
                              </div>
                            ) : ch.isBase64Logo && ch.logo ? (
                              <div className="h-9 w-12 bg-white/5 rounded-xl flex items-center justify-center p-1 border border-white/5 overflow-hidden shrink-0">
                                <img src={ch.logo} alt={ch.name} className="h-full max-w-full object-contain" />
                              </div>
                            ) : (
                              <div className="h-9 w-9 bg-white/5 rounded-xl flex items-center justify-center p-1.5 border border-white/5 shrink-0">
                                <img src={ch.logo || "https://flagcdn.com/w80/un.png"} alt={ch.name} className="w-full h-full object-contain" />
                              </div>
                            )}
                            {/* Info */}
                            <div className="truncate">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-1.5 py-0.5 bg-white/5 border border-white/5 rounded-md text-[7.5px] font-black text-zinc-500 uppercase tracking-widest">
                                  {ch.isChannel ? 'Saluran TV' : 'Live Match'}
                                </span>
                                {!ch.isChannel && (
                                  (() => {
                                    const info = getMatchStatus(ch);
                                    const isLive = info.status === 'playable';
                                    const isFinished = info.isFinishedMatch;
                                    return (
                                      <span className={`px-1.5 py-0.5 rounded-md text-[7.5px] font-black uppercase tracking-widest ${isLive && !isFinished
                                        ? 'bg-netflix-red/10 text-netflix-red border border-netflix-red/25 animate-pulse'
                                        : isFinished
                                          ? 'bg-zinc-800/30 text-zinc-500 border border-zinc-700/10'
                                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
                                        }`}>
                                        {isLive && !isFinished ? 'LIVE' : info.timeLeft || 'Upcoming'}
                                      </span>
                                    );
                                  })()
                                )}
                              </div>
                              <h4 className="text-xs font-black text-white truncate mt-1 group-hover:text-primary transition-colors">
                                {ch.name}
                              </h4>
                              <div className="flex items-center gap-2 mt-0.5 truncate flex-wrap">
                                {ch.subName && (
                                  <p className="text-[8.5px] text-zinc-500 font-bold truncate uppercase tracking-wider">
                                    {ch.subName}
                                  </p>
                                )}
                                {!ch.isChannel && ch.jadwal_event && (
                                  <p className="text-[8.5px] text-zinc-400 font-bold tracking-wider font-mono">
                                    ⏱️ {formatMatchTime(parseJadwal(ch.jadwal_event))}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Spectator Indicator */}
                          <div className="flex items-center gap-3 shrink-0">
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black font-mono tracking-wider transition-all ${hasActiveViewers
                              ? 'bg-primary/10 border-primary/20 text-primary animate-pulse-light'
                              : 'bg-zinc-900/50 border-white/5 text-zinc-600'
                              }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${hasActiveViewers ? 'bg-primary' : 'bg-zinc-700'}`} />
                              <span>{viewers} Live</span>
                            </div>

                            {/* Go to Stream */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(ch.isChannel ? `/watch/${slugify(ch.name)}` : `/watch/${slugify(ch.name)}-${ch.id}`);
                              }}
                              className="w-7 h-7 bg-white/5 hover:bg-primary hover:text-dark text-zinc-400 rounded-lg flex items-center justify-center transition-all cursor-pointer border border-white/5"
                            >
                              <ExternalLink size={10} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected Channel Live Chat Monitor */}
              {selectedChannel && (
                <div className="md:col-span-6 glass-card rounded-[2rem] p-5 border border-white/5 flex flex-col h-[500px] md:h-[600px] relative overflow-hidden transition-all duration-300">
                  {/* Chat Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-white/5 select-none shrink-0">
                    <div className="truncate pr-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <h4 className="text-xs font-black text-white truncate uppercase tracking-wider">
                          Chat: {selectedChannel.name}
                        </h4>
                      </div>
                      <p className="text-[8.5px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">
                        {roomViewers} Penonton Aktif
                      </p>
                    </div>

                    {/* Close Button */}
                    <button
                      onClick={() => setSelectedChannel(null)}
                      className="w-6 h-6 rounded-lg bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-zinc-400 flex items-center justify-center transition-all cursor-pointer border border-white/5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>

                  {/* Message History area */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 my-3 space-y-3 min-h-0">
                    {chatMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-4">
                        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Belum ada obrolan</p>
                      </div>
                    ) : (
                      chatMessages.map((msg) => {
                        const isMe = msg.username === 'YKN TV' && msg.avatar?.includes('yknwc-logo');
                        const isSystem = msg.role === 'system';

                        if (isSystem) {
                          return (
                            <div key={msg.id} className="text-center py-0.5">
                              <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-950/40 px-2.5 py-0.5 rounded-full border border-white/5">
                                {msg.message}
                              </span>
                            </div>
                          );
                        }

                        return (
                          <div key={msg.id} className="flex flex-col space-y-0.5">
                            <div className="flex items-center gap-1">
                              <span className={`text-[9.5px] font-black ${isMe ? 'text-primary' : 'text-sky-400'}`}>
                                {msg.username}
                              </span>
                              {isMe && (
                                <span className="px-1 py-0.2 bg-primary text-dark font-black text-[6px] uppercase tracking-widest rounded">
                                  HOST
                                </span>
                              )}
                              <span className="text-[7.5px] text-zinc-500 font-mono">
                                {new Date(msg.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })}
                              </span>
                            </div>
                            <div className={`px-2.5 py-1.5 rounded-xl text-xs font-bold leading-relaxed break-words w-fit max-w-[90%] ${
                              isMe
                                ? 'bg-primary/10 border border-primary/20 text-zinc-100'
                                : 'bg-zinc-900/90 border border-white/5 text-zinc-200'
                            }`}>
                              {/* Inline Link Render */}
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
                                        className="text-primary hover:underline font-black break-all"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {part}
                                        <ExternalLink size={10} className="inline-block ml-0.5 align-middle shrink-0" />
                                      </a>
                                    );
                                  }
                                  return part;
                                });
                              })()}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Input Form */}
                  <form onSubmit={handleSendMessage} className="flex gap-2 pt-2 border-t border-white/5 shrink-0">
                    <textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
                          if (!isMobile) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }
                      }}
                      placeholder={connected ? "Ketik balasan..." : "Menghubungkan..."}
                      disabled={!connected}
                      maxLength={150}
                      rows={1}
                      className="flex-1 bg-zinc-950/70 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold text-white placeholder-zinc-500 focus:outline-none focus:border-primary/50 transition-all disabled:opacity-50 resize-none h-[40px] custom-scrollbar"
                    />
                    <button
                      type="submit"
                      disabled={!connected || !chatInput.trim()}
                      className="bg-primary text-dark font-black hover:scale-105 active:scale-95 transition-all text-[9px] uppercase tracking-widest px-4 rounded-xl flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-45 disabled:pointer-events-none"
                    >
                      Kirim
                    </button>
                  </form>
                </div>
              )}

            </div>

          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default AdminDashboard;
