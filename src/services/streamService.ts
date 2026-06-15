import stableChannels from '../data/stable_channels.json';
import backupEvents from '../data/tv-events.json';
import backupSports from '../data/tv-sports.json';
import backupLive from '../data/tv-hiburan.json';
import axios from 'axios';

export interface StreamServer {
  name: string;
  url: string;
  type: string;
  keyId?: string;
  key?: string;
}

export interface PlayableStream {
  id: string;
  name: string;
  subName?: string;
  logo?: string;
  logo2?: string;
  isBase64Logo?: boolean;
  servers: StreamServer[];
  isChannel?: boolean;
  player1?: string;
  player2?: string;
  jadwal_event?: string;
  jadwal_stop?: string;
  deskripsi?: string;
  deskripsi_en?: string;
}

interface MatchEvent {
  id_event: string;
  nama_event: string;
  player_1: string;
  player_2: string;
  logo_1?: string;
  logo_2?: string;
  jadwal_event?: string;
  jadwal_stop?: string;
  url_iptv: string;
  url_license?: string;
  jenis: string;
  deskripsi?: string;
  deskripsi_en?: string;
}

interface ChannelEvent {
  id_iptv: string;
  nama_channel: string;
  url_iptv: string;
  url_license?: string;
  jenis: string;
  gbr_base64?: string;
  tagline?: string;
  premium?: string;
  aktif?: string;
}

const XOR_KEY = '90_NiwmsdfhgjQw';

export const decryptLicense = (ciphertext: string): string => {
  try {
    const binary = atob(ciphertext);
    let result = '';
    for (let i = 0; i < binary.length; i++) {
      result += String.fromCharCode(binary.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length));
    }
    return result;
  } catch (e) {
    console.error('Decryption failed', e);
    return '';
  }
};

export const buildServers = (urlIptv: string, urlLicense: string | undefined, jenis: string): StreamServer[] => {
  const decryptedLicense = urlLicense ? decryptLicense(urlLicense) : '';
  const servers: StreamServer[] = [];

  servers.push({
    name: 'Server 1',
    url: urlIptv,
    type: jenis
  });

  if (decryptedLicense) {
    if (decryptedLicense.includes(':') && !decryptedLicense.startsWith('http')) {
      const [keyId, key] = decryptedLicense.split(':');
      servers[0].keyId = keyId;
      servers[0].key = key;
    } else if (decryptedLicense.startsWith('http')) {
      servers.push({
        name: 'Server 2 (Alt)',
        url: decryptedLicense,
        type: 'hls'
      });
    }
  }
  return servers;
};

// Reliable CORS Proxy Helper
export const getProxiedUrl = (url: string, force = false) => {
  const restrictedDomains = ['alkassdigital.net', 'shooflive', 'shoof.alkass.net', '30a-tv.com', 'ok.ru', 'streamlock.net'];
  const needsProxy = force || restrictedDomains.some(domain => url.includes(domain));
  
  if (needsProxy) {
    const proxyBase = import.meta.env.VITE_PROXY_BASE_URL || 'http://147.135.252.68:20114/api/proxy';
    const cleanUrl = url.replace(/^(https?):\/\//, '$1/');
    return `${proxyBase}/${cleanUrl}`;
  }
  return url;
};

// Clean HTML tags and redundant text from match descriptions
export const cleanDescription = (desc?: string): string => {
  if (!desc) return '';
  return desc
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/Siaran langsung pertandingan.*?\./gi, '')
    .replace(/Live broadcast of the match.*?\./gi, '')
    .replace(/di YKN TV/gi, '')
    .trim();
};

