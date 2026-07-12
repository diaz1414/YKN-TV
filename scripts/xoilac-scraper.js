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
const DATA_API = 'https://data-api.sportflowlivez.com';

const SPORT_LABELS = {
  football:   'Sepak Bola',
  basketball: 'Bola Basket',
  tennis:     'Tenis',
  badminton:  'Bulu Tangkis',
  volleyball: 'Bola Voli',
  esports:    'Esports',
};

// Esports sub-types (lol=6, dota2=7, csgo=8) — fetched with their own sport key
// but all mapped to sport_type='esports' in the output
const ESPORTS_SUBTYPES = ['lol', 'csgo', 'dota2'];

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

// ─── REGULAR SPORTS FETCH ──────────────────────────────────────────────────
/**
 * Fetch regular sport live data — response wrapped in {code, message, data: {...}}
 * Returns the inner data object (with .matches, .teams, .competitions)
 */
async function fetchSportLive(sport) {
  console.log(`[SCRAPER] Fetching ${sport} live matches...`);
  const url = `${DATA_API}/v1/${sport}/${SITE_NAME}/match/live`;
  const raw = await safeFetch(url);
  if (!raw) return null;
  // Regular sports: {code: 0, message: 'success', data: {matches, teams, competitions}}
  if (raw.data && Array.isArray(raw.data.matches)) return raw.data;
  // Fallback: response might be direct (like esports subtypes)
  if (Array.isArray(raw.matches)) return raw;
  return null;
}

// ─── ESPORTS FETCH ─────────────────────────────────────────────────────────
/**
 * Fetch esports live data per sub-type (lol, csgo, dota2).
 * Response is direct: {matches: [...], teams: {...}, competitions: {...}, sites: [...]}
 * Returns the data object directly.
 */
async function fetchEsportsSubtype(subtype) {
  console.log(`[SCRAPER] Fetching esports/${subtype} live matches...`);
  const url = `${DATA_API}/v1/${subtype}/${SITE_NAME}/match/live`;
  const raw = await safeFetch(url);
  if (!raw) return null;
  // Esports API returns data directly without {code, data} wrapper
  if (Array.isArray(raw.matches)) return raw;
  // Fallback: might have data wrapper
  if (raw.data && Array.isArray(raw.data.matches)) return raw.data;
  return null;
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

  // Build ID-indexed maps — handle both array format (esports) and object format (other sports)
  const teamsMap = {};
  const compsMap = {};

  const teamsSource = data.teams || {};
  const compsSource = data.competitions || {};

  // Normalize: if it's an array, index by .id; if it's an object, use Object.values
  const teamsArr = Array.isArray(teamsSource) ? teamsSource : Object.values(teamsSource);
  const compsArr = Array.isArray(compsSource) ? compsSource : Object.values(compsSource);

  teamsArr.forEach(t => { if (t && t.id) teamsMap[t.id] = t; });
  compsArr.forEach(c => { if (c && c.id) compsMap[c.id] = c; });

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

    // Logos: Xoilac uses a CDN for team logos (same CDN for all sports including esports)
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

  const LIVE_STATUS_IDS = {
    football:   new Set([2, 3, 4, 5, 6, 7]),
    basketball: new Set([2, 3, 4, 5, 6, 7, 8, 9]),
    tennis:     new Set([3, 51, 52, 53, 54, 55]),
    badminton:  new Set([3, 51, 331, 52, 332, 53, 333, 54, 334, 55]),
    volleyball: new Set([3, 432, 434, 436, 438, 440]),
    esports:    new Set([2]),
  };

  // ── Regular sports ─────────────────────────────────────────────────────
  const REGULAR_SPORTS = ['football', 'basketball', 'tennis', 'badminton', 'volleyball'];

  for (const sport of REGULAR_SPORTS) {
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

  // ── Esports — fetch each sub-type (lol, csgo, dota2) separately ────────
  console.log('[SCRAPER] Fetching esports (lol, csgo, dota2)...');

  // Use flat arrays instead of objects to avoid Object.assign breaking array merges
  const esportsCombined = {
    matches: [],
    teamsArr: [],   // flat array of team objects
    compsArr: [],   // flat array of competition objects
  };

  for (const subtype of ESPORTS_SUBTYPES) {
    const data = await fetchEsportsSubtype(subtype);
    if (!data) {
      console.warn(`[SCRAPER] No data for esports/${subtype}, skipping.`);
      continue;
    }

    const matches = data.matches || [];
    console.log(`[SCRAPER] esports/${subtype}: ${matches.length} matches found`);

    esportsCombined.matches.push(...matches);

    // teams and competitions are arrays — just push them in
    const teamsRaw = data.teams || [];
    const compsRaw = data.competitions || [];
    const teamsArr = Array.isArray(teamsRaw) ? teamsRaw : Object.values(teamsRaw);
    const compsArr = Array.isArray(compsRaw) ? compsRaw : Object.values(compsRaw);
    esportsCombined.teamsArr.push(...teamsArr);
    esportsCombined.compsArr.push(...compsArr);

    await sleep(300);
  }

  if (esportsCombined.matches.length > 0) {
    // Deduplicate teams and competitions by ID, then build a fake {matches, teams: {}, competitions: {}}
    // shape compatible with mapSportEvents
    const teamsById = {};
    esportsCombined.teamsArr.forEach(t => { if (t && t.id) teamsById[t.id] = t; });
    const compsById = {};
    esportsCombined.compsArr.forEach(c => { if (c && c.id) compsById[c.id] = c; });

    const esportsData = {
      matches: esportsCombined.matches,
      teams:   Object.values(teamsById),   // pass as array (mapSportEvents handles both)
      competitions: Object.values(compsById),
    };

    console.log(`[SCRAPER] esports total: ${esportsData.matches.length} matches, ${Object.keys(teamsById).length} unique teams — fetching stream pages...`);

    // Fetch streams for live/hot esports matches
    const liveEsports = esportsData.matches.filter(m =>
      (LIVE_STATUS_IDS.esports?.has(m.status_id) || m.is_hot === 1) && m.name
    );

    console.log(`[SCRAPER] esports: ${liveEsports.length} live/hot matches`);
    const streamMap = {};
    const BATCH = 5;
    for (let i = 0; i < liveEsports.length; i += BATCH) {
      const batch = liveEsports.slice(i, i + BATCH);
      await Promise.all(batch.map(async m => {
        const streams = await fetchMatchStreams(m.name);
        if (streams.length > 0) {
          streamMap[m.name] = streams;
          console.log(`  [+] ${m.name}: ${streams.length} streams`);
        }
      }));
      if (i + BATCH < liveEsports.length) await sleep(300);
    }

    const esportsEvents = mapSportEvents(esportsData, 'esports', streamMap);
    allEvents.push(...esportsEvents);
    console.log(`[SCRAPER] esports: mapped ${esportsEvents.length} events`);
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
