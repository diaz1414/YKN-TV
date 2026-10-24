/**
 * Google Apps Script (Code.gs)
 * Backend API untuk Sistem VIP Token YKN TV bertenaga Google Sheets
 * 
 * PANDUAN DEPLOYMENT:
 * 1. Buat Google Sheet baru di Google Drive Anda.
 * 2. Beri nama sheet pertama: "Tokens"
 * 3. Di baris 1 (Header), buat kolom:
 *    A1: token | B1: buyer_name | C1: duration_days | D1: max_devices | E1: registered_devices | F1: activated_at | G1: expired_at | H1: status | I1: created_at
 * 4. Buka menu: Extensions -> Apps Script.
 * 5. Hapus kode default, lalu paste SELURUH KODE di file ini.
 * 6. Ubah konstanta ADMIN_SECRET di bawah sesuai keinginan Anda.
 * 7. Klik tombol "Deploy" (kanan atas) -> "New deployment".
 * 8. Pilih type: "Web app".
 *    - Description: "YKN TV VIP API"
 *    - Execute as: "Me"
 *    - Who has access: "Anyone" (PENTING: Pilih 'Anyone' agar frontend web bisa membaca token)
 * 9. Klik "Deploy", lalu salin "Web App URL" yang diberikan (contoh: https://script.google.com/macros/s/AKfycb.../exec).
 * 10. Paste Web App URL tersebut ke Admin Panel YKN TV Anda. Selesai!
 */

const ADMIN_SECRET = "ykn_secret_admin_2026"; // Ganti dengan sandi admin rahasia Anda
const SHEET_NAME = "Tokens";

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      "token",
      "buyer_name",
      "duration_days",
      "max_devices",
      "registered_devices",
      "activated_at",
      "expired_at",
      "status",
      "created_at"
    ]);
  }
  return sheet;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── GET: Verifikasi Token & List Token untuk Admin ──────────────────────────
function doGet(e) {
  const params = e.parameter || {};
  const action = params.action;
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();

  // 1. Verifikasi Token dari Client (/aktivasi)
  if (action === "verify") {
    const rawToken = (params.token || "").trim().toUpperCase();
    const deviceId = (params.device_id || "").trim();

    if (!rawToken || !deviceId) {
      return jsonResponse({ success: false, message: "Token dan Device ID wajib diisi." });
    }

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const token = String(row[0]).trim().toUpperCase();

      if (token === rawToken) {
        const buyerName = row[1];
        const durationDays = Number(row[2]) || 0;
        const maxDevices = Number(row[3]) || 2;
        let registered = [];
        try {
          registered = JSON.parse(row[4] || "[]");
        } catch (err) {
          registered = [];
        }

        let activatedAt = row[5];
        let expiredAt = row[6];
        const status = row[7] || "active";

        if (status === "blocked") {
          return jsonResponse({ success: false, message: "Token VIP ini telah dinonaktifkan oleh admin." });
        }

        // Cek apakah perangkat sudah pernah terdaftar
        const isExistingDevice = registered.indexOf(deviceId) !== -1;

        // Jika perangkat baru tapi kuota penuh
        if (!isExistingDevice && registered.length >= maxDevices) {
          return jsonResponse({
            success: false,
            message: "Batas kuota perangkat untuk token ini sudah penuh (" + registered.length + "/" + maxDevices + " HP). Hubungi admin jika ingin reset perangkat.",
            max_devices: maxDevices,
            used_devices: registered.length
          });
        }

        // Jika pertama kali aktivasi
        const now = new Date();
        if (!activatedAt) {
          activatedAt = now.toISOString();
          sheet.getRange(i + 1, 6).setValue(activatedAt);

          if (durationDays > 0) {
            const expTime = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
            expiredAt = expTime.toISOString();
          } else {
            expiredAt = "permanent";
          }
          sheet.getRange(i + 1, 7).setValue(expiredAt);
        }

        // Cek kedaluwarsa jika bukan permanen
        if (expiredAt && expiredAt !== "permanent") {
          const expDate = new Date(expiredAt);
          if (now.getTime() > expDate.getTime()) {
            sheet.getRange(i + 1, 8).setValue("expired");
            return jsonResponse({
              success: false,
              message: "Masa trial VIP Anda telah kedaluwarsa pada " + expDate.toLocaleString("id-ID") + ". Hubungi admin untuk memperpanjang!"
            });
          }
        }

        // Daftarkan device baru jika belum ada
        if (!isExistingDevice) {
          registered.push(deviceId);
          sheet.getRange(i + 1, 5).setValue(JSON.stringify(registered));
        }

        return jsonResponse({
          success: true,
          message: isExistingDevice ? "Perangkat dikenali kembali. VIP No-Ads aktif!" : "Selamat! VIP No-Ads Berhasil Diaktifkan.",
          buyer_name: buyerName,
          expired_at: expiredAt,
          max_devices: maxDevices,
          used_devices: registered.length
        });
      }
    }

    return jsonResponse({ success: false, message: "Token VIP tidak ditemukan. Pastikan token yang Anda masukkan benar." });
  }

  // 2. Ambil List Semua Token (Khusus Admin)
  if (action === "list") {
    const secret = params.secret;
    if (secret !== ADMIN_SECRET) {
      return jsonResponse({ success: false, message: "Akses ditolak: Sandi admin salah." });
    }

    const tokens = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      let registered = [];
      try { registered = JSON.parse(row[4] || "[]"); } catch (e) { registered = []; }

      tokens.push({
        token: String(row[0]),
        buyer_name: String(row[1] || ""),
        duration_days: Number(row[2]) || 0,
        max_devices: Number(row[3]) || 2,
        registered_devices: registered,
        activated_at: row[5] || null,
        expired_at: row[6] || "permanent",
        status: row[7] || "active",
        created_at: row[8] || ""
      });
    }

    return jsonResponse({ success: true, tokens: tokens });
  }

  return jsonResponse({ success: false, message: "Aksi tidak dikenal." });
}