// Get channels / events from dynamic Raw configurations
export const getLiveSportsData = async (): Promise<{
  matches: PlayableStream[];
  sportsTv: PlayableStream[];
  liveTv: PlayableStream[];
}> => {
  let eventsData: MatchEvent[] = [];
  let sportsData: ChannelEvent[] = [];
  let liveData: ChannelEvent[] = [];

  try {
    // 1. Primary Source: Fetch from the bot's API endpoints
    const BOT_API_URL = import.meta.env.VITE_BOT_API_URL || 'http://147.135.252.68:20114';
    const [eventsRes, sportsRes, liveRes] = await Promise.all([
      axios.get<MatchEvent[]>(`${BOT_API_URL}/api/sports/events`),
      axios.get<ChannelEvent[]>(`${BOT_API_URL}/api/sports/tv`),
      axios.get<ChannelEvent[]>(`${BOT_API_URL}/api/sports/hiburan`)
    ]);
    eventsData = eventsRes.data;
    sportsData = sportsRes.data;
    liveData = liveRes.data;
  } catch (botErr) {
    console.warn('Failed to fetch from Bot API, trying GitHub raw fallback...', botErr);
    
    // 2. First Fallback (Backup): Fetch from external GitHub configurations
    try {
      const [eventsRes, sportsRes, liveRes] = await Promise.all([
        axios.get<MatchEvent[]>('https://raw.githubusercontent.com/movietrailersxxi-pixel/web/main/assets/tv-events.dat'),
        axios.get<ChannelEvent[]>('https://raw.githubusercontent.com/movietrailersxxi-pixel/web/main/assets/tv-sports.dat'),
        axios.get<ChannelEvent[]>('https://raw.githubusercontent.com/movietrailersxxi-pixel/web/main/assets/tv-hiburan.dat')
      ]);
      eventsData = eventsRes.data;
      sportsData = sportsRes.data;
      liveData = liveRes.data;
    } catch (githubErr) {
      console.warn('Failed to fetch from GitHub source, falling back to local JSON data...', githubErr);
      
      // 3. Second Fallback (Final Backup): Use local imported JSON files
      eventsData = backupEvents as MatchEvent[];
      sportsData = backupSports as ChannelEvent[];
      liveData = backupLive as ChannelEvent[];
    }
  }

  // If we couldn't load anything (both APIs and backups empty), use stable channels
  if (eventsData.length === 0 && sportsData.length === 0 && liveData.length === 0) {
    console.warn('All configurations empty or failed, using stable channels only...');
    const channels = stableChannels as any[];
    const mappedSports: PlayableStream[] = [];
    const mappedLive: PlayableStream[] = [];

    channels.forEach(ch => {
      const stream: PlayableStream = {
        id: ch.id,
        name: ch.name,
        subName: ch.now_playing,
        logo: ch.logo,
        isBase64Logo: false,
        servers: [{ name: 'Server 1', url: ch.url, type: 'hls' }],
        isChannel: true
      };
      if (ch.category.toLowerCase().includes('sports')) {
        mappedSports.push(stream);
      } else {
        mappedLive.push(stream);
      }
    });

    return {
      matches: [],
      sportsTv: mappedSports,
      liveTv: mappedLive
    };
  }

  // Process Matches (Deduplicated)
  const seenEvents = new Set<string>();
  const mappedEvents: PlayableStream[] = [];
  for (const item of eventsData) {
    const key = item.id_event || `${item.player_1} vs ${item.player_2}`;
    if (seenEvents.has(key)) continue;
    seenEvents.add(key);
    mappedEvents.push({
      id: item.id_event,
      name: `${item.player_1} vs ${item.player_2}`,
      subName: item.nama_event,
      logo: item.logo_1,
      logo2: item.logo_2,
      isBase64Logo: false,
      servers: buildServers(item.url_iptv, item.url_license, item.jenis),
      isChannel: false,
      player1: item.player_1,
      player2: item.player_2,
      jadwal_event: item.jadwal_event,
      jadwal_stop: item.jadwal_stop,
      deskripsi: cleanDescription(item.deskripsi),
      deskripsi_en: cleanDescription(item.deskripsi_en)
    });
  }

  // Process Sports TV
  const seenSports = new Set<string>();
  const mappedSports: PlayableStream[] = [];
  for (const item of sportsData) {
    const key = item.id_iptv || item.nama_channel;
    if (seenSports.has(key)) continue;
    seenSports.add(key);
    mappedSports.push({
      id: item.id_iptv,
      name: item.nama_channel,
      subName: item.tagline || 'Saluran Sports Premium',
      logo: item.gbr_base64,
      isBase64Logo: !!item.gbr_base64,
      servers: buildServers(item.url_iptv, item.url_license, item.jenis),
      isChannel: true
    });
  }

  // Process Live TV
  const seenLive = new Set<string>();
  const mappedLive: PlayableStream[] = [];
  for (const item of liveData) {
    const key = item.id_iptv || item.nama_channel;
    if (seenLive.has(key)) continue;
    seenLive.add(key);
    mappedLive.push({
      id: item.id_iptv,
      name: item.nama_channel,
      subName: item.tagline || 'Saluran Hiburan & Lokal',
      logo: item.gbr_base64,
      isBase64Logo: !!item.gbr_base64,
      servers: buildServers(item.url_iptv, item.url_license, item.jenis),
      isChannel: true
    });
  }

  return {
    matches: mappedEvents,
    sportsTv: mappedSports,
    liveTv: mappedLive
  };
};;

export const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const getStreamById = async (idOrSlug: string): Promise<PlayableStream | undefined> => {
  const data = await getLiveSportsData();
  const allStreams = [...data.matches, ...data.sportsTv, ...data.liveTv];
  
  // 1. Direct ID match
  let found = allStreams.find(s => s.id === idOrSlug);
  if (found) return found;

  // 2. Slugified name match
  const targetSlug = idOrSlug.toLowerCase().trim();
  found = allStreams.find(s => slugify(s.name) === targetSlug);
  if (found) return found;

  // 3. Fallback: match by custom generated matchup slug
  found = allStreams.find(s => {
    if (!s.isChannel && s.player1 && s.player2) {
      const matchSlug = slugify(`${s.player1} vs ${s.player2}`);
      return matchSlug === targetSlug;
    }
    return false;
  });
  if (found) return found;

  return undefined;
};
