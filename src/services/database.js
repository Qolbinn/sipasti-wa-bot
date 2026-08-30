import fs from 'fs';
import path from 'path';
import { supabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

/**
 * Mengambil semua data FAQ aktif dari database, diurutkan berdasarkan urutan.
 * @returns {Promise<Array>} Array of FAQ objects
 */
export const fetchAllFaq = async () => {
    try {
        const { data, error } = await supabase
            .from('faq_menu')
            .select('*')
            .eq('is_active', true)
            .order('parent_id', { ascending: true, nullsFirst: true })
            .order('urutan', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        logger.error({ error: error.message }, 'Gagal mengambil data FAQ dari Supabase');
        throw error;
    }
};

/**
 * Menyimpan tiket eskalasi baru ke Supabase
 * @param {Object} payload 
 * @returns {Object|null}
 */
export const insertEscalation = async (payload) => {
    try {
        const { data, error } = await supabase
            .from('eskalasi')
            .insert([payload])
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        logger.error({ error: error.message }, 'Gagal insert eskalasi ke Supabase');
        return null;
    }
};

/**
 * Mengupdate status feedback eskalasi
 * @param {string} id - ID Eskalasi (UUID)
 * @param {string} status - 'PENDING' atau 'SENT'
 */
export const updateFeedbackStatus = async (id, status) => {
    try {
        const { error } = await supabase
            .from('eskalasi')
            .update({ feedback_status: status })
            .eq('id', id);

        if (error) throw error;
        return true;
    } catch (error) {
        logger.error({ error: error.message }, 'Gagal update feedback status');
        return false;
    }
};

/**
 * Menyelesaikan tiket eskalasi (via perintah WA /selesai) di Database
 * Hanya mengubah status jadi RESOLVED (feedback tidak otomatis)
 * @param {string} pelanggan_lid - Nomor pelanggan (lid_wa)
 */
export const resolveEscalationDB = async (pelanggan_lid) => {
    try {
        const { error } = await supabase
            .from('eskalasi')
            .update({ status: 'RESOLVED' })
            .eq('pelanggan_lid', pelanggan_lid)
            .neq('status', 'RESOLVED');

        if (error) throw error;
        return true;
    } catch (error) {
        logger.error({ error: error.message }, 'Gagal menyelesaikan tiket via Database');
        return false;
    }
};

/**
 * Mencatat notifikasi bot (seperti feedback) ke bot_notif_log
 * @param {string} tipe_notif - Contoh: 'feedback'
 * @param {string} tujuan_lid - Nomor WA
 * @param {string} status - 'SUCCESS' atau 'ERROR'
 * @param {string} error_message - (Opsional) pesan error
 */
export const logBotNotif = async (tipe_notif, tujuan_lid, status, error_message = null) => {
    try {
        const { error } = await supabase
            .from('bot_notif_log')
            .insert([{ tipe_notif, tujuan_lid, status, error_message }]);

        if (error) throw error;
        return true;
    } catch (error) {
        logger.error({ error: error.message }, 'Gagal mencatat bot_notif_log');
        return false;
    }
};

/**
 * Mengambil semua template pesan dari database.
 * @returns {Promise<Array>} Array of template objects
 */
export const fetchAllTemplates = async () => {
    try {
        const { data, error } = await supabase
            .from('template_pesan')
            .select('*');

        if (error) throw error;
        return data || [];
    } catch (error) {
        logger.error({ error: error.message }, 'Gagal mengambil data Template Pesan dari Supabase');
        throw error;
    }
};

/**
 * Mengambil Kategori Layanan dari Supabase dan menyimpannya ke JSON lokal (Cache)
 */
export const syncKategoriCache = async () => {
    try {
        const { data, error } = await supabase
            .from('kategori_layanan')
            .select('kode, nama, is_active')
            .eq('is_active', true)
            .order('kode', { ascending: true });

        if (error) throw error;

        const cachePath = path.join(process.cwd(), 'src', 'config', 'kategori_layanan.json');

        // Simpan ke config/kategori_layanan.json
        fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
        logger.info('✅ Cache Kategori Layanan berhasil disinkronisasi ke file lokal');
        return true;
    } catch (error) {
        logger.error({ error: error.message }, 'Terjadi kesalahan saat menyimpan kategori layanan');
        return false;
    }
};

/**
 * Mencatat interaksi pertama harian pelanggan (Fire and Forget)
 * @param {string} lid_wa - Nomor WhatsApp pengguna
 */
export const recordDailyChat = async (lid_wa) => {
    try {
        const { error } = await supabase
            .from('riwayat_chat_harian')
            .insert([{
                lid_wa,
                tanggal: new Date().toLocaleDateString('sv-SE'),
                waktu_first_chat: new Date().toISOString()
            }]);

        if (error) throw error;
    } catch (error) {
        logger.warn({ error: error.message }, 'Gagal merekam analitik harian ke DB (Fire and Forget)');
    }
};

/**
 * Mengambil daftar petugas piket hari ini
 * @returns {Promise<Array>} Array of { pegawai: { name, lid_wa } }
 */
export const getPetugasPiketHariIni = async () => {
    try {
        const todayStr = new Date().toLocaleDateString('sv-SE'); // 'YYYY-MM-DD'
        const { data, error } = await supabase
            .from('jadwal_piket')
            .select('pegawai ( name, lid_wa )')
            .eq('tanggal', todayStr);

        if (error) throw error;
        return data || [];
    } catch (error) {
        logger.error({ error: error.message }, 'Gagal mengambil jadwal_piket dari Supabase');
        return [];
    }
};

/**
 * Mengambil statistik eskalasi yang belum selesai (OPEN dan ON_PROCESS)
 * @returns {Promise<Object>} { openTicket, onProcessTicket }
 */
export const getEskalasiStats = async () => {
    try {
        const { data, error } = await supabase
            .from('eskalasi')
            .select('status')
            .in('status', ['OPEN', 'ON_PROCESS']);

        if (error) throw error;

        let openTicket = 0;
        let onProcessTicket = 0;

        (data || []).forEach(ticket => {
            if (ticket.status === 'OPEN') openTicket++;
            if (ticket.status === 'ON_PROCESS') onProcessTicket++;
        });

        return { openTicket, onProcessTicket };
    } catch (error) {
        logger.error({ error: error.message }, 'Gagal menghitung statistik eskalasi');
        return { openTicket: 0, onProcessTicket: 0 };
    }
};

/**
 * Memperbarui status nyala/matinya bot (Ping)
 * @param {string} status - Default 'ONLINE'
 */
export const updateBotStatus = async (status = 'ONLINE') => {
    try {
        const payload = {
            service_name: 'whatsapp_bot',
            status: status,
            last_ping_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('bot_status')
            .upsert(payload, { onConflict: 'service_name' });

        if (error) throw error;
    } catch (error) {
        logger.warn({ error: error.message }, 'Gagal mengirim ping status ke bot_status (Fire and Forget)');
    }
};

/**
 * Mengambil semua pelanggan_lid yang memiliki tiket aktif (OPEN dan ON_PROCESS)
 * @returns {Promise<Array<string>>}
 */
export const fetchActiveEscalationLids = async () => {
    try {
        const { data, error } = await supabase
            .from('eskalasi')
            .select('pelanggan_lid')
            .in('status', ['OPEN', 'ON_PROCESS']);

        if (error) throw error;
        return (data || []).map(row => row.pelanggan_lid).filter(Boolean);
    } catch (error) {
        logger.error({ error: error.message }, 'Gagal mengambil daftar pelanggan_lid aktif');
        return [];
    }
};
