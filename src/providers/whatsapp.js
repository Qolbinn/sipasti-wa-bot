import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import { logger } from '../utils/logger.js';
import { randomDelay } from '../utils/helper.js';

let sock;

/**
 * Inisialisasi koneksi WhatsApp menggunakan Baileys
 * @param {Function} onMessageCallback - Fungsi callback yang dipanggil saat ada pesan masuk
 */
export const initWhatsApp = async (onMessageCallback) => {
    // Folder auth_info_baileys akan menyimpan session
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    sock = makeWASocket({
        auth: state,
        // Menyembunyikan log default dari Baileys agar terminal kita tetap bersih
        logger: logger.child({ module: 'baileys' }, { level: 'error' }),
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Cetak QR code jika tersedia menggunakan qrcode-terminal
        if (qr) {
            logger.info('Silakan scan QR Code di bawah ini menggunakan WhatsApp Anda:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            logger.error({ error: lastDisconnect?.error }, 'Koneksi WhatsApp terputus');

            if (shouldReconnect) {
                logger.info('Mencoba reconnect...');
                initWhatsApp(onMessageCallback); // Panggil rekursif untuk auto-reconnect
            } else {
                logger.fatal('Anda telah logout dari WhatsApp. Silakan hapus folder auth_info_baileys dan jalankan ulang untuk scan QR.');
            }
        } else if (connection === 'open') {
            logger.info('✅ WhatsApp Bot berhasil terhubung dan siap melayani pesan!');
        }
    });

    // Wajib menyimpan kredensial saat ada pembaruan sesi
    sock.ev.on('creds.update', saveCreds);

    if (onMessageCallback) {
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type === 'notify') {
                for (const msg of messages) {
                    // Meneruskan semua pesan (termasuk dari agen/fromMe) ke handler
                    // Handler sudah memiliki pengaman untuk tidak membalas pesan bot itu sendiri
                    // if (!msg.key.fromMe && msg.message) {
                    if (msg.message) {
                        await onMessageCallback(msg);
                    }
                }
            }
        });
    }
};

/**
 * Menandai pesan telah dibaca (Centang Biru)
 * @param {Object} key - Kunci pesan dari Baileys
 */
export const markRead = async (key) => {
    if (sock) {
        try {
            await sock.readMessages([key]);
        } catch (error) {
            logger.error({ error: error.message }, 'Gagal menandai pesan dibaca');
        }
    }
};

/**
 * Fungsi adapter untuk mengirim teks
 * Mengandung mekanisme randomDelay untuk menghindari sistem anti-spam Meta.
 * 
 * @param {string} jid - WhatsApp ID tujuan
 * @param {string} message - Pesan yang akan dikirim
 * @param {Object} [quotedMsg] - Pesan asli yang akan di-reply (opsional)
 */
export const sendText = async (jid, message, quotedMsg = null) => {
    if (!sock) {
        throw new Error('WhatsApp Socket belum terhubung.');
    }
    try {
        // Gunakan jid asli atau fallback ke @lid
        const formattedJid = jid.includes('@') ? jid : `${jid}@lid`;

        // Simulasikan status "sedang mengetik..." di HP penerima
        await sock.sendPresenceUpdate('composing', formattedJid);

        await randomDelay(3000, 5000); // Anti-spam delay (3 - 5 detik)

        // Hentikan status "sedang mengetik..."
        await sock.sendPresenceUpdate('paused', formattedJid);

        const options = quotedMsg ? { quoted: quotedMsg } : {};
        await sock.sendMessage(formattedJid, { text: message }, options);

        logger.info({ jid }, 'Pesan terkirim sukses');
    } catch (error) {
        logger.error({ jid, error: error.message }, 'Gagal mengirim pesan');
        throw error;
    }
};

/**
 * Menambahkan label WA Business ke obrolan
 * @param {string} jid - WhatsApp ID
 * @param {string} labelId - ID internal dari label WA Business
 */
export const addChatLabel = async (jid, labelId) => {
    if (sock && labelId) {
        try {
            const formattedJid = jid.includes('@') ? jid : `${jid}@lid`;
            await sock.addChatLabel(formattedJid, labelId);
            logger.info({ jid: formattedJid, labelId }, 'Berhasil menambahkan label obrolan');
        } catch (error) {
            logger.error({ jid, labelId, error: error.message }, 'Gagal menambahkan label (mungkin bukan akun bisnis atau ID salah)');
        }
    }
};

/**
 * Menghapus label WA Business dari obrolan
 * @param {string} jid - WhatsApp ID
 * @param {string} labelId - ID internal dari label WA Business
 */
export const removeChatLabel = async (jid, labelId) => {
    if (sock && labelId) {
        try {
            const formattedJid = jid.includes('@') ? jid : `${jid}@lid`;
            await sock.removeChatLabel(formattedJid, labelId);
            logger.info({ jid: formattedJid, labelId }, 'Berhasil menghapus label obrolan');
        } catch (error) {
            logger.error({ jid, labelId, error: error.message }, 'Gagal menghapus label');
        }
    }
};
