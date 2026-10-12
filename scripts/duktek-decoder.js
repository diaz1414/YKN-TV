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
  if (logoPath.startsWith('http')) return logoPath;
  const cleanName = logoPath.replace(/^\/?(uploads\/)?/, '');
  return `${UPLOADS_BASE}/${cleanName}`;
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

      allChannels.push({
        id_iptv: String(item.id || item.id_iptv || ''),
        nama_channel: item.name || item.nama_channel || '',
        tagline: item.tagline || '',
        url_iptv: item.hls || item.url_iptv || '',
        url_license: item.url_license && item.url_license !== 'none' ? item.url_license : '',
        jenis: item.jenis || 'hls',
        country_code: item.alpha_2_code || data.country || code,
        country_name: item.country_name || countryName,
        logo: normalizeLogo(item.logo || item.gbr_channel || ''),
        headers: parsedHeader,
        license_headers: parsedLicenseHeader,
        updated_token: data.token || remoteToken
      });
    });
  });

  report.sort((a, b) => a.country_name.localeCompare(b.country_name));

  const outPath1 = path.join(DATA_DIR, 'duktek-channels.json');
  const outPath2 = path.join(SRC_DATA_DIR, 'duktek-channels.json');

  const payloadJson = JSON.stringify(allChannels, null, 2);
  fs.writeFileSync(outPath1, payloadJson, 'utf-8');
  fs.writeFileSync(outPath2, payloadJson, 'utf-8');

  // Ekspor feed khusus APK Android (tv-sports.json & tv-hiburan.json)
  const sportsChannels = allChannels.filter(c => c.country_code === 'SP');
  const hiburanChannels = allChannels.filter(c => c.country_code === 'ID');

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
  console.log(` Token Tersimpan         : ${tokenToSave}`);
  console.log(` Waktu Eksekusi          : ${totalTime} detik`);
  console.log(` File Output             :`);
  console.log(`  -> ${path.relative(process.cwd(), outPath1)}`);
  console.log(`  -> ${path.relative(process.cwd(), outPath2)}`);
  console.log('='.repeat(65) + '\n');
}

run();
