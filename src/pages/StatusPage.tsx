import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Server,
  Shield,
  Tv,
  Users,
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { getLiveSportsData, slugify, type PlayableStream } from '../services/streamService';
import { formatBracketText } from '../utils/textFormatter';
import { formatJadwalDateTimeForUserZone, parseJadwalDate } from '../utils/indonesiaTime';

type StatusTab = 'all' | 'events' | 'sports' | 'live';
type ItemKind = 'event' | 'sports' | 'live';
type StatusTone = 'live' | 'ready' | 'upcoming' | 'grace' | 'finished' | 'empty';

interface MonitorRoom {
  roomId: string;
  viewers: number;
}

interface StatusItem {
  stream: PlayableStream;
  kind: ItemKind;
  status: StatusTone;
  statusLabel: string;
  detail: string;
  timeLabel: string;
  serverCount: number;
  primaryType: string;
  hasDrm: boolean;
  viewers: number;
  href: string;
  sortRank: number;
  sortTime: number;
  searchText: string;
}

const REFRESH_COOLDOWN_MS = 15000;

const statusStyle: Record<StatusTone, string> = {
  live: 'bg-red-500/12 text-red-300 border-red-500/25',
  ready: 'bg-emerald-500/12 text-emerald-300 border-emerald-500/25',
  upcoming: 'bg-amber-500/12 text-amber-300 border-amber-500/25',
  grace: 'bg-sky-500/12 text-sky-300 border-sky-500/25',
  finished: 'bg-zinc-500/12 text-zinc-400 border-zinc-500/20',
  empty: 'bg-rose-500/12 text-rose-300 border-rose-500/25',
};

const kindLabel: Record<ItemKind, string> = {
  event: 'Event',
  sports: 'Sports TV',
  live: 'Live TV',
};

const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'Y';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

const formatViewerCount = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value);
};

const getApiBase = () => {
  const envVal = import.meta.env.VITE_BOT_API_URL;
  return envVal === '/api' ? '' : (envVal || 'https://api.ykn.my.id');
};

const getStreamPath = (stream: PlayableStream) => {
  if (stream.isChannel) return `/watch/${slugify(stream.name)}`;
  return `/watch/${slugify(stream.name)}-${stream.id}`;
};

const getEventStatus = (stream: PlayableStream, hasPlayableServer: boolean) => {
  if (!hasPlayableServer) {
    return {
      status: 'empty' as const,
      statusLabel: 'URL Kosong',
      detail: 'Tidak ada server aktif',
      sortRank: 5,
      sortTime: Number.MAX_SAFE_INTEGER,
      timeLabel: '-',
    };
  }

  if (stream.isChannel || !stream.jadwal_event) {
    return {
      status: 'ready' as const,
      statusLabel: 'Siap',
      detail: 'Channel tersedia',
      sortRank: 1,
      sortTime: Number.MAX_SAFE_INTEGER,
      timeLabel: 'Live TV',
    };
  }

  const start = parseJadwalDate(stream.jadwal_event);
  const stop = stream.jadwal_stop ? parseJadwalDate(stream.jadwal_stop) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const playableStart = new Date(start.getTime() - 30 * 60 * 1000);
  const playableEnd = new Date(stop.getTime() + 30 * 60 * 1000);
  const now = new Date();
  const timeLabel = formatJadwalDateTimeForUserZone(stream.jadwal_event);

  if (now > playableEnd) {
    return {
      status: 'finished' as const,
      statusLabel: 'Selesai',
      detail: 'Jadwal berakhir',
      sortRank: 4,
      sortTime: start.getTime(),
      timeLabel,
    };
  }

  if (now > stop) {
    return {
      status: 'grace' as const,
      statusLabel: 'Selesai',
      detail: 'Masih dalam window akhir',
      sortRank: 3,
      sortTime: start.getTime(),
      timeLabel,
    };
  }

  if (now >= playableStart) {
    return {
      status: 'live' as const,
      statusLabel: 'Live',
      detail: 'Sedang bisa ditonton',
      sortRank: 0,
      sortTime: start.getTime(),
      timeLabel,
    };
  }

  return {
    status: 'upcoming' as const,
    statusLabel: 'Akan Datang',
    detail: 'Belum masuk window live',
    sortRank: 2,
    sortTime: start.getTime(),
    timeLabel,
  };
};

