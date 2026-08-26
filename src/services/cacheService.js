import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { supabase } from '../config/supabase.js';
import { fetchAllFaq, fetchAllTemplates } from './database.js';

const configDir = path.join(process.cwd(), 'src', 'config');
const faqPath = path.join(configDir, 'faq_data.json');
const templatePath = path.join(configDir, 'template_pesan.json');

/**
 * Menulis data ke file JSON secara sinkron.
 */
const writeCacheFile = (filePath, data, label) => {
    try {
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        logger.info(`✅ Cache ${label} berhasil disinkronisasi ke file lokal`);
    } catch (error) {
        logger.error({ error: error.message }, `Gagal menulis cache ${label}`);
        throw error;
    }
};

/**
 * Sinkronisasi data FAQ dari Supabase ke file lokal.
 */
export const syncFaqCache = async () => {
    try {
        const faqs = await fetchAllFaq();
        writeCacheFile(faqPath, faqs, 'FAQ');
    } catch (error) {
        logger.error('Gagal sinkronisasi FAQ. Bot mungkin menggunakan data cache lama jika tersedia.');
    }
};

/**
 * Sinkronisasi data Template Pesan dari Supabase ke file lokal.
 */
export const syncTemplateCache = async () => {
    try {
        const templates = await fetchAllTemplates();
        writeCacheFile(templatePath, templates, 'Template Pesan');
    } catch (error) {
        logger.error('Gagal sinkronisasi Template Pesan. Bot mungkin menggunakan data cache lama jika tersedia.');
    }
};

/**
 * Fungsi utama untuk inisialisasi semua cache pada saat bot start.
 */
export const initializeCache = async () => {
    logger.info('Mulai sinkronisasi cache awal dari Supabase...');
    // Jalankan secara paralel untuk mempercepat proses startup
    await Promise.all([
        syncFaqCache(),
        syncTemplateCache()
    ]);
    logger.info('Sinkronisasi cache awal selesai.');
};

/**
 * Inisialisasi Realtime Listener Supabase untuk auto-sync Cache.
 */
export const initRealtimeListeners = () => {
    logger.info('Mendaftarkan Supabase Realtime Listener untuk Master Data...');
    
    supabase
        .channel('master-data-channel')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'faq_menu' },
            (payload) => {
                logger.info(`Terdeteksi perubahan [${payload.eventType}] pada tabel faq_menu, memuat ulang cache...`);
                syncFaqCache();
            }
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'template_pesan' },
            (payload) => {
                logger.info(`Terdeteksi perubahan [${payload.eventType}] pada tabel template_pesan, memuat ulang cache...`);
                syncTemplateCache();
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                logger.info('✅ Realtime Listener berhasil terhubung ke Supabase');
            }
        });
};
