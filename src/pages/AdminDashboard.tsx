import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { ChevronLeft, Key, ShieldAlert, RefreshCw, LogOut, ExternalLink, Tv, Activity, CheckCircle, Users, Radio, Search, Info, AlertTriangle, X } from 'lucide-react';
import axios from 'axios';
import { getLiveSportsData, slugify, type PlayableStream } from '../services/streamService';
import yknwcLogo from '../assets/yknwc-logo.png';
import { io } from 'socket.io-client';
import { supabase } from '../services/supabase';

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
  const location = useLocation();
  const isDashboardPath = location.pathname === '/ykn-c0ntr0l-hq/dashboard';
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [adminRole, setAdminRole] = useState<'developer' | 'admin' | null>(null);
  const [adminUsername, setAdminUsername] = useState('');
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapeSuccess, setScrapeSuccess] = useState(false);

  // User Management states (Developer only)
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'developer' | 'admin'>('admin');
  const [createUserError, setCreateUserError] = useState('');
  const [createUserSuccess, setCreateUserSuccess] = useState('');

  // Password editing states
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editPasswordInput, setEditPasswordInput] = useState('');

  // Hashing helper using Native Web Crypto API
  const sha256 = async (message: string): Promise<string> => {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  };

  // Monitoring States
  const [channels, setChannels] = useState<PlayableStream[]>([]);
  const [monitoringData, setMonitoringData] = useState<Record<string, number>>({});
  const [loadingData, setLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [monitorTab, setMonitorTab] = useState<'all' | 'channels' | 'matches' | 'users' | 'announcement'>('all');

  // Announcement States
  const [annMessage, setAnnMessage] = useState('');
  const [annType, setAnnType] = useState<'info' | 'success' | 'warning' | 'alert'>('info');
  const [annDuration, setAnnDuration] = useState(8);
  const [annIsActive, setAnnIsActive] = useState(false);
  const [annLoading, setAnnLoading] = useState(false);
  const [annSuccessMessage, setAnnSuccessMessage] = useState('');
  const [annErrorMessage, setAnnErrorMessage] = useState('');

  // Chat States for monitoring
  const [selectedChannel, setSelectedChannel] = useState<PlayableStream | null>(null);
  const [socket, setSocket] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [roomViewers, setRoomViewers] = useState(0);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatMonitorRef = useRef<HTMLDivElement>(null);
  const announcementChannelRef = useRef<any>(null);

  // Scroll to chat monitor on mobile when a channel is selected
  useEffect(() => {
    if (selectedChannel && window.innerWidth < 768 && chatMonitorRef.current) {
      chatMonitorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedChannel]);

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
      let savedUserId = localStorage.getItem('ykn_chat_user_id');
      if (!savedUserId) {
        savedUserId = 'usr_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('ykn_chat_user_id', savedUserId);
      }
      newSocket.emit('join_room', {
        roomId: selectedChannel.id,
        username: 'YKN TV',
        avatar: yknwcLogo,
        role: 'user',
        userId: savedUserId
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

  // Fetch list of registered admin users (Developer only)
  const fetchAdminUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('ykn_users')
        .select('id, username, role, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching admin users:', error);
        return;
      }

      if (data) {
        setAdminUsers(data);
      }
    } catch (err) {
      console.error('Failed to fetch admin users:', err);
    }
  };

  // Check existing session on mount via Supabase verification against ykn_users table
  // Checks both localStorage (remember me) and sessionStorage (session-only)
  useEffect(() => {
    const checkSession = async () => {
      const adminSession =
        localStorage.getItem('ykn_admin_logged_in') ||
        sessionStorage.getItem('ykn_admin_logged_in');
      const savedUsername =
        localStorage.getItem('ykn_admin_username') ||
        sessionStorage.getItem('ykn_admin_username');
      const savedToken =
        localStorage.getItem('ykn_admin_token') ||
        sessionStorage.getItem('ykn_admin_token');
      const savedRole = (
        localStorage.getItem('ykn_admin_role') ||
        sessionStorage.getItem('ykn_admin_role')
      ) as 'developer' | 'admin' | null;

      if (adminSession === 'true' && savedUsername && savedToken) {
        try {
          const { data } = await supabase
            .from('ykn_users')
            .select('*')
            .eq('username', savedUsername)
            .eq('password', savedToken)
            .single();

          if (data) {
            setIsLoggedIn(true);
            setAdminRole(data.role);
            setAdminUsername(data.username);
            // If already logged in and visiting the login path, redirect to dashboard
            if (!isDashboardPath) {
              navigate('/ykn-c0ntr0l-hq/dashboard', { replace: true });
            }
          } else {
            // Invalid token, force logout
            ['ykn_admin_logged_in','ykn_admin_username','ykn_admin_role','ykn_admin_token','ykn_chat_nickname','ykn_chat_avatar'].forEach(k => {
              localStorage.removeItem(k);
              sessionStorage.removeItem(k);
            });
            setIsLoggedIn(false);
            if (isDashboardPath) navigate('/ykn-c0ntr0l-hq', { replace: true });
          }
        } catch (err) {
          // If offline / network error, trust session locally but log warning
          console.warn('Supabase offline session check failed, using local fallback:', err);
          setIsLoggedIn(true);
          setAdminRole(savedRole);
          setAdminUsername(savedUsername || '');
          if (!isDashboardPath) navigate('/ykn-c0ntr0l-hq/dashboard', { replace: true });
        }
      } else if (isDashboardPath) {
        // No session but trying to access /dashboard → redirect to login
        navigate('/ykn-c0ntr0l-hq', { replace: true });
      }
    };
    checkSession();
  }, []);

  // Fetch admin list if Developer opens "Kelola Admin"
  useEffect(() => {
    if (isLoggedIn && adminRole === 'developer' && monitorTab === 'users') {
      fetchAdminUsers();
    }
  }, [isLoggedIn, adminRole, monitorTab]);

  const handleCreateUser = async () => {
    setCreateUserError('');
    setCreateUserSuccess('');

    if (!newUsername.trim() || !newPassword.trim()) {
      setCreateUserError('Username dan Password tidak boleh kosong!');
      return;
    }

    try {
      const hashedPassword = await sha256(newPassword.trim());

      const { error } = await supabase
        .from('ykn_users')
        .insert({
          username: newUsername.trim().toLowerCase(),
          password: hashedPassword,
          role: newRole
        });

      if (error) {
        if (error.message.includes('unique') || error.code === '23505') {
          setCreateUserError('Username sudah terdaftar!');
        } else {
          setCreateUserError('Gagal membuat akun: ' + error.message);
        }
        return;
      }

      setCreateUserSuccess(`Akun ${newUsername.trim()} (${newRole}) berhasil dibuat!`);
      setNewUsername('');
      setNewPassword('');
      fetchAdminUsers();
    } catch (err) {
      console.error(err);
      setCreateUserError('Terjadi kesalahan sistem.');
    }
  };

  const handleDeleteUser = async (userId: number, targetUsername: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus akun admin "${targetUsername}"?`)) return;

    try {
      const { error } = await supabase
        .from('ykn_users')
        .delete()
        .eq('id', userId);

      if (error) {
        alert('Gagal menghapus: ' + error.message);
        return;
      }

      fetchAdminUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdatePassword = async (userId: number, isSelf: boolean) => {
    if (!editPasswordInput.trim()) {
      alert('Password baru tidak boleh kosong!');
      return;
    }

    try {
      const hashedPassword = await sha256(editPasswordInput.trim());

      const { error } = await supabase
        .from('ykn_users')
        .update({ password: hashedPassword })
        .eq('id', userId);

      if (error) {
        alert('Gagal memperbarui password: ' + error.message);
        return;
      }

      alert('Password berhasil diperbarui!');
      
      if (isSelf) {
        localStorage.setItem('ykn_admin_token', hashedPassword);
      }

      setEditingUserId(null);
      setEditPasswordInput('');
      fetchAdminUsers();
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan sistem.');
    }
  };

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

  // Setup persistent announcement broadcast channel on login
  useEffect(() => {
    if (!isLoggedIn) {
      if (announcementChannelRef.current) {
        announcementChannelRef.current.unsubscribe();
        announcementChannelRef.current = null;
      }
      return;
    }

    const channel = supabase.channel('ykn-global-announcements');
    channel.subscribe((status) => {
      console.log('Admin announcement channel subscription status:', status);
    });
    announcementChannelRef.current = channel;

    return () => {
      if (announcementChannelRef.current) {
        announcementChannelRef.current.unsubscribe();
        announcementChannelRef.current = null;
      }
    };
  }, [isLoggedIn]);

  // Fetch current announcement state for admin dashboard
  useEffect(() => {
    if (!isLoggedIn) return;

    const fetchCurrentAnnouncement = async () => {
      try {
        const { data, error } = await supabase
          .from('ykn_announcements')
          .select('message, type, duration, is_active')
          .eq('id', 1)
          .single();

        if (error) {
          console.warn('Dashboard announcement query warning:', error.message);
          return;
        }

        if (data) {
          setAnnMessage(data.message);
          setAnnType(data.type as any);
          setAnnDuration(data.duration);
          setAnnIsActive(data.is_active);
        }
      } catch (err) {
        console.error('Failed to fetch current announcement for dashboard:', err);
      }
    };

    fetchCurrentAnnouncement();
  }, [isLoggedIn]);

  const handleSaveAnnouncement = async (activate: boolean) => {
    setAnnLoading(true);
    setAnnSuccessMessage('');
    setAnnErrorMessage('');

    try {
      const nowStr = new Date().toISOString();
      const payload = {
        message: annMessage.trim(),
        type: annType,
        duration: annDuration,
        is_active: activate,
        updated_at: nowStr
      };

      // 1. Update/Upsert in Supabase Table
      const { error } = await supabase
        .from('ykn_announcements')
        .upsert({
          id: 1,
          ...payload
        });

      if (error) {
        throw error;
      }

      setAnnIsActive(activate);

      // 2. Publish Real-time Broadcast Event to all clients instantly
      if (announcementChannelRef.current) {
        if (activate) {
          await announcementChannelRef.current.send({
            type: 'broadcast',
            event: 'new-announcement',
            payload: {
              message: annMessage.trim(),
              type: annType,
              duration: annDuration,
              updated_at: nowStr
            }
          });
          setAnnSuccessMessage('Pengumuman berhasil diaktifkan dan disiarkan secara real-time!');
        } else {
          await announcementChannelRef.current.send({
            type: 'broadcast',
            event: 'clear-announcement',
            payload: {}
          });
          setAnnSuccessMessage('Pengumuman berhasil dinonaktifkan.');
        }
      } else {
        setAnnSuccessMessage('Pengumuman berhasil disimpan di database (Broadcast channel belum siap).');
      }
    } catch (err: any) {
      console.error(err);
      setAnnErrorMessage('Gagal menyimpan/menyiarkan pengumuman. Pastikan tabel ykn_announcements sudah dibuat di Supabase.');
    } finally {
      setAnnLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!usernameInput.trim() || !passwordInput.trim()) {
      setError('Username dan password tidak boleh kosong!');
      return;
    }

    try {
      const hashedPassword = await sha256(passwordInput.trim());

      const { data, error: dbError } = await supabase
        .from('ykn_users')
        .select('*')
        .eq('username', usernameInput.trim().toLowerCase())
        .eq('password', hashedPassword)
        .single();

      if (dbError || !data) {
        console.error('Supabase query error:', dbError);
        setError('Username atau password salah! Hubungi developer jika lupa.');
        return;
      }

      // If Remember Me is checked → persist in localStorage (survives browser restart)
      // If unchecked → use sessionStorage (clears when tab/browser is closed)
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('ykn_admin_logged_in', 'true');
      storage.setItem('ykn_admin_username', data.username);
      storage.setItem('ykn_admin_role', data.role);
      storage.setItem('ykn_admin_token', data.password);
      storage.setItem('ykn_chat_nickname', 'YKN TV');
      storage.setItem('ykn_chat_avatar', yknwcLogo);
      
      setIsLoggedIn(true);
      setAdminRole(data.role);
      setAdminUsername(data.username);
      setError('');
      navigate('/ykn-c0ntr0l-hq/dashboard', { replace: true });
    } catch (err) {
      console.error(err);
      setError('Terjadi kesalahan sistem saat mencoba masuk.');
    }
  };

  const handleLogout = () => {
    const keys = ['ykn_admin_logged_in','ykn_admin_username','ykn_admin_role','ykn_admin_token','ykn_chat_nickname','ykn_chat_avatar'];
    keys.forEach(k => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
    setIsLoggedIn(false);
    setAdminRole(null);
    setAdminUsername('');
    setUsernameInput('');
    setPasswordInput('');
    navigate('/ykn-c0ntr0l-hq');
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
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Username</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500">
                      <Users size={14} />
                    </span>
                    <input
                      type="text"
                      value={usernameInput}
                      onChange={(e) => {
                        setUsernameInput(e.target.value);
                        if (error) setError('');
                      }}
                      placeholder="Masukkan username..."
                      className="w-full bg-zinc-950/70 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-xs font-black text-white focus:outline-none focus:border-primary/50 transition-all placeholder-zinc-700"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Password</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500">
                      <Key size={14} />
                    </span>
                    <input
                      type="password"
                      value={passwordInput}
                      onChange={(e) => {
                        setPasswordInput(e.target.value);
                        if (error) setError('');
                      }}
                      placeholder="Masukkan password..."
                      className="w-full bg-zinc-950/70 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-xs font-black text-white focus:outline-none focus:border-primary/50 transition-all placeholder-zinc-700"
                    />
                  </div>
                  {error && (
                    <p className="text-[9.5px] text-red-500 font-bold uppercase tracking-wider mt-2 px-1">
                      ⚠️ {error}
                    </p>
                  )}
                </div>

                {/* Remember Me */}
                <label htmlFor="rememberMe" className="flex items-center gap-2.5 cursor-pointer group select-none">
                  <input
                    id="rememberMe"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`relative w-9 h-5 rounded-full transition-all duration-300 flex-shrink-0 ${
                      rememberMe ? 'bg-primary' : 'bg-zinc-800 border border-white/10'
                    }`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-300 ${
                      rememberMe ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-zinc-200 transition-colors">
                    Ingat saya <span className="text-zinc-600 font-bold normal-case tracking-normal">(tetap login setelah browser ditutup)</span>
                  </span>
                </label>

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
                <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-primary/5 rounded-full blur-2xl animate-pulse pointer-events-none" />
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary/5 rounded-full blur-2xl animate-pulse pointer-events-none" />
                <div className="flex items-center gap-4 relative z-10">
                  <div className="relative shrink-0 select-none">
                    <img
                      src={yknwcLogo}
                      alt="YKN TV Logo"
                      className="w-12 h-12 rounded-full bg-zinc-900 border border-primary/30 p-1 shadow-lg"
                    />
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-zinc-950 rounded-full animate-pulse" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm font-black text-white tracking-wide uppercase truncate max-w-[120px] sm:max-w-none">
                        {adminUsername || 'Administrator'}
                      </h2>
                      <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest ${
                        adminRole === 'developer'
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/25'
                          : 'bg-red-500/10 text-red-400 border border-red-500/25'
                      }`}>
                        {adminRole || 'Staff'}
                      </span>
                    </div>
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mt-1.5">
                      {adminRole === 'developer' ? 'Akses Penuh Pengembang' : 'Akses Terbatas Staf Admin'}
                    </p>
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

            {/* Right Column: Realtime Active Channels Monitor / Kelola Admin (8 columns) */}
            <div className="lg:col-span-8">
              {monitorTab === 'users' && adminRole === 'developer' ? (
                /* User Management Panel (Developer only) */
                <div className="glass-card rounded-[2rem] p-6 border border-white/5 space-y-6 transition-all duration-300">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-wider">Kelola Admin</h3>
                      <p className="text-[9.5px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">Tambah, ubah, atau hapus akun akses admin YKN TV</p>
                    </div>
                    <button
                      onClick={() => setMonitorTab('all')}
                      className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-all group py-2 px-3.5 bg-zinc-900/50 hover:bg-zinc-800/60 rounded-xl border border-white/5 text-[9px] font-black uppercase tracking-widest cursor-pointer select-none self-start sm:self-auto"
                    >
                      <ChevronLeft size={12} className="group-hover:-translate-x-0.5 transition-transform text-zinc-400 group-hover:text-white" />
                      <span>KEMBALI KE MONITOR</span>
                    </button>
                  </div>

                  {/* Form to Add User */}
                  <div className="bg-zinc-950/60 border border-white/5 rounded-2xl p-5 space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-primary font-display italic">Tambah Akun Baru</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Username */}
                      <div className="space-y-1.5">
                        <label className="text-[8.5px] font-black uppercase tracking-wider text-zinc-400">Username</label>
                        <input
                          type="text"
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                          placeholder="Contoh: staff_admin"
                          className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-primary/50 transition-all placeholder-zinc-600"
                        />
                      </div>
                      {/* Password */}
                      <div className="space-y-1.5">
                        <label className="text-[8.5px] font-black uppercase tracking-wider text-zinc-400">Password</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Masukkan password..."
                          className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-primary/50 transition-all placeholder-zinc-600"
                        />
                      </div>
                      {/* Role */}
                      <div className="space-y-1.5">
                        <label className="text-[8.5px] font-black uppercase tracking-wider text-zinc-400">Role</label>
                        <select
                          value={newRole}
                          onChange={(e) => setNewRole(e.target.value as 'developer' | 'admin')}
                          className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-primary/50 transition-all cursor-pointer"
                        >
                          <option value="admin">Admin (Read-only)</option>
                          <option value="developer">Developer (Full Access)</option>
                        </select>
                      </div>
                    </div>

                    {createUserError && (
                      <p className="text-[9.5px] text-red-500 font-bold uppercase tracking-wider px-1">
                        ⚠️ {createUserError}
                      </p>
                    )}
                    {createUserSuccess && (
                      <p className="text-[9.5px] text-emerald-500 font-bold uppercase tracking-wider px-1">
                        ✓ {createUserSuccess}
                      </p>
                    )}

                    <button
                      onClick={handleCreateUser}
                      className="py-2.5 px-6 bg-primary text-dark font-black text-[9px] uppercase tracking-widest rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-primary/10"
                    >
                      Buat Akun
                    </button>
                  </div>

                  {/* Registered Users List */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Daftar Admin Aktif</h4>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                      {adminUsers.map(user => {
                        const isSelf = user.username.toLowerCase() === adminUsername.toLowerCase();
                        const isEditing = editingUserId === user.id;

                        return (
                          <div
                            key={user.id}
                            className="p-4 bg-zinc-950/40 border border-white/5 rounded-2xl space-y-3"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-black text-white">{user.username}</p>
                                  <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest ${
                                    user.role === 'developer'
                                      ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                      : 'bg-zinc-800 text-zinc-400'
                                  }`}>
                                    {user.role}
                                  </span>
                                  {isSelf && (
                                    <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded text-[7px] font-black uppercase tracking-widest">
                                      Saya
                                    </span>
                                  )}
                                </div>
                                <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider mt-1">
                                  Dibuat: {new Date(user.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </p>
                              </div>

                              {!isEditing && (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <button
                                    onClick={() => {
                                      setEditingUserId(user.id);
                                      setEditPasswordInput('');
                                    }}
                                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 rounded-xl font-black text-[8px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                  >
                                    Ganti Password
                                  </button>
                                  {!isSelf && (
                                    <button
                                      onClick={() => handleDeleteUser(user.id, user.username)}
                                      className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl font-black text-[8px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                    >
                                      Hapus Akun
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {isEditing && (
                              <div className="flex flex-col sm:flex-row sm:items-end gap-3 pt-2.5 border-t border-white/5 w-full">
                                <div className="flex-1 space-y-1 w-full">
                                  <label className="text-[7.5px] font-black uppercase tracking-wider text-zinc-400">Password Baru</label>
                                  <input
                                    type="password"
                                    value={editPasswordInput}
                                    onChange={(e) => setEditPasswordInput(e.target.value)}
                                    placeholder="Masukkan password baru..."
                                    className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-primary/50 transition-all placeholder-zinc-650"
                                  />
                                </div>
                                <div className="flex gap-2 w-full justify-end sm:w-auto">
                                  <button
                                    onClick={() => handleUpdatePassword(user.id, isSelf)}
                                    className="px-4 py-2.5 bg-primary text-dark font-black text-[8.5px] uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                  >
                                    Simpan
                                  </button>
                                  <button
                                    onClick={() => setEditingUserId(null)}
                                    className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-400 border border-white/5 rounded-xl font-black text-[8.5px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                  >
                                    Batal
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (monitorTab as string) === 'announcement' ? (
                /* Announcement Management Panel (Admin and Developer) */
                <div className="glass-card rounded-[2rem] p-6 border border-white/5 space-y-6 transition-all duration-300">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-wider">Kelola Pengumuman Global</h3>
                      <p className="text-[9.5px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">Kirim pengumuman bergaya iOS melayang dari atas layar secara real-time</p>
                    </div>
                    <button
                      onClick={() => setMonitorTab('all')}
                      className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-all group py-2 px-3.5 bg-zinc-900/50 hover:bg-zinc-800/60 rounded-xl border border-white/5 text-[9px] font-black uppercase tracking-widest cursor-pointer select-none self-start sm:self-auto"
                    >
                      <ChevronLeft size={12} className="group-hover:-translate-x-0.5 transition-transform text-zinc-400 group-hover:text-white" />
                      <span>KEMBALI KE MONITOR</span>
                    </button>
                  </div>

                  {/* Split Grid for Form Controls and Live iOS Preview */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                    
                    {/* Left side: Controls (7 columns) */}
                    <div className="md:col-span-7 space-y-5">
                      
                      {/* Message Input */}
                      <div className="space-y-1.5">
                        <label className="text-[8.5px] font-black uppercase tracking-wider text-zinc-400">Pesan Pengumuman</label>
                        <textarea
                          rows={3}
                          value={annMessage}
                          onChange={(e) => setAnnMessage(e.target.value)}
                          placeholder="Contoh: Pemeliharaan sistem akan dilakukan pukul 00:00 WIB..."
                          className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-primary/50 transition-all placeholder-zinc-650 resize-none font-sans"
                        />
                        <div className="text-right text-[8px] text-zinc-500 font-bold">
                          {annMessage.length} karakter
                        </div>
                      </div>

                      {/* Announcement Type (iOS color picker style) */}
                      <div className="space-y-1.5">
                        <label className="text-[8.5px] font-black uppercase tracking-wider text-zinc-400">Tipe / Warna Notifikasi</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {/* Info (Blue) */}
                          <button
                            type="button"
                            onClick={() => setAnnType('info')}
                            className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                              annType === 'info' 
                                ? 'bg-blue-500/10 border-blue-500 text-blue-400 font-black shadow-md' 
                                : 'bg-zinc-900 border-white/5 text-zinc-400'
                            }`}
                          >
                            <p className="text-[9px] font-black uppercase tracking-wider">Info (Biru)</p>
                          </button>

                          {/* Success (Green) */}
                          <button
                            type="button"
                            onClick={() => setAnnType('success')}
                            className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                              annType === 'success' 
                                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-black shadow-md' 
                                : 'bg-zinc-900 border-white/5 text-zinc-400'
                            }`}
                          >
                            <p className="text-[9px] font-black uppercase tracking-wider">Sukses (Hijau)</p>
                          </button>

                          {/* Warning (Yellow) */}
                          <button
                            type="button"
                            onClick={() => setAnnType('warning')}
                            className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                              annType === 'warning' 
                                ? 'bg-amber-500/10 border-amber-500 text-amber-400 font-black shadow-md' 
                                : 'bg-zinc-900 border-white/5 text-zinc-400'
                            }`}
                          >
                            <p className="text-[9px] font-black uppercase tracking-wider">Warning (Kuning)</p>
                          </button>

                          {/* Alert (Red) */}
                          <button
                            type="button"
                            onClick={() => setAnnType('alert')}
                            className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                              annType === 'alert' 
                                ? 'bg-red-500/10 border-red-500 text-red-400 font-black shadow-md' 
                                : 'bg-zinc-900 border-white/5 text-zinc-400'
                            }`}
                          >
                            <p className="text-[9px] font-black uppercase tracking-wider">Alert (Merah)</p>
                          </button>
                        </div>
                      </div>

                      {/* Duration & Status Switch */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Duration */}
                        <div className="space-y-1.5">
                          <label className="text-[8.5px] font-black uppercase tracking-wider text-zinc-400">Durasi Tayang (Detik)</label>
                          <input
                            type="number"
                            min="0"
                            max="3600"
                            value={annDuration}
                            onChange={(e) => setAnnDuration(parseInt(e.target.value) || 0)}
                            className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-primary/50 transition-all font-sans"
                            placeholder="Contoh: 8 (0 = tetap tampil)"
                          />
                          <p className="text-[7.5px] text-zinc-500 font-bold uppercase tracking-wider">Gunakan nilai 0 agar pengumuman tidak menutup otomatis</p>
                        </div>

                        {/* Status Info */}
                        <div className="space-y-1.5">
                          <label className="text-[8.5px] font-black uppercase tracking-wider text-zinc-400">Status Saat Ini</label>
                          <div className={`p-2.5 rounded-xl border font-mono text-center flex items-center justify-center gap-1.5 h-[38px] ${
                            annIsActive 
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-black animate-pulse' 
                              : 'bg-zinc-900 border-white/5 text-zinc-500 font-bold'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${annIsActive ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
                            <span className="text-[9px] uppercase tracking-wider">{annIsActive ? 'AKTIF & TAYANG' : 'TIDAK AKTIF / HILANG'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Messages */}
                      {annErrorMessage && (
                        <p className="text-[9.5px] text-red-500 font-bold uppercase tracking-wider px-1">
                          ⚠️ {annErrorMessage}
                        </p>
                      )}
                      {annSuccessMessage && (
                        <p className="text-[9.5px] text-emerald-500 font-bold uppercase tracking-wider px-1">
                          ✓ {annSuccessMessage}
                        </p>
                      )}

                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => handleSaveAnnouncement(true)}
                          disabled={annLoading || !annMessage.trim()}
                          className="py-2.5 px-6 bg-primary text-dark font-black text-[9px] uppercase tracking-widest rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-primary/10 disabled:opacity-45"
                        >
                          {annLoading ? 'Memproses...' : 'Simpan & Siarkan'}
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => handleSaveAnnouncement(false)}
                          disabled={annLoading}
                          className="py-2.5 px-6 bg-red-500/15 hover:bg-red-500/20 text-red-400 border border-red-500/25 font-black text-[9px] uppercase tracking-widest rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-45"
                        >
                          {annLoading ? 'Memproses...' : 'Matikan Pengumuman'}
                        </button>
                      </div>

                    </div>

                    {/* Right side: iOS Live Preview (5 columns) */}
                    <div className="md:col-span-5 space-y-4">
                      <label className="text-[8.5px] font-black uppercase tracking-wider text-zinc-400 block">Live Preview (Gaya iOS)</label>
                      <div className="relative h-[220px] rounded-2xl bg-zinc-950/80 border border-white/5 p-4 flex flex-col items-center justify-center overflow-hidden">
                        
                        {/* Fake Page Mockup behind preview */}
                        <div className="absolute inset-0 opacity-20 pointer-events-none p-4 flex flex-col justify-between">
                          <div className="w-12 h-2 bg-zinc-700 rounded" />
                          <div className="space-y-1">
                            <div className="w-full h-1 bg-zinc-700 rounded" />
                            <div className="w-2/3 h-1 bg-zinc-700 rounded" />
                          </div>
                          <div className="w-full h-12 bg-zinc-900 border border-white/5 rounded-xl" />
                        </div>

                        {/* iOS style preview banner */}
                        <div 
                          className="relative w-full rounded-2xl bg-zinc-900/95 border border-white/15 shadow-[0_12px_24px_rgba(0,0,0,0.6)] overflow-hidden z-10 transition-all duration-300"
                          style={{ 
                            borderLeft: `4px solid ${
                              annType === 'success' ? '#10b981' : 
                              annType === 'warning' ? '#f59e0b' : 
                              annType === 'alert' ? '#ef4444' : '#3b82f6'
                            }` 
                          }}
                        >
                          <div className="p-3.5 flex items-start gap-2.5 pr-8 relative">
                            {/* Left App Icon / Avatar */}
                            <div className="w-8 h-8 rounded-full bg-zinc-900 border border-primary/20 p-0.5 shrink-0 shadow-lg flex items-center justify-center">
                              <img
                                src={yknwcLogo}
                                alt="YKN TV"
                                className="w-full h-full object-contain rounded-full"
                              />
                            </div>

                            {/* Text preview */}
                            <div className="flex-1 min-w-0 space-y-1 text-left">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-black text-white font-display tracking-wide uppercase italic">YKN TV</span>
                                <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">• Sekarang</span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span 
                                  className="text-[7.5px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border font-sans inline-flex items-center gap-1"
                                  style={{ 
                                    backgroundColor: `${
                                      annType === 'success' ? '#10b98115' : 
                                      annType === 'warning' ? '#f59e0b15' : 
                                      annType === 'alert' ? '#ef444415' : '#3b82f615'
                                    }`, 
                                    borderColor: `${
                                      annType === 'success' ? '#10b98125' : 
                                      annType === 'warning' ? '#f59e0b25' : 
                                      annType === 'alert' ? '#ef444425' : '#3b82f625'
                                    }`,
                                    color: 
                                      annType === 'success' ? '#10b981' : 
                                      annType === 'warning' ? '#f59e0b' : 
                                      annType === 'alert' ? '#ef4444' : '#3b82f6'
                                  }}
                                >
                                  {annType === 'success' && <CheckCircle size={9} strokeWidth={3} />}
                                  {annType === 'warning' && <AlertTriangle size={9} strokeWidth={3} />}
                                  {annType === 'alert' && <ShieldAlert size={9} strokeWidth={3} />}
                                  {annType === 'info' && <Info size={9} strokeWidth={3} />}
                                  {
                                    annType === 'success' ? 'SUKSES' : 
                                    annType === 'warning' ? 'PERINGATAN' : 
                                    annType === 'alert' ? 'PERHATIAN' : 'PENGUMUMAN'
                                  }
                                </span>
                              </div>
                              <p className="text-[10px] font-black text-zinc-200 leading-normal break-words font-sans">
                                {annMessage.trim() || 'Teks pengumuman Anda akan tampil di sini...'}
                              </p>
                            </div>

                            {/* Fake Close Button */}
                            <div className="absolute top-3 right-3 w-5 h-5 rounded-md bg-white/5 border border-white/5 text-zinc-500 flex items-center justify-center">
                              <X size={10} strokeWidth={2.5} />
                            </div>
                          </div>

                          {/* Fake progress bar */}
                          {annDuration > 0 && (
                            <div className="w-full h-[2px] bg-white/5 absolute bottom-0 left-0 overflow-hidden">
                              <div 
                                className="h-full w-4/5"
                                style={{ 
                                  backgroundColor: 
                                    annType === 'success' ? '#10b981' : 
                                    annType === 'warning' ? '#f59e0b' : 
                                    annType === 'alert' ? '#ef4444' : '#3b82f6'
                                }}
                              />
                            </div>
                          )}
                        </div>

                      </div>
                    </div>

                  </div>
                </div>
              ) : (
                /* Default Monitoring Grid: Channels + Chat */
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
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
                    <div className="flex flex-row overflow-x-auto bg-zinc-950/60 p-1 rounded-xl border border-white/5 gap-1 select-none w-full custom-scrollbar pb-2 sm:pb-1">
                      <button
                        onClick={() => setMonitorTab('all')}
                        className={`flex-shrink-0 px-4 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${monitorTab === 'all'
                          ? 'bg-primary text-dark font-black shadow-lg shadow-primary/10'
                          : 'text-zinc-400 hover:text-white hover:bg-white/5'
                          }`}
                      >
                        Semua
                      </button>
                      <button
                        onClick={() => setMonitorTab('channels')}
                        className={`flex-shrink-0 px-4 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${monitorTab === 'channels'
                          ? 'bg-primary text-dark font-black shadow-lg shadow-primary/10'
                          : 'text-zinc-400 hover:text-white hover:bg-white/5'
                          }`}
                      >
                        Saluran TV
                      </button>
                      <button
                        onClick={() => setMonitorTab('matches')}
                        className={`flex-shrink-0 px-4 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${monitorTab === 'matches'
                          ? 'bg-primary text-dark font-black shadow-lg shadow-primary/10'
                          : 'text-zinc-400 hover:text-white hover:bg-white/5'
                          }`}
                      >
                        Jadwal Pertandingan
                      </button>
                      <button
                        onClick={() => setMonitorTab('announcement')}
                        className={`flex-shrink-0 px-4 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${(monitorTab as string) === 'announcement'
                          ? 'bg-primary text-dark font-black shadow-lg shadow-primary/10'
                          : 'text-zinc-400 hover:text-white hover:bg-white/5'
                          }`}
                      >
                        Pengumuman
                      </button>
                      {adminRole === 'developer' && (
                        <button
                          onClick={() => setMonitorTab('users')}
                          className={`flex-shrink-0 px-4 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${monitorTab === 'users'
                            ? 'bg-primary text-dark font-black shadow-lg shadow-primary/10'
                            : 'text-zinc-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                          Kelola Admin
                        </button>
                      )}
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
                              className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-zinc-950/40 border rounded-[1.25rem] gap-3 transition-all hover:bg-zinc-900/40 cursor-pointer ${
                                isSelected 
                                  ? 'border-primary shadow-lg shadow-primary/10' 
                                  : hasActiveViewers 
                                    ? 'border-primary/25 shadow-md shadow-primary/[0.02]' 
                                    : 'border-white/5'
                              }`}>
                              <div className="flex items-center gap-3.5 min-w-0 sm:pr-4 flex-1">
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
                                <div className="min-w-0 flex-1">
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
                                  <h4 className="text-xs font-black text-white md:truncate mt-1 group-hover:text-primary transition-colors">
                                    {ch.name}
                                  </h4>
                                  <div className="flex items-center gap-2 mt-0.5 md:truncate flex-wrap">
                                    {ch.subName && (
                                      <p className="text-[8.5px] text-zinc-500 font-bold md:truncate uppercase tracking-wider">
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
                              <div className="flex items-center gap-3 shrink-0 justify-end w-full sm:w-auto border-t border-white/5 sm:border-t-0 pt-2.5 sm:pt-0">
                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black font-mono tracking-wider transition-all ${viewers > 0
                                  ? 'bg-primary/10 border-primary/20 text-primary animate-pulse-light'
                                  : 'bg-zinc-900/50 border-white/5 text-zinc-600'
                                  }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${viewers > 0 ? 'bg-primary' : 'bg-zinc-700'}`} />
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

                  {selectedChannel && (
                    <div ref={chatMonitorRef} className="md:col-span-6 glass-card rounded-[2rem] p-5 border border-white/5 flex flex-col h-[500px] md:h-[600px] relative overflow-hidden transition-all duration-300">
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
              )}
            </div>

          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default AdminDashboard;
