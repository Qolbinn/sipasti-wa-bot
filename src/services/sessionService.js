import { logger } from '../utils/logger.js';

// In-memory Map untuk menyimpan sesi pengguna
// Key: senderNumber, Value: Object Sesi
const sessions = new Map();

// Cooldown timeout (15 menit)
const SESSION_TIMEOUT_MS = 15 * 60 * 1000; 

/**
 * Mendapatkan sesi pengguna saat ini. 
 * Jika ada sesi yang sudah kedaluwarsa (idle > 15 menit), otomatis dihapus.
 * @param {string} senderNumber - Nomor pengirim
 * @returns {Object|null} Objek sesi jika masih valid, null jika tidak ada/kedaluwarsa
 */
export const getSession = (senderNumber) => {
    const session = sessions.get(senderNumber);
    if (!session) return null;

    const now = Date.now();
    if (now - session.updatedAt > SESSION_TIMEOUT_MS) {
        // Sesi sudah kedaluwarsa (cooldown tercapai), hapus diam-diam
        logger.info({ senderNumber }, 'Sesi kedaluwarsa (cooldown tercapai), membersihkan memori.');
        sessions.delete(senderNumber);
        return null;
    }

    return session;
};

/**
 * Memulai atau memperbarui sesi pengguna
 * @param {string} senderNumber - Nomor pengirim
 * @param {string} state - Status sesi (misal: ESCALATION_ASK_NAME)
 * @param {Object} data - Data tambahan yang ingin disimpan
 */
export const updateSession = (senderNumber, state, data = {}) => {
    // Jika sesi sudah ada, kita gabungkan datanya (merge)
    const existingSession = getSession(senderNumber) || { data: {} };
    
    sessions.set(senderNumber, {
        state: state,
        data: { ...existingSession.data, ...data },
        updatedAt: Date.now()
    });
};

/**
 * Menghapus sesi secara manual (misal saat pengguna ketik BATAL atau selesai)
 * @param {string} senderNumber - Nomor pengirim
 */
export const clearSession = (senderNumber) => {
    sessions.delete(senderNumber);
};

// Interval bersih-bersih memori setiap 1 jam agar RAM tidak bocor
setInterval(() => {
    const now = Date.now();
    for (const [senderNumber, session] of sessions.entries()) {
        if (now - session.updatedAt > SESSION_TIMEOUT_MS) {
            sessions.delete(senderNumber);
        }
    }
}, 60 * 60 * 1000);
