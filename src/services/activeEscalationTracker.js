import { fetchActiveEscalationLids } from './database.js';
import { logger } from '../utils/logger.js';

// Set In-Memory untuk menyimpan pelanggan_lid dengan tiket aktif
const activeEscalations = new Set();

/**
 * Memuat semua tiket aktif dari database ke dalam Set saat startup
 */
export const initActiveEscalations = async () => {
    try {
        const lids = await fetchActiveEscalationLids();
        activeEscalations.clear();
        lids.forEach(lid => activeEscalations.add(lid));
        logger.info({ count: activeEscalations.size }, '✅ Tracker Eskalasi Aktif berhasil diinisialisasi');
    } catch (error) {
        logger.error({ error: error.message }, 'Gagal inisialisasi Tracker Eskalasi Aktif');
    }
};

/**
 * Menambahkan pelanggan_lid ke tracker tiket aktif
 * @param {string} lid 
 */
export const addActiveEscalation = (lid) => {
    if (lid) {
        activeEscalations.add(lid);
        logger.debug({ lid }, 'LID ditambahkan ke Tracker Eskalasi Aktif');
    }
};

/**
 * Menghapus pelanggan_lid dari tracker tiket aktif
 * @param {string} lid 
 */
export const removeActiveEscalation = (lid) => {
    if (lid) {
        activeEscalations.delete(lid);
        logger.debug({ lid }, 'LID dihapus dari Tracker Eskalasi Aktif');
    }
};

/**
 * Memeriksa apakah pelanggan_lid memiliki tiket aktif
 * @param {string} lid 
 * @returns {boolean}
 */
export const hasActiveEscalation = (lid) => {
    if (!lid) return false;
    return activeEscalations.has(lid);
};
