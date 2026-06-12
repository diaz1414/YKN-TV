import stableChannels from '../data/stable_channels.json';

export interface Channel {
  id: string;
  name: string;
  category: string;
  logo: string;
  url: string;
  status: 'online' | 'offline';
  now_playing: string;
}

export interface PlaylistPreset {
  id: string;
  name: string;
  url: string;
  type: 'category' | 'country';
}

export const PLAYLIST_PRESETS: PlaylistPreset[] = [
  // Categories
  { id: 'freetv', name: 'Free TV', url: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8', type: 'category' },
  { id: 'sports', name: 'Sports', url: 'https://iptv-org.github.io/iptv/categories/sports.m3u', type: 'category' },
  { id: 'news', name: 'News', url: 'https://iptv-org.github.io/iptv/categories/news.m3u', type: 'category' },
  { id: 'movies', name: 'Movies', url: 'https://iptv-org.github.io/iptv/categories/movies.m3u', type: 'category' },
  { id: 'music', name: 'Music', url: 'https://iptv-org.github.io/iptv/categories/music.m3u', type: 'category' },
  { id: 'documentary', name: 'Documentaries', url: 'https://iptv-org.github.io/iptv/categories/documentary.m3u', type: 'category' },
  { id: 'kids', name: 'Kids', url: 'https://iptv-org.github.io/iptv/categories/kids.m3u', type: 'category' },
  // Countries
  { id: 'id', name: 'Indonesia', url: 'https://iptv-org.github.io/iptv/countries/id.m3u', type: 'country' },
  { id: 'us', name: 'United States', url: 'https://iptv-org.github.io/iptv/countries/us.m3u', type: 'country' },
  { id: 'uk', name: 'United Kingdom', url: 'https://iptv-org.github.io/iptv/countries/uk.m3u', type: 'country' },
  { id: 'sg', name: 'Singapore', url: 'https://iptv-org.github.io/iptv/countries/sg.m3u', type: 'country' },
  { id: 'my', name: 'Malaysia', url: 'https://iptv-org.github.io/iptv/countries/my.m3u', type: 'country' },
  { id: 'sa', name: 'Saudi Arabia', url: 'https://iptv-org.github.io/iptv/countries/sa.m3u', type: 'country' },
];

const CACHE_KEY = 'ykn_channels_cache';

// Reliable CORS Proxy Helper
export const getProxiedUrl = (url: string, force = false) => {
  const restrictedDomains = ['alkassdigital.net', 'shooflive', 'shoof.alkass.net', '30a-tv.com', 'ok.ru', 'm3u8'];
  const needsProxy = force || restrictedDomains.some(domain => url.includes(domain));
  
  if (needsProxy) {
    return `/api/proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
};

// Custom parser for M3U playlists
export const parseM3U = (text: string): Channel[] => {
  const lines = text.split('\n');
  const channels: Channel[] = [];
  let currentChannel: Partial<Channel> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      currentChannel = {};
      
      const commaIdx = line.lastIndexOf(',');
      if (commaIdx !== -1) {
        currentChannel.name = line.substring(commaIdx + 1).trim();
      }

      const idMatch = line.match(/tvg-id="([^"]*)"/);
      if (idMatch && idMatch[1]) {
        currentChannel.id = idMatch[1];
      }

      const logoMatch = line.match(/tvg-logo="([^"]*)"/);
      if (logoMatch && logoMatch[1]) {
        currentChannel.logo = logoMatch[1];
      }

      const groupMatch = line.match(/group-title="([^"]*)"/);
      if (groupMatch && groupMatch[1]) {
        currentChannel.category = groupMatch[1];
      }
    } else if (!line.startsWith('#')) {
      if (currentChannel.name) {
        const logo = currentChannel.logo || `https://images.unsplash.com/photo-1540747737956-37872f04760a?w=150&auto=format&fit=crop&q=60`;
        const id = currentChannel.id || encodeURIComponent(currentChannel.name);
        const category = currentChannel.category || 'General';
        
        channels.push({
          id,
          name: currentChannel.name,
          category,
          logo,
          url: line,
          status: 'online',
          now_playing: `${category} Live Broadcast`
        });
      }
      currentChannel = {};
    }
  }

  return channels;
};

export const saveChannelsToCache = (channels: Channel[]) => {
  try {
    const existingCache = localStorage.getItem(CACHE_KEY);
    let cachedMap: Record<string, Channel> = {};
    if (existingCache) {
      cachedMap = JSON.parse(existingCache);
    }
    channels.forEach(ch => {
      cachedMap[ch.id] = ch;
    });
    localStorage.setItem(CACHE_KEY, JSON.stringify(cachedMap));
  } catch (e) {
    console.error('Failed to save channels to cache:', e);
  }
};

export const getCachedChannelById = (id: string): Channel | undefined => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const cachedMap: Record<string, Channel> = JSON.parse(cached);
      return cachedMap[id];
    }
  } catch (e) {
    console.error('Failed to get cached channel:', e);
  }
  return undefined;
};

// Fetch channels from dynamic playlist URL
export const fetchPlaylist = async (url: string): Promise<Channel[]> => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const text = await response.text();
    const parsed = parseM3U(text);
    saveChannelsToCache(parsed);
    return parsed;
  } catch (err) {
    console.warn(`Direct fetch failed for ${url}, trying with CORS proxy...`, err);
    try {
      const proxyUrl = getProxiedUrl(url, true);
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`HTTP error via proxy! status: ${response.status}`);
      const text = await response.text();
      const parsed = parseM3U(text);
      saveChannelsToCache(parsed);
      return parsed;
    } catch (proxyErr) {
      console.error(`Failed to fetch playlist ${url} with proxy:`, proxyErr);
      return [];
    }
  }
};

// Get channels using the category (which is treated as a playlist URL key) or return stable channels as default
export const getChannels = async (playlistUrl?: string): Promise<Channel[]> => {
  if (playlistUrl) {
    return await fetchPlaylist(playlistUrl);
  }
  
  // Return stable channels by default if no playlist URL is specified
  const channels = stableChannels as Channel[];
  saveChannelsToCache(channels);
  return channels;
};

export const getChannelById = async (id: string): Promise<Channel | undefined> => {
  const stable = (stableChannels as Channel[]).find(c => c.id === id);
  if (stable) return stable;

  const cached = getCachedChannelById(id);
  if (cached) return cached;

  // Background lookup by loading Sports playlist
  const sports = await fetchPlaylist(PLAYLIST_PRESETS[1].url);
  const found = sports.find(c => c.id === id);
  if (found) return found;

  return undefined;
};

// Search & Filter Logic
export const searchAndFilterChannels = (
  channels: Channel[], 
  query: string, 
  category: string
): Channel[] => {
  return channels.filter(channel => {
    const matchesQuery = channel.name.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === 'All' || channel.category.toLowerCase() === category.toLowerCase();
    return matchesQuery && matchesCategory;
  });
};
