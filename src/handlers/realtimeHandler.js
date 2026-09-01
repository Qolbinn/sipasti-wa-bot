import { supabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { syncFaqCache, syncTemplateCache } from '../services/cacheService.js';
import { syncKategoriCache } from '../services/database.js';
import { processEscalationUpdate } from '../services/escalationService.js';

/**
 * Inisialisasi Realtime Listener Supabase untuk semua tabel.
 * Ini adalah sentral "pendengar" perubahan database (Single Responsibility).
 */
export const initRealtimeListeners = () => {
    logger.info('Mendaftarkan Supabase Realtime Listener untuk Master Data & Event...');
    
    // Subscribe ke tabel faq_menu (Cache Sync)
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

    // Subscribe ke tabel template_pesan (Cache Sync)
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

    // Subscribe ke tabel kategori_layanan (Cache Sync)
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

    // Subscribe ke tabel eskalasi (Notification Trigger)
    supabase
        .channel('public:eskalasi')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'eskalasi' }, (payload) => {
            // Delegasikan logika bisnis (penutupan tiket & pengiriman WA) ke service yang bersangkutan
            processEscalationUpdate(payload.new, payload.old);
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                logger.info('✅ Realtime Listener aktif untuk tabel eskalasi');
            }
        });
};
