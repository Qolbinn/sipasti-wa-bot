# Rencana Pengujian (Test Plan) - SIPASTI WA Bot

Dokumen ini merangkum *User Acceptance Test (UAT)* untuk menguji secara manual fitur-fitur utama bot.

---

## Fase 1: Master Data & Caching (Hari 1 & 2)

### Skenario 1.1: Memuat Cache Saat Startup
1. **Prasyarat:** Database Supabase memiliki data di tabel `faq_menu` dan `template_pesan`. File JSON lokal di folder `src/config/` boleh ada atau tidak ada.
2. **Langkah:** Jalankan `npm start`.
3. **Ekspektasi Output Terminal:** Bot memunculkan log `"Menarik data FAQ_MENU dari Supabase..."` dan `"Cache FAQ berhasil disimpan ke file lokal"`.
4. **Ekspektasi File:** File `faq_data.json` dan `template_pesan.json` terbuat atau terupdate isinya sesuai database terbaru.

### Skenario 1.2: Hot-Reload Realtime Supabase
1. **Prasyarat:** Bot sedang menyala (`npm start`).
2. **Langkah:** Buka Web App / Supabase Studio. Ubah isi kolom `content` pada salah satu baris `faq_menu`, lalu simpan.
3. **Ekspektasi Output Terminal:** Dalam 1-3 detik, muncul log `"Terdeteksi perubahan [UPDATE] pada tabel faq_menu, memuat ulang cache..."` lalu `"Cache FAQ berhasil diperbarui!"`.
4. **Ekspektasi File:** Buka file `faq_data.json`, isi `content` yang Anda ubah tadi langsung ter-update.

---

## Fase 2: Hybrid Daily Greetings & Cache Performance (Hari 3)

### Skenario 2.1: Sapaan Harian Cepat
1. **Prasyarat:** Bot sedang menyala, nomor WA Anda belum mengirim pesan hari ini (atau Hapus `src/config/daily_stats.json`).
2. **Langkah:** Kirim sembarang pesan (contoh: "Halo") ke nomor Bot.
3. **Ekspektasi WA:** Bot langsung merespons *SANGAT CEPAT* (seharusnya < 1 detik) dengan sapaan harian (Selamat Pagi/Siang) diikuti menu utama.
4. **Ekspektasi Sistem:**
   - Nama nomor WA Anda tercatat di `src/config/daily_stats.json`.
   - Di *background*, cek tabel `riwayat_chat_harian` di Supabase. Harus ada satu baris baru berisi nomor Anda dan tanggal hari ini.

### Skenario 2.2: Bypass Sapaan Harian
1. **Prasyarat:** Skenario 2.1 sudah berhasil dilakukan.
2. **Langkah:** Kirim pesan lagi (contoh: "Test lagi").
3. **Ekspektasi WA:** Bot langsung memunculkan respons perintah (jika tidak dikenali, memunculkan "Maaf pesan tidak dikenali"), *tanpa* mengirim sapaan harian/template sambutan pembuka lagi.

---

## Fase 3: Alur Eskalasi & Trigger Survei (Hari 4)

### Skenario 3.1: Alur Pembuatan Tiket
1. **Langkah:** Kirim "Eskalasi" ke bot.
2. **Ekspektasi WA:** Bot menanyakan nama lengkap Anda.
3. **Langkah:** Balas dengan nama Anda (cth: "Budi").
4. **Ekspektasi WA:** Bot menampilkan daftar kategori layanan beserta nomor urutnya.
5. **Langkah:** Balas dengan nomor kategori (cth: "1").
6. **Ekspektasi WA:** Bot meminta Anda menuliskan detail keperluan.
7. **Langkah:** Balas dengan deskripsi (cth: "Tolong bantu saya mereset password akun.").
8. **Ekspektasi WA:** Bot memunculkan konfirmasi data. Ketik "1" untuk setuju.
9. **Ekspektasi WA:** Bot membalas bahwa tiket berhasil dibuat, menggunakan **template dinamis** `create_ticket` yang menyebutkan nama Anda.
10. **Ekspektasi Sistem:** Cek tabel `eskalasi` di Supabase. Harus ada satu baris baru dengan nama dan keperluan Anda berstatus `OPEN`.

### Skenario 3.2: Trigger Feedback Realtime
1. **Prasyarat:** Anda baru saja membuat tiket di atas.
2. **Langkah:** Buka Supabase Studio, masuk ke tabel `eskalasi`. Ubah status baris tadi menjadi `RESOLVED` (atau ubah via Web App). Kemudian, ubah `feedback_status` menjadi `PENDING` lalu tekan Save/Save changes.
3. **Ekspektasi Output Terminal:** Muncul log `"Trigger feedback terdeteksi"` dan `"✅ Berhasil mengirim notifikasi feedback"`.
4. **Ekspektasi WA:** Anda akan otomatis menerima chat WA baru berisi template `feedback` yang sudah disisipi sapaan waktu dan nama Anda.
5. **Ekspektasi Sistem:** Cek tabel `eskalasi`, `feedback_status` harus otomatis berubah menjadi `SENT`. Cek tabel `bot_notif_log`, harus ada log sukses pengiriman feedback.

---

## Fase 4: Scheduler Pengingat (Hari 5)

### Skenario 4.1: Pengingat Jadwal Piket & Tiket
1. **Prasyarat:** 
   - Di tabel `jadwal_piket` Supabase, masukkan *record* untuk tanggal hari ini yang menunjuk ke ID Anda di tabel `pegawai`.
   - Pastikan nomor `lid_wa` di tabel `pegawai` diisi dengan nomor WhatsApp aktif Anda (cth: 6281234567890@s.whatsapp.net).
2. **Langkah Uji Coba Cepat:** Karena *cron job* terjadwal jam 07:30, 10:00, dan 13:00, untuk pengujian manual, ubah sementara *cron interval* di `src/jobs/reminder.js` menjadi `* * * * *` (setiap menit).
3. **Langkah:** Jalankan bot `npm start`.
4. **Ekspektasi Terminal:** Dalam maksimal 1 menit, muncul log `"Mengeksekusi Cron Job..."` lalu `"✅ Berhasil mengirim pengingat jadwal piket..."`.
5. **Ekspektasi WA:** Nomor Anda akan menerima pesan template `reminder_jadwal` (beserta jumlah *Open Ticket* dan *On Process Ticket*).
6. **Ekspektasi Sistem:** Di tabel `bot_notif_log` muncul *record* baru berstatus `SUCCESS` untuk `tipe_notif: reminder_jadwal`.
7. **Pembersihan:** Kembalikan *cron interval* ke jam aslinya setelah pengujian berhasil.
