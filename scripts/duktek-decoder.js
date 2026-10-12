/**
 * duktek-decoder.js
 * Tool untuk men-download, men-decode, dan mengonversi database siaran
 * dari repositori Duktek TV / BitTV (movietrailersxxi-pixel/duktek2)
 * menjadi JSON siap pakai untuk project YKN TV.
 *
 * FITUR SMART TOKEN CHECK:
 * - Cuma mendownload 10 bytes (token.dat) untuk cek apakah ada update.
 * - Jika token sama dengan lokal, langsung SELESAI (< 0.5 detik, HEMAT kuota & runner Actions).
 * - Jika token berubah (mereka baru update commit), baru download & decode full.
 * - Gunakan flag '--force' jika ingin memaksa decode tanpa cek token.
 *
 * Jalankan:
 *   node scripts/duktek-decoder.js          # default: ID, SP, EV (dengan token check)
 *   node scripts/duktek-decoder.js --all    # decode SEMUA 51 negara (dengan token check)
 *   node scripts/duktek-decoder.js --force  # paksa decode ulang
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
const SRC_DATA_DIR = path.join(__dirname, '../src/data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(SRC_DATA_DIR)) fs.mkdirSync(SRC_DATA_DIR, { recursive: true });

const REPO_BASE = 'https://raw.githubusercontent.com/movietrailersxxi-pixel/duktek2/main/dt';
const TOKEN_URL = `${REPO_BASE}/token.dat`;
const UPLOADS_BASE = `${REPO_BASE}/uploads`;

const TOKEN_FILE_DATA = path.join(DATA_DIR, 'duktek-token.txt');
const TOKEN_FILE_SRC = path.join(SRC_DATA_DIR, 'duktek-token.txt');

// Daftar lengkap semua 51 negara dan kategori yang ada di Duktek TV
export const ALL_KNOWN_CODES = [
  'A1', 'A2', 'AA', 'AE', 'AG', 'AN', 'AR', 'AU', 'BE', 'BR',
  'C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9',
  'CA', 'CN', 'CO', 'EV', 'FR', 'GB', 'ID', 'IN', 'IT', 'JP',
  'KD', 'KR', 'KW', 'LO', 'MI', 'MX', 'MY', 'PH', 'PT', 'PY',
  'RI', 'RU', 'SA', 'SE', 'SG', 'SK', 'SP', 'TH', 'US', 'UY', 'VN'
];

const DEFAULT_CODES = ['ID', 'SP', 'EV'];

/**
 * Cek apakah ada perubahan di repositori upstream via token.dat (hanya 10 byte)
 */
