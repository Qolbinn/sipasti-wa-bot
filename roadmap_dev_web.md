# Roadmap Pengembangan SIPASTI Web App (Timeline 2 Minggu)

Dengan waktu **2 minggu (14 hari)**, kita memiliki ruang napas yang lebih lega untuk membangun fitur dengan lebih rapi, menguji integrasi WA Bot secara mendalam, serta memoles antarmuka pengguna (UI/UX) agar lebih profesional. 

Berikut adalah usulan **Prioritas Pengembangan (Terbagi menjadi 2 Sprint)**:

---

## 🏃‍♂️ SPRINT 1 (Minggu 1): Core System & Master Data
Fokus pada minggu pertama adalah menuntaskan seluruh struktur fondasi, *Auth*, dan *Master Data* yang akan digunakan oleh sistem operasional harian (Bot dan Eskalasi).

**Hari 1-2: Setup Ulang & Integrasi Auth**
- [ ] *Update* konfigurasi koneksi Next.js ke Supabase menggunakan schema baru.
- [ ] *Fix* halaman Login (Pastikan integrasi ke tabel `auth.users` dan tabel `pegawai` berjalan lancar).
- [ ] Implementasi *Role-based Access Control (RBAC)* dasar: Pisahkan rute/sidebar untuk `admin`, `pimpinan`, dan `petugas`.

**Hari 3-4: Modul Manajemen Pegawai & Layanan**
- [ ] **Modul Pegawai:** Halaman untuk melihat *list* pegawai (Admin bisa CRUD, menambahkan/memperbarui `lid_wa` dan nomor HP).
- [ ] **Modul Kategori Layanan:** CRUD untuk tabel `kategori_layanan`.
- [ ] **Modul Template Pesan:** Halaman editor teks (*textarea*) untuk menyimpan *greeting*, *reminder*, dan *feedback*. (Tambahkan fitur bantuan tombol sisip variabel opsional).

**Hari 5: Modul FAQ Menu Bersarang (Nested)**
- [ ] CRUD untuk tabel `faq_menu` beserta implementasi hirarkinya (*parent_id*).
- [ ] **UI/UX:** Buat tampilan tabel / daftar menu FAQ yang nyaman dilihat meskipun bersarang (misalnya menggunakan *collapsible rows* atau UI *tree-view*).

**Hari 6-7: Modul Jadwal Piket & Monitoring (Otak Bot)**
- [ ] **Assign Jadwal:** UI untuk *Assign* jadwal piket mingguan/harian secara otomatis ke tabel `jadwal_piket` tanpa ribet.
- [ ] **Checklist Kehadiran:** Komponen UI di Dashboard Petugas berisikan tombol **"Hadir Hari Ini"** jika petugas tersebut ada jadwal.
- [ ] **Status Bot:** Implementasi UI pengecekan `last_ping_at` dari tabel `bot_status` di bagian header (munculkan *badge* 🟢 Online atau 🔴 Offline).

---

## 🏃‍♂️ SPRINT 2 (Minggu 2): Operasional Utama, Analitik, & Polish
Fokus minggu kedua adalah membangun halaman tempat para petugas akan menghabiskan waktu bekerjanya, serta visualisasi data untuk Pimpinan.

**Hari 8-9: Modul Inti Eskalasi Pelanggan**
- [ ] **Tabel Eskalasi Realtime:** Buat halaman Daftar Eskalasi, aktifkan *listener* **Supabase Realtime** sehingga saat bot menambahkan data, baris baru langsung muncul tanpa *refresh*.
- [ ] **Panel Detail:** Modal atau Halaman Detail yang menampilkan informasi rinci dari `pelanggan_lid`, `keperluan`, dll.
- [ ] **Alur Status:** UI *Dropdown* atau Tombol untuk menggeser status dari `OPEN` -> `ON_PROCESS` -> `RESOLVED`.
- [ ] **Trigger Survei:** Tombol *"Kirim Link Survei"* yang mengubah *flag* `feedback_notified` di baris eskalasi (memerintah bot untuk merespons).

**Hari 10-11: Dashboard Analitik Pimpinan & Admin**
- [ ] **Card Statistic:** Ringkasan Total Eskalasi Hari Ini, Eskalasi Tertunda (OPEN), dan Selesai (RESOLVED).
- [ ] **Chart / Grafik Harian:** Visualisasi sederhana dari tabel `riwayat_chat_harian` untuk menunjukkan kepadatan/jam sibuk pelanggan berinteraksi dengan chatbot setiap harinya.
- [ ] **Log Notifikasi (`bot_notif_log`):** Halaman tabel bagi Admin untuk memantau riwayat pengiriman pesan otomatis ke WhatsApp. Notifikasi yang dicatat mencakup:
  1. **Reminder Piket:** Pengingat jadwal piket harian kepada petugas apakah sukses terkirim pada hari H.
  2. **Feedback Survei:** Pesan survei kepuasan ke pelanggan setelah tiket eskalasi diselesaikan (di-*flag* PENDING untuk dikirim).
  3. **Reminder SLA (Eskalasi Tertunda):** Peringatan berkala (misal tiap jam 13.00 di hari kerja) ke petugas jika masih ada tiket berstatus OPEN atau ON_PROCESS agar SLA tetap terjaga.

**Hari 12-13: Testing & Integrasi Servis WA Bot**
- [ ] **End-to-End Testing:** Coba *flow* penuh dengan menghubungkan Service Node.js (Baileys) ke Supabase dan lakukan *chat* langsung via WhatsApp simulasi.
- [ ] Cek apakah bot berhasil membaca `faq_menu`, menulis ke `eskalasi`, dan melihat siapa yang bertugas di `jadwal_piket`.

**Hari 14: Final Polish & Deployment**
- [ ] *Bug fixing* (pemeriksaan responsivitas UI untuk tampilan HP / *Mobile View*).
- [ ] *Error handling* dan *Toasts/Snackbar* yang rapi.
- [ ] Persiapan *deploy* Web App (misalnya ke Vercel/VPS) dan *deploy* layanan bot WA-nya.

---

> [!TIP]
> **Strategi Pengerjaan Santai:**
> Karena sebelumnya proyek ini menggunakan skema lama, daur ulang (*recycle*) saja sebanyak mungkin kode UI yang Anda punya. Modifikasi pada *state management* atau *Supabase Queries* (merujuk pada tabel/relasi baru) jauh lebih hemat waktu dibanding membuat halaman CSS dari nol.
