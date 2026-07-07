import stableChannels from '../data/stable_channels.json';
import backupEvents from '../data/tv-events.json';
import backupSports from '../data/tv-sports.json';
import backupLive from '../data/tv-hiburan.json';
import axios from 'axios';
import { getRawEventsUrl, SHOW_RTB_GO_IN_JADWAL } from './matchService';
import { getActiveCustomEvents } from './customEventService';

export interface StreamServer {
  name: string;
  url: string;
  type: string;
  keyId?: string;
  key?: string;
  keys?: Record<string, string>;
  forceProxy?: boolean;
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
  logo?: string;
  tagline?: string;
  premium?: string;
  aktif?: string;

  // tambahan buat channel hasil parser M3U
  forceProxy?: boolean;
  force_proxy?: boolean | string;
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

const ENABLE_PROXY = true;

// const PROXY_BACKUP_DOMAINS = [
//   'alkassdigital.net',
//   'shooflive',
//   'shoof.alkass.net',
//   '30a-tv.com',
//   'ok.ru',
//   'streamlock.net',
//   'iptvcat.com',
//   'akamaihd.net',
//   'akamaized.net',
//   'pv-cdn.net',
//   'aiv-cdn.net',
//   'beetv.kz',
//   'amazon.fastly-edge.com',
//   'byteplaycdn.com',
//   'tencent-css.byteplaycdn.com'
// ];


const normalizeStreamUrl = (url: string): string => {
  let cleanTargetUrl = url.trim();

  // If the URL already contains a proxy prefix, extract the raw target URL to avoid nested proxying.
  const proxyPattern = /^(https?:\/\/[^\/]+)?\/api\/proxy\/(https?\/|https?:\/\/)?(.*)$/i;
  const match = cleanTargetUrl.match(proxyPattern);

  if (match) {
    const targetPath = match[3];

    if (targetPath.startsWith('http/') || targetPath.startsWith('https/')) {
      cleanTargetUrl = targetPath.replace(/^(https?)\//i, '$1://');
    } else if (targetPath.startsWith('http://') || targetPath.startsWith('https://')) {
      cleanTargetUrl = targetPath;
    } else {
      cleanTargetUrl = `https://${targetPath}`;
    }
  }

  // Auto-correct known database input typos for RTB Go.
  if (cleanTargetUrl.includes('d12l1ahplmeugs.cloudfront.net')) {
    cleanTargetUrl = cleanTargetUrl.replace(
      'd12l1ahplmeugs.cloudfront.net',
      'd1211whpimeups.cloudfront.net'
    );
  }

  if (cleanTargetUrl.includes('smil:rtbg/')) {
    cleanTargetUrl = cleanTargetUrl.replace('smil:rtbg/', 'smil:rtbgo/');
  }

  return cleanTargetUrl;
};


export const getProxiedUrl = (url: string, force = false) => {
  const cleanTargetUrl = normalizeStreamUrl(url);

  // Default sekarang selalu direct.
  // Proxy hanya dipakai kalau user memilih server backup/proxy secara manual.
  if (!ENABLE_PROXY || !force) {
    return cleanTargetUrl;
  }

  const proxyBase =
    import.meta.env.VITE_PROXY_BASE_URL ||
    'https://proxy-ykntv414.ykn.my.id/api/proxy';

  const cleanUrl = cleanTargetUrl.replace(/^(https?):\/\//, '$1/');
  return `${proxyBase}/${cleanUrl}`;
};


export const buildServers = (
  urlIptv: string,
  urlLicense: string | undefined,
  jenis: string,
  _forceProxyFirst = false  // tidak lagi dipakai — Server 1 selalu direct
): StreamServer[] => {
  const decryptedLicense = urlLicense ? decryptLicense(urlLicense) : '';
  const servers: StreamServer[] = [];
  const rawUrl = normalizeStreamUrl(urlIptv);

  // Server 1: selalu direct CDN — sama seperti backup HTML.
  // Kalau CORS gagal atau http:// blocked, user tinggal switch ke Server 2.
  servers.push({
    name: 'Server 1 (Direct)',
    url: rawUrl,
    type: jenis,
    forceProxy: false,
  });

  // Server 2: selalu proxy — sama seperti backup HTML yang always provide proxy untuk semua channel.
  // Tidak perlu whitelist domain lagi.
  servers.push({
    name: 'Server 2 (Proxy)',
    url: rawUrl,
    type: jenis,
    forceProxy: true,
  });

  if (decryptedLicense) {
    if (decryptedLicense.includes(':') && !decryptedLicense.startsWith('http')) {
      const keys: Record<string, string> = {};
      const pairs = decryptedLicense.split(',');

      pairs.forEach(pair => {
        const parts = pair.split(':');

        if (parts.length === 2) {
          const [kid, k] = parts;

          if (kid && k) {
            keys[kid.trim()] = k.trim();
          }
        }
      });

      if (Object.keys(keys).length > 0) {
        // DRM key dipasang ke Server 1 dan Server 2 supaya keduanya bisa play.
        servers.forEach(s => {
          s.keys = keys;
          const firstKeyId = Object.keys(keys)[0];
          s.keyId = firstKeyId;
          s.key = keys[firstKeyId];
        });
      }
    } else if (decryptedLicense.startsWith('http')) {
      const altUrl = normalizeStreamUrl(decryptedLicense);

      // Server Alt selalu direct + proxy, konsisten dengan pola di atas.
      servers.push({
        name: 'Server 3 (Alt Direct)',
        url: altUrl,
        type: 'hls',
        forceProxy: false
      });

      servers.push({
        name: 'Server 4 (Alt Proxy)',
        url: altUrl,
        type: 'hls',
        forceProxy: true
      });
    }
  }

  return servers;
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


const DOMS9_BASE_M3U_URL =
  'https://raw.githubusercontent.com/doms9/iptv/refs/heads/default/M3U8/base.m3u8';

/*
const SPORTS_M3U_KEYWORDS = [
  'sport',
  'sports',
  'espn',
  'fox sports',
  'fs1',
  'fs2',
  'golazo',
  'bein',
  'sky sports',
  'premier sports',
  'directv sports',
  'nfl',
  'nhl',
  'nba',
  'mlb',
  'sec network',
  'acc network',
  'nesn',
  'marquee sports',
  'nbc sports',
  'cbs sports',
  'olahraga',
  'liga',
  'football',
  'soccer',
  'arena',
  'fight',
  'ufc',
  'wwe',
];
*/

const getM3uAttr = (line: string, key: string): string => {
  const match = line.match(new RegExp(`${key}="([^"]*)"`, 'i'));
  return match?.[1]?.trim() || '';
};

const makeM3uId = (name: string, index: number): string => {
  const safeName = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `doms9-${safeName || index}`;
};

const parseDoms9AllM3u = (m3uText: string): ChannelEvent[] => {
  const lines = m3uText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const channels: ChannelEvent[] = [];

  for (let i = 0; i < lines.length; i++) {
    const infoLine = lines[i];

    if (!infoLine.startsWith('#EXTINF')) continue;

    const urlLine = lines[i + 1];
    if (!urlLine || urlLine.startsWith('#')) continue;

    const url = urlLine.trim();
    const lowerUrl = url.toLowerCase();

    if (!/^https?:\/\//i.test(url)) continue;

    const tvgName = getM3uAttr(infoLine, 'tvg-name');
    const tvgLogo = getM3uAttr(infoLine, 'tvg-logo');
    const tvgChno = getM3uAttr(infoLine, 'tvg-chno');
    const groupTitle = getM3uAttr(infoLine, 'group-title');

    const fallbackName = infoLine.split(',').pop()?.trim() || '';
    const name = tvgName || fallbackName;

    if (!name) continue;

    const isM3u8 = lowerUrl.includes('.m3u8');
    const isTs = lowerUrl.endsWith('.ts') || lowerUrl.includes('/mpegts');

    channels.push({
      id_iptv: makeM3uId(`${tvgChno}-${name}`, i),
      nama_channel: name,
      tagline: groupTitle || 'Live TV',
      jenis: isM3u8 ? 'hls' : isTs ? 'hls' : 'hls',
      url_iptv: url,
      url_license: '',
      gbr_base64: '',
      logo: tvgLogo || '',

      // Paksa proxy kalau:
      // 1. URL masih http
      // 2. URL bukan .m3u8 standar
      // 3. URL .ts / mpegts
      forceProxy: !lowerUrl.startsWith('https://') || !isM3u8 || isTs,
    });
  }

  return channels;
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
    // 1. Primary Source: Fetch from GitHub raw (CDN global, tahan beban banyak user)
    const [eventsRes, sportsRes, liveRes] = await Promise.all([
      axios.get<MatchEvent[]>(getRawEventsUrl()),
      axios.get<ChannelEvent[]>('https://raw.githubusercontent.com/movietrailersxxi-pixel/web/main/assets/tv-sports.dat'),
      axios.get<ChannelEvent[]>('https://raw.githubusercontent.com/movietrailersxxi-pixel/web/main/assets/tv-hiburan.dat')
    ]);
    eventsData = eventsRes.data;
    sportsData = sportsRes.data;
    liveData = liveRes.data;
  } catch (githubErr) {
    console.warn('Failed to fetch from GitHub raw, trying Bot API fallback...', githubErr);

    // 2. First Fallback (Backup): Fetch from the bot's API endpoints
    try {
      const envVal = import.meta.env.VITE_BOT_API_URL;
      const BOT_API_URL = envVal === '/api' ? '' : (envVal || 'https://api.ykn.my.id');
      const [eventsRes, sportsRes, liveRes] = await Promise.all([
        axios.get<MatchEvent[]>(`${BOT_API_URL}/api/sports/events`),
        axios.get<ChannelEvent[]>(`${BOT_API_URL}/api/sports/tv`),
        axios.get<ChannelEvent[]>(`${BOT_API_URL}/api/sports/hiburan`)
      ]);
      eventsData = eventsRes.data;
      sportsData = sportsRes.data;
      liveData = liveRes.data;
    } catch (botErr) {
      console.warn('Failed to fetch from Bot API, falling back to local JSON data...', botErr);

      // 3. Second Fallback (Final Backup): Use local imported JSON files
      eventsData = backupEvents as MatchEvent[];
      sportsData = backupSports as ChannelEvent[];
      liveData = backupLive as ChannelEvent[];
    }
  }

  // Inject custom channels that should always be present
  // Inject custom channels that should always be present
  const customSports: ChannelEvent[] = [
    {
      id_iptv: "custom-bein-sports-xtra",
      nama_channel: "beIN SPORTS XTRA",
      tagline: "Live Sports & Action",
      jenis: "hls",
      url_iptv: "https://bein-xtra-bein.amagi.tv/playlist.m3u8",
      gbr_base64: "",
      logo: "https://upload.wikimedia.org/wikipedia/commons/2/20/Bein_sport_logo.png",
      url_license: ""
    },
    {
      id_iptv: "custom-fox-sports",
      nama_channel: "FOX Sports",
      tagline: "Live International Sports",
      jenis: "hls",
      url_iptv: "https://jmp2.uk/plu-5a74b8e1e22a61737979c6bf.m3u8",
      gbr_base64: "",
      logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/FOX_Sports_logo.svg/1280px-FOX_Sports_logo.svg.png",
      url_license: ""
    },
    {
      id_iptv: "custom-fubo-sports",
      nama_channel: "fubo Sports Network",
      tagline: "Live Sports News & Matches",
      jenis: "hls",
      url_iptv: "https://dnf08l6u6uxnz.cloudfront.net/master.m3u8",
      gbr_base64: "",
      logo: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSlgp5-BQ9kkzVotJleKKyHMjOWwf1LUKOyXA&s",
      url_license: ""
    },
    {
      id_iptv: "custom-alkass-one",
      nama_channel: "Alkass One HD",
      tagline: "Saluran Olahraga Alkass 1",
      jenis: "hls",
      url_iptv: "https://liveeu-gcp.alkassdigital.net/alkass1-p/main.m3u8",
      gbr_base64: "",
      logo: "https://www.cne-eg.com/uploads/logos/20183142627377.png",
      url_license: ""
    },
    {
      id_iptv: "custom-alkass-two",
      nama_channel: "Alkass Two HD",
      tagline: "Saluran Olahraga Alkass 2",
      jenis: "hls",
      url_iptv: "https://liveeu-gcp.alkassdigital.net/alkass2-p/main.m3u8",
      gbr_base64: "",
      logo: "https://mir-s3-cdn-cf.behance.net/project_modules/max_1200/e07af070606335.5ba94e1546767.jpg",
      url_license: ""
    },
    {
      id_iptv: "custom-alkass-three",
      nama_channel: "Alkass Three HD",
      tagline: "Saluran Olahraga Alkass 3",
      jenis: "hls",
      url_iptv: "https://liveeu-gcp.alkassdigital.net/alkass3-p/main.m3u8",
      gbr_base64: "",
      logo: "https://mir-s3-cdn-cf.behance.net/project_modules/max_1200/e07af070606335.5ba94e1546767.jpg",
      url_license: ""
    },
    {
      id_iptv: "custom-tvri-sport",
      nama_channel: "TVRI Sport HD",
      tagline: "Saluran Olahraga Nasional",
      jenis: "hls",
      url_iptv: "https://ott-balancer.tvri.go.id/live/eds/SportHD/hls/SportHD.m3u8",
      gbr_base64: "",
      logo: "https://upload.wikimedia.org/wikipedia/commons/e/eb/TVRILogo2019.svg",
      url_license: ""
    },
    {
      id_iptv: "custom-rtb-go",
      nama_channel: "RTB Go",
      tagline: "Live Streaming RTB Go",
      jenis: "hls",
      url_iptv: "https://liveplay-srs.voc.com.cn/hls/tv/134_180adf.m3u8",
      gbr_base64: "",
      logo: "https://www.rtbgo.bn/assets/favicon/favicon-96x96.png",
      url_license: "",
    }
  ];

  const customLive: ChannelEvent[] = [
    {
      id_iptv: "custom-trans-tv",
      nama_channel: "Trans TV",
      tagline: "Informasi & Hiburan Keluarga",
      jenis: "hls",
      url_iptv: "https://video.detik.com/transtv/smil:transtv.smil/index.m3u8",
      gbr_base64: "",
      logo: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQJ8dlG4_n4MXGQXvrKvctGxKhEOv7D5kLRFQ&s",
      url_license: ""
    },
    {
      id_iptv: "custom-trans7",
      nama_channel: "Trans7",
      tagline: "Aktif, Cerdas & Menghibur",
      jenis: "hls",
      url_iptv: "https://video.detik.com/trans7/smil:trans7.smil/index.m3u8",
      gbr_base64: "",
      logo: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSscALyQ9IIiuzQGoWLp4aA8f2I2SVniDKRcg&s",
      url_license: ""
    },
    {
      id_iptv: "custom-sctv",
      nama_channel: "SCTV",
      tagline: "Satu Untuk Semua",
      jenis: "hls",
      url_iptv: "https://op-group1-swiftservehd-1.dens.tv/h/h217/index.m3u8",
      gbr_base64: "",
      logo: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQu1T4sGfPsFdky5crZBeP8uUpsxb7h_jDPbw&s",
      url_license: ""
    },
    {
      id_iptv: "custom-kompas-tv",
      nama_channel: "Kompas TV",
      tagline: "Independen, Terpercaya",
      jenis: "hls",
      url_iptv: "https://op-group1-swiftservehd-1.dens.tv/h/h234/index.m3u8",
      gbr_base64: "",
      logo: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT4r2EmiXirt-AWSG3oKz1Nz_tzSLbzssdIKw&s",
      url_license: ""
    },
    {
      id_iptv: "custom-metro-tv",
      nama_channel: "Metro TV",
      tagline: "Knowledge to Elevate",
      jenis: "hls",
      url_iptv: "https://edge.medcom.id/live-edge/smil:metro.smil/playlist.m3u8",
      gbr_base64: "",
      logo: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRJrB73cHIEve53WFt8WK3r3y16zFL0UlCyeQ&s",
      url_license: ""
    },
    {
      id_iptv: "custom-tvone",
      nama_channel: "tvOne",
      tagline: "Memang Beda",
      jenis: "hls",
      url_iptv: "http://202.80.222.20/cdn/iptv/Tvod/001/channel2000018/1024.m3u8",
      gbr_base64: "",
      logo: "https://upload.wikimedia.org/wikipedia/commons/9/91/TvOne_2023.svg",
      url_license: ""
    },
    {
      id_iptv: "custom-cnbc-indo",
      nama_channel: "CNBC Indonesia",
      tagline: "News & Business",
      jenis: "hls",
      url_iptv: "https://live.cnbcindonesia.com/livecnbc/smil:cnbctv.smil/master.m3u8",
      gbr_base64: "",
      logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/CNBC_Indonesia_2025.svg/1280px-CNBC_Indonesia_2025.svg.png",
      url_license: ""
    },
    {
      id_iptv: "custom-tvri-nasional",
      nama_channel: "TVRI Nasional",
      tagline: "Media Pemersatu Bangsa",
      jenis: "hls",
      url_iptv: "https://ott-balancer.tvri.go.id/live/eds/Nasional/hls/Nasional.m3u8",
      gbr_base64: "",
      logo: "https://upload.wikimedia.org/wikipedia/commons/e/eb/TVRILogo2019.svg",
      url_license: ""
    },
    {
      id_iptv: "custom-tvri-world",
      nama_channel: "TVRI World",
      tagline: "Indonesia to the World",
      jenis: "hls",
      url_iptv: "https://ott-balancer.tvri.go.id/live/eds/TVRIWorld/hls/TVRIWorld.m3u8",
      gbr_base64: "",
      logo: "https://upload.wikimedia.org/wikipedia/commons/e/eb/TVRILogo2019.svg",
      url_license: ""
    }
  ];

  if (!Array.isArray(eventsData)) eventsData = [];
  if (!Array.isArray(sportsData)) sportsData = [];
  if (!Array.isArray(liveData)) liveData = [];

  try {
    const doms9Res = await axios.get(DOMS9_BASE_M3U_URL, {
      responseType: 'text',
      timeout: 4000,
    });

    const doms9Sports = parseDoms9AllM3u(String(doms9Res.data || ''));

    doms9Sports.forEach((ch) => {
      // Injeksi ke sportsData (Olahraga)
      const existsInSports = sportsData.some(
        (existing) =>
          existing.id_iptv === ch.id_iptv ||
          existing.nama_channel.toLowerCase().trim() === ch.nama_channel.toLowerCase().trim()
      );
      if (!existsInSports) {
        sportsData.push(ch);
      }

      // Injeksi ke liveData (Hiburan & Lokal)
      const existsInLive = liveData.some(
        (existing) =>
          existing.id_iptv === ch.id_iptv ||
          existing.nama_channel.toLowerCase().trim() === ch.nama_channel.toLowerCase().trim()
      );
      if (!existsInLive) {
        liveData.push(ch);
      }
    });

    console.log(`[Doms9 IPTV] Injected ${doms9Sports.length} channels`);
  } catch (err) {
    console.warn('[Doms9 IPTV] Failed to fetch/parse base.m3u8:', err);
  }

  customSports.forEach(ch => {
    if (!sportsData.some(existing => existing.id_iptv === ch.id_iptv || existing.nama_channel === ch.nama_channel)) {
      sportsData.push(ch);
    }
  });

  customLive.forEach(ch => {
    if (!liveData.some(existing => existing.id_iptv === ch.id_iptv || existing.nama_channel === ch.nama_channel)) {
      liveData.push(ch);
    }
  });

  try {
    const customEvents = await getActiveCustomEvents();
    const allSourceChannels = [...sportsData, ...liveData];

    customEvents.forEach((row) => {
      const sourceChannel = allSourceChannels.find(
        (ch) => ch.id_iptv === row.source_channel_id
      );

      if (!sourceChannel) {
        console.warn(
          `[Custom Event] source channel tidak ketemu: ${row.source_channel_id}`
        );
        return;
      }

      const exists = eventsData.some(
        (event) => event.id_event === row.id_event
      );

      if (exists) return;

      eventsData.push({
        id_event: row.id_event,
        nama_event: row.nama_event || 'Live Event',
        player_1: row.player_1,
        player_2: row.player_2,
        logo_1: row.logo_1 || '',
        logo_2: row.logo_2 || '',
        jadwal_event: row.jadwal_event,
        jadwal_stop: row.jadwal_stop || '',
        url_iptv: sourceChannel.url_iptv,
        url_license: sourceChannel.url_license || '',
        jenis: sourceChannel.jenis || 'hls',
        deskripsi:
          row.deskripsi ||
          `Siaran langsung ${row.player_1} vs ${row.player_2} di YKN TV.`,
        deskripsi_en:
          row.deskripsi_en ||
          `Live broadcast ${row.player_1} vs ${row.player_2} on YKN TV.`,
      });
    });

    console.log(`[Custom Event] injected ${customEvents.length} custom events`);
  } catch (err) {
    console.warn('[Custom Event] gagal inject custom events:', err);
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
        servers: [{ name: 'Server 1 (Direct)', url: ch.url, type: 'hls', forceProxy: false }],
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
  const seenRtbMatchups = new Set<string>();
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

    const start = parseJadwal(item.jadwal_event);
    const nowTime = new Date();
    const isStartingSoonOrLive = nowTime.getTime() >= start.getTime() - 60 * 60 * 1000;

    const homeTeamName = item.player_1 || 'TBD';
    const awayTeamName = item.player_2 || 'TBD';
    const matchupKey = `${homeTeamName.toLowerCase().trim()} vs ${awayTeamName.toLowerCase().trim()}`;

    if (SHOW_RTB_GO_IN_JADWAL && item.nama_event && item.nama_event.toLowerCase().includes("fifa world cup") && isStartingSoonOrLive) {
      if (!seenRtbMatchups.has(matchupKey)) {
        seenRtbMatchups.add(matchupKey);
        mappedEvents.push({
          id: `${item.id_event}9`,
          name: `${item.player_1} vs ${item.player_2}`,
          subName: "FIFA World Cup [RTB Go]",
          logo: item.logo_1,
          logo2: item.logo_2,
          isBase64Logo: false,
          servers: buildServers("https://d1211whpimeups.cloudfront.net/smil:rtbgo/playlist.m3u8", "", "hls"),
          isChannel: false,
          player1: item.player_1,
          player2: item.player_2,
          jadwal_event: item.jadwal_event,
          jadwal_stop: item.jadwal_stop,
          deskripsi: cleanDescription(item.deskripsi),
          deskripsi_en: cleanDescription(item.deskripsi_en)
        });
      }
    }
  }

  // Process Sports TV
  const seenSports = new Set<string>();
  const mappedSports: PlayableStream[] = [];
  for (const item of sportsData) {
    const key = item.id_iptv || item.nama_channel;
    if (seenSports.has(key)) continue;
    seenSports.add(key);

    let name = item.nama_channel;
    if (name.toLowerCase() === "init duktek") {
      name = "init ykn";
    }

    mappedSports.push({
      id: item.id_iptv,
      name: name,
      subName: item.tagline || 'Saluran Sports Premium',
      logo: item.gbr_base64 || item.logo || '',
      isBase64Logo: !!item.gbr_base64,
      servers: buildServers(
        item.url_iptv,
        item.url_license,
        item.jenis,
        item.forceProxy === true || item.force_proxy === true || item.force_proxy === 'true'
      ),
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
      logo: item.gbr_base64 || item.logo || '',
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

  // 2. Extract ID from the end of the slug (e.g. spain-vs-cabo-verde-1234 -> ID is 1234)
  const lastDashIndex = idOrSlug.lastIndexOf('-');
  if (lastDashIndex !== -1) {
    const potentialId = idOrSlug.substring(lastDashIndex + 1);
    found = allStreams.find(s => s.id === potentialId);
    if (found) return found;
  }

  // 3. Slugified name match
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
