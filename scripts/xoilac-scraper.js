/**
 * xoilac-scraper.js
 * Scrapes match schedules + live stream resources from Xoilacz (fameandpartners.com)
 * for all sport categories: football, basketball, tennis, badminton, volleyball, esports
 *
 * Output: data/xoilac-events.json
 * Run: node scripts/xoilac-scraper.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_PATH = path.join(__dirname, '../data/xoilac-events.json');
const DATA_DIR = path.join(__dirname, '../data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ─── CONSTANTS ─────────────────────────────────────────────────────────────
const SITE_NAME = 'xoilacz';
const BASE_URL = 'https://fameandpartners.com';

const SPORT_APIS = {
  football:   'https://data-api.sportflowlivez.com',
  basketball: 'https://data-api.sportflowlivez.com',
  tennis:     'https://data-api.sportflowlivez.com',
  badminton:  'https://data-api.sportflowlivez.com',
  volleyball: 'https://data-api.sportflowlivez.com',
  esports:    'https://data-api.sportflowlivez.com',
};

const SPORT_LABELS = {
  football:   'Bóng Đá',
  basketball: 'Bóng Rổ',
  tennis:     'Tennis',
  badminton:  'Cầu Lông',
  volleyball: 'Bóng Chuyền',
  esports:    'Esports',
};

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8',
  'Origin': BASE_URL,
  'Referer': `${BASE_URL}/`,
};

// ─── HELPERS ───────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function safeFetch(url, opts = {}) {
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS, ...opts });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[WARN] fetch failed: ${url} → ${err.message}`);
    return null;
  }
}

async function safeFetchText(url) {
  try {
    const res = await fetch(url, { headers: { ...FETCH_HEADERS, Accept: 'text/html' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    console.warn(`[WARN] fetchText failed: ${url} → ${err.message}`);
    return null;
  }
}

/**
 * Extract list_stream from a match page HTML.
 * Returns array of stream URLs (iframe sources), or empty array.
 */
function extractStreamsFromHtml(html) {
  if (!html) return [];
  const match = html.match(/var list_stream\s*=\s*(\[\[.*?\]\]);/s);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1]);
    // parsed is [[url1, url2], [url3], ...]
    const flat = parsed.flatMap(arr => arr).filter(Boolean);
    return flat;
  } catch {
    return [];
  }
}

/**
 * Convert Unix timestamp to "YYYY-MM-DD HH:MM+07" format (ICT)
 */
function tsToJadwal(ts) {
  const d = new Date(ts * 1000);
  const pad = n => String(n).padStart(2, '0');
  // Convert to ICT (UTC+7)
  const ict = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return `${ict.getUTCFullYear()}-${pad(ict.getUTCMonth() + 1)}-${pad(ict.getUTCDate())} ${pad(ict.getUTCHours())}:${pad(ict.getUTCMinutes())}+07`;
}

// ─── MAIN SCRAPER ──────────────────────────────────────────────────────────
async function fetchSportLive(sport) {
  console.log(`[SCRAPER] Fetching ${sport} live matches...`);
  const url = `${SPORT_APIS[sport]}/v1/${sport}/${SITE_NAME}/match/live`;
  const data = await safeFetch(url);
  if (!data) return null;
  return data;
}

/**
 * Fetch the Xoilac match page and extract stream URLs.
 * Only for live or hot matches to avoid too many requests.
 */
async function fetchMatchStreams(matchSlug) {
  const url = `${BASE_URL}/truc-tiep/${matchSlug}/`;
  const html = await safeFetchText(url);
  return extractStreamsFromHtml(html);
}

/**
 * Map a sport's live data response to an array of event objects
 * compatible with the existing tv-events.json format.
 */
