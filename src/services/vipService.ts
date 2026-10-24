/**
 * vipService.ts - YKN TV VIP License & Ad-Free System
 * Backed by Google Sheets / Google Apps Script API + Local Storage Recovery
 */

export interface VipTokenRow {
  token: string;
  buyer_name: string;
  duration_days: number; // 0 = permanent / lifetime, > 0 = trial days
  max_devices: number;
  registered_devices: string[];
  activated_at?: string | null;
  expired_at?: string | null; // ISO date string or 'permanent'
  status: 'active' | 'expired' | 'blocked';
  created_at: string;
  last_active_at?: string | null;
}

export interface VipVerifyResult {
  success: boolean;
  message: string;
  isPermanent?: boolean;
  expiredAt?: string | null;
  maxDevices?: number;
  usedDevices?: number;
  buyerName?: string;
}

// Config: Google Apps Script Web App URL milik user
const DEFAULT_GAS_URL =
  import.meta.env.VITE_VIP_GAS_URL ||
  'https://script.google.com/macros/s/AKfycbw5JgsnaEW56Y7eCHgLEU71EXaSsAYiNCSQqok6B1D7pLovS1W-GpmNPQOs1kdm0NJEGg/exec';
const DEFAULT_ADMIN_SECRET = import.meta.env.VITE_VIP_ADMIN_SECRET || 'ykn_secret_admin_2026';

export const getGasApiUrl = (): string => {
  return localStorage.getItem('ykn_vip_gas_url') || DEFAULT_GAS_URL;
};

export const setGasApiUrl = (url: string) => {
  localStorage.setItem('ykn_vip_gas_url', url.trim());
};

export const getAdminSecret = (): string => {
  return localStorage.getItem('ykn_vip_admin_secret') || DEFAULT_ADMIN_SECRET;
};

export const setAdminSecret = (secret: string) => {
  localStorage.setItem('ykn_vip_admin_secret', secret.trim());
};

/**
 * Generate stable device fingerprint without external libraries
 */
