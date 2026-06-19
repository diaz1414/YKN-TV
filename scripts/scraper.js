import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from 'saweria';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
const FILE_NAME = 'ykn-leaderboard.json';
const FILE_PATH = path.join(DATA_DIR, FILE_NAME);
const STREAM_KEY = '404af2c94a1776c1acb47060b881adf4';
const LEADERBOARD_API = `https://backend.saweria.co/widgets/leaderboard?stream_key=${STREAM_KEY}`;

let cache = [];

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load existing files on startup if available
if (fs.existsSync(FILE_PATH)) {
  try {
    cache = JSON.parse(fs.readFileSync(FILE_PATH, 'utf-8'));
    console.log(`[LEADERBOARD SCRAPER] Loaded cached leaderboard from disk.`);
  } catch (e) {
    console.error(`[LEADERBOARD SCRAPER] Failed to parse local cached leaderboard:`, e.message);
  }
}

// Bandingkan data lama dan baru, lalu log perubahan posisi/jumlah donasi
function compareAndLog(oldList, newList) {
  if (!oldList || oldList.length === 0) {
    console.log('[LEADERBOARD SCRAPER] Inisialisasi leaderboard pertama kali. Menampilkan donatur saat ini:');
    newList.forEach((d, idx) => {
      const name = d.name || 'Anonymous';
      console.log(`  #${idx + 1} - ${name}: Rp ${Number(d.amount).toLocaleString('id-ID')}`);
    });
    return;
  }

  const oldMap = new Map();
  oldList.forEach((d, idx) => {
    const key = d.name || 'Anonymous';
    oldMap.set(key, { rank: idx + 1, amount: Number(d.amount) });
  });

  const changes = [];
  newList.forEach((d, idx) => {
    const key = d.name || 'Anonymous';
    const newRank = idx + 1;
    const newAmount = Number(d.amount);

    if (oldMap.has(key)) {
      const oldData = oldMap.get(key);
      const oldRank = oldData.rank;
      const oldAmount = oldData.amount;

      let detail = [];
      if (newAmount > oldAmount) {
        detail.push(`donasi bertambah Rp ${(newAmount - oldAmount).toLocaleString('id-ID')} (Total: Rp ${newAmount.toLocaleString('id-ID')})`);
      }
      if (newRank !== oldRank) {
        const arrow = newRank < oldRank ? '▲ NAIK' : '▼ TURUN';
        detail.push(`peringkat ${arrow} dari #${oldRank} ke #${newRank}`);
      }

      if (detail.length > 0) {
        changes.push(`[UPDATE] ${key}: ${detail.join(', ')}`);
      }
      oldMap.delete(key);
    } else {
      changes.push(`[BARU] ${key} masuk leaderboard di peringkat #${newRank} dengan donasi Rp ${newAmount.toLocaleString('id-ID')}`);
    }
  });

  // Siapa saja yang tersisa di oldMap berarti keluar dari leaderboard
  for (const [key, oldData] of oldMap.entries()) {
    changes.push(`[KELUAR] ${key} keluar dari leaderboard (sebelumnya peringkat #${oldData.rank})`);
  }

  if (changes.length > 0) {
    console.log('[LEADERBOARD SCRAPER] Deteksi perubahan pada leaderboard:');
    changes.forEach(change => console.log(`  ${change}`));
  } else {
    console.log('[LEADERBOARD SCRAPER] Tidak ada perubahan peringkat atau donasi.');
  }

  // Tampilkan peringkat leaderboard terbaru di console
  console.log('\n--- POSISI LEADERBOARD SAAT INI ---');
  newList.forEach((d, idx) => {
    const name = d.name || 'Anonymous';
    console.log(`  [Rank #${idx + 1}] ${name} - Rp ${Number(d.amount).toLocaleString('id-ID')}`);
  });
  console.log('------------------------------------\n');
}

async function runScraper() {
  console.log('[LEADERBOARD SCRAPER] Memulai fetch data leaderboard dari Saweria...');
  
  try {
    const res = await fetch(LEADERBOARD_API, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.data)) {
        const oldCache = [...cache];
        
        // Map data dari format Saweria (donator, amount) ke format web (name, amount)
        cache = data.data.map(item => ({
          name: item.donator || 'Anonymous',
          amount: Number(item.amount) || 0,
          isVerified: false
        }));
        
        // Simpan ke disk
        fs.writeFileSync(FILE_PATH, JSON.stringify(cache, null, 2));
        console.log(`[LEADERBOARD SCRAPER] Sukses update leaderboard dari Saweria -> ${FILE_NAME}`);
        
        // Bandingkan dan log perbedaan
        compareAndLog(oldCache, cache);
        return;
      } else {
        console.error('[LEADERBOARD SCRAPER] API mengembalikan format data tidak valid:', data);
      }
    } else {
      console.error(`[LEADERBOARD SCRAPER] Fetch gagal dengan status: ${res.status}`);
    }
  } catch (err) {
    console.error('[LEADERBOARD SCRAPER] Gagal fetch data leaderboard:', err.message);
  }
}

// Inisialisasi Saweria Client untuk mendengar donasi live secara real-time
try {
  const client = new Client();
  client.setStreamKey(STREAM_KEY);

  client.on('donations', (donations) => {
    console.log(`\n[SAWERIA EVENT] Menerima ${donations.length} donasi baru secara real-time!`);
    donations.forEach(d => {
      console.log(`  - Dari: ${d.donator || 'Anonymous'}`);
      console.log(`  - Jumlah: Rp ${Number(d.amount).toLocaleString('id-ID')}`);
      if (d.message) console.log(`  - Pesan: "${d.message}"`);
    });
    
    // Tunggu 2 detik lalu jalankan update cache
    console.log('[SAWERIA EVENT] Menjadwalkan sinkronisasi data dengan Saweria dalam 2 detik...');
    setTimeout(runScraper, 2000);
  });

  // Tangani error agar script tidak crash jika koneksi WebSocket diblokir oleh Cloudflare WAF hosting
  client.on('error', (err) => {
    console.error('[LEADERBOARD SCRAPER] Saweria client WebSocket error (Kemungkinan diblokir oleh Cloudflare WAF hosting):', err.message);
  });

  console.log(`[LEADERBOARD SCRAPER] Saweria live listener diaktifkan dengan Stream Key: ${STREAM_KEY.slice(0, 6)}***`);
} catch (err) {
  console.error('[LEADERBOARD SCRAPER] Gagal menginisialisasi Saweria client:', err.message);
}

// Jalankan scraper saat startup
runScraper();

// Jalankan berkala setiap 2 menit (sebagai cadangan / backup sync)
setInterval(runScraper, 2 * 60 * 1000);

const getLeaderboard = () => cache;

export {
  getLeaderboard,
  runScraper
};