function mapSportEvents(data, sport, streamMap) {
  if (!data || !Array.isArray(data.matches)) return [];

  // Build ID-indexed maps from the array-like objects
  const teamsMap = {};
  const compsMap = {};
  Object.values(data.teams || {}).forEach(t => { if (t && t.id) teamsMap[t.id] = t; });
  Object.values(data.competitions || {}).forEach(c => { if (c && c.id) compsMap[c.id] = c; });

  const events = [];

  for (const match of data.matches) {
    const homeTeam = teamsMap[match.home_team_id] || {};
    const awayTeam = teamsMap[match.away_team_id] || {};
    const comp     = compsMap[match.competition_id] || {};

    const homeName = homeTeam.name || 'TBD';
    const awayName = awayTeam.name || 'TBD';
    const compName = comp.name || comp.short_name || 'Unknown League';

    const jadwalStart = tsToJadwal(match.match_time);
    // Assume 2h match + 30min buffer
    const jadwalStop  = tsToJadwal(match.match_time + 2.5 * 3600);

    const matchSlug   = match.name || '';
    const streams     = streamMap[matchSlug] || [];
    const primaryStream = streams[0] || '';

    // Logos: Xoilac uses a CDN for team logos
    const logoBase = 'https://imgts.sportpulseapiz.com/images/football/teams';
    const homeLogo = homeTeam.id ? `${logoBase}/${homeTeam.id}.png` : '';
    const awayLogo = awayTeam.id ? `${logoBase}/${awayTeam.id}.png` : '';

    const id_event = `xoilac-${sport}-${match.id}`;

    events.push({
      id_iptv:      id_event,
      nama_channel: id_event,
      url_iptv:     primaryStream,
      url_license:  '',
      jenis:        primaryStream ? 'iframe' : 'xoilac',
      nama_event:   `${compName} [${SPORT_LABELS[sport]}]`,
      player_1:     homeName,
      player_2:     awayName,
      logo_1:       homeLogo,
      logo_2:       awayLogo,
      jadwal_event: jadwalStart,
      jadwal_stop:  jadwalStop,
      deskripsi:    `Saksikan pertandingan ${homeName} vs ${awayName} live di YKN TV`,
      deskripsi_en: `Watch ${homeName} vs ${awayName} live on YKN TV`,
      id_event:     id_event,
      xoilac_slug:  matchSlug,
      xoilac_url:   matchSlug ? `${BASE_URL}/truc-tiep/${matchSlug}/` : '',
      sport_type:   sport,
      home_scores:  match.home_scores,
      away_scores:  match.away_scores,
      status_id:    match.status_id,
      is_hot:       match.is_hot,
      streams_all:  streams,
    });
  }

  return events;
}

async function run() {
  console.log('[XOILAC SCRAPER] Starting scrape for all sports...');
  const allEvents = [];

  // Determine which matches are live/hot (status_id for playing) to fetch stream pages
  // We'll do this per-sport
  const SPORTS = ['football', 'basketball', 'tennis', 'badminton', 'volleyball', 'esports'];
  const LIVE_STATUS_IDS = {
    football:   new Set([2, 3, 4, 5, 6, 7]),
    basketball: new Set([2, 3, 4, 5, 6, 7, 8, 9]),
    tennis:     new Set([3, 51, 52, 53, 54, 55]),
    badminton:  new Set([3, 51, 331, 52, 332, 53, 333, 54, 334, 55]),
    volleyball: new Set([3, 432, 434, 436, 438, 440]),
    esports:    new Set([2]),
  };

  for (const sport of SPORTS) {
    const data = await fetchSportLive(sport);
    if (!data) {
      console.warn(`[SCRAPER] No data for ${sport}, skipping.`);
      continue;
    }

    const matches = data.matches || [];
    console.log(`[SCRAPER] ${sport}: ${matches.length} matches found`);

    // Filter live/hot matches to fetch stream URLs
    const liveMatches = matches.filter(m =>
      (LIVE_STATUS_IDS[sport]?.has(m.status_id) || m.is_hot === 1) && m.name
    );

    console.log(`[SCRAPER] ${sport}: ${liveMatches.length} live/hot matches — fetching stream pages...`);

    const streamMap = {};
    // Batch: max 5 at a time to avoid hammering server
    const BATCH = 5;
    for (let i = 0; i < liveMatches.length; i += BATCH) {
      const batch = liveMatches.slice(i, i + BATCH);
      await Promise.all(batch.map(async m => {
        const streams = await fetchMatchStreams(m.name);
        if (streams.length > 0) {
          streamMap[m.name] = streams;
          console.log(`  [+] ${m.name}: ${streams.length} streams`);
        }
      }));
      if (i + BATCH < liveMatches.length) await sleep(300);
    }

    const events = mapSportEvents(data, sport, streamMap);
    allEvents.push(...events);
    console.log(`[SCRAPER] ${sport}: mapped ${events.length} events`);

    await sleep(500);
  }

  // Save to file
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allEvents, null, 2));
  console.log(`\n[XOILAC SCRAPER] Done! Total events: ${allEvents.length}`);
  console.log(`[XOILAC SCRAPER] Saved to: ${OUTPUT_PATH}`);

  // Summary by sport
  const bySport = {};
  for (const ev of allEvents) {
    bySport[ev.sport_type] = (bySport[ev.sport_type] || 0) + 1;
  }
  console.log('[XOILAC SCRAPER] Breakdown:', bySport);
}

// Run scraper
run().catch(err => {
  console.error('[XOILAC SCRAPER] Fatal error:', err);
  process.exit(1);
});

// Export for use in periodic runner
export { run as runXoilacScraper };
