# Test Plan: SIPASTI WA Bot

Dokumen ini memuat skenario pengujian (berbasis perilaku pengguna) yang dapat Anda gunakan sebagai panduan untuk memverifikasi fungsionalitas sistem pada tiap akhir fase *sprint*.

---

## 🧪 Fase 1: Cache Master Data & Supabase Realtime (Hari 1 & 2)

**Tujuan Uji:** Memastikan bahwa data FAQ dan Template Pesan berhasil ditarik dari *database* secara kilat, dan perubahannya (melalui Web App) langsung masuk ke memori Bot tanpa harus mematikan dan menyalakan server.

### Skenario 1.1: Sinkronisasi Awal (Startup Sync)
1. **Langkah:** Matikan proses bot di terminal (`Ctrl+C`), lalu jalankan `npm start`.
2. **Ekspektasi Output Terminal:**
   - Muncul log *"Mulai sinkronisasi cache awal dari Supabase..."*
   - Muncul log *"✅ Cache FAQ berhasil disinkronisasi ke file lokal"*
   - Muncul log *"✅ Cache Template Pesan berhasil disinkronisasi ke file lokal"*
3. **Ekspektasi Sistem:** Anda dapat melihat file `src/config/faq_data.json` dan `src/config/template_pesan.json` terbuat dan terisi sesuai data asli Supabase Anda.

### Skenario 1.2: Pembaruan Data Secara Realtime (Hot-Reload)
1. **Langkah:** Pastikan bot sedang menyala (jangan dimatikan).
2. **Langkah:** Buka *dashboard* Supabase Studio. Buka tabel `faq_menu` dan ubah nilai pada kolom `content` salah satu FAQ (misalnya menambahkan kata "TEST"). Tekan Save/Save changes.
3. **Ekspektasi Output Terminal:** Tanpa menyentuh apa-apa, terminal akan memunculkan tulisan *"Terdeteksi perubahan [UPDATE] pada tabel faq_menu, memuat ulang cache..."* dan file JSON akan otomatis tertimpa data baru.
4. **Langkah:** Coba _chat_ bot di WhatsApp dengan nomor urut menu tersebut.
5. **Ekspektasi WA:** Balasan bot di WhatsApp harusnya sudah mengandung kata "TEST" yang baru saja Anda buat.

---

## 🧪 Fase 2: Hybrid Daily Greetings & Analitik (Hari 3)

**Tujuan Uji:** Memastikan sistem hanya mengirim pesan sambutan (greeting) **satu kali** sehari per pelanggan, dan data pencatatannya di Supabase (`riwayat_chat_harian`) tidak menyebabkan bot merespons lebih lambat.

### Skenario 2.1: Interaksi Pertama (New Daily Chat)
1. **Prasyarat:** Buka `src/config/daily_stats.json` dan hapus nomor WA Anda jika sudah terdaftar, atau ganti tanggal di file tersebut ke hari kemarin. (Atau gunakan nomor WA lain yang belum nge-*chat* hari ini).
2. **Langkah:** Kirimkan sembarang pesan teks ke nomor Bot (contoh: "Halo").
3. **Ekspektasi WA:** Bot akan membalas dengan pesan yang diawali *Greeting* (contoh: "Selamat sore Kak..."). Waktu pengetikan bot seharusnya *natural* (ada *delay* 3-5 detik).
4. **Ekspektasi Database:** Buka tabel `riwayat_chat_harian` di Supabase. Harus ada satu baris data baru dengan `lid_wa` nomor Anda dan `tanggal` hari ini.

### Skenario 2.2: Interaksi Kedua di Hari yang Sama
1. **Prasyarat:** Anda baru saja melakukan Skenario 2.1.
2. **Langkah:** Kirim kembali sembarang pesan (contoh: "Saya butuh menu data ketenagakerjaan").
3. **Ekspektasi WA:** Bot membalas dengan langsung memberikan menu/jawaban tanpa mengulang kata-kata "Selamat sore/pagi..." (Tidak ada sapaan pembuka lagi).
4. **Ekspektasi Database:** Data di tabel `riwayat_chat_harian` untuk nomor Anda hari ini tetap berjumlah 1 (tidak ada duplikasi baris baru untuk nomor dan tanggal yang sama jika Anda menggunakan operasi Insert murni, atau tidak ada tambahan *record* jika Anda me-*refresh*).

---

## 🧪 Fase 3: Alur Eskalasi & Trigger Survei (Hari 4)

**Tujuan Uji:** Memastikan alur interaktif WA (State Machine) untuk eskalasi berjalan lancar, dan *trigger realtime* dari tabel `eskalasi` Supabase bisa memicu bot untuk mengirim notifikasi survei.

### Skenario 3.1: Pembuatan Tiket Eskalasi via WA
1. **Prasyarat:** Pastikan bot menyala dan sudah terhubung ke database. Cek apakah ada data di tabel `kategori_layanan` Supabase.
2. **Langkah:** Kirim "99" (kode eskalasi) ke bot.
3. **Ekspektasi WA:** Bot meminta Anda mengisikan "nama lengkap".
4. **Langkah:** Balas dengan nama Anda (cth: "Andi").
5. **Ekspektasi WA:** Bot menampilkan daftar kategori layanan beserta nomor urutnya.
6. **Langkah:** Balas dengan nomor kategori (cth: "1").
7. **Ekspektasi WA:** Bot meminta Anda menuliskan detail keperluan.
8. **Langkah:** Balas dengan deskripsi (cth: "Tolong bantu saya mereset password akun.").
9. **Ekspektasi WA:** Bot memunculkan konfirmasi data. Ketik "1" untuk setuju.
10. **Ekspektasi WA:** Bot membalas bahwa tiket berhasil dibuat, menggunakan **template dinamis** `create_ticket` yang menyebutkan nama Anda.
11. **Ekspektasi Sistem:** Cek tabel `eskalasi` di Supabase. Harus ada satu baris baru dengan nama dan keperluan Anda berstatus `OPEN`.

### Skenario 3.2: Trigger Feedback Realtime
1. **Prasyarat:** Anda baru saja membuat tiket di atas.
2. **Langkah:** Buka Supabase Studio, masuk ke tabel `eskalasi`. Ubah status baris tadi menjadi `RESOLVED` (atau ubah via Web App). Kemudian, ubah `feedback_status` menjadi `PENDING` lalu tekan Save/Save changes.
3. **Ekspektasi Output Terminal:** Muncul log `"Trigger feedback terdeteksi"` dan `"✅ Berhasil mengirim notifikasi feedback"`.
4. **Ekspektasi WA:** Anda akan otomatis menerima chat WA baru berisi template `feedback` yang sudah disisipi sapaan waktu dan nama Anda.
5. **Ekspektasi Sistem:** Cek tabel `eskalasi`, `feedback_status` harus otomatis berubah menjadi `SENT`. Cek tabel `bot_notif_log`, harus ada log sukses pengiriman feedback.

---

*(Test Plan ini akan terus diperbarui secara otomatis setiap kali kita menyelesaikan pengembangan fitur baru)*
