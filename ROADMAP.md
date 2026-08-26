# Rencana Implementasi & Roadmap: SIPASTI WA Bot & Scheduler

Dokumen ini merangkum rencana implementasi layanan SIPASTI WA Bot menggunakan arsitektur **Hybrid (JSON Cache + Supabase Realtime)** untuk performa maksimal dan efisiensi *resource* basis data, beserta *roadmap* pengembangan selama 7 hari.

## Deskripsi Tujuan
Membangun *backend* WA Bot yang responsif tanpa membebani *database*. Bot akan beroperasi menggunakan *Cache* lokal (memori & JSON) untuk fitur sering-baca (seperti FAQ & sapaan harian) dan menggunakan fitur **Supabase Realtime** untuk sinkronisasi data seketika tanpa perlu *polling* berkala.

---

## 1. Arsitektur Komunikasi (Supabase Realtime vs Cache)

### A. Pola *Read* Cepat (Master Data & Sapaan)
- **FAQ & Template Pesan:** Saat bot menyala, ia mengambil data utuh dari Supabase dan menyimpannya di RAM serta file `config/*.json`. Ketika melayani pelanggan, bot membaca dari *cache* lokal ini secara instan (O(1)).
- **Daily Greetings:** Bot menggunakan `daily_stats.json` untuk mengecek apakah nomor sudah disapa hari ini. Jika belum, bot menyapa, menyimpan nomor di JSON lokal, dan menjalankan **Background Insert (Fire and Forget)** ke tabel `riwayat_chat_harian` di Supabase untuk keperluan analitik *dashboard*.

### B. Pola *Realtime Sync & Action*
Bot "berlangganan" (*subscribe*) pada tabel Supabase tertentu. Begitu admin Web App melakukan perubahan (menekan tombol di *dashboard*), bot langsung merespons:
1. **Sync Master Data:** Ketika admin mengubah `faq_menu` atau `template_pesan`, Supabase memancarkan *event* `UPDATE`. Bot menangkapnya, dan secara otomatis menarik data baru lalu menimpa file JSON lokal (sinkronisasi transparan).
2. **Kirim Survei/Feedback:** Ketika admin Web App menyelesaikan eskalasi (mengubah baris tabel `eskalasi`), bot mendengarkan *event* tersebut menggunakan filter spesifik. Bot langsung mengekstrak `pelanggan_lid`, mengirim pesan survei, dan meng-*update* kembali baris tabel ke status selesai (`SENT`).

---

## 2. Perubahan pada Struktur File & Kode

### Database Services (`services/database.js`)
Fokus pada fungsi-fungsi untuk menginisialisasi langganan (Subscriptions) Supabase:
- `initRealtimeListeners()`: Berisi *listener* untuk tabel `faq_menu`, `template_pesan`, dan `eskalasi`.
- `recordDailyChat(lid_wa)`: Fungsi asinkron untuk menambahkan data *traffic* harian.
- `updateEskalasiSurveyStatus(id)`: Mengubah status survei setelah pesan terkirim.

### Refactoring Logika (Services)
- **`faqService.js`**: Menambahkan fungsi `syncCache()` yang dipanggil saat *event Realtime* terdeteksi.
- **`greetingService.js`**: Menulis ke `daily_stats.json` dan memanggil `recordDailyChat` ke Supabase tanpa memblokir (await) pengiriman pesan.

---

## 3. Roadmap Development WA Bot (7 Hari)

### Hari 1: Fondasi, Supabase, & Cache Awal
- [ ] Menyiapkan `.env` dan *client* Supabase.
- [ ] Membangun kerangka sinkronisasi: saat inisialisasi awal, bot otomatis membuat dan mengisi file `faq_data.json` & `template_pesan.json` jika belum ada atau kadaluwarsa, bersumber dari DB.

### Hari 2: Implementasi Supabase Realtime
- [ ] Menerapkan *Realtime Subscriptions* pada tabel `faq_menu` dan `template_pesan`.
- [ ] Menguji dari Web App / Supabase Studio: mengubah suatu entri FAQ, dan memastikan file JSON di *server* Bot otomatis ter-update seketika (Hot-Reload).

### Hari 3: Hybrid Daily Greetings & Analitik
- [ ] Modifikasi `greetingService.js` menggunakan pola *Fire and Forget* ke tabel `riwayat_chat_harian`.
- [ ] Validasi performa waktu balas bot yang harus di bawah 1 detik (karena menggunakan JSON *cache*).

### Hari 4: Alur Eskalasi & Trigger Survei (Realtime)
- [ ] Modifikasi `escalationService.js` untuk membuat baris tiket eskalasi di tabel Supabase saat pelanggan butuh petugas.
- [ ] Menerapkan *Realtime Subscription* pada tabel `eskalasi` (dengan filter khusus) yang memicu bot untuk mengirimkan link/teks survei saat petugas memintanya.

### Hari 5: Implementasi Scheduler Pengingat Jadwal
- [ ] Membuat *job* Node-cron `src/jobs/reminder.js` untuk berjalan tiap jam 07:00 pagi.
- [ ] Bot melakukan query pada tabel `jadwal_piket` yang di-join dengan tabel `pegawai` (nomor WA) dan mengirim pesan pengingat.

### Hari 6: Bot Status Ping & Error Handling
- [ ] Membuat *cron job* internal (tiap menit) untuk meng-*update* tabel `bot_status` (last_ping_at).
- [ ] Mengintegrasikan pino logger untuk mencatat notifikasi di tabel `bot_notif_log`.

### Hari 7: Uji Coba End-to-End (E2E) & Finishing
- [ ] Menguji siklus utuh: Chat Pengguna -> Cache FAQ -> Request Eskalasi -> Notifikasi Petugas -> Selesai -> Survey Otomatis.
- [ ] Kesiapan untuk dijalankan secara permanen menggunakan PM2 di *server/dedicated PC*.
