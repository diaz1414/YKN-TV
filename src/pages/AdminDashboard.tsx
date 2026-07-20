import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { ChevronLeft, ChevronRight, Key, ShieldAlert, RefreshCw, LogOut, Tv, Activity, CheckCircle, Users, Radio, Search, Info, AlertTriangle, X, ChevronDown, Check } from 'lucide-react';
import axios from 'axios';
import { getLiveSportsData, slugify, type PlayableStream } from '../services/streamService';
import { XOILAC_SPORTS, type XoilacSport } from '../services/xoilacService';
import yknLogo from '../assets/ykn-tv-logo.png';
import { io } from 'socket.io-client';
import { supabase } from '../services/supabase';
import {
  getEventServersForAdmin,
  saveEventServer,
  setEventServerActive,
  deleteEventServer,
  type EventServerRow,
} from '../services/eventServerService';
import {
  Trash2,
  Power,
  PowerOff,
  RefreshCcw,
  ExternalLink,
} from 'lucide-react';

import {
  getCustomEventsForAdmin,
  saveCustomEvent,
  setCustomEventActive,
  deleteCustomEvent,
  type CustomEventRow,
} from '../services/customEventService';
import {
  formatDateTimeLocalInWib,
  formatJadwalDateTimeForUserZone,
  formatMatchTimeForUserZone,
  parseJadwalDate,
} from '../utils/indonesiaTime';

interface MonitorRoom {
  roomId: string;
  viewers: number;
}



// Helper functions for match schedules and statuses
const parseJadwal = parseJadwalDate;
const formatMatchTime = formatMatchTimeForUserZone;

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

type MatchCategoryTab = 'all' | 'main' | XoilacSport;

const MATCH_CATEGORY_TABS: Array<{
  id: MatchCategoryTab;
  label: string;
  icon: string;
  color: string;
}> = [
    { id: 'all', label: 'Semua', icon: '•', color: '#eab308' },
    { id: 'main', label: 'Utama', icon: 'LIVE', color: '#f59e0b' },
    ...Object.entries(XOILAC_SPORTS).map(([id, meta]) => ({
      id: id as XoilacSport,
      label: meta.label,
      icon: meta.icon,
      color: meta.color,
    })),
  ];

const isExternalScheduleMatch = (streamId?: string) => (
  (streamId || '').includes('esportex-') || (streamId || '').includes('xoilac-')
);

const matchBelongsToCategory = (match: PlayableStream, category: MatchCategoryTab): boolean => {
  if (category === 'all') return true;
  if (category === 'main') return !isExternalScheduleMatch(match.id);

  const sport = XOILAC_SPORTS[category];
  const label = sport?.label.toLowerCase() ?? category.toLowerCase();
  const text = `${match.id} ${match.name} ${match.subName || ''}`.toLowerCase();

  return (
    text.includes(`esportex-${category}-`) ||
    text.includes(`xoilac-${category}-`) ||
    text.includes(label) ||
    text.includes(category.toLowerCase())
  );
};

interface SearchableSelectOption {
  id: string;
  name: string;
  subName?: string;
  category?: 'channel' | 'match' | string;
  backupCount?: number;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  showGroups?: boolean;
  showBackupIndicator?: boolean;
}

