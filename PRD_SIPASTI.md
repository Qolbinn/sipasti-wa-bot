# Product Requirements Document
## SIPASTI (Sistem Pelayanan Statistik Terintegrasi)

**Dokumen Rancangan Sistem**  
BPS Kabupaten Tangerang  
Disusun oleh: Arzuda Qolbin Mulya  
Agustus 2026  

---

## 1. Pendahuluan

### 1.1 Latar Belakang
Pelayanan Statistik Terpadu (PST) Online melalui WhatsApp di BPS Kabupaten Tangerang saat ini menghadapi kendala responsivitas akibat mekanisme pengelolaan yang masih manual. Penjadwalan petugas menggunakan format *spreadsheet* tanpa adanya pengingat otomatis menyebabkan petugas sering melewatkan jadwal jaga. Selain itu, ketiadaan sistem pencatatan riwayat interaksi membuat pimpinan kesulitan mengevaluasi kualitas layanan publik. Untuk mengatasi masalah tersebut, diperlukan transformasi tata kelola layanan melalui pengembangan SIPASTI (Sistem Pelayanan Statistik Terintegrasi).

### 1.2 Tujuan Dokumen
Dokumen Product Requirements Document (PRD) ini bertujuan untuk mendefinisikan ruang lingkup, arsitektur dasar, dan spesifikasi fitur dari sistem SIPASTI. Dokumen ini berfungsi sebagai panduan teknis selama fase *development*, uji coba, hingga peluncuran aplikasi pada masa aktualisasi Latsar CPNS.

---

## 2. Ruang Lingkup Sistem
SIPASTI mengintegrasikan layanan pesan instan dengan sistem manajemen di *back-end*. Ruang lingkup sistem terbagi menjadi tiga modul utama:
- **Modul Front-End Pelanggan (WhatsApp Bot):** Sistem antarmuka otomatis yang berinteraksi langsung dengan pengguna data (publik).
- **Modul Back-End Internal (Web App):** Dasbor administratif untuk mengelola operasional PST, seperti jadwal, FAQ, dan rekapitulasi data layanan.
- **Modul Otomasi (Scheduler):** *Cron job* atau penugasan terjadwal yang berjalan di latar belakang untuk mengirimkan notifikasi.

---

## 3. Aktor & Pengguna Sistem (User Personas)

| Peran | Deskripsi & Hak Akses |
| :--- | :--- |
| **Masyarakat (User Publik)** | Berinteraksi dengan sistem hanya melalui aplikasi WhatsApp. Membutuhkan informasi data BPS, panduan, atau layanan konsultasi lanjutan. |
| **Petugas PST (Operator)** | Menerima notifikasi pengingat jadwal via WhatsApp. Mengoperasikan Web App untuk melihat rekapitulasi, serta merespons *chat* pengguna saat eskalasi manual. |
| **Admin / Pimpinan** | Memiliki hak akses penuh pada Web App. Dapat mengatur jadwal piket seluruh pegawai, memodifikasi konten FAQ, dan melihat dasbor analisis layanan secara keseluruhan. |

---

## 4. Kebutuhan Fungsional (Functional Requirements)

### 4.1 Modul WhatsApp Bot

| Kode FR | Fitur | Deskripsi |
| :--- | :--- | :--- |
| FR-BOT-01 | **Auto-Greeting & Menu** | Bot otomatis membalas pesan masuk pertama dari nomor baru dengan salam pembuka dan menampilkan menu interaktif (FAQ). |
| FR-BOT-02 | **FAQ Handler** | Bot merespons pilihan angka/teks dari pengguna dengan informasi yang relevan sesuai *database* FAQ. |
| FR-BOT-03 | **Eskalasi Layanan** | Jika pengguna memilih "Layanan Konsultasi", Bot akan mencatat data pengguna ke *database* dan memberikan informasi bahwa petugas akan segera bergabung ke ruang obrolan. |

### 4.2 Modul Web App (Admin Dashboard)

| Kode FR | Fitur | Deskripsi |
| :--- | :--- | :--- |
| FR-WEB-01 | **Manajemen Jadwal** | Admin dapat menambah, mengedit, dan menghapus jadwal piket petugas harian. Data tersimpan dalam format kalender di *database*. |
| FR-WEB-02 | **Manajemen FAQ** | Admin dapat memperbarui daftar pertanyaan dan jawaban FAQ tanpa harus mengubah baris kode program. |
| FR-WEB-03 | **Dasbor Rekapitulasi** | Menampilkan visualisasi statistik layanan, seperti total *chat* masuk, jumlah eskalasi, dan waktu sibuk pelayanan. |

### 4.3 Modul Otomasi (Scheduler)

| Kode FR | Fitur | Deskripsi |
| :--- | :--- | :--- |
| FR-SCH-01 | **Daily Reminder** | Sistem mengeksekusi pemeriksaan jadwal pada pukul 07:00 pagi setiap hari dan mengirimkan pesan WhatsApp ke nomor pribadi petugas yang bertugas pada hari tersebut. |

---

## 5. Kebutuhan Non-Fungsional

> **Keamanan & Stabilitas**
> - **Keamanan Data:** Mengingat ini adalah instansi pemerintah, basis data dan aplikasi harus di-*deploy* pada *server* atau *Dedicated PC* lokal milik BPS Kabupaten Tangerang untuk menjaga keamanan data publik dan internal.
> - **Anti-Spam Mechanism:** Bot WhatsApp harus dilengkapi dengan algoritma *delay* (jeda respons acak antara 3000ms - 5000ms) untuk menghindari pemblokiran akun oleh sistem anti-spam Meta.

---

## 6. Tumpukan Teknologi (Tech Stack)

Sistem akan dikembangkan menggunakan arsitektur *microservices* sederhana dengan pembagian *service* sebagai berikut:

- **Service Web Monitoring (Admin Dashboard):**
  - **Framework:** Full-stack Next.js (React untuk komponen *front-end*, API Routes/Server Actions untuk logika *back-end*).
  - **UI Styling:** Tailwind CSS (rekomendasi untuk *styling* dasbor yang cepat dan modern).
- **Service WhatsApp Bot & Otomasi:** 
  - **Engine:** Node.js menggunakan *library* **Baileys** untuk mengelola koneksi *socket* WhatsApp secara efisien dan ringan.
  - **Task Scheduler:** Menggunakan *library* seperti `node-cron` yang terintegrasi di dalam *service* bot.
- **Database (BaaS):** 
  - **Supabase:** Menggunakan Supabase (berbasis PostgreSQL) sebagai *Backend-as-a-Service*. Pemilihan Supabase akan sangat mempercepat proses *development* karena menyediakan fitur basis data, API instan, dan *real-time subscriptions* bawaan yang sangat mudah diintegrasikan baik dengan Next.js maupun Node.js (Baileys).

### 6.1 Arsitektur Deployment & Komunikasi Antar Service

Kedua *service* berjalan di mesin fisik yang sama (Dedicated PC) namun sebagai proses terpisah:

- **Service 1 — Next.js Web App** → port `3000`
- **Service 2 — Node.js Bot & Scheduler** → berjalan sebagai daemon menggunakan *process manager* (PM2)
- **Komunikasi:** Kedua *service* berbagi *database* Supabase yang sama.
  - Web App menulis data jadwal/FAQ → Bot membaca via *query*.
  - Bot menulis `chat_logs`/`escalations` → Web App menampilkan via *dashboard*.
- **Realtime:** Web App menggunakan Supabase Realtime Subscription untuk menampilkan update *chat*/eskalasi secara *live* di *dashboard*.

---
