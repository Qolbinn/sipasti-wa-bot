# AGENTS-BOT.MD
**Guidelines & Best Practices for SIPASTI Bot & Scheduler Service**

Dokumen ini adalah *blueprint* arsitektur dan standar penulisan kode untuk pengembangan modul WhatsApp Bot dan Scheduler pada sistem SIPASTI. Dokumen ini dirancang dengan pendekatan *Forward-Thinking*, memastikan kode yang ditulis pada masa aktualisasi (menggunakan Baileys) dapat bermigrasi ke **Meta Official API** di masa depan dengan *refactoring* seminimal mungkin.

---

## 1. Konsep Arsitektur Utama: Adapter / Provider Pattern
Prinsip utama dalam kode ini adalah **Dependency Inversion**. Logika bisnis aplikasi (*scheduler*, FAQ, eskalasi) **tidak boleh bergantung langsung** pada *library* Baileys. 

Semua fungsi pengiriman dan penerimaan pesan harus melewati sebuah lapisan abstraksi (Adapter) di dalam folder `providers/`. Jika *engine* WhatsApp diganti, *developer* hanya perlu menulis ulang *file provider*, tanpa menyentuh ratusan baris kode logika bisnis lainnya.

---

## 2. Standar Struktur Direktori
Gunakan pola modular berikut untuk memisahkan tanggung jawab (*Separation of Concerns*):

```text
/src
 ├── config/
 │   ├── supabase.js         # Inisialisasi Supabase client (Singleton)
 │   └── env.js              # Validasi dan export environment variables
 ├── providers/
 │   └── whatsapp.js         # ADAPTER LAYER: Membungkus logika spesifik Baileys / Meta API
 ├── handlers/
 │   ├── messageHandler.js   # Pemroses teks mentah (FAQ, Eskalasi) - TIDAK terikat Baileys
 │   └── webhook.js          # (Future-proof) Entry point untuk HTTP POST Meta API
 ├── services/
 │   └── database.js         # Kumpulan fungsi query CRUD ke Supabase
 ├── jobs/
 │   ├── reminder.js         # Logika node-cron untuk jadwal piket
 │   └── retryQueue.js       # Job retry pesan gagal kirim
 ├── health/
 │   └── server.js           # HTTP health check endpoint
 ├── utils/
 │   ├── helper.js           # Fungsi utilitas (format tanggal, random delay)
 │   ├── logger.js           # Logging terstruktur (pino)
 │   └── sanitizer.js        # Input validation & sanitasi
 └── index.js                # Entry point utama (inisialisasi service + graceful shutdown)
```

### 2.1 Environment Variables (`config/env.js`)

File `.env` harus memuat variabel berikut:

| Variable | Deskripsi | Contoh |
| :--- | :--- | :--- |
| `SUPABASE_URL` | URL project Supabase | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key (bukan anon key) | `eyJ...` |
| `BOT_PHONE_NUMBER` | Nomor WA bot (untuk referensi internal) | `6281234567890` |
| `ADMIN_PHONE_NUMBER` | Nomor admin untuk fallback notifikasi | `6289876543210` |
| `LOG_LEVEL` | Level logging (debug/info/warn/error) | `info` |
| `NODE_ENV` | Environment (development/production) | `production` |

`config/env.js` harus memvalidasi bahwa semua variabel wajib terisi saat *startup* dan menghentikan proses jika ada yang kosong.

---

## 3. Panduan Implementasi per Modul

### A. WhatsApp Provider (`providers/whatsapp.js`)
Lapisan ini adalah satu-satunya tempat di mana *library* pihak ketiga (Baileys) diizinkan untuk di- *import* dan digunakan.

