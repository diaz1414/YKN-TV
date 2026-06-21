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
  keys?: Record<string, string>;
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
        servers[0].keys = keys;
        const firstKeyId = Object.keys(keys)[0];
        servers[0].keyId = firstKeyId;
        servers[0].key = keys[firstKeyId];
      }
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

// Toggle to temporarily enable/disable proxy server. Set to false to disable.
const ENABLE_PROXY = true;

// Reliable CORS Proxy Helper
export const getProxiedUrl = (url: string, force = false) => {
  if (!ENABLE_PROXY) {
    return url;
  }

  // 1. If the URL already contains a proxy prefix, extract the raw target URL to avoid nested proxying
  let cleanTargetUrl = url.trim();
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

  // 2. Auto-correct known database input typos for RTB Go
  if (cleanTargetUrl.includes('d12l1ahplmeugs.cloudfront.net')) {
    cleanTargetUrl = cleanTargetUrl.replace('d12l1ahplmeugs.cloudfront.net', 'd1211whpimeups.cloudfront.net');
  }
  if (cleanTargetUrl.includes('smil:rtbg/')) {
    cleanTargetUrl = cleanTargetUrl.replace('smil:rtbg/', 'smil:rtbgo/');
  }

  const restrictedDomains = ['alkassdigital.net', 'shooflive', 'shoof.alkass.net', '30a-tv.com', 'ok.ru', 'streamlock.net', 'iptvcat.com', 'cloudfront.net'];
  const needsProxy = force || restrictedDomains.some(domain => cleanTargetUrl.includes(domain));

  if (needsProxy) {
    let proxyBase = import.meta.env.VITE_PROXY_BASE_URL || 'https://api.ykn.my.id/api/proxy';

    // If the stream is cloudfront.net (RTB Go), bypass VPS proxy and use Vercel proxy
    // to avoid the VPS IP block.
    const isCloudfront = cleanTargetUrl.includes('cloudfront.net') || cleanTargetUrl.includes('rtbgo');
    if (isCloudfront) {
      proxyBase = '/api/proxy';
    } else if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      // Use local proxy handler during development on localhost for other domains
      proxyBase = '/api/proxy';
    }

    const cleanUrl = cleanTargetUrl.replace(/^(https?):\/\//, '$1/');
    return `${proxyBase}/${cleanUrl}`;
  }
  return cleanTargetUrl;
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
    const isProduction = import.meta.env.PROD;
    const BOT_API_URL = isProduction ? '' : (import.meta.env.VITE_BOT_API_URL || 'http://147.135.252.68:20114');
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
      url_iptv: "https://d1211whpimeups.cloudfront.net/smil:rtbgo/playlist.m3u8",
      gbr_base64: "",
      logo: "https://www.rtbgo.bn/assets/favicon/favicon-96x96.png",
      url_license: ""
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

    if (item.nama_event && item.nama_event.toLowerCase().includes("fifa world cup") && isStartingSoonOrLive) {
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