// ── POST: Buat Token, Reset Perangkat, Hapus Token (Khusus Admin) ────────────
function doPost(e) {
  let body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ success: false, message: "Format payload JSON salah." });
  }

  if (body.secret !== ADMIN_SECRET) {
    return jsonResponse({ success: false, message: "Akses ditolak: Sandi admin salah." });
  }

  const action = body.action;
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();

  // 1. Buat Token Baru
  if (action === "create") {
    const token = (body.token || "").trim().toUpperCase();
    const buyerName = (body.buyer_name || "Pembeli VIP").trim();
    const durationDays = Number(body.duration_days) || 0;
    const maxDevices = Number(body.max_devices) || 2;
    const nowIso = new Date().toISOString();

    sheet.appendRow([
      token,
      buyerName,
      durationDays,
      maxDevices,
      "[]",
      "",
      durationDays === 0 ? "permanent" : "",
      "active",
      nowIso
    ]);

    return jsonResponse({ success: true, message: "Token VIP berhasil dibuat di Google Sheets!", token: token });
  }

  // 2. Reset Perangkat (Kuota kembali kosong 0/X)
  if (action === "reset_devices") {
    const targetToken = (body.token || "").trim().toUpperCase();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toUpperCase() === targetToken) {
        sheet.getRange(i + 1, 5).setValue("[]");
        return jsonResponse({ success: true, message: "Perangkat terdaftar berhasil di-reset (0 perangkat)." });
      }
    }
    return jsonResponse({ success: false, message: "Token tidak ditemukan." });
  }

  // 3. Hapus Token
  if (action === "delete") {
    const targetToken = (body.token || "").trim().toUpperCase();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toUpperCase() === targetToken) {
        sheet.deleteRow(i + 1);
        return jsonResponse({ success: true, message: "Token berhasil dihapus permanen." });
      }
    }
    return jsonResponse({ success: false, message: "Token tidak ditemukan." });
  }

  return jsonResponse({ success: false, message: "Aksi POST tidak valid." });
}