*   **Session & Reconnection:** Wajib menggunakan `useMultiFileAuthState`. Tangani `connection.update` menggunakan `@hapi/boom`. Jika terputus bukan karena *logout*, jalankan fungsi *reconnect* secara otomatis.
*   **Sentralisasi Anti-Spam:** Terapkan fungsi `randomDelay` secara terpusat tepat sebelum fungsi eksekusi pesan bawaan Baileys dipanggil. Ini memastikan semua pesan yang keluar dari sistem mendapat jeda waktu secara otomatis (mematuhi DRY - *Don't Repeat Yourself*).
*   **Standardized Export:** Ekspor fungsi-fungsi umum yang *agnostic* (tidak spesifik Baileys), seperti `sendText(phone, message)`.

```javascript
// Contoh implementasi di providers/whatsapp.js
import { makeWASocket } from '@whiskeysockets/baileys';
import { randomDelay } from '../utils/helper.js';

let sock;

export const initWhatsApp = async () => {
    // Logika koneksi dan auth Baileys...
    sock = makeWASocket({ /* config */ });
};

// Fungsi abstrak yang akan digunakan oleh seluruh aplikasi
export const sendText = async (phone, message) => {
    await randomDelay(3000, 5000); // Anti-spam delay terpusat
    
    // Format nomor telepon (Baileys butuh akhiran @s.whatsapp.net)
    const formattedPhone = `${phone}@s.whatsapp.net`;
    await sock.sendMessage(formattedPhone, { text: message });
};
```

### B. Business Logic & Handlers (`handlers/messageHandler.js`)
*Handler* hanya bertugas menerima *string* pesan masuk, memprosesnya, dan merespons menggunakan fungsi dari `provider/whatsapp.js`. Jangan memanggil `sock.sendMessage` di sini.

```javascript
// Contoh implementasi di handlers/messageHandler.js
import { sendText } from '../providers/whatsapp.js';
import { getFAQ } from '../services/database.js';

export const processIncomingMessage = async (senderPhone, text) => {
    if (text === '1') {
        const reply = await getFAQ('1');
        await sendText(senderPhone, reply);
    }
};
```

### C. Supabase Integration (`services/database.js`)
Karena modul ini berjalan di *environment backend* (Node.js), ada aturan ketat dalam menggunakan Supabase:

*   **Service Role Key:** Gunakan `SUPABASE_SERVICE_ROLE_KEY` (bukan *anon key*), karena sistem *backend* ini beroperasi dengan privilese admin untuk menarik data jadwal dan merekam riwayat secara utuh melewati *Row Level Security* (RLS).
*   **Singleton Pattern:** *Client* Supabase hanya boleh diinisialisasi satu kali di `config/supabase.js` dan di-*export*.
*   **Fail-Safe Query:** Selalu gunakan blok `try...catch`. Galat (*error*) di *database* tidak boleh mematikan proses utama Node.js (*crash*).

### D. Scheduler Automations (`jobs/reminder.js`)
*Scheduler* bertugas mengeksekusi *task* di latar belakang dan memanggil *provider* untuk mengirim notifikasi.

*   **Timezone Explicit:** Selalu deklarasikan zona waktu secara spesifik (`Asia/Jakarta`) agar eksekusi *cron job* tetap konsisten, terlepas dari konfigurasi *server host*.
*   **Concurrency Handling:** Karena `sendText` sudah memiliki mekanisme *delay*, pengulangan (*looping*) pengiriman *reminder* ke banyak petugas secara otomatis akan memiliki jeda yang aman dan natural, menyerupai ketikan manusia.

```javascript
import cron from 'node-cron';
import { getTodaySchedule } from '../services/database.js';
import { sendText } from '../providers/whatsapp.js';

export const startReminderJob = () => {
    cron.schedule('0 7 * * *', async () => {
        try {
            const schedules = await getTodaySchedule();
            for (const user of schedules) {
                // Tidak perlu panggil delay di sini, karena sudah di-handle oleh sendText()
                await sendText(user.phone, `[SIPASTI] Halo, Anda memiliki jadwal piket PST hari ini.`);
            }
        } catch (error) {
            console.error("Gagal menjalankan tugas pengingat:", error);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Jakarta"
    });
};
```

### E. Logging Strategy

Gunakan *library* logging terstruktur (rekomendasi: **pino**) alih-alih `console.log/error`.

*   **Format:** JSON terstruktur dengan *field* `timestamp`, `level`, `module`, `message`, `data`.
*   **Rotasi:** Gunakan *file rotation* (harian) atau *pipe* ke *logging service*.
*   **Level:**
    - `error` → Kegagalan kritis (DB *down*, WA *disconnect* permanen)
    - `warn` → *Retry*, *reconnect*, pesan gagal sementara
    - `info` → Pesan terkirim, *cron job executed*, eskalasi dibuat
    - `debug` → *Raw message payload* (hanya di *development*)
*   **Sentralisasi:** Buat *logger instance* di `utils/logger.js` dan *import* di semua modul.

```javascript
// utils/logger.js
import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
    level: env.LOG_LEVEL || 'info',
    transport: env.NODE_ENV === 'development'
        ? { target: 'pino-pretty' }
        : undefined,
});
```

### F. Error Handling & Message Retry

Pesan yang gagal terkirim tidak boleh hilang begitu saja.

*   **Retry Queue:** Gunakan tabel `message_queue` di Supabase dengan kolom `id`, `phone`, `message`, `status` (pending/sent/failed), `attempts`, `next_retry_at`.
*   **Retry Logic:** Maksimal 3 percobaan dengan *exponential backoff* (5s → 15s → 45s).
*   **Dead Letter:** Setelah 3x gagal, status diubah ke `failed` dan notifikasi dikirim ke admin.
*   **Scheduler Retry Job:** Tambahkan *cron job* setiap 1 menit untuk memproses antrian *pending*.

```javascript
// Modifikasi di providers/whatsapp.js
import { logger } from '../utils/logger.js';

export const sendText = async (phone, message, retryCount = 0) => {
    try {
        await randomDelay(3000, 5000);
        const formattedPhone = `${phone}@s.whatsapp.net`;
        await sock.sendMessage(formattedPhone, { text: message });
        logger.info({ phone, status: 'sent' }, 'Pesan terkirim');
    } catch (error) {
        logger.error({ phone, error: error.message, attempt: retryCount }, 'Gagal kirim pesan');
        if (retryCount < 3) {
            await queueRetry(phone, message, retryCount + 1);
        } else {
            await markAsFailed(phone, message);
            await notifyAdmin(`Pesan ke ${phone} gagal setelah 3 percobaan`);
        }
    }
};
```

### G. Graceful Shutdown

Proses Node.js harus menangani sinyal terminasi dengan benar agar tidak memutus operasi di tengah jalan.

```javascript
// Di index.js
import { logger } from './utils/logger.js';

const shutdown = async (signal) => {
    logger.info(`Menerima sinyal ${signal}, memulai graceful shutdown...`);

    // 1. Hentikan penerimaan pesan baru
    // 2. Tunggu proses pengiriman yang sedang berjalan selesai (timeout 10 detik)
    // 3. Tutup koneksi Supabase
    // 4. Logout WhatsApp socket dengan bersih

    process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

### H. Health Check & Monitoring

Buat *endpoint* HTTP sederhana (menggunakan native `http` module) pada port terpisah (misal: `3001`) untuk monitoring status bot:

```javascript
// health/server.js
import http from 'http';
import { getConnectionStatus } from '../providers/whatsapp.js';

const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        const status = {
            uptime: process.uptime(),
            waConnected: getConnectionStatus(),
            timestamp: new Date().toISOString(),
            memoryUsage: process.memoryUsage(),
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status));
    }
});