async function getRemoteToken() {
  try {
    const res = await fetch(`${TOKEN_URL}?t=${Date.now()}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const txt = (await res.text()).trim();
    return txt || null;
  } catch (err) {
    return null;
  }
}

function getLocalToken() {
  if (fs.existsSync(TOKEN_FILE_DATA)) {
    try {
      return fs.readFileSync(TOKEN_FILE_DATA, 'utf-8').trim();
    } catch (e) {}
  }
  return null;
}

/**
 * Algoritma dekripsi 'pulihkan' (Reverse + Base64 bertingkat)
 */
function pulihkan(payloadStr) {
  try {
    const s1 = payloadStr.split('').reverse().join('');
    const s2 = Buffer.from(s1, 'base64').toString('utf8');
    const s3 = s2.split('').reverse().join('');
    const s4 = Buffer.from(s3, 'base64').toString('utf8');
    const jsonStr = s4.split('').reverse().join('');
    return JSON.parse(jsonStr);
  } catch (err) {
    throw new Error(`Gagal mendecode payload: ${err.message}`);
  }
}

/**
 * Normalisasi URL Logo agar mengarah ke CDN raw Github
 */
function normalizeLogo(logoPath) {
  if (!logoPath) return '';
  if (logoPath.startsWith('data:image') || logoPath.startsWith('http')) return logoPath;
  const cleanName = logoPath.replace(/^\/?(uploads\/)?/, '');
  return `${UPLOADS_BASE}/${cleanName}`;
}

function formatTimestampToWib(stamp) {
  if (!stamp) return '';
  const num = Number(stamp);
  if (isNaN(num) || num <= 0) return '';
  const d = new Date(num * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const wibTime = new Date(d.getTime() + 7 * 3600 * 1000);
  const year = wibTime.getUTCFullYear();
  const month = pad(wibTime.getUTCMonth() + 1);
  const date = pad(wibTime.getUTCDate());
  const hours = pad(wibTime.getUTCHours());
  const minutes = pad(wibTime.getUTCMinutes());
  return `${year}-${month}-${date} ${hours}:${minutes} WIB`;
}

/**
 * Fetch dan decode data per kode negara
 */
async function fetchAndDecode(code, version = 'v214') {
  const url = `${REPO_BASE}/${version}/${code.toUpperCase()}.json`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!res.ok) return null;

    const rawText = await res.text();
    const markerMatch = rawText.match(/([0-9a-f]{32,})/i);
    if (!markerMatch) return null;

    const payload = rawText.slice(markerMatch.index + markerMatch[0].length);
    const decoded = pulihkan(payload);
    return decoded;
  } catch (err) {
    return null;
  }
}

async function mapConcurrent(items, limit, fn) {
  const results = [];
  const executing = [];
  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));
    results.push(p);
    if (limit <= items.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(results);
}

async function run() {
  const startTime = Date.now();
  const args = process.argv.slice(2);
  const isForce = args.includes('--force') || args.includes('-f');
  const isAll = args.includes('--all') || args.includes('all') || args.includes('-a');

  const filteredArgs = args.filter(a => !a.startsWith('-') && a !== 'all');
  const targetCodes = isAll 
    ? ALL_KNOWN_CODES 
    : (filteredArgs.length > 0 ? filteredArgs.map(s => s.toUpperCase()) : DEFAULT_CODES);

  console.log('='.repeat(65));
  console.log(` [DUKTEK DECODER] Memeriksa status update sumber...`);

  // 1. SMART TOKEN CHECK (Hemat GitHub Actions / bandwidth)
  const remoteToken = await getRemoteToken();
  const localToken = getLocalToken();

  console.log(` • Remote Token Upstream : ${remoteToken || '(gagal membaca)'}`);
  console.log(` • Local Cached Token    : ${localToken || '(belum ada)'}`);

  const hasExistingJson = fs.existsSync(path.join(DATA_DIR, 'duktek-channels.json'));

  if (!isForce && remoteToken && localToken && remoteToken === localToken && hasExistingJson) {
    const elapsedMs = Date.now() - startTime;
    console.log(`\n ✅ [SKIP - HEMAT RUNNER] Token masih identik (${remoteToken}).`);
    console.log(`    Tidak ada pembaruan dari repository upstream.`);
    console.log(`    Selesai dalam ${elapsedMs}ms tanpa membuang menit Actions/kuota.`);
    console.log('='.repeat(65) + '\n');
    return;
  }

  if (isForce) {
    console.log(` ⚡ [FORCE] Mode paksa decode diaktifkan.`);
  } else {
    console.log(` 🚀 [UPDATE TERDETEKSI] Token berubah atau data belum ada. Memulai ekstraksi...`);
  }
  console.log('='.repeat(65));

  const allChannels = [];
  const report = [];
  let processedCount = 0;

  await mapConcurrent(targetCodes, 6, async (code) => {
    const data = await fetchAndDecode(code);
    processedCount++;

    if (!data) {
      return;
    }

    const items = data.info || [];
    const countryName = data.country_name || code;
    console.log(` [${processedCount}/${targetCodes.length}] ✅ ${code} (${countryName}): ${items.length} channel`);

    report.push({
      code,
      country_name: countryName,
      count: items.length,
      token: data.token
    });

    items.forEach((item) => {
      let parsedHeader = null;
      let parsedLicenseHeader = null;

      try {
        if (item.header_iptv) parsedHeader = JSON.parse(item.header_iptv);
      } catch (e) {}

      try {
        if (item.header_license) parsedLicenseHeader = JSON.parse(item.header_license);
      } catch (e) {}

      const rawLogo = item.image || item.logo || item.gbr_channel || '';
      const finalLogo = normalizeLogo(rawLogo);

      let streamUrl = item.hls || item.url_iptv || '';
      let streamHeaders = parsedHeader;
      const channelName = item.name || item.nama_channel || '';
      const nameLower = channelName.toLowerCase();

      // CEK & FILTER STREAM PENGUMUMAN PALSU ("BitTV-v2.1.7-obsidian")
      if (streamUrl.includes('movietrailersxxi-pixel/web/main/ts/index.m3u8') || streamUrl.includes('video_with_qr')) {
        // Jika KompasTV, ganti dengan stream live aslinya
        if (nameLower.includes('kompas')) {
          streamUrl = 'https://op-flashcon-digdayahd-1.dens.tv/h/h234/index.m3u8';
          streamHeaders = {
            'Referer': 'https://www.dens.tv/',
            'Origin': 'https://www.dens.tv/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
          };
        } else {
          // Buang siaran yang hanya berisi video pengumuman palsu ini!
          return;
        }
      }

      allChannels.push({
        id_iptv: String(item.id || item.id_iptv || ''),
        nama_channel: channelName,
        tagline: item.tagline || '',
        jadwal_event: formatTimestampToWib(item.t_stamp),
        jadwal_stop: formatTimestampToWib(item.s_stamp),
        t_stamp: item.t_stamp ? Number(item.t_stamp) : null,
        s_stamp: item.s_stamp ? Number(item.s_stamp) : null,
        url_iptv: streamUrl,
        url_license: item.url_license && item.url_license !== 'none' ? item.url_license : '',
        jenis: item.jenis || 'hls',
        country_code: item.alpha_2_code || data.country || code,
        country_name: item.country_name || countryName,
        logo: finalLogo,
        gbr_base64: finalLogo.startsWith('data:image') ? finalLogo : '',
        headers: streamHeaders,
        license_headers: parsedLicenseHeader,
        updated_token: data.token || remoteToken,
        last_updated: new Date().toISOString()
      });
    });
  });

  report.sort((a, b) => a.country_name.localeCompare(b.country_name));

  // FITUR HEALTH CHECK STREAM (HIDUP VS MATI)
  const isCheckStream = args.includes('--check') || args.includes('-c') || args.includes('--filter-live');
  let aliveChannels = allChannels;

  if (isCheckStream) {
    console.log('\n' + '='.repeat(65));
    console.log(` 🩺 [STREAM HEALTH CHECK] Memeriksa status hidup/mati stream...`);
    console.log(`    Total stream yang akan diperiksa: ${allChannels.length}`);
    console.log('='.repeat(65));

    let testedCount = 0;
    let liveCount = 0;

    await mapConcurrent(allChannels, 20, async (ch) => {
      const checkResult = await testStreamUrl(ch.url_iptv, ch.headers, 3000);
      testedCount++;
      ch.is_alive = checkResult.ok;
      ch.status = checkResult.ok ? 'live' : 'offline';
      ch.http_status = checkResult.status;

      if (checkResult.ok) {
        liveCount++;
      }

      if (testedCount % 50 === 0 || testedCount === allChannels.length) {
        process.stdout.write(`\r [STATUS] Diperiksa: ${testedCount}/${allChannels.length} | Hidup: ${liveCount} | Mati: ${testedCount - liveCount}`);
      }
    });

    console.log('\n' + '='.repeat(65));
    console.log(` ✅ Pemeriksaan Selesai!`);
    console.log(`    Stream Hidup (Live) : ${liveCount}`);
    console.log(`    Stream Mati         : ${allChannels.length - liveCount}`);
    console.log('='.repeat(65) + '\n');

    aliveChannels = allChannels.filter(c => c.is_alive);
  } else {
    // Default: tandai status live jika belum dicek
    allChannels.forEach(c => {
      c.is_alive = true;
      c.status = 'live';
    });
  }

  const outPath1 = path.join(DATA_DIR, 'duktek-channels.json');
  const outPath2 = path.join(SRC_DATA_DIR, 'duktek-channels.json');
  const outAlive1 = path.join(DATA_DIR, 'duktek-channels-alive.json');
  const outAlive2 = path.join(SRC_DATA_DIR, 'duktek-channels-alive.json');

  const payloadJson = JSON.stringify(allChannels, null, 2);
  fs.writeFileSync(outPath1, payloadJson, 'utf-8');
  fs.writeFileSync(outPath2, payloadJson, 'utf-8');

  const payloadAliveJson = JSON.stringify(aliveChannels, null, 2);
  fs.writeFileSync(outAlive1, payloadAliveJson, 'utf-8');
  fs.writeFileSync(outAlive2, payloadAliveJson, 'utf-8');

  // Ekspor feed khusus APK Android (tv-sports.json & tv-hiburan.json)
  const sportsChannels = (isCheckStream ? aliveChannels : allChannels).filter(c => c.country_code === 'SP');
  const hiburanChannels = (isCheckStream ? aliveChannels : allChannels).filter(c => c.country_code === 'ID');

  if (sportsChannels.length > 0) {
    const sportsJson = JSON.stringify(sportsChannels, null, 2);
    fs.writeFileSync(path.join(DATA_DIR, 'tv-sports.json'), sportsJson, 'utf-8');
    fs.writeFileSync(path.join(SRC_DATA_DIR, 'tv-sports.json'), sportsJson, 'utf-8');
  }

  if (hiburanChannels.length > 0) {
    const hiburanJson = JSON.stringify(hiburanChannels, null, 2);
    fs.writeFileSync(path.join(DATA_DIR, 'tv-hiburan.json'), hiburanJson, 'utf-8');
    fs.writeFileSync(path.join(SRC_DATA_DIR, 'tv-hiburan.json'), hiburanJson, 'utf-8');
  }

  // Simpan token baru
  const tokenToSave = remoteToken || String(Date.now());
  fs.writeFileSync(TOKEN_FILE_DATA, tokenToSave, 'utf-8');
  fs.writeFileSync(TOKEN_FILE_SRC, tokenToSave, 'utf-8');

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n' + '='.repeat(65));
  console.log(` HASIL EKSTRAKSI:`);
  console.log('='.repeat(65));
  console.log(` Total Kategori Berhasil : ${report.length} dari ${targetCodes.length}`);
  console.log(` Total Channel Tersimpan : ${allChannels.length} channel`);
  if (isCheckStream) {
    console.log(` Total Channel HIDUP     : ${aliveChannels.length} channel`);
  }
  console.log(` Token Tersimpan         : ${tokenToSave}`);
  console.log(` Waktu Eksekusi          : ${totalTime} detik`);
  console.log(` File Output             :`);
  console.log(`  -> ${path.relative(process.cwd(), outPath1)} (semua channel + status)`);
  console.log(`  -> ${path.relative(process.cwd(), outAlive1)} (hanya stream aktif)`);
  console.log(`  -> data/tv-sports.json & data/tv-hiburan.json`);
  console.log('='.repeat(65) + '\n');
}

/**
 * Health check HTTP stream URL
 */
async function testStreamUrl(url, headers, timeoutMs = 3000) {
  if (!url || !url.startsWith('http')) return { ok: false, status: 0, reason: 'Invalid URL' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Range': 'bytes=0-1024',
        ...(headers || {})
      },
      signal: ctrl.signal
    });
    clearTimeout(timer);
    return { ok: res.ok, status: res.status };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, status: 0, reason: err.name === 'AbortError' ? 'TIMEOUT' : err.message };
  }
}

run();
