import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { supabase } from '../config/supabase.js';
import { fetchAllFaq, fetchAllTemplates, syncKategoriCache, updateFeedbackStatus, logBotNotif } from './database.js';
import { sendText } from '../providers/whatsapp.js';
import { getTemplate } from './templateService.js';

const configDir = path.join(process.cwd(), 'src', 'config');
const faqPath = path.join(configDir, 'faq_data.json');
const templatePath = path.join(configDir, 'template_pesan.json');
const kategoriPath = path.join(configDir, 'kategori_layanan.json');

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
    await syncFaqCache();
    await syncTemplateCache();
    await syncKategoriCache();
    logger.info('Sinkronisasi cache awal selesai.');
};

