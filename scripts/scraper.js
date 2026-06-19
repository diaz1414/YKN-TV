const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const FILE_NAME = 'ykn-leaderboard.json';
const FILE_PATH = path.join(DATA_DIR, FILE_NAME);
const LEADERBOARD_API = 'https://bagibagi.co/api/partnerintegration/top-donator/streamkey?streamkey=k6OOWWlQNACUlvhsujt0xGGYOh44REgM';

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
      const name = d.userName || d.name || 'Anonymous';
      console.log(`  #${idx + 1} - ${name}: Rp ${Number(d.amount).toLocaleString('id-ID')}`);
    });
    return;
  }

  const oldMap = new Map();
  oldList.forEach((d, idx) => {
    const key = d.userName || d.name || 'Anonymous';
    oldMap.set(key, { rank: idx + 1, amount: Number(d.amount) });
  });

  const changes = [];
  newList.forEach((d, idx) => {
    const key = d.userName || d.name || 'Anonymous';
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
    const name = d.userName || d.name || 'Anonymous';
    console.log(`  [Rank #${idx + 1}] ${name} - Rp ${Number(d.amount).toLocaleString('id-ID')}`);
  });
  console.log('------------------------------------\n');
}

async function runScraper() {
  console.log('[LEADERBOARD SCRAPER] Memulai fetch data leaderboard BagiBagi...');
  
  try {
    const res = await fetch(LEADERBOARD_API, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.data)) {
        const oldCache = [...cache];
        cache = data.data;
        
        // Simpan ke file disk
        fs.writeFileSync(FILE_PATH, JSON.stringify(cache, null, 2));
        console.log(`[LEADERBOARD SCRAPER] Sukses update leaderboard secara langsung -> ${FILE_NAME}`);
        
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

// Jalankan scraper saat script dimuat
runScraper();

// Jalankan berkala setiap 2 menit
setInterval(runScraper, 2 * 60 * 1000);

module.exports = {
  getLeaderboard: () => cache,
  runScraper
};
