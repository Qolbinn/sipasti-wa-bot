import 'dotenv/config';
import { logger } from './utils/logger.js';
import { initializeCache } from './services/cacheService.js';
import { initRealtimeListeners } from './handlers/realtimeHandler.js';
import { initWhatsApp } from './providers/whatsapp.js';
import { processIncomingMessage } from './handlers/messageHandler.js';
import { initAllCronJobs } from './jobs/index.js';
import { initActiveEscalations } from './services/activeEscalationTracker.js';

// ==========================================
// Inisialisasi Aplikasi
// ==========================================
const start = async () => {
    logger.info('Menyiapkan layanan SIPASTI WA Bot (Hybrid Mode)...');
    
    try {
        // Tarik data awal dari Supabase ke lokal Cache JSON
        await initializeCache();

        // Inisialisasi tracker tiket eskalasi aktif
        await initActiveEscalations();
        
        // Daftarkan listener Supabase Realtime
        initRealtimeListeners();

        // Daftarkan Scheduler Cron Jobs secara terpusat
        initAllCronJobs();

        // Inisialisasi WhatsApp provider dan passing handler sebagai callback
        // Pola ini mematuhi Adapter Pattern / Dependency Inversion
        await initWhatsApp(processIncomingMessage);
        
    } catch (error) {
        logger.error({ error: error.message }, 'Gagal memulai service');
        process.exit(1);
    }
};

// ==========================================
// Graceful Shutdown Handler
// ==========================================
const shutdown = async (signal) => {
    logger.info(`\nMenerima sinyal ${signal}, memulai graceful shutdown...`);
    
    // Memberikan waktu jeda sebelum mematikan proses, untuk memastikan
    // proses asinkron yang sedang berjalan (seperti kirim pesan) bisa selesai.
    setTimeout(() => {
        logger.info('Sistem berhasil dihentikan. Bye!');
        process.exit(0);
    }, 1500);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT')); // Menangkap CTRL+C

// Eksekusi aplikasi
start();
