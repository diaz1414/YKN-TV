# AGENTS.md — YKN TV Anti-Slop Design & Engineering Codex

> **Mandatory Guidelines for AI Agents & Engineers**
> Dokumen ini adalah konstitusi desain dan kode untuk YKN TV. Seluruh AI agent dan pengembang yang bekerja pada repositori ini WAJIB mematuhi pedoman ini untuk mencegah **AI SLOP** (desain generik murahan, template kloningan, dan animasi kaku yang merusak kredibilitas platform).

---

## 1. The Anti-Slop Manifesto (Larangan Keras)

Situs web modern yang dibuat oleh AI sering kali memiliki "bau AI" yang kentara: serba ungu, serba membulat berlebihan, teks abu-abu pudar tanpa kontras, dan copywriting klise. Di YKN TV, hal-hal berikut **DIHARAMKAN**:

1. ❌ **NO AI-Purple/Indigo Gradient Soup**:
   Jangan pernah menggunakan gradien ungu-biru ala SaaS AI generik. YKN TV adalah **Sports & Live TV Broadcasting Hub**, bukan aplikasi chatbot AI.
2. ❌ **NO Murky Flat Glass**:
   Jangan sekadar menempelkan `bg-white/5 backdrop-blur-md` seragam di semua kartu sehingga UI terlihat seperti kabut kelabu tanpa kedalaman. Kartu harus memiliki *specular highlights* (cahaya tepi atas), bayangan ambient terarah, dan kontras tegas.
3. ❌ **NO Robot Copywriting**:
   Hindari kata-kata basi seperti *"Revolutionize your streaming experience with next-gen cutting-edge technology"*. Gunakan bahasa yang ringkas, percaya diri, khas penggemar sepak bola / olahraga Indonesia: *"Jadwal Siaran Langsung"*, *"Tonton Langsung"*, *"Server Stabil"*, *"Buka dlm 15m"*.
4. ❌ **NO Static Lifeless Cards**:
   Setiap kartu pertandingan dan saluran harus memiliki mikro-interaksi taktil: reaksi hover dengan pegas halus, indikator live yang berdenyut riil (*radar beacon*), dan status waktu yang informatif.
5. ❌ **NO Breaking Core Logic**:
   Dilarang merombak atau menghapus fungsi penting saat memperbaiki UI: navigasi Smart TV (`tv-focusable`), redirect iklan (`yknAdRedirect`), pelacak viewer Supabase Presence, fallback monitoring WebSocket, dan router parameter tab.

---

## 2. Visual Architecture & Brand DNA

YKN TV mengusung konsep **"Stadium Nocturne"** — atmosfer stadion megah di malam hari dengan pencahayaan lampu sorot berpresisi tinggi.

### 🎨 Color Palette & Semantics
| Peruntukan | Token / Hex | Makna & Penggunaan |
|---|---|---|
| **Void Base** | `#020202` & `#070707` | Latar belakang hitam pekat dan arang bertekstur, menjaga fokus penuh pada konten live. |
| **Trophy Gold** | `#D4AF37` / `#F59E0B` | Warna aksen utama: juara, prestisius, tombol aksi utama, sorotan jadwal aktif. |
| **Stadium Live Red** | `#EF4444` / `#DC2626` | Siaran langsung aktif (LIVE), skor terkini, radar pulsator pertandingan. |
| **Pitch Emerald** | `#10B981` / `#059669` | Saluran TV 24 jam on-air, status server normal, indikator online. |
| **Tension Amber** | `#F59E0B` / `#D97706` | Pertandingan segera dimulai (<60 menit), status peringatan. |
| **Muted Slate** | `text-zinc-400` / `text-zinc-500` | Metadata sekunder, nama liga, jam pertandingan, label non-kritis. |

### 🔤 Typographic Hierarchy
- **Display Font (`Outfit`)**:
  - Digunakan untuk: Judul halaman, nama pertandingan, skor besar stadion, badge liga huruf kapital, dan angka countdown.
  - Karakter: Bold, Extra-Bold, Black (800/900), sering dipadukan dengan style `italic` dan `tracking-tighter` untuk memberi kesan kecepatan & aksi olahraga.
- **Body & Data Font (`Inter`)**:
  - Digunakan untuk: Navigasi, deskripsi, waktu kickoff, teks tombol, dan status detail.
  - Karakter: Clean, legible, dengan `font-bold` atau `font-black` pada label kecil (`text-[10px] uppercase tracking-widest`).
  - Gunakan `tabular-nums` pada skor dan waktu agar angka tidak meloncat-loncat saat berdetik.

