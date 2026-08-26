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

/**
 * Inisialisasi Realtime Listener Supabase untuk auto-sync Cache.
 */
export const initRealtimeListeners = () => {
    logger.info('Mendaftarkan Supabase Realtime Listener untuk Master Data...');
    
    // Subscribe ke tabel faq_menu
    supabase
        .channel('public:faq_menu')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'faq_menu' }, (payload) => {
            logger.info(`Terdeteksi perubahan [${payload.eventType}] pada tabel faq_menu, memuat ulang cache...`);
            syncFaqCache();
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                logger.info('✅ Realtime Listener aktif untuk tabel faq_menu');
            }
        });

    // Subscribe ke tabel template_pesan
    supabase
        .channel('public:template_pesan')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'template_pesan' }, (payload) => {
            logger.info(`Terdeteksi perubahan [${payload.eventType}] pada tabel template_pesan, memuat ulang cache...`);
            syncTemplateCache();
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                logger.info('✅ Realtime Listener aktif untuk tabel template_pesan');
            }
        });

    // Subscribe ke tabel kategori_layanan
    supabase
        .channel('public:kategori_layanan')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'kategori_layanan' }, (payload) => {
            logger.info(`Terdeteksi perubahan [${payload.eventType}] pada tabel kategori_layanan, memuat ulang cache...`);
            syncKategoriCache();
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                logger.info('✅ Realtime Listener aktif untuk tabel kategori_layanan');
            }
        });

    // Subscribe ke tabel eskalasi (Untuk Trigger Feedback/Survei)
    supabase
        .channel('public:eskalasi')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'eskalasi' }, async (payload) => {
            const oldData = payload.old;
            const newData = payload.new;

            // Cek apakah feedback_status berubah menjadi 'PENDING'
            if (newData.feedback_status === 'PENDING' && oldData.feedback_status !== 'PENDING') {
                logger.info({ eskalasi_id: newData.id, lid_wa: newData.pelanggan_lid }, 'Trigger feedback terdeteksi');
                
                try {
                    // Menentukan sapaan waktu
                    const hour = new Date().getHours();
                    let timeGreeting = '';
                    if (hour >= 0 && hour < 11) timeGreeting = 'pagi';
                    else if (hour >= 11 && hour < 15) timeGreeting = 'siang';
                    else if (hour >= 15 && hour < 18) timeGreeting = 'sore';
                    else timeGreeting = 'malam';

                    // Ambil template
                    const msg = getTemplate('feedback', {
                        timeGreeting: timeGreeting,
                        customerName: newData.nama_pelanggan
                    }) || `Selamat ${timeGreeting} ${newData.nama_pelanggan}, mohon isi ulasan kami.`; // fallback

                    // Kirim Pesan WA
                    await sendText(newData.pelanggan_lid, msg);
                    
                    // Update Supabase menjadi SENT
                    await updateFeedbackStatus(newData.id, 'SENT');
                    
                    // Catat ke log bot
                    await logBotNotif('feedback', newData.pelanggan_lid, 'SUCCESS');
                    logger.info('✅ Berhasil mengirim notifikasi feedback');

                } catch (error) {
                    logger.error({ error: error.message }, 'Gagal memproses trigger feedback');
                    await logBotNotif('feedback', newData.pelanggan_lid, 'ERROR', error.message);
                }
            }
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                logger.info('✅ Realtime Listener aktif untuk tabel eskalasi');
            }
        });
};
