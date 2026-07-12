/**
 * leaderboard-scraper.js
 * Scrapes the Saweria leaderboard for YKN TV and writes it to JSON.
 * Runs once and exits. Compatible with GitHub Actions.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
const FILE_NAME = 'ykn-leaderboard.json';
const FILE_PATH = path.join(DATA_DIR, FILE_NAME);

const STREAM_KEY = '404af2c94a1776c1acb47060b881adf4';
const LEADERBOARD_API = `https://backend.saweria.co/widgets/leaderboard?stream_key=${STREAM_KEY}`;

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function run() {
  console.log('[LEADERBOARD SCRAPER] Fetching leaderboard from Saweria...');
  try {
    const res = await fetch(LEADERBOARD_API, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    if (data && Array.isArray(data.data)) {
      // Map Saweria widget API format (donator, amount) to frontend format
      const leaderboard = data.data.map(item => ({
        name: item.donator || 'Anonymous',
        amount: Number(item.amount) || 0,
        isVerified: item.is_user || false,
      }));

      fs.writeFileSync(FILE_PATH, JSON.stringify(leaderboard, null, 2));
      console.log(`[LEADERBOARD SCRAPER] Successfully updated leaderboard -> ${FILE_PATH}`);
      console.log(`[LEADERBOARD SCRAPER] Total donors in leaderboard: ${leaderboard.length}`);
    } else {
      console.error('[LEADERBOARD SCRAPER] Invalid response format:', data);
    }
  } catch (err) {
    console.error('[LEADERBOARD SCRAPER] Failed to fetch leaderboard:', err.message);
    process.exit(1);
  }
}

run();