server.listen(3001);
```

*Endpoint* ini dapat digunakan oleh PM2, *monitoring tool*, atau Web App untuk menampilkan status bot di *dashboard*.

### I. Input Validation & Security

Semua input dari pengguna WhatsApp harus diperlakukan sebagai *untrusted data*.

*   **Sanitasi Input:** *Strip* HTML *tags* dan karakter berbahaya sebelum menyimpan ke *database*.
*   **Length Limit:** Tolak pesan masuk yang melebihi 1000 karakter (kemungkinan spam/abuse).
*   **Phone Number Validation:** Validasi format nomor telepon sebelum menyimpan ke *database*.
*   **SQL Injection:** Supabase *client* sudah *parameterized* secara bawaan, tapi tetap hindari *string concatenation* dalam *query*.

```javascript
// utils/sanitizer.js
export const sanitizeInput = (text) => {
    if (typeof text !== 'string') return '';
    return text
        .replace(/<[^>]*>/g, '')  // Strip HTML
        .trim()
        .substring(0, 1000);      // Max length
};

export const isValidPhone = (phone) => {
    return /^62\d{9,13}$/.test(phone);
};
```

---

## 4. Rencana Migrasi ke Meta API (Future-Proofing)
Berkat arsitektur di atas, ketika SIPASTI nantinya mendapatkan persetujuan *budget* atau akses untuk menggunakan WhatsApp Cloud API resmi dari Meta, Anda HANYA perlu melakukan dua hal:

1.  **Ubah isi `providers/whatsapp.js`:** Hapus semua *library* Baileys, ganti fungsi `sendText` dengan *HTTP POST Request* (menggunakan *axios* atau *fetch*) yang mengarah ke *endpoint Graph API* Meta.
2.  **Buat Webhook Listener:** Ganti `sock.ev.on('messages.upsert')` bawaan Baileys di `index.js` dengan membuat *endpoint* API (misalnya menggunakan *Express.js* `app.post('/webhook')`) untuk menangkap pesan masuk dari server Meta, lalu lemparkan datanya ke fungsi `processIncomingMessage()` yang sudah ada.

*File handler, layanan Supabase, dan logika cron job Anda tidak akan berubah satu karakter pun!*

---

## 5. Panduan Testing

### Unit Test
- Gunakan **Vitest** atau **Jest** sebagai *test runner*.
- *Handler* dan *services* harus bisa di-*test* secara independen dengan *mock provider*.

### Integration Test
- Buat *mock* WhatsApp *provider* (`providers/whatsapp.mock.js`) yang merekam pesan alih-alih mengirimnya, untuk *testing flow end-to-end* tanpa koneksi WA nyata.

### Manual Test Checklist
- [ ] Bot merespons pesan pertama dengan *greeting* + menu
- [ ] FAQ menampilkan jawaban yang benar sesuai pilihan
- [ ] Eskalasi membuat *record* di *database* dan mengirim notifikasi ke petugas
- [ ] *Reminder* terkirim tepat pukul 07:00 WIB kepada petugas yang bertugas
- [ ] Bot *auto-reconnect* setelah koneksi terputus
- [ ] *Graceful shutdown* tidak memutus pesan yang sedang terproses
