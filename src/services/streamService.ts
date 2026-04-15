import axios from 'axios';

export interface Channel {
  id: string;
  name: string;
  category: string;
  logo: string;
  url: string;
  status: 'online' | 'offline';
  now_playing: string;
}

const SOURCES = [
  { url: 'https://iptv-org.github.io/iptv/categories/sports.m3u', category: 'Sports' },
  { url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/id.m3u', category: 'Indonesia' }
];

// Reliable Public CORS Proxy Helper
export const getProxiedUrl = (url: string) => {
  // Common IPTV sources that definitely need CORS bypass
  const restrictedDomains = ['alkassdigital.net', 'shooflive', 'shoof.alkass.net'];
  const needsProxy = restrictedDomains.some(domain => url.includes(domain));
  
  if (needsProxy) {
    return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  }
  return url;
};

let cachedChannels: Channel[] = [];

// Improved M3U Parser using Regex
const parseM3U = (data: string, category: string): Channel[] => {
  const channels: Channel[] = [];
  const lines = data.split('\n');
  let currentChannel: Partial<Channel> = {};

  lines.forEach((line) => {
    line = line.trim();
    if (line.startsWith('#EXTINF')) {
      // Extract tvg-id, tvg-logo, and Name
      const idMatch = line.match(/tvg-id="([^"]+)"/);
      const logoMatch = line.match(/tvg-logo="([^"]+)"/);
      const nameMatch = line.match(/,(.*)$/);

      currentChannel = {
        id: idMatch ? idMatch[1] : `ch-${Math.random().toString(36).substr(2, 9)}`,
        name: nameMatch ? nameMatch[1].trim() : 'Unknown Channel',
        logo: logoMatch ? logoMatch[1] : 'https://placehold.co/400x400/111/00FF88?text=TV',
        category: category,
        status: 'online',
        now_playing: category === 'Sports' ? 'Live Sports Event' : 'Local Broadcast'
      };
    } else if (line.startsWith('http')) {
      if (currentChannel.name) {
        currentChannel.url = line;
        channels.push(currentChannel as Channel);
        currentChannel = {};
      }
    }
  });

  return channels;
};

export const getChannels = async (forceRefresh = false): Promise<Channel[]> => {
  if (cachedChannels.length > 0 && !forceRefresh) {
    return cachedChannels;
  }

  try {
    const results = await Promise.all(
      SOURCES.map(source => 
        axios.get(source.url).then(res => parseM3U(res.data, source.category))
      )
    );

    cachedChannels = results.flat();
    return cachedChannels;
  } catch (error) {
    console.error('Failed to fetch M3U playlists:', error);
    return [];
  }
};

export const getChannelById = async (id: string): Promise<Channel | undefined> => {
  if (cachedChannels.length === 0) await getChannels();
  return cachedChannels.find(c => c.id === id);
};

// Search & Filter Logic
export const searchAndFilterChannels = (
  channels: Channel[], 
  query: string, 
  category: string
): Channel[] => {
  return channels.filter(channel => {
    const matchesQuery = channel.name.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === 'All' || channel.category === category;
    return matchesQuery && matchesCategory;
  });
};