export const getDeviceFingerprint = (): string => {
  const cached = localStorage.getItem('ykn_device_fp');
  if (cached && cached.length >= 10) return cached;

  try {
    const screenInfo = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
    const navInfo = `${navigator.userAgent}|${navigator.language}|${navigator.platform}|${navigator.hardwareConcurrency || 4}`;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta';

    // Canvas fingerprinting sample
    let canvasHash = 'c0';
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 120;
      canvas.height = 30;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(10, 5, 40, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('YKN TV VIP', 15, 8);
        const dataUrl = canvas.toDataURL();
        let hash = 0;
        for (let i = 0; i < dataUrl.length; i++) {
          hash = (hash << 5) - hash + dataUrl.charCodeAt(i);
          hash |= 0;
        }
        canvasHash = `c_${Math.abs(hash).toString(36)}`;
      }
    } catch {}

    const rawString = `${screenInfo}|${navInfo}|${tz}|${canvasHash}`;
    let hash = 0;
    for (let i = 0; i < rawString.length; i++) {
      hash = (hash << 5) - hash + rawString.charCodeAt(i);
      hash |= 0;
    }

    const fp = `dev_${Math.abs(hash).toString(36)}_${Date.now().toString(36).slice(-4)}`;
    localStorage.setItem('ykn_device_fp', fp);
    return fp;
  } catch {
    const fallback = `dev_fb_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('ykn_device_fp', fallback);
    return fallback;
  }
};

/**
 * Check if the current client has a valid VIP status
 */
export const isVipActive = (): boolean => {
  const active = localStorage.getItem('ykn_vip_active') === 'true';
  const token = localStorage.getItem('ykn_vip_token');
  const exp = localStorage.getItem('ykn_vip_expired_at');

  if (!active || !token) return false;

  if (exp && exp !== 'permanent') {
    const expTime = new Date(exp).getTime();
    if (!isNaN(expTime) && Date.now() > expTime) {
      localStorage.removeItem('ykn_vip_active');
      return false;
    }
  }

  return true;
};

/**
 * Get current VIP details
 */
export const getVipInfo = () => {
  const active = isVipActive();
  const token = localStorage.getItem('ykn_vip_token') || undefined;
  const buyerName = localStorage.getItem('ykn_vip_buyer_name') || undefined;
  const expiredAt = localStorage.getItem('ykn_vip_expired_at') || undefined;
  const isPermanent = expiredAt === 'permanent';

  return {
    isActive: active,
    token,
    buyerName,
    expiredAt,
    isPermanent,
  };
};

// Fallback in-memory/localStorage store if GAS URL is not yet connected
const LOCAL_STORAGE_MOCK_KEY = 'ykn_mock_vip_tokens';

const getMockTokens = (): VipTokenRow[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_MOCK_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
};

const saveMockTokens = (tokens: VipTokenRow[]) => {
  localStorage.setItem(LOCAL_STORAGE_MOCK_KEY, JSON.stringify(tokens));
};

/**
 * Verify VIP Token
 */
export const verifyVipToken = async (rawToken: string): Promise<VipVerifyResult> => {
  const token = rawToken.trim().toUpperCase();
  const fp = getDeviceFingerprint();
  const gasUrl = getGasApiUrl();

  if (!token) {
    return { success: false, message: 'Kode token VIP tidak boleh kosong.' };
  }

  // If Google Apps Script URL is configured, use online API
  if (gasUrl) {
    try {
      const url = `${gasUrl}?action=verify&token=${encodeURIComponent(token)}&device_id=${encodeURIComponent(fp)}`;
      const res = await fetch(url, { method: 'GET' });
      const data = await res.json();

      if (data && data.success) {
        localStorage.setItem('ykn_vip_active', 'true');
        localStorage.setItem('ykn_vip_token', token);
        localStorage.setItem('ykn_vip_expired_at', data.expired_at || 'permanent');
        if (data.buyer_name) localStorage.setItem('ykn_vip_buyer_name', data.buyer_name);

        return {
          success: true,
          message: data.message || 'VIP No-Ads Berhasil Diaktifkan!',
          isPermanent: data.expired_at === 'permanent',
          expiredAt: data.expired_at,
          maxDevices: data.max_devices,
          usedDevices: data.used_devices,
          buyerName: data.buyer_name,
        };
      } else {
        return {
          success: false,
          message: data.message || 'Token VIP tidak valid atau batas perangkat sudah penuh.',
        };
      }
    } catch (err: any) {
      console.warn('[vipService] Online verify failed, checking fallback...', err);
    }
  }

  // Fallback Mock Local Verification (allows testing before GAS deployment)
  const tokens = getMockTokens();
  const found = tokens.find((t) => t.token === token);

  if (!found) {
    return {
      success: false,
      message: 'Token VIP tidak ditemukan. Pastikan token yang Anda masukkan benar.',
    };
  }

  if (found.status === 'blocked') {
    return {
      success: false,
      message: 'Token ini telah dinonaktifkan oleh admin.',
    };
  }

  const registered = found.registered_devices || [];
  const alreadyIn = registered.includes(fp);

  if (!alreadyIn && registered.length >= found.max_devices) {
    return {
      success: false,
      message: `Batas perangkat untuk token ini sudah penuh (${registered.length}/${found.max_devices} HP). Hubungi admin jika ingin reset perangkat.`,
      maxDevices: found.max_devices,
      usedDevices: registered.length,
    };
  }

  if (!alreadyIn) {
    registered.push(fp);
    found.registered_devices = registered;
  }

  if (!found.activated_at) {
    found.activated_at = new Date().toISOString();
    if (found.duration_days > 0) {
      const exp = new Date(Date.now() + found.duration_days * 24 * 60 * 60 * 1000);
      found.expired_at = exp.toISOString();
    } else {
      found.expired_at = 'permanent';
    }
  }

  found.last_active_at = new Date().toISOString();
  saveMockTokens(tokens);

  localStorage.setItem('ykn_vip_active', 'true');
  localStorage.setItem('ykn_vip_token', token);
  localStorage.setItem('ykn_vip_expired_at', found.expired_at || 'permanent');
  if (found.buyer_name) localStorage.setItem('ykn_vip_buyer_name', found.buyer_name);

  return {
    success: true,
    message: alreadyIn
      ? 'Perangkat Anda dikenali kembali. VIP No-Ads aktif!'
      : 'Selamat! VIP No-Ads Berhasil Diaktifkan.',
    isPermanent: found.expired_at === 'permanent',
    expiredAt: found.expired_at,
    maxDevices: found.max_devices,
    usedDevices: registered.length,
    buyerName: found.buyer_name,
  };
};

/**
 * Generate random clean token format: YKN-VIP-XXXX-YYYY
 */
export const generateTokenCode = (): string => {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const rand = (len: number) => {
    let res = '';
    for (let i = 0; i < len; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };
  return `YKN-VIP-${rand(4)}-${rand(4)}`;
};

/**
 * Admin: Create New VIP Token
 */
export const createVipToken = async (input: {
  buyerName: string;
  durationDays: number;
  maxDevices: number;
}): Promise<{ success: boolean; token?: string; message?: string }> => {
  const gasUrl = getGasApiUrl();
  const adminSecret = getAdminSecret();
  const token = generateTokenCode();

  if (gasUrl) {
    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'create',
          secret: adminSecret,
          token,
          buyer_name: input.buyerName,
          duration_days: input.durationDays,
          max_devices: input.maxDevices,
        }),
      });
      const data = await res.json();
      if (data && data.success) {
        return { success: true, token, message: data.message };
      }
      return { success: false, message: data.message || 'Gagal membuat token di Google Sheets' };
    } catch (err: any) {
      console.warn('[vipService] Failed to create token online, falling back to local...', err);
    }
  }

  // Fallback Mock Local
  const tokens = getMockTokens();
  const newRow: VipTokenRow = {
    token,
    buyer_name: input.buyerName || 'Pembeli VIP',
    duration_days: input.durationDays || 0,
    max_devices: input.maxDevices || 2,
    registered_devices: [],
    status: 'active',
    created_at: new Date().toISOString(),
  };
  tokens.unshift(newRow);
  saveMockTokens(tokens);

  return { success: true, token, message: 'Token berhasil dibuat (Tersimpan di sistem lokal)' };
};

/**
 * Admin: List all tokens
 */
export const listVipTokens = async (): Promise<VipTokenRow[]> => {
  const gasUrl = getGasApiUrl();
  const adminSecret = getAdminSecret();

  if (gasUrl) {
    try {
      const url = `${gasUrl}?action=list&secret=${encodeURIComponent(adminSecret)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.success && Array.isArray(data.tokens)) {
        return data.tokens;
      }
    } catch (err) {
      console.warn('[vipService] Failed to fetch online tokens, using local...', err);
    }
  }

  return getMockTokens();
};