### 🪞 Tactile Glass & Specular Depth
Untuk membuat kartu terasa "mahal" dan tidak template:
- **Hairline Borders**: `border border-white/[0.08]` (jangan `border-white/20` yang terlalu kasar atau `border-white/5` yang hilang).
- **Specular Top Bevel**: Kartu utama memiliki aksen tepi atas tipis (misal `border-t-white/15` atau gradien pembatas `from-primary/40 via-transparent to-transparent`).
- **Inner Rim Depth**: Berikan `shadow-inner` halus pada wadah logo tim sepak bola/saluran agar logo terlihat duduk di dalam pod khusus.

---

## 3. Motion & Animation Standards (Framer Motion)

Animasi di YKN TV harus terasa **fisik, organik, dan responsif**, bukan sekadar fade-in lambat.

```tsx
// Standar Spring Physics untuk Interaksi Hover & Tap
const springHover = {
  whileHover: { y: -4, scale: 1.015, transition: { type: "spring", stiffness: 400, damping: 25 } },
  whileTap: { scale: 0.98 }
};

// Standar Sliding Indicator untuk Tabs (Framer Motion layoutId)
<motion.div
  layoutId="activePill"
  className="absolute inset-0 bg-primary rounded-xl shadow-[0_0_16px_rgba(212,175,55,0.3)]"
  transition={{ type: "spring", stiffness: 500, damping: 35 }}
/>
```

- **Live Indicators**: Gunakan animasi cincin radar ganda (`relative flex h-2.5 w-2.5` dengan satu span ber-ping dan satu span ber-glow) agar status siaran langsung langsung menarik perhatian mata.
- **Hardware Acceleration**: Selalu gunakan `transform-gpu` pada elemen kartu yang memiliki animasi hover/scale agar FPS tetap solid 60fps di Smart TV & Android terjangkau.

---

## 4. Component Rules

### MatchCard (`src/components/MatchCard.tsx`)
- **League Header**: Tampilkan nama kompetisi/liga dengan format rapi dan badge status siaran di kanan.
- **Team Pods**: Logo tim berada di wadah berukuran konsisten dengan background gelap `bg-white/[0.04]` dan border mikro. Logo harus memiliki fallback rapi.
- **Scoreboard Center**: Jika LIVE atau Selesai, tampilkan skor besar berbobot tebal; jika belum mulai, tampilkan jam kickoff dan countdown dinamis.
- **Live Glow**: Kartu dengan status `live` harus mendapatkan ambient aura keemasan/merah yang elegan di pojok atas atau border aksen.
- **Accessibility & TV**: Pertahankan properti `tabIndex={0}` dan kelas `tv-focusable` untuk navigasi remote D-Pad.

### MatchSchedule (`src/components/MatchSchedule.tsx`)
- Multi-sport tab switcher wajib memakai `framer-motion` sliding background agar perpindahan antar cabang olahraga (Sepak Bola, Basket, Esport, dll.) terasa licin dan memuaskan.
- Tampilkan badge jumlah pertandingan LIVE di tiap cabang olahraga jika ada (`liveCount > 0`).

### ChannelCard (`src/components/ChannelCard.tsx`)
- Desain bergaya siaran TV: logo stasiun TV bersih, sinyal live hijau zamrud, nama saluran tebal, dan tombol aksi "Mulai Menonton" yang merespons kursor/remote dengan cepat.

---

## 5. Performance & Cross-Device Compatibility

1. **Smart TV Navigation (D-Pad)**:
   Setiap elemen interaktif wajib menyertakan kelas `tv-focusable` dan `tabIndex={0}`. Jangan pernah menghapus event keyboard atau merusak focus ring.
2. **Mobile Ergonomics**:
   Navigasi bawah (*Mobile Bottom Dock*) harus mudah dijangkau satu tangan (ibu jari), memiliki backdrop blur solid agar tidak bertabrakan dengan teks konten yang di-scroll, dan memiliki touch target minimal 44x44px.
3. **No Heavy Over-Blurring**:
   Hindari menumpuk `backdrop-blur-3xl` di dalam elemen yang di-nesting berulang-ulang karena dapat menyebabkan frame drop pada browser TV / smartphone entry-level.

---

*Setiap perubahan antarmuka di YKN TV harus menghormati dokumen ini. Jika ragu antara desain "ramai/berlebihan" vs "presisi/tajam", selalu pilih **presisi siaran olahraga premium**.*