const StatusPage = () => {
  const navigate = useNavigate();
  const [streams, setStreams] = useState<{ matches: PlayableStream[]; sportsTv: PlayableStream[]; liveTv: PlayableStream[] }>({
    matches: [],
    sportsTv: [],
    liveTv: [],
  });
  const [viewerCounts, setViewerCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<StatusTab>('all');

  const loadStatus = async (manual = false) => {
    const now = Date.now();
    if (manual && now - lastRefreshAt < REFRESH_COOLDOWN_MS) return;

    if (manual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      const dataPromise = getLiveSportsData();
      const monitoringPromise = axios.get<MonitorRoom[]>(`${getApiBase()}/api/sports/monitoring`, { timeout: 6000 });
      const [dataResult, monitoringResult] = await Promise.allSettled([dataPromise, monitoringPromise]);

      if (dataResult.status === 'rejected') {
        throw dataResult.reason;
      }

      setStreams(dataResult.value);

      if (monitoringResult.status === 'fulfilled' && Array.isArray(monitoringResult.value.data)) {
        const nextCounts: Record<string, number> = {};
        monitoringResult.value.data.forEach((room) => {
          if (room?.roomId) nextCounts[room.roomId] = Number(room.viewers || 0);
        });
        setViewerCounts(nextCounts);
      } else {
        setViewerCounts({});
      }

      setLastUpdated(new Date());
      setLastRefreshAt(Date.now());
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat status siaran');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStatus(false);
  }, []);

  const items = useMemo<StatusItem[]>(() => {
    const rows: Array<{ stream: PlayableStream; kind: ItemKind }> = [
      ...streams.matches.map((stream) => ({ stream, kind: 'event' as const })),
      ...streams.sportsTv.map((stream) => ({ stream, kind: 'sports' as const })),
      ...streams.liveTv.map((stream) => ({ stream, kind: 'live' as const })),
    ];

    return rows
      .map(({ stream, kind }) => {
        const playableServers = (stream.servers || []).filter((server) => !!server.url);
        const status = getEventStatus(stream, playableServers.length > 0);
        const primaryType = (playableServers[0]?.type || 'unknown').toUpperCase();
        const hasDrm = playableServers.some((server) => !!server.keyId || !!server.key || !!server.keys || server.type.toLowerCase().includes('clear'));
        const href = getStreamPath(stream);

        return {
          stream,
          kind,
          ...status,
          serverCount: playableServers.length,
          primaryType,
          hasDrm,
          viewers: viewerCounts[stream.id] || 0,
          href,
          searchText: `${stream.name} ${stream.subName || ''} ${kindLabel[kind]} ${stream.id}`.toLowerCase(),
        };
      })
      .sort((a, b) => {
        if (a.sortRank !== b.sortRank) return a.sortRank - b.sortRank;
        if (a.sortTime !== b.sortTime) return a.sortTime - b.sortTime;
        return a.stream.name.localeCompare(b.stream.name);
      });
  }, [streams, viewerCounts]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      const matchesTab =
        activeTab === 'all' ||
        (activeTab === 'events' && item.kind === 'event') ||
        (activeTab === 'sports' && item.kind === 'sports') ||
        (activeTab === 'live' && item.kind === 'live');

      if (!matchesTab) return false;
      if (!term) return true;
      return item.searchText.includes(term);
    });
  }, [items, activeTab, searchTerm]);

  const stats = useMemo(() => {
    const liveEvents = items.filter((item) => item.kind === 'event' && item.status === 'live').length;
    const upcomingEvents = items.filter((item) => item.kind === 'event' && item.status === 'upcoming').length;
    const readyChannels = items.filter((item) => item.kind !== 'event' && item.status === 'ready').length;
    const totalViewers = items.reduce((sum, item) => sum + item.viewers, 0);

    return { liveEvents, upcomingEvents, readyChannels, totalViewers };
  }, [items]);

  const tabs: Array<{ id: StatusTab; label: string; count: number }> = [
    { id: 'all', label: 'Semua', count: items.length },
    { id: 'events', label: 'Event', count: items.filter((item) => item.kind === 'event').length },
    { id: 'sports', label: 'Sports', count: items.filter((item) => item.kind === 'sports').length },
    { id: 'live', label: 'Live TV', count: items.filter((item) => item.kind === 'live').length },
  ];

  return (
    <MainLayout disableLiveBadge>
      <div className="px-4 md:px-8 py-6 md:py-8 space-y-6">
        <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest">
              <Activity size={13} />
              Status Center
            </div>
            <h1 className="text-3xl md:text-5xl font-display font-black uppercase tracking-tight italic">
              Status Siaran
            </h1>
            <p className="text-xs md:text-sm text-zinc-500 font-bold max-w-2xl">
              Ringkasan event, channel, server, format, dan penonton aktif tanpa membuka player.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">Update terakhir</p>
              <p className="text-xs text-zinc-300 font-bold">{lastUpdated ? lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</p>
            </div>
            <button
              onClick={() => loadStatus(true)}
              disabled={refreshing || loading}
              className="h-11 px-4 rounded-lg bg-primary text-black font-black text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-primary/90 disabled:opacity-60 disabled:pointer-events-none transition-all cursor-pointer"
            >
              {refreshing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              Refresh
            </button>
          </div>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-lg border border-white/8 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-red-300 mb-3">
              <Activity size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Live Event</span>
            </div>
            <p className="text-2xl font-black">{stats.liveEvents}</p>
          </div>
          <div className="rounded-lg border border-white/8 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-amber-300 mb-3">
              <CalendarClock size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Upcoming</span>
            </div>
            <p className="text-2xl font-black">{stats.upcomingEvents}</p>
          </div>
          <div className="rounded-lg border border-white/8 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-emerald-300 mb-3">
              <Tv size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Channel</span>
            </div>
            <p className="text-2xl font-black">{stats.readyChannels}</p>
          </div>
          <div className="rounded-lg border border-white/8 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sky-300 mb-3">
              <Users size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Viewer</span>
            </div>
            <p className="text-2xl font-black">{formatViewerCount(stats.totalViewers)}</p>
          </div>
        </section>

        <section className="rounded-lg border border-white/8 bg-[#080808]/80 overflow-hidden">
          <div className="p-4 border-b border-white/8 flex flex-col xl:flex-row gap-3 xl:items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-primary text-black border-primary'
                      : 'bg-white/[0.03] text-zinc-400 border-white/8 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  {tab.label} <span className="opacity-70">({tab.count})</span>
                </button>
              ))}
            </div>

            <div className="relative w-full xl:w-80">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Cari event atau channel"
                className="w-full h-10 rounded-lg bg-black/40 border border-white/8 pl-9 pr-3 text-sm outline-none focus:border-primary/40 placeholder:text-zinc-700"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Loader2 className="text-primary animate-spin" size={34} />
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Memuat status</p>
            </div>
          ) : error ? (
            <div className="py-16 px-4 flex flex-col items-center justify-center gap-3 text-center">
              <AlertTriangle className="text-red-400" size={34} />
              <p className="text-sm text-zinc-300 font-bold">{error}</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 px-4 text-center">
              <p className="text-sm text-zinc-500 font-bold">Tidak ada data yang cocok.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/6">
              {filteredItems.map((item) => (
                <div
                  key={`${item.kind}-${item.stream.id}`}
                  className="p-4 flex flex-col lg:flex-row lg:items-center gap-4 hover:bg-white/[0.025] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-lg bg-white/[0.05] border border-white/8 flex items-center justify-center text-xs font-black text-primary shrink-0">
                      {getInitials(item.stream.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`px-2 py-1 rounded-md border text-[9px] font-black uppercase tracking-wider ${statusStyle[item.status]}`}>
                          {item.statusLabel}
                        </span>
                        <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">{kindLabel[item.kind]}</span>
                      </div>
                      <h2 className="text-sm md:text-base font-black text-white truncate">{item.stream.name}</h2>
                      <div className="text-[10px] text-zinc-500 font-bold truncate flex items-center gap-1.5 flex-wrap">
                        {formatBracketText(item.stream.subName || item.detail)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex lg:items-center gap-2 lg:gap-3 text-[10px] font-bold text-zinc-400">
                    <div className="h-9 px-3 rounded-lg bg-white/[0.03] border border-white/6 flex items-center gap-2">
                      <Clock size={13} className="text-zinc-500" />
                      <span className="truncate max-w-[150px]">{item.timeLabel}</span>
                    </div>
                    <div className="h-9 px-3 rounded-lg bg-white/[0.03] border border-white/6 flex items-center gap-2">
                      <Server size={13} className="text-zinc-500" />
                      <span>{item.serverCount} server</span>
                    </div>
                    <div className="h-9 px-3 rounded-lg bg-white/[0.03] border border-white/6 flex items-center gap-2">
                      {item.hasDrm ? <Shield size={13} className="text-primary" /> : <CheckCircle2 size={13} className="text-emerald-400" />}
                      <span>{item.primaryType}</span>
                    </div>
                    <div className="h-9 px-3 rounded-lg bg-white/[0.03] border border-white/6 flex items-center gap-2">
                      <Users size={13} className="text-zinc-500" />
                      <span>{formatViewerCount(item.viewers)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(item.href)}
                    className="h-9 px-3 rounded-lg bg-white/[0.04] hover:bg-primary hover:text-black border border-white/8 text-zinc-300 font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
                  >
                    Buka
                    <ExternalLink size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  );
};

export default StatusPage;