/**
 * Admin: Reset Devices for a token
 */
export const resetVipDevices = async (token: string): Promise<{ success: boolean; message?: string }> => {
  const gasUrl = getGasApiUrl();
  const adminSecret = getAdminSecret();

  if (gasUrl) {
    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'reset_devices',
          secret: adminSecret,
          token,
        }),
      });
      const data = await res.json();
      return { success: data.success, message: data.message };
    } catch (err: any) {
      console.warn('[vipService] Online reset failed:', err);
    }
  }

  const tokens = getMockTokens();
  const item = tokens.find((t) => t.token === token);
  if (item) {
    item.registered_devices = [];
    saveMockTokens(tokens);
    return { success: true, message: 'Perangkat berhasil di-reset (0 device terdaftar).' };
  }
  return { success: false, message: 'Token tidak ditemukan.' };
};

/**
 * Admin: Delete/Block Token
 */
export const deleteVipToken = async (token: string): Promise<{ success: boolean; message?: string }> => {
  const gasUrl = getGasApiUrl();
  const adminSecret = getAdminSecret();

  if (gasUrl) {
    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'delete',
          secret: adminSecret,
          token,
        }),
      });
      const data = await res.json();
      return { success: data.success, message: data.message };
    } catch (err: any) {
      console.warn('[vipService] Online delete failed:', err);
    }
  }

  let tokens = getMockTokens();
  tokens = tokens.filter((t) => t.token !== token);
  saveMockTokens(tokens);
  return { success: true, message: 'Token berhasil dihapus.' };
};