const SearchableSelect = ({
  options,
  value,
  onChange,
  placeholder,
  showGroups = false,
  showBackupIndicator = false,
}: SearchableSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.id === value);

  const filteredOptions = options.filter((opt) => {
    const term = searchQuery.toLowerCase().trim();
    if (!term) return true;
    const nameMatch = opt.name.toLowerCase().includes(term);
    const subNameMatch = opt.subName ? opt.subName.toLowerCase().includes(term) : false;
    return nameMatch || subNameMatch;
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
  };

  const renderOptionItem = (opt: SearchableSelectOption) => {
    const isSelected = opt.id === value;
    return (
      <button
        key={opt.id}
        type="button"
        onClick={() => handleSelect(opt.id)}
        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer select-none ${isSelected
            ? 'bg-primary text-dark shadow-md'
            : 'text-zinc-300 hover:bg-white/5 hover:text-white'
          }`}
      >
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="truncate">{opt.name}</span>
            {showBackupIndicator && opt.backupCount !== undefined && opt.backupCount > 0 && (
              <span className={`shrink-0 text-[7px] font-black border px-1.5 py-0.5 rounded uppercase ${isSelected
                  ? 'bg-dark/10 text-dark border-dark/20'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}>
                {opt.backupCount} Backup
              </span>
            )}
          </div>
          {opt.subName && (
            <p className={`text-[9px] font-bold mt-0.5 truncate ${isSelected ? 'text-dark/70' : 'text-zinc-500'}`}>
              {opt.subName}
            </p>
          )}
        </div>
        {isSelected && <Check size={12} strokeWidth={3} className={isSelected ? 'text-dark' : 'text-primary'} />}
      </button>
    );
  };

  const channels = filteredOptions.filter(opt => opt.category === 'channel');
  const matches = filteredOptions.filter(opt => opt.category === 'match');

  return (
    <div ref={containerRef} className="relative w-full font-sans">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white flex items-center justify-between outline-none cursor-pointer text-left focus:border-primary/45 transition-all select-none"
      >
        {selectedOption ? (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate">{selectedOption.name}</span>
              {showBackupIndicator && selectedOption.backupCount !== undefined && selectedOption.backupCount > 0 && (
                <span className="shrink-0 text-[7px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded uppercase">
                  {selectedOption.backupCount} Backup
                </span>
              )}
            </div>
            {selectedOption.subName && (
              <p className="text-[9px] text-zinc-500 font-bold truncate mt-0.5">
                {selectedOption.subName}
              </p>
            )}
          </div>
        ) : (
          <span className="text-zinc-500">{placeholder}</span>
        )}
        <ChevronDown size={14} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-2 bg-zinc-950/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-[0_10px_25px_-5px_rgba(0,0,0,0.7)] p-2.5 space-y-2 select-none">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" size={12} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari..."
              className="w-full bg-zinc-900 border border-white/5 rounded-xl pl-8 pr-8 py-2 text-xs font-bold text-white focus:outline-none focus:border-primary/30 transition-all placeholder-zinc-600"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="max-h-[220px] overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <p className="text-center py-4 text-[10px] font-black uppercase text-zinc-600 tracking-wider">
                Tidak ada pilihan ditemukan
              </p>
            ) : !showGroups ? (
              filteredOptions.map((opt) => renderOptionItem(opt))
            ) : (
              <>
                {channels.length > 0 && (
                  <div className="space-y-1">
                    <div className="px-2 py-1 text-[8px] font-black text-zinc-500 uppercase tracking-widest bg-white/2 rounded">
                      📺 TV Channels
                    </div>
                    {channels.map((opt) => renderOptionItem(opt))}
                  </div>
                )}

                {matches.length > 0 && (
                  <div className="space-y-1 pt-1.5">
                    <div className="px-2 py-1 text-[8px] font-black text-zinc-500 uppercase tracking-widest bg-white/2 rounded">
                      ⚽ Matches / Events
                    </div>
                    {matches.map((opt) => renderOptionItem(opt))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
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

  const [customEvents, setCustomEvents] = useState<CustomEventRow[]>([]);
  const [customEventLoading, setCustomEventLoading] = useState(false);
  const [customEventSaving, setCustomEventSaving] = useState(false);
  const [customEventMessage, setCustomEventMessage] = useState('');

  const [eventName, setEventName] = useState('Live Event');
  const [eventPlayer1, setEventPlayer1] = useState('');
  const [eventPlayer2, setEventPlayer2] = useState('');
  const [eventLogo1, setEventLogo1] = useState('');
  const [eventLogo2, setEventLogo2] = useState('');
  const [eventStart, setEventStart] = useState('');
  const [eventStop, setEventStop] = useState('');
  const [eventSourceChannelId, setEventSourceChannelId] = useState('');
  const [eventInternalNote, setEventInternalNote] = useState('');

  // Wizard states for schedule tab
  const [scheduleStep, setScheduleStep] = useState<1 | 2 | 3>(1);
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [selectedRawEventKey, setSelectedRawEventKey] = useState(''); // id_event of first CH entry
  const [scheduleChannelMode, setScheduleChannelMode] = useState<'raw' | 'web' | 'manual'>('raw');
  const [scheduleManualSourceId, setScheduleManualSourceId] = useState('');
  const [scheduleWebSourceId, setScheduleWebSourceId] = useState('');
  // Raw event entries grouped: unique matches (by id_event of CH1), all channels per match
  interface RawEventEntry {
    id_iptv: string;
    nama_channel: string;
    url_iptv: string;
    url_license?: string;
    jenis: string;
    nama_event: string;
    player_1: string;
    player_2: string;
    logo_1?: string;
    logo_2?: string;
    jadwal_event?: string;
    jadwal_stop?: string;
    deskripsi?: string;
    deskripsi_en?: string;
    id_event: string;
    thumbnail?: string;
  }


  // Remote live events fetch state
  const [remoteEvents, setRemoteEvents] = useState<RawEventEntry[]>([]);
  const [remoteEventsLoading, setRemoteEventsLoading] = useState(false);
  const [remoteEventsFetched, setRemoteEventsFetched] = useState(false);

  const REMOTE_EVENTS_URL = 'https://raw.githubusercontent.com/movietrailersxxi-pixel/web/main/assets/tv-events.dat';
  const REMOTE_EVENTS_CACHE_BUST_MS = 5000;
  const getRemoteEventsUrl = () => {
    const bucket = Math.floor(Date.now() / REMOTE_EVENTS_CACHE_BUST_MS);
    return `${REMOTE_EVENTS_URL}?t=${bucket}`;
  };

  const fetchRemoteEvents = async () => {
    setRemoteEventsLoading(true);
    try {
      const res = await fetch(getRemoteEventsUrl(), { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const parsed = JSON.parse(text) as RawEventEntry[];
      setRemoteEvents(parsed);
      setRemoteEventsFetched(true);
    } catch (err) {
      console.warn('[Remote Events] gagal fetch:', err);
      setRemoteEvents([]);
    } finally {
      setRemoteEventsLoading(false);
    }
  };

  // Derived unique matches from remote events
  const remoteUniqueMatches: RawEventEntry[] = (() => {
    const result: RawEventEntry[] = [];
    const seen = new Set<string>();
    for (const ev of remoteEvents) {
      const key = `${ev.player_1}|${ev.player_2}|${ev.jadwal_event || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(ev);
      }
    }
    return result;
  })();

  const getRemoteChannelsForMatch = (match: RawEventEntry): RawEventEntry[] =>
    remoteEvents.filter(
      (ev) =>
        ev.player_1 === match.player_1 &&
        ev.player_2 === match.player_2 &&
        (ev.jadwal_event || '') === (match.jadwal_event || '')
    );

  const selectedRemoteMatch = remoteUniqueMatches.find((m) => m.id_event === selectedRawEventKey) || null;



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
  const [monitorTab, setMonitorTab] = useState<
    'all' | 'channels' | 'matches' | 'users' | 'announcement' | 'servers' | 'schedule'
  >('all');
  const [matchCategoryTab, setMatchCategoryTab] = useState<MatchCategoryTab>('all');

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

  const [serverStreamId, setServerStreamId] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [serverPriority, setServerPriority] = useState(3);
  const [serverForceProxy, setServerForceProxy] = useState(false);
  const [serverInternalNote, setServerInternalNote] = useState('');
  const [serverSaving, setServerSaving] = useState(false);
  const [serverMessage, setServerMessage] = useState('');

  // New state variables for copying from existing channels/matches
  const [serverUrlSource, setServerUrlSource] = useState<'manual' | 'channel'>('manual');
  const [serverSourceChannelId, setServerSourceChannelId] = useState('');
  const [serverSourceIndex, setServerSourceIndex] = useState<number | ''>('');

  const [eventServers, setEventServers] = useState<EventServerRow[]>([]);
  const [serverListLoading, setServerListLoading] = useState(false);


  const sourceChannelsForEvent = channels.filter((ch) => ch.isChannel && !ch.id.startsWith('doms9-'));
  const toWibIso = (value: string) => {
    if (!value) return '';

    // input datetime-local biasanya: 2026-07-01T20:00
    const withSeconds = value.length === 16 ? `${value}:00` : value;

    // karena target kamu WIB
    return `${withSeconds}+07:00`;
  };

  const loadCustomEvents = async () => {
    setCustomEventLoading(true);

    try {
      const rows = await getCustomEventsForAdmin();
      setCustomEvents(rows);
    } catch (err) {
      console.warn('[Admin Custom Events] gagal load:', err);
    } finally {
      setCustomEventLoading(false);
    }
  };

  useEffect(() => {
    if ((monitorTab as string) === 'schedule') {
      loadCustomEvents();
    }
  }, [monitorTab]);

  const handleSaveCustomEvent = async (active: boolean) => {
    if (!eventPlayer1.trim() || !eventPlayer2.trim()) {
      setCustomEventMessage('Isi nama kedua tim dulu.');
      return;
    }
    if (!eventStart) {
      setCustomEventMessage('Isi jam mulai pertandingan dulu.');
      return;
    }
    // Resolve source_channel_id from wizard mode
    let resolvedSourceId = '';
    if (scheduleChannelMode === 'raw') {
      resolvedSourceId = eventSourceChannelId;
    } else if (scheduleChannelMode === 'web') {
      resolvedSourceId = scheduleWebSourceId;
    } else {
      resolvedSourceId = scheduleManualSourceId;
    }
    if (!resolvedSourceId.trim()) {
      setCustomEventMessage('Pilih atau isi channel sumber live dulu.');
      return;
    }
    setCustomEventSaving(true);
    setCustomEventMessage('');
    try {
      const sourceLabel =
        scheduleChannelMode === 'raw'
          ? (selectedRemoteMatch
            ? `${selectedRemoteMatch.nama_event} (${resolvedSourceId})`
            : resolvedSourceId)
          : scheduleChannelMode === 'web'
            ? (sourceChannelsForEvent.find((c) => c.id === resolvedSourceId)?.name || resolvedSourceId)
            : resolvedSourceId;
      await saveCustomEvent({
        nama_event: eventName.trim() || 'Live Event',
        player_1: eventPlayer1.trim(),
        player_2: eventPlayer2.trim(),
        logo_1: eventLogo1.trim() || undefined,
        logo_2: eventLogo2.trim() || undefined,
        jadwal_event: toWibIso(eventStart),
        jadwal_stop: eventStop ? toWibIso(eventStop) : undefined,
        source_channel_id: resolvedSourceId,
        is_active: active,
        internal_note: eventInternalNote.trim() || `Source: ${sourceLabel}`,
      });
      setCustomEventMessage(
        active ? 'Jadwal event berhasil dibuat dan aktif.' : 'Jadwal event berhasil disimpan nonaktif.'
      );
      // Reset wizard
      setScheduleStep(1);
      setSelectedRawEventKey('');
      setScheduleSearch('');
      setScheduleChannelMode('raw');
      setScheduleManualSourceId('');
      setScheduleWebSourceId('');
      setEventName('Live Event');
      setEventPlayer1('');
      setEventPlayer2('');
      setEventLogo1('');
      setEventLogo2('');
      setEventStart('');
      setEventStop('');
      setEventSourceChannelId('');
      setEventInternalNote('');
      await loadCustomEvents();
    } catch (err: any) {
      setCustomEventMessage('Gagal simpan jadwal: ' + (err?.message || 'Unknown error'));
    } finally {
      setCustomEventSaving(false);
    }
  };

  const handleToggleCustomEvent = async (row: CustomEventRow) => {
    setCustomEventSaving(true);
    setCustomEventMessage('');

    try {
      await setCustomEventActive(row.id, !row.is_active);
      setCustomEventMessage(row.is_active ? 'Jadwal dinonaktifkan.' : 'Jadwal diaktifkan.');
      await loadCustomEvents();
    } catch (err: any) {
      setCustomEventMessage('Gagal ubah status: ' + (err?.message || 'Unknown error'));
    } finally {
      setCustomEventSaving(false);
    }
  };

  const handleDeleteCustomEvent = async (row: CustomEventRow) => {
    const ok = window.confirm(
      `Hapus jadwal ini?\n\n${row.player_1} vs ${row.player_2}`
    );

    if (!ok) return;

    setCustomEventSaving(true);
    setCustomEventMessage('');

    try {
      await deleteCustomEvent(row.id);
      setCustomEventMessage('Jadwal berhasil dihapus.');
      await loadCustomEvents();
    } catch (err: any) {
      setCustomEventMessage('Gagal hapus jadwal: ' + (err?.message || 'Unknown error'));
    } finally {
      setCustomEventSaving(false);
    }
  };

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

    const envVal = import.meta.env.VITE_BOT_API_URL;
    const socketUrl = envVal === '/api' ? window.location.origin : (envVal || 'https://api.ykn.my.id');
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
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
        avatar: yknLogo,
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
      avatar: yknLogo,
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
        // Backup credential local session check
        const isBackupDev = savedUsername === 'diaww' && savedRole === 'developer' && savedToken === '63f94390a2807bf1cfc047f0c3c54ec7f1bad40985c32d7983bc16a34edb9d08';
        const isBackupAdmin = savedUsername === 'diaww14' && savedRole === 'admin' && savedToken === '63f94390a2807bf1cfc047f0c3c54ec7f1bad40985c32d7983bc16a34edb9d08';

        if (isBackupDev || isBackupAdmin) {
          setIsLoggedIn(true);
          setAdminRole(savedRole);
          setAdminUsername(savedUsername);
          if (!isDashboardPath) {
            navigate('/ykn-c0ntr0l-hq/dashboard', { replace: true });
          }
          return;
        }

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
            ['ykn_admin_logged_in', 'ykn_admin_username', 'ykn_admin_role', 'ykn_admin_token', 'ykn_chat_nickname', 'ykn_chat_avatar'].forEach(k => {
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

        // Sort matches: Live first, then Upcoming (earliest kickoff first), then Finished
        // For matches with equal kickoff time, sort [RTB Go] matches to the end
        const sortedMatches = [...data.matches].sort((a, b) => {
          const statusA = getMatchStatus(a).status;
          const statusB = getMatchStatus(b).status;

          if (statusA === statusB) {
            const dateA = a.jadwal_event ? parseJadwal(a.jadwal_event).getTime() : 0;
            const dateB = b.jadwal_event ? parseJadwal(b.jadwal_event).getTime() : 0;
            if (dateA === dateB) {
              const isRtbA = a.subName && a.subName.toLowerCase().includes("[rtb go]");
              const isRtbB = b.subName && b.subName.toLowerCase().includes("[rtb go]");
              if (isRtbA && !isRtbB) return 1;
              if (!isRtbA && isRtbB) return -1;
            }
            return dateA - dateB;
          }
          if (statusA === 'playable') return -1;
          if (statusB === 'playable') return 1;
          if (statusA === 'upcoming' && statusB === 'finished') return -1;
          if (statusA === 'finished' && statusB === 'upcoming') return 1;
          return 0;
        });

        // Combine all channels and matches — exclude Doms9 IPTV channels from admin monitor
        const allChannels = [
          ...data.sportsTv.filter(c => !c.id.startsWith('doms9-')).map(c => ({ ...c, isChannel: true })),
          ...data.liveTv.filter(c => !c.id.startsWith('doms9-')).map(c => ({ ...c, isChannel: true })),
          ...sortedMatches.map(m => ({ ...m, isChannel: false }))
        ];
        setChannels(allChannels);
      } catch (err) {
        console.error('Failed to load channels for monitoring:', err);
      }
    };

    const fetchRealtimeViewers = async () => {
      try {
        const envVal = import.meta.env.VITE_BOT_API_URL;
        const apiBase = envVal === '/api' ? '' : (envVal || 'https://api.ykn.my.id');
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
    channel.subscribe((status: any) => {
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
      const inputUsername = usernameInput.trim().toLowerCase();
      const inputPassword = passwordInput.trim();
      const hashedPassword = await sha256(inputPassword);

      // Backup credentials local check
      const isBackupDevLogin = inputUsername === 'diaww' && hashedPassword === '63f94390a2807bf1cfc047f0c3c54ec7f1bad40985c32d7983bc16a34edb9d08';
      const isBackupAdminLogin = inputUsername === 'diaww14' && hashedPassword === '63f94390a2807bf1cfc047f0c3c54ec7f1bad40985c32d7983bc16a34edb9d08';

      if (isBackupDevLogin || isBackupAdminLogin) {
        const assignedRole = isBackupDevLogin ? 'developer' : 'admin';
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem('ykn_admin_logged_in', 'true');
        storage.setItem('ykn_admin_username', inputUsername);
        storage.setItem('ykn_admin_role', assignedRole);
        storage.setItem('ykn_admin_token', hashedPassword);
        storage.setItem('ykn_chat_nickname', 'YKN TV');
        storage.setItem('ykn_chat_avatar', yknLogo);

        setIsLoggedIn(true);
        setAdminRole(assignedRole);
        setAdminUsername(inputUsername);
        setError('');
        navigate('/ykn-c0ntr0l-hq/dashboard', { replace: true });
        return;
      }

      const { data, error: dbError } = await supabase
        .from('ykn_users')
        .select('*')
        .eq('username', inputUsername)
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
      storage.setItem('ykn_chat_avatar', yknLogo);

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
    const keys = ['ykn_admin_logged_in', 'ykn_admin_username', 'ykn_admin_role', 'ykn_admin_token', 'ykn_chat_nickname', 'ykn_chat_avatar'];
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
      const envVal = import.meta.env.VITE_BOT_API_URL;
      const apiBase = envVal === '/api' ? '' : (envVal || 'https://api.ykn.my.id');
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
    if (monitorTab === 'matches' && !matchBelongsToCategory(ch, matchCategoryTab)) return false;

    return (
      ch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ch.subName && ch.subName.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const matchCategoryCounts = MATCH_CATEGORY_TABS.reduce<Record<MatchCategoryTab, number>>((acc, tab) => {
    acc[tab.id] = channels.filter(ch => !ch.isChannel && matchBelongsToCategory(ch, tab.id)).length;
    return acc;
  }, {} as Record<MatchCategoryTab, number>);

  const visibleMatchCategoryTabs = MATCH_CATEGORY_TABS.filter(tab => (
    tab.id === 'all' || tab.id === 'main' || matchCategoryCounts[tab.id] > 0
  ));

  // Total active rooms and viewers sum
  const activeRoomsCount = Object.keys(monitoringData).length;
  const totalLiveViewers = Object.values(monitoringData).reduce((sum, val) => sum + val, 0);

  const loadEventServers = async () => {
    setServerListLoading(true);

    try {
      const rows = await getEventServersForAdmin();
      setEventServers(rows);
    } catch (err) {
      console.warn('[Admin Event Servers] gagal load:', err);
    } finally {
      setServerListLoading(false);
    }
  };

  useEffect(() => {
    if ((monitorTab as string) === 'servers') {
      loadEventServers();
    }
  }, [monitorTab]);

  const visibleEventServers = serverStreamId
    ? eventServers.filter((row) => row.stream_id === serverStreamId)
    : eventServers;

  const serverCountByStream = eventServers.reduce<Record<string, number>>((acc, row) => {
    acc[row.stream_id] = (acc[row.stream_id] || 0) + 1;
    return acc;
  }, {});

  const selectedServerTarget = channels.find((ch) => ch.id === serverStreamId);

  const getTargetNameById = (streamId: string) => {
    const target = channels.find((ch) => ch.id === streamId);
    return target?.name || streamId;
  };

  const handleSourceChannelChange = (channelId: string) => {
    setServerSourceChannelId(channelId);
    if (!channelId) {
      setServerSourceIndex('');
      setServerUrl('');
      return;
    }
    const ch = channels.find((c) => c.id === channelId);
    if (ch && ch.servers && ch.servers.length > 0) {
      setServerSourceIndex(0);
      setServerUrl(ch.servers[0].url);
      setServerForceProxy(!!ch.servers[0].forceProxy);
      if (!serverInternalNote.trim()) {
        setServerInternalNote(`Source: ${ch.name}`);
      }
    } else {
      setServerSourceIndex('');
      setServerUrl('');
    }
  };

  const handleSourceServerChange = (index: number) => {
    setServerSourceIndex(index);
    const ch = channels.find((c) => c.id === serverSourceChannelId);
    if (ch && ch.servers && ch.servers[index]) {
      const srv = ch.servers[index];
      setServerUrl(srv.url);
      setServerForceProxy(!!srv.forceProxy);
    }
  };

  const handleSaveEventServer = async (active: boolean) => {
    if (!serverStreamId) {
      setServerMessage('Pilih pertandingan/channel dulu.');
      return;
    }

    if (!serverUrl.trim()) {
      setServerMessage('Isi URL live dulu.');
      return;
    }

    setServerSaving(true);
    setServerMessage('');

    try {
      await saveEventServer({
        stream_id: serverStreamId,
        url: serverUrl.trim(),
        type: serverUrl.includes('.mpd') ? 'dash' : 'hls',
        force_proxy: serverForceProxy,
        priority: serverPriority,
        is_active: active,
        internal_note: serverInternalNote.trim() || null,
        source_label: serverForceProxy ? 'Proxy Backup' : 'Direct Backup',
        created_by: adminUsername || 'admin',
      });

      setServerMessage(
        active
          ? 'Backup channel berhasil diaktifkan.'
          : 'Backup channel berhasil disimpan nonaktif.'
      );

      setServerUrl('');
      setServerInternalNote('');
      setServerPriority(3);
      setServerForceProxy(false);
      setServerUrlSource('manual');
      setServerSourceChannelId('');
      setServerSourceIndex('');

      await loadEventServers();
    } catch (err: any) {
      setServerMessage('Gagal simpan backup: ' + (err?.message || 'Unknown error'));
    } finally {
      setServerSaving(false);
    }
  };

  const handleToggleEventServer = async (row: EventServerRow) => {
    setServerSaving(true);
    setServerMessage('');

    try {
      await setEventServerActive(row.id, !row.is_active);
      setServerMessage(row.is_active ? 'Backup berhasil dinonaktifkan.' : 'Backup berhasil diaktifkan.');
      await loadEventServers();
    } catch (err: any) {
      setServerMessage('Gagal ubah status backup: ' + (err?.message || 'Unknown error'));
    } finally {
      setServerSaving(false);
    }
  };

  const handleDeleteEventServer = async (row: EventServerRow) => {
    const ok = window.confirm(
      `Hapus backup ini?\n\nTarget: ${getTargetNameById(row.stream_id)}\nURL: ${row.url}`
    );

    if (!ok) return;

    setServerSaving(true);
    setServerMessage('');

    try {
      await deleteEventServer(row.id);
      setServerMessage('Backup berhasil dihapus.');
      await loadEventServers();
    } catch (err: any) {
      setServerMessage('Gagal hapus backup: ' + (err?.message || 'Unknown error'));
    } finally {
      setServerSaving(false);
    }
  };

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
                    className={`relative w-9 h-5 rounded-full transition-all duration-300 flex-shrink-0 ${rememberMe ? 'bg-primary' : 'bg-zinc-800 border border-white/10'
                      }`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-300 ${rememberMe ? 'translate-x-4' : 'translate-x-0'
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
                      src={yknLogo}
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
                      <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest ${adminRole === 'developer'
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
                                  <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest ${user.role === 'developer'
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
                            className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${annType === 'info'
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
                            className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${annType === 'success'
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
                            className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${annType === 'warning'
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
                            className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${annType === 'alert'
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
                          <div className={`p-2.5 rounded-xl border font-mono text-center flex items-center justify-center gap-1.5 h-[38px] ${annIsActive
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
                            borderLeft: `4px solid ${annType === 'success' ? '#10b981' :
                              annType === 'warning' ? '#f59e0b' :
                                annType === 'alert' ? '#ef4444' : '#3b82f6'
                              }`
                          }}
                        >
                          <div className="p-3.5 flex items-start gap-2.5 pr-8 relative">
                            {/* Left App Icon / Avatar */}
                            <div className="w-8 h-8 rounded-full bg-zinc-900 border border-primary/20 p-0.5 shrink-0 shadow-lg flex items-center justify-center">
                              <img
                                src={yknLogo}
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
                                    backgroundColor: `${annType === 'success' ? '#10b98115' :
                                      annType === 'warning' ? '#f59e0b15' :
                                        annType === 'alert' ? '#ef444415' : '#3b82f615'
                                      }`,
                                    borderColor: `${annType === 'success' ? '#10b98125' :
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
              ) :
                (monitorTab as string) === 'servers' ? (
                  <div className="glass-card rounded-[2rem] p-6 border border-white/5 space-y-5 transition-all duration-300">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
                      <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">
                          Server Live Tambahan
                        </h3>
                        <p className="text-[9.5px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">
                          Tambahkan server ke pertandingan/channel tanpa membuat card baru.
                        </p>
                      </div>

                      <button
                        onClick={() => setMonitorTab('all')}
                        className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-all group py-2 px-3.5 bg-zinc-900/50 hover:bg-zinc-800/60 rounded-xl border border-white/5 text-[9px] font-black uppercase tracking-widest cursor-pointer select-none self-start sm:self-auto"
                      >
                        <ChevronLeft size={12} className="group-hover:-translate-x-0.5 transition-transform text-zinc-400 group-hover:text-white" />
                        <span>KEMBALI KE MONITOR</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      {/* Left side: Add Server Form (7 columns) */}
                      <div className="lg:col-span-7 space-y-4">
                        <div className="space-y-2">
                          <label className="text-[8.5px] font-black uppercase tracking-wider text-zinc-400">
                            Pilih Target
                          </label>

                          <SearchableSelect
                            options={channels.filter(ch => !ch.id.startsWith('doms9-')).map((ch) => ({
                              id: ch.id,
                              name: ch.name,
                              subName: ch.subName,
                              backupCount: serverCountByStream[ch.id] || 0,
                            }))}
                            value={serverStreamId}
                            onChange={(val) => setServerStreamId(val)}
                            placeholder="Pilih pertandingan/channel..."
                            showBackupIndicator={true}
                          />
                        </div>

                        {/* URL Live Source Selection */}
                        <div className="space-y-2">
                          <label className="text-[8.5px] font-black uppercase tracking-wider text-zinc-400">
                            Sumber URL Live
                          </label>
                          <div className="flex bg-zinc-950/60 p-1 rounded-xl border border-white/5 gap-1 select-none">
                            <button
                              type="button"
                              onClick={() => {
                                setServerUrlSource('manual');
                                setServerSourceChannelId('');
                                setServerSourceIndex('');
                                setServerUrl('');
                              }}
                              className={`flex-1 py-1.5 text-[8.5px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${serverUrlSource === 'manual'
                                  ? 'bg-primary text-dark font-black shadow-lg shadow-primary/10'
                                  : 'text-zinc-400 hover:text-white'
                                }`}
                            >
                              Input URL Manual
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setServerUrlSource('channel');
                              }}
                              className={`flex-1 py-1.5 text-[8.5px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${serverUrlSource === 'channel'
                                  ? 'bg-primary text-dark font-black shadow-lg shadow-primary/10'
                                  : 'text-zinc-400 hover:text-white'
                                }`}
                            >
                              Salin dari Channel/Match Web
                            </button>
                          </div>
                        </div>

                        {/* Source Selection if 'channel' */}
                        {serverUrlSource === 'channel' && (
                          <div className="space-y-4 pt-1 bg-zinc-950/20 p-3 rounded-2xl border border-white/5">
                            <div className="space-y-2">
                              <label className="text-[8.5px] font-black uppercase tracking-wider text-zinc-400">
                                Pilih Channel/Match Sumber
                              </label>
                              <SearchableSelect
                                options={channels.map((ch) => ({
                                  id: ch.id,
                                  name: `${ch.isChannel ? '📺' : '⚽'} ${ch.name}`,
                                  subName: ch.subName,
                                  category: ch.isChannel ? 'channel' : 'match',
                                }))}
                                value={serverSourceChannelId}
                                onChange={(val) => handleSourceChannelChange(val)}
                                placeholder="Pilih Channel / Pertandingan..."
                                showGroups={true}
                              />
                            </div>

                            {serverSourceChannelId && (
                              <div className="space-y-2">
                                <label className="text-[8.5px] font-black uppercase tracking-wider text-zinc-400">
                                  Pilih Server Sumber (Klik salah satu)
                                </label>
                                <div className="grid grid-cols-1 gap-2 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                                  {(() => {
                                    const ch = channels.find((c) => c.id === serverSourceChannelId);
                                    if (!ch || !ch.servers || ch.servers.length === 0) {
                                      return <p className="text-[9px] text-red-400 py-1">Channel ini tidak memiliki server streaming aktif.</p>;
                                    }
                                    return ch.servers.map((srv, idx) => {
                                      const isSelected = serverSourceIndex === idx;
                                      return (
                                        <button
                                          key={idx}
                                          type="button"
                                          onClick={() => handleSourceServerChange(idx)}
                                          className={`w-full text-left p-2.5 rounded-xl border text-[10px] transition-all flex flex-col gap-1 ${isSelected
                                              ? 'bg-primary/10 text-primary border-primary/30 shadow-lg shadow-primary/5'
                                              : 'bg-zinc-900/50 text-zinc-300 border-white/5 hover:bg-zinc-800/80 hover:text-white'
                                            }`}
                                        >
                                          <div className="flex items-center justify-between font-black uppercase tracking-wider">
                                            <span>{srv.name || `Server ${idx + 1}`}</span>
                                            <span className="text-[7.5px] px-1.5 py-0.5 rounded bg-white/5 border border-white/5 font-mono">
                                              {srv.type.toUpperCase()}
                                            </span>
                                          </div>
                                          <span className="text-[8.5px] font-mono text-zinc-500 break-all select-all">
                                            {srv.url}
                                          </span>
                                        </button>
                                      );
                                    });
                                  })()}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[8.5px] font-black uppercase tracking-wider text-zinc-400">
                              URL Live
                            </label>
                            {serverUrlSource === 'channel' && serverUrl && (
                              <span className="text-[7.5px] text-emerald-400 font-bold uppercase tracking-wider animate-pulse">
                                ✓ Disalin dari sumber
                              </span>
                            )}
                          </div>

                          <input
                            value={serverUrl}
                            onChange={(e) => setServerUrl(e.target.value)}
                            placeholder="https://api.ykn.my.id/live/event/index.m3u8"
                            className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-primary/30 transition-all font-mono"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <label className="text-[8.5px] font-black uppercase tracking-wider text-zinc-400">
                              Urutan Server
                            </label>

                            <input
                              type="number"
                              value={serverPriority}
                              onChange={(e) => setServerPriority(Number(e.target.value))}
                              min={1}
                              className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-primary/30 transition-all"
                            />
                          </div>

                          <label className="flex items-center gap-3 bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 cursor-pointer hover:bg-zinc-800/50 transition-all select-none self-end h-[38px]">
                            <input
                              type="checkbox"
                              checked={serverForceProxy}
                              onChange={(e) => setServerForceProxy(e.target.checked)}
                              className="accent-primary w-3.5 h-3.5"
                            />
                            <span className="text-[9px] font-black uppercase tracking-wider text-zinc-300">
                              Lewat Proxy
                            </span>
                          </label>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[8.5px] font-black uppercase tracking-wider text-zinc-400">
                            Catatan Internal
                          </label>

                          <input
                            value={serverInternalNote}
                            onChange={(e) => setServerInternalNote(e.target.value)}
                            placeholder="Catatan admin saja, tidak tampil ke user"
                            className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-primary/30 transition-all"
                          />
                        </div>

                        {serverMessage && (
                          <p className="text-[10px] text-primary font-black uppercase tracking-wider bg-primary/5 px-3 py-2 rounded-xl border border-primary/10">
                            {serverMessage}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-3 pt-2">
                          <button
                            onClick={() => handleSaveEventServer(true)}
                            disabled={serverSaving}
                            className="px-6 py-3 bg-primary text-dark font-black rounded-xl text-[9px] uppercase tracking-widest disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/10 cursor-pointer"
                          >
                            {serverSaving ? 'Menyimpan...' : 'Aktifkan Server'}
                          </button>

                          <button
                            onClick={() => handleSaveEventServer(false)}
                            disabled={serverSaving}
                            className="px-6 py-3 bg-white/10 hover:bg-white/15 text-white border border-white/10 font-black rounded-xl text-[9px] uppercase tracking-widest disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                          >
                            Simpan Nonaktif
                          </button>
                        </div>
                      </div>

                      {/* Right side: Backups List Area (5 columns) */}
                      <div className="lg:col-span-5 border-t border-white/5 pt-6 lg:border-t-0 lg:pt-0 lg:border-l lg:border-white/5 lg:pl-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <h4 className="text-xs font-black text-white uppercase tracking-wider">
                              Daftar Backup Channel
                            </h4>

                            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">
                              {serverStreamId
                                ? `Backup untuk ${selectedServerTarget?.name || serverStreamId}`
                                : 'Semua backup yang sudah dibuat'}
                            </p>
                          </div>

                          <button
                            onClick={loadEventServers}
                            disabled={serverListLoading}
                            className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-300 rounded-xl text-[8.5px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50 cursor-pointer transition-all self-start sm:self-auto"
                          >
                            <RefreshCcw size={12} className={serverListLoading ? 'animate-spin' : ''} />
                            Refresh
                          </button>
                        </div>

                        {serverListLoading ? (
                          <div className="py-12 flex items-center justify-center">
                            <div className="w-7 h-7 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : visibleEventServers.length === 0 ? (
                          <div className="p-8 bg-zinc-950/30 border border-white/5 rounded-2xl text-center">
                            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-wider">
                              Belum ada backup channel untuk target ini.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                            {visibleEventServers.map((row) => {
                              const targetName = getTargetNameById(row.stream_id);

                              return (
                                <div
                                  key={row.id}
                                  className="p-4 bg-zinc-950/40 hover:bg-zinc-950/60 border border-white/5 rounded-2xl space-y-3 hover:border-white/10 transition-all"
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2 mb-2">
                                        <span
                                          className={`px-2 py-0.5 rounded-lg text-[7.5px] font-black uppercase tracking-widest border ${row.is_active
                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                            : 'bg-zinc-800/60 text-zinc-500 border-white/5'
                                            }`}
                                        >
                                          {row.is_active ? 'Aktif' : 'Nonaktif'}
                                        </span>

                                        <span className="px-2 py-0.5 rounded-lg text-[7.5px] font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20">
                                          Server Priority {row.priority ?? 50}
                                        </span>

                                        <span className="px-2 py-0.5 rounded-lg text-[7.5px] font-black uppercase tracking-widest bg-white/5 text-zinc-400 border border-white/5">
                                          {row.force_proxy ? 'Proxy' : 'Direct'}
                                        </span>

                                        <span className="px-2 py-0.5 rounded-lg text-[7.5px] font-black uppercase tracking-widest bg-white/5 text-zinc-400 border border-white/5 font-mono">
                                          {(row.type || 'hls').toUpperCase()}
                                        </span>
                                      </div>

                                      <h5 className="text-xs font-black text-white uppercase tracking-wider break-words">
                                        {targetName}
                                      </h5>

                                      {row.internal_note && (
                                        <p className="text-[9px] text-zinc-500 font-bold mt-1 break-words">
                                          Catatan: {row.internal_note}
                                        </p>
                                      )}

                                      <p className="text-[9px] text-zinc-600 font-mono mt-2 break-all select-all bg-zinc-950/40 p-2 rounded-lg border border-white/5">
                                        {row.url}
                                      </p>
                                    </div>

                                    <div className="flex flex-wrap gap-2 shrink-0">
                                      <button
                                        onClick={() => window.open(row.url, '_blank')}
                                        className="w-8 h-8 bg-white/5 hover:bg-sky-500/15 text-zinc-400 hover:text-sky-400 border border-white/5 rounded-xl flex items-center justify-center transition-all cursor-pointer"
                                        title="Buka URL"
                                      >
                                        <ExternalLink size={13} />
                                      </button>

                                      <button
                                        onClick={() => handleToggleEventServer(row)}
                                        disabled={serverSaving}
                                        className={`w-8 h-8 border rounded-xl flex items-center justify-center transition-all disabled:opacity-50 cursor-pointer ${row.is_active
                                          ? 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border-orange-500/20'
                                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                                          }`}
                                        title={row.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                                      >
                                        {row.is_active ? <PowerOff size={13} /> : <Power size={13} />}
                                      </button>

                                      <button
                                        onClick={() => handleDeleteEventServer(row)}
                                        disabled={serverSaving}
                                        className="w-8 h-8 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 cursor-pointer"
                                        title="Hapus"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (monitorTab as string) === 'schedule' ? ((() => {
                  const formatJadwalShort = (jadwal?: string) => {
                    return formatJadwalDateTimeForUserZone(jadwal);
                  };

                  // Filtered unique matches for Step 1
                  const filteredMatches = remoteUniqueMatches.filter((m) => {
                    const term = scheduleSearch.toLowerCase().trim();
                    if (!term) return true;
                    return (
                      m.player_1.toLowerCase().includes(term) ||
                      m.player_2.toLowerCase().includes(term) ||
                      m.nama_event.toLowerCase().includes(term)
                    );
                  });

                  // Step indicator bar
                  const StepIndicator = () => (
                    <div className="flex items-center gap-2 mb-6 select-none">
                      {[
                        { n: 1, label: 'Pilih Event' },
                        { n: 2, label: 'Pilih Channel' },
                        { n: 3, label: 'Simpan' },
                      ].map(({ n, label }, idx) => (
                        <div key={n} className="flex items-center gap-2">
                          <div className={`flex items-center gap-2 transition-all ${scheduleStep >= n ? 'opacity-100' : 'opacity-30'}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black border transition-all shrink-0 ${scheduleStep > n ? 'bg-emerald-500 border-emerald-500 text-dark'
                                : scheduleStep === n ? 'bg-primary border-primary text-dark'
                                  : 'bg-transparent border-zinc-700 text-zinc-500'
                              }`}>
                              {scheduleStep > n ? <Check size={10} strokeWidth={3} /> : n}
                            </div>
                            <span className={`text-[8.5px] font-black uppercase tracking-widest hidden sm:block ${scheduleStep === n ? 'text-white' : 'text-zinc-500'}`}>{label}</span>
                          </div>
                          {idx < 2 && <div className={`flex-1 min-w-[16px] h-px transition-all ${scheduleStep > n ? 'bg-emerald-500/60' : 'bg-white/5'}`} />}
                        </div>
                      ))}
                    </div>
                  );

                  return (
                    <div className="glass-card rounded-[2rem] p-6 border border-white/5 space-y-5 transition-all duration-300">
                      {/* Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
                        <div>
                          <h3 className="text-sm font-black text-white uppercase tracking-wider">Buat Jadwal Event</h3>
                          <p className="text-[9.5px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">
                            Wizard — data otomatis dari raw event terbaru
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => { fetchRemoteEvents(); setScheduleStep(1); setSelectedRawEventKey(''); setScheduleSearch(''); }}
                          disabled={remoteEventsLoading}
                          className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-300 rounded-xl text-[8.5px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50 cursor-pointer transition-all self-start sm:self-auto shrink-0"
                        >
                          <RefreshCw size={12} className={remoteEventsLoading ? 'animate-spin' : ''} />
                          {remoteEventsFetched ? 'Refresh Data' : 'Muat Data Live'}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* LEFT: Wizard Steps */}
                        <div className="lg:col-span-7 space-y-4">
                          <StepIndicator />

                          {/* ─── STEP 1: Pick event from raw ─── */}
                          {scheduleStep === 1 && (
                            <div className="space-y-4">
                              {/* Search */}
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={13} />
                                <input
                                  type="text"
                                  value={scheduleSearch}
                                  onChange={(e) => setScheduleSearch(e.target.value)}
                                  placeholder="Cari pertandingan... (misal: England, Brazil)"
                                  className="w-full bg-zinc-900 border border-white/5 rounded-xl pl-9 pr-9 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-primary/30 transition-all placeholder-zinc-600"
                                />
                                {scheduleSearch && (
                                  <button type="button" onClick={() => setScheduleSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer">
                                    <X size={12} />
                                  </button>
                                )}
                              </div>

                              {/* Loading */}
                              {remoteEventsLoading ? (
                                <div className="py-16 flex flex-col items-center justify-center gap-3">
                                  <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
                                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Memuat data live...</p>
                                </div>
                              ) : filteredMatches.length === 0 ? (
                                <div className="py-10 text-center">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Tidak ada pertandingan ditemukan</p>
                                  {!remoteEventsFetched && (
                                    <button
                                      type="button"
                                      onClick={fetchRemoteEvents}
                                      className="mt-3 px-4 py-2 bg-primary text-dark font-black rounded-xl text-[8.5px] uppercase tracking-widest cursor-pointer hover:scale-105 active:scale-95 transition-all"
                                    >
                                      Muat Data dari Server
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                                  {filteredMatches.map((match) => {
                                    const rawChs = getRemoteChannelsForMatch(match);
                                    const isSelected = selectedRawEventKey === match.id_event;
                                    return (
                                      <button
                                        key={`${match.player_1}|${match.player_2}|${match.jadwal_event}`}
                                        type="button"
                                        onClick={() => {
                                          setSelectedRawEventKey(match.id_event);
                                          // Auto-fill event states from raw
                                          setEventName(match.nama_event || 'Live Event');
                                          setEventPlayer1(match.player_1);
                                          setEventPlayer2(match.player_2);
                                          setEventLogo1(match.logo_1 || '');
                                          setEventLogo2(match.logo_2 || '');
                                          if (match.jadwal_event) {
                                            setEventStart(formatDateTimeLocalInWib(parseJadwal(match.jadwal_event)));
                                          }
                                          if (match.jadwal_stop) {
                                            setEventStop(formatDateTimeLocalInWib(parseJadwal(match.jadwal_stop)));
                                          }
                                          setScheduleChannelMode('raw');
                                          setEventSourceChannelId(rawChs[0]?.id_iptv || '');
                                          setScheduleStep(2);
                                        }}
                                        className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center gap-4 cursor-pointer ${isSelected
                                            ? 'bg-primary/10 border-primary/30 shadow-lg shadow-primary/5'
                                            : 'bg-zinc-900/50 border-white/5 hover:bg-zinc-800/60 hover:border-white/10'
                                          }`}
                                      >
                                        {/* Team Logos */}
                                        <div className="flex items-center gap-2 shrink-0">
                                          {match.logo_1 ? (
                                            <img src={match.logo_1} alt={match.player_1} className="w-8 h-8 object-contain rounded-lg bg-white/5 p-0.5" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                          ) : (
                                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[7px] font-black text-zinc-400">{match.player_1.slice(0, 2).toUpperCase()}</div>
                                          )}
                                          <span className="text-[10px] font-black text-zinc-400">vs</span>
                                          {match.logo_2 ? (
                                            <img src={match.logo_2} alt={match.player_2} className="w-8 h-8 object-contain rounded-lg bg-white/5 p-0.5" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                          ) : (
                                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[7px] font-black text-zinc-400">{match.player_2.slice(0, 2).toUpperCase()}</div>
                                          )}
                                        </div>
                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                            <span className="text-[7.5px] font-black uppercase tracking-widest px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded">
                                              {match.nama_event}
                                            </span>
                                            <span className="text-[7.5px] font-black uppercase tracking-widest px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                                              {rawChs.length} CH
                                            </span>
                                          </div>
                                          <p className="text-xs font-black text-white truncate">{match.player_1} <span className="text-zinc-500">vs</span> {match.player_2}</p>
                                          <p className="text-[9px] text-zinc-500 font-mono mt-0.5">📅 {formatJadwalShort(match.jadwal_event)}</p>
                                        </div>
                                        <ChevronRight size={14} className="text-zinc-600 shrink-0" />
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Manual option */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedRawEventKey('__manual__');
                                  setEventName('Live Event');
                                  setEventPlayer1('');
                                  setEventPlayer2('');
                                  setEventLogo1('');
                                  setEventLogo2('');
                                  setEventStart('');
                                  setEventStop('');
                                  setScheduleChannelMode('manual');
                                  setEventSourceChannelId('');
                                  setScheduleStep(2);
                                }}
                                className="w-full py-3 bg-white/3 hover:bg-white/5 border border-dashed border-white/10 hover:border-white/20 rounded-2xl text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-all cursor-pointer"
                              >
                                + Manual / Tidak Ada di List
                              </button>
                            </div>
                          )}

                          {/* ─── STEP 2: Pick Channel Source ─── */}
                          {scheduleStep === 2 && (
                            <div className="space-y-4">
                              {/* Selected event preview */}
                              {selectedRawEventKey !== '__manual__' && selectedRemoteMatch && (
                                <div className="p-4 bg-zinc-950/60 border border-white/5 rounded-2xl flex flex-col gap-3">
                                  <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 shrink-0">
                                      {selectedRemoteMatch.logo_1 && <img src={selectedRemoteMatch.logo_1} alt="" className="w-7 h-7 object-contain" />}
                                      <span className="text-[9px] text-zinc-500 font-black">vs</span>
                                      {selectedRemoteMatch.logo_2 && <img src={selectedRemoteMatch.logo_2} alt="" className="w-7 h-7 object-contain" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-black text-white truncate">{eventPlayer1} <span className="text-zinc-500">vs</span> {eventPlayer2}</p>
                                      <p className="text-[9px] text-zinc-400 font-mono mt-0.5">📅 {formatJadwalShort(selectedRemoteMatch.jadwal_event)}</p>
                                    </div>
                                  </div>
                                  {/* Kustomisasi Nama Event */}
                                  <div className="space-y-1.5 border-t border-white/5 pt-2">
                                    <label className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Kustomisasi Nama Event</label>
                                    <input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Live Event" className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-primary/30 transition-all" />
                                  </div>
                                </div>
                              )}

                              {/* Manual event fill — shown if __manual__ selected */}
                              {selectedRawEventKey === '__manual__' && (
                                <div className="space-y-3 p-4 bg-zinc-950/40 border border-white/5 rounded-2xl">
                                  <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Isi Data Event Manual</p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                      <label className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Nama Event</label>
                                      <input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Live Event" className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-primary/30 transition-all" />
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Mulai</label>
                                      <input type="datetime-local" value={eventStart} onChange={(e) => setEventStart(e.target.value)} className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-primary/30 transition-all" />
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Tim 1</label>
                                      <input value={eventPlayer1} onChange={(e) => setEventPlayer1(e.target.value)} placeholder="Argentina" className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-primary/30 transition-all" />
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Tim 2</label>
                                      <input value={eventPlayer2} onChange={(e) => setEventPlayer2(e.target.value)} placeholder="Austria" className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-primary/30 transition-all" />
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Logo Tim 1 (URL)</label>
                                      <input value={eventLogo1} onChange={(e) => setEventLogo1(e.target.value)} placeholder="https://flagcdn.com/w80/ar.png" className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-primary/30 transition-all" />
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Logo Tim 2 (URL)</label>
                                      <input value={eventLogo2} onChange={(e) => setEventLogo2(e.target.value)} placeholder="https://flagcdn.com/w80/at.png" className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-primary/30 transition-all" />
                                    </div>
                                    <div className="sm:col-span-2 space-y-1.5">
                                      <label className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Selesai (opsional)</label>
                                      <input type="datetime-local" value={eventStop} onChange={(e) => setEventStop(e.target.value)} className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-primary/30 transition-all" />
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Channel mode tabs */}
                              <div className="space-y-2">
                                <label className="text-[8.5px] font-black uppercase tracking-wider text-zinc-400">Pilih Channel Sumber</label>
                                <div className="flex bg-zinc-950/60 p-1 rounded-xl border border-white/5 gap-1 select-none">
                                  {([
                                    { mode: 'raw', label: '📡 CH dari Raw', show: selectedRawEventKey !== '__manual__' },
                                    { mode: 'web', label: '📺 iOS / Web', show: true },
                                    { mode: 'manual', label: '✏️ Manual', show: true },
                                  ] as const).filter(t => t.show).map(({ mode, label }) => (
                                    <button
                                      key={mode}
                                      type="button"
                                      onClick={() => { setScheduleChannelMode(mode); }}
                                      className={`flex-1 py-1.5 text-[8px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${scheduleChannelMode === mode
                                          ? 'bg-primary text-dark shadow-lg shadow-primary/10'
                                          : 'text-zinc-400 hover:text-white'
                                        }`}
                                    >
                                      {label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* CH from Raw */}
                              {scheduleChannelMode === 'raw' && selectedRemoteMatch && (
                                <div className="space-y-2">
                                  <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Pilih Channel (dari raw)</p>
                                  <div className="space-y-2">
                                    {getRemoteChannelsForMatch(selectedRemoteMatch).map((ch, idx) => {
                                      const isSelected = eventSourceChannelId === ch.id_iptv;
                                      return (
                                        <button
                                          key={`${ch.id_iptv}-${idx}`}
                                          type="button"
                                          onClick={() => setEventSourceChannelId(ch.id_iptv)}
                                          className={`w-full text-left p-3 rounded-xl border flex items-center gap-3 transition-all cursor-pointer ${isSelected
                                              ? 'bg-primary/10 border-primary/30 text-white'
                                              : 'bg-zinc-900/50 border-white/5 hover:bg-zinc-800/60 hover:border-white/10 text-zinc-300'
                                            }`}
                                        >
                                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-primary border-primary' : 'border-zinc-600'}`}>
                                            {isSelected && <Check size={10} strokeWidth={3} className="text-dark" />}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black uppercase tracking-wider">{ch.nama_event} — CH {idx + 1}</p>
                                            <p className="text-[8px] text-zinc-500 font-mono mt-0.5 truncate">{ch.jenis.toUpperCase()} · ID: {ch.id_iptv}</p>
                                          </div>
                                          {isSelected && <Check size={13} className="text-primary shrink-0" />}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* iOS / Web channel */}
                              {scheduleChannelMode === 'web' && (
                                <div className="space-y-2">
                                  <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Pilih channel dari sistem web</p>
                                  <SearchableSelect
                                    options={sourceChannelsForEvent.map((ch) => ({
                                      id: ch.id,
                                      name: ch.name,
                                      subName: ch.subName,
                                    }))}
                                    value={scheduleWebSourceId}
                                    onChange={(val) => setScheduleWebSourceId(val)}
                                    placeholder="Cari channel..."
                                  />
                                </div>
                              )}

                              {/* Manual channel ID */}
                              {scheduleChannelMode === 'manual' && (
                                <div className="space-y-2">
                                  <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Ketik source_channel_id manual</p>
                                  <input
                                    value={scheduleManualSourceId}
                                    onChange={(e) => setScheduleManualSourceId(e.target.value)}
                                    placeholder="Contoh: rtbgo, 4228, beinsports1..."
                                    className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-primary/30 transition-all font-mono"
                                  />
                                  <p className="text-[8px] text-zinc-600 font-bold">ID ini harus cocok dengan id_iptv atau id channel yang terdaftar di sistem.</p>
                                </div>
                              )}

                              {/* Catatan Internal */}
                              <div className="space-y-1.5">
                                <label className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Catatan Internal (opsional)</label>
                                <input
                                  value={eventInternalNote}
                                  onChange={(e) => setEventInternalNote(e.target.value)}
                                  placeholder="Catatan admin, tidak tampil ke user"
                                  className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-primary/30 transition-all"
                                />
                              </div>

                              {/* Nav buttons */}
                              <div className="flex items-center justify-between gap-3 pt-2">
                                <button
                                  type="button"
                                  onClick={() => setScheduleStep(1)}
                                  className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 font-black rounded-xl text-[9px] uppercase tracking-widest flex items-center gap-2 cursor-pointer transition-all"
                                >
                                  <ChevronLeft size={13} />
                                  Kembali
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const sid = scheduleChannelMode === 'raw' ? eventSourceChannelId : scheduleChannelMode === 'web' ? scheduleWebSourceId : scheduleManualSourceId;
                                    if (!eventPlayer1.trim() || !eventPlayer2.trim()) { setCustomEventMessage('Isi nama kedua tim dulu.'); return; }
                                    if (!eventStart) { setCustomEventMessage('Isi jam mulai dulu.'); return; }
                                    if (!sid.trim()) { setCustomEventMessage('Pilih atau isi channel sumber dulu.'); return; }
                                    setCustomEventMessage('');
                                    setScheduleStep(3);
                                  }}
                                  className="px-5 py-2.5 bg-primary text-dark font-black rounded-xl text-[9px] uppercase tracking-widest flex items-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/10"
                                >
                                  Lanjut — Preview
                                  <ChevronRight size={13} />
                                </button>
                              </div>
                            </div>
                          )}

                          {/* ─── STEP 3: Preview & Save ─── */}
                          {scheduleStep === 3 && (() => {
                            const resolvedSid = scheduleChannelMode === 'raw' ? eventSourceChannelId : scheduleChannelMode === 'web' ? scheduleWebSourceId : scheduleManualSourceId;
                            const channelLabel = scheduleChannelMode === 'raw'
                              ? `📡 CH Raw (${resolvedSid})`
                              : scheduleChannelMode === 'web'
                                ? `📺 ${sourceChannelsForEvent.find((c) => c.id === resolvedSid)?.name || resolvedSid}`
                                : `✏️ Manual: ${resolvedSid}`;
                            return (
                              <div className="space-y-4">
                                <p className="text-[8.5px] font-black uppercase tracking-wider text-zinc-400">Preview Card yang Akan Dibuat</p>
                                {/* Preview Card */}
                                <div className="p-5 bg-zinc-950/60 border border-white/8 rounded-2xl space-y-4">
                                  <div className="flex flex-wrap gap-2">
                                    <span className="text-[7.5px] font-black uppercase tracking-widest px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded">
                                      {eventName || 'Live Event'}
                                    </span>
                                  </div>
                                  {/* Teams */}
                                  <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2.5">
                                      {eventLogo1 ? (
                                        <img src={eventLogo1} alt={eventPlayer1} className="w-10 h-10 object-contain rounded-xl bg-white/5 p-1" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                      ) : (
                                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-[10px] font-black text-zinc-400">{eventPlayer1.slice(0, 2).toUpperCase()}</div>
                                      )}
                                      <span className="text-sm font-black text-white">{eventPlayer1 || '—'}</span>
                                    </div>
                                    <span className="text-[10px] font-black text-zinc-500 uppercase">vs</span>
                                    <div className="flex items-center gap-2.5">
                                      {eventLogo2 ? (
                                        <img src={eventLogo2} alt={eventPlayer2} className="w-10 h-10 object-contain rounded-xl bg-white/5 p-1" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                      ) : (
                                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-[10px] font-black text-zinc-400">{eventPlayer2.slice(0, 2).toUpperCase()}</div>
                                      )}
                                      <span className="text-sm font-black text-white">{eventPlayer2 || '—'}</span>
                                    </div>
                                  </div>
                                  {/* Meta */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[9px] font-mono">
                                    <div className="bg-zinc-900/50 rounded-xl p-2.5 border border-white/5">
                                      <p className="text-zinc-500 font-black uppercase text-[7px] tracking-wider mb-1">Mulai</p>
                                      <p className="text-white">{eventStart ? formatJadwalShort(eventStart) : '—'}</p>
                                    </div>
                                    <div className="bg-zinc-900/50 rounded-xl p-2.5 border border-white/5">
                                      <p className="text-zinc-500 font-black uppercase text-[7px] tracking-wider mb-1">Selesai</p>
                                      <p className="text-white">{eventStop ? formatJadwalShort(eventStop) : 'Tidak diatur'}</p>
                                    </div>
                                  </div>
                                  <div className="bg-zinc-900/50 rounded-xl p-2.5 border border-white/5">
                                    <p className="text-zinc-500 font-black uppercase text-[7px] tracking-wider mb-1">Channel Sumber</p>
                                    <p className="text-white text-[10px] font-black">{channelLabel}</p>
                                  </div>
                                  {eventInternalNote && (
                                    <div className="bg-zinc-900/50 rounded-xl p-2.5 border border-white/5">
                                      <p className="text-zinc-500 font-black uppercase text-[7px] tracking-wider mb-1">Catatan Internal</p>
                                      <p className="text-zinc-300 text-[9px]">{eventInternalNote}</p>
                                    </div>
                                  )}
                                </div>

                                {customEventMessage && (
                                  <p className={`text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl border ${customEventMessage.includes('berhasil') ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10' : 'bg-primary/5 text-primary border-primary/10'}`}>
                                    {customEventMessage}
                                  </p>
                                )}

                                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                                  <button
                                    type="button"
                                    onClick={() => setScheduleStep(2)}
                                    className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 font-black rounded-xl text-[9px] uppercase tracking-widest flex items-center gap-2 cursor-pointer transition-all"
                                  >
                                    <ChevronLeft size={13} />
                                    Kembali
                                  </button>
                                  <div className="flex gap-3">
                                    <button
                                      type="button"
                                      onClick={() => handleSaveCustomEvent(false)}
                                      disabled={customEventSaving}
                                      className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white border border-white/10 font-black rounded-xl text-[9px] uppercase tracking-widest disabled:opacity-50 cursor-pointer transition-all"
                                    >
                                      Simpan Nonaktif
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveCustomEvent(true)}
                                      disabled={customEventSaving}
                                      className="px-5 py-2.5 bg-primary text-dark font-black rounded-xl text-[9px] uppercase tracking-widest disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/10 cursor-pointer"
                                    >
                                      {customEventSaving ? 'Menyimpan...' : '✓ Buat & Aktifkan'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {/* RIGHT: Jadwal Buatan Admin list */}
                        <div className="lg:col-span-5 border-t border-white/5 pt-6 lg:border-t-0 lg:pt-0 lg:border-l lg:border-white/5 lg:pl-6 space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <h4 className="text-xs font-black text-white uppercase tracking-wider">Jadwal Buatan Admin</h4>
                              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">Daftar jadwal kustom yang aktif</p>
                            </div>
                            <button
                              onClick={loadCustomEvents}
                              disabled={customEventLoading}
                              className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-300 rounded-xl text-[8.5px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50 cursor-pointer transition-all self-start sm:self-auto"
                            >
                              <RefreshCcw size={12} className={customEventLoading ? 'animate-spin' : ''} />
                              Refresh
                            </button>
                          </div>

                          {customEventLoading ? (
                            <div className="py-12 flex items-center justify-center">
                              <div className="w-7 h-7 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                          ) : customEvents.length === 0 ? (
                            <div className="p-8 bg-zinc-950/30 border border-white/5 rounded-2xl text-center">
                              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-wider">Belum ada jadwal buatan admin.</p>
                            </div>
                          ) : (
                            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
                              {customEvents.map((row) => (
                                <div
                                  key={row.id}
                                  className="p-4 bg-zinc-950/40 hover:bg-zinc-950/60 border border-white/5 rounded-2xl space-y-3 hover:border-white/10 transition-all"
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap gap-2 mb-2">
                                        <span className={`px-2 py-0.5 rounded-lg text-[7.5px] font-black uppercase tracking-widest border ${row.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-800/60 text-zinc-500 border-white/5'}`}>
                                          {row.is_active ? 'Aktif' : 'Nonaktif'}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-lg text-[7.5px] font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20">
                                          {row.nama_event || 'Live Event'}
                                        </span>
                                      </div>
                                      <h5 className="text-xs font-black text-white uppercase tracking-wider break-words">{row.player_1} vs {row.player_2}</h5>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-[9px] font-mono">
                                        <div className="bg-zinc-950/40 p-2 rounded-lg border border-white/5">
                                          <p className="text-zinc-500 font-black uppercase text-[7px] tracking-wider mb-1">Mulai</p>
                                          <p className="text-zinc-300">{formatJadwalShort(row.jadwal_event)}</p>
                                        </div>
                                        <div className="bg-zinc-950/40 p-2 rounded-lg border border-white/5">
                                          <p className="text-zinc-500 font-black uppercase text-[7px] tracking-wider mb-1">Selesai</p>
                                          <p className="text-zinc-300">{row.jadwal_stop ? formatJadwalShort(row.jadwal_stop) : 'Tidak diatur'}</p>
                                        </div>
                                      </div>
                                      <p className="text-[9px] text-zinc-500 font-mono mt-1 break-all bg-zinc-950/40 p-2 rounded-lg border border-white/5">
                                        Source ID: {row.source_channel_id}
                                      </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2 shrink-0">
                                      <button
                                        onClick={() => handleToggleCustomEvent(row)}
                                        disabled={customEventSaving}
                                        className={`w-8 h-8 border rounded-xl flex items-center justify-center transition-all disabled:opacity-50 cursor-pointer ${row.is_active ? 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border-orange-500/20' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'}`}
                                        title={row.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                                      >
                                        {row.is_active ? <PowerOff size={13} /> : <Power size={13} />}
                                      </button>
                                      <button
                                        onClick={() => handleDeleteCustomEvent(row)}
                                        disabled={customEventSaving}
                                        className="w-8 h-8 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 cursor-pointer"
                                        title="Hapus"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()
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
                        <button
                          onClick={() => setMonitorTab('servers')}
                          className={`flex-shrink-0 px-4 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${(monitorTab as string) === 'servers'
                            ? 'bg-primary text-dark font-black shadow-lg shadow-primary/10'
                            : 'text-zinc-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                          Server Live
                        </button>
                        <button
                          onClick={() => setMonitorTab('schedule')}
                          className={`flex-shrink-0 px-4 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${(monitorTab as string) === 'schedule'
                            ? 'bg-primary text-dark font-black shadow-lg shadow-primary/10'
                            : 'text-zinc-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                          Buat Jadwal
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

                      {monitorTab === 'matches' && (
                        <div className="flex flex-row overflow-x-auto bg-zinc-950/40 p-1.5 rounded-xl border border-white/5 gap-1.5 select-none w-full custom-scrollbar pb-2 sm:pb-1">
                          {visibleMatchCategoryTabs.map((tab) => {
                            const isActive = matchCategoryTab === tab.id;
                            const count = matchCategoryCounts[tab.id] || 0;

                            return (
                              <button
                                key={tab.id}
                                onClick={() => {
                                  setMatchCategoryTab(tab.id);
                                  setSelectedChannel(null);
                                }}
                                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[8.5px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer border ${isActive
                                  ? 'text-dark border-transparent shadow-lg'
                                  : 'text-zinc-400 hover:text-white hover:bg-white/5 border-white/5'
                                  }`}
                                style={isActive ? { background: tab.color, boxShadow: `0 0 14px ${tab.color}22` } : undefined}
                              >
                                <span>{tab.icon}</span>
                                <span>{tab.label}</span>
                                <span className={`rounded-full px-1.5 py-0.5 text-[7px] font-black ${isActive
                                  ? 'bg-black/20 text-dark'
                                  : 'bg-white/5 text-zinc-500'
                                  }`}>
                                  {count}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}

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
                                className={`flex flex-col ${selectedChannel ? 'w-full' : 'sm:flex-row sm:items-center'} justify-between p-3.5 bg-zinc-950/40 border rounded-[1.25rem] gap-3 transition-all hover:bg-zinc-900/40 cursor-pointer ${isSelected
                                  ? 'border-primary shadow-lg shadow-primary/10'
                                  : hasActiveViewers
                                    ? 'border-primary/25 shadow-md shadow-primary/[0.02]'
                                    : 'border-white/5'
                                  }`}>
                                <div className={`flex items-center gap-3.5 min-w-0 ${selectedChannel ? '' : 'sm:pr-4'} flex-1`}>
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
                                    <h4 className={`text-xs font-black text-white ${selectedChannel ? 'break-words' : 'md:truncate'} mt-1 group-hover:text-primary transition-colors`}>
                                      {ch.name}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-0.5 md:truncate flex-wrap">
                                      {ch.subName && (
                                        <p className={`text-[8.5px] text-zinc-500 font-bold ${selectedChannel ? 'break-words' : 'md:truncate'} uppercase tracking-wider`}>
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
                                <div className={`flex items-center gap-3 shrink-0 justify-end w-full ${selectedChannel ? 'w-full border-t border-white/5 pt-2.5' : 'sm:w-auto sm:border-t-0 sm:pt-0'} pt-2.5`}>
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
                              const isMe = msg.username === 'YKN TV' && msg.avatar?.includes('ykn-tv-logo');
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
                                  <div className={`px-2.5 py-1.5 rounded-xl text-xs font-bold leading-relaxed break-words w-fit max-w-[90%] ${isMe
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
