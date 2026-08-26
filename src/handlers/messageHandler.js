import { sendText, markRead, addChatLabel, removeChatLabel } from '../providers/whatsapp.js';
import { logger } from '../utils/logger.js';
import { isMessageAllowed } from '../utils/numberFilter.js';
import { getFaqResponse } from '../services/faqService.js';
import { checkAndRecordGreeting, getGreetingText } from '../services/greetingService.js';
import { getSession } from '../services/sessionService.js';
import { startEscalation, processEscalation, resolveEscalation } from '../services/escalationService.js';

// ID Label bisa diatur melalui file .env
const getLabelId = () => process.env.LABEL_ESKALASI_ID;

/**
 * Memproses pesan masuk dari WhatsApp
 * @param {Object} msg - Payload pesan mentah dari Baileys
 */
export const processIncomingMessage = async (msg) => {
    try {
        const remoteJid = msg.key.remoteJid;
        const senderNumber = remoteJid.split('@')[0].split(':')[0];
        const isFromMe = msg.key.fromMe;

        // Ekstraksi teks (support pesan teks biasa maupun extended teks/reply)
        const text = msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            "";

        // Jika pesan bukan teks (misal: image, stiker, audio), maka abaikan
        if (!text) return;

        // ==== FITUR AGEN (Menutup Tiket /selesai) ====
        if (isFromMe) {
            const cleanText = text.trim().toLowerCase();
            if (cleanText === '/selesai' || cleanText === '/close') {
                const isResolved = resolveEscalation(senderNumber);
                if (isResolved) {
                    await sendText(remoteJid, "✅ Sesi layanan eskalasi telah selesai. Terima kasih telah menghubungi BPS Kabupaten Tangerang.");
                    const labelId = getLabelId();
                    if (labelId) await removeChatLabel(remoteJid, labelId);
                }
            }
            return; // Jangan memproses logika bot untuk pesan yang dikirim oleh agen sendiri
        }

        // ==== Filter Nomor Pengirim (O(1) Cache Lookup) ====
        if (!isMessageAllowed(senderNumber)) {
            logger.debug({ senderNumber }, 'Pesan diabaikan (dibatasi oleh konfigurasi allow/ignore list)');
            return;
        }

        logger.info({ remoteJid, text }, 'Pesan diterima');

        // Tandai pesan sudah dibaca (centang biru di HP pengirim)
        await markRead(msg.key);

        // ==== CEK SESI AKTIF (STATE MACHINE) ====
        const activeSession = getSession(senderNumber);

        if (activeSession) {
            // Jika user sedang berada di dalam alur tanya-jawab (misal Eskalasi)
            const response = await processEscalation(senderNumber, text, activeSession);
            await sendText(remoteJid, response.message, msg);

            if (response.addLabel) {
                const labelId = getLabelId();
                if (labelId) await addChatLabel(remoteJid, labelId);
            }
            return; // Hentikan proses, jangan masuk ke logika FAQ
        }

        // ==== ALUR SAPAAN & FAQ ====
        const pushName = msg.pushName || '';
        const isFirstChatToday = checkAndRecordGreeting(senderNumber);
        const cleanText = text.trim().toUpperCase();

        if (isFirstChatToday) {
            // Jika ini percakapan pertama hari ini
            let replyMessage;

            if (cleanText === '99') {
                replyMessage = startEscalation(senderNumber);
            } else {
                replyMessage = getFaqResponse(text);
                if (!replyMessage) {
                    // Jika pesannya acak (di luar trigger keyword/menu FAQ), paksa kirim Menu Utama
                    replyMessage = getFaqResponse('MENU');
                }
            }

            // Bubble 1: Kirim Sapaan
            const greeting = getGreetingText(pushName);
            await sendText(remoteJid, greeting, msg);

            // Bubble 2: Kirim Menu / Respons FAQ
            await sendText(remoteJid, replyMessage, msg);
        } else {
            // Jika SUDAH PERNAH disapa hari ini, jalankan mode FAQ normal
            let replyMessage;

            if (cleanText === '99') {
                replyMessage = startEscalation(senderNumber);
            } else {
                replyMessage = getFaqResponse(text);
            }

            // Jika pesan tidak valid atau tidak termasuk trigger keyword, bot akan diam
            if (!replyMessage) return;

            // Kirim balasan menggunakan fungsi adapter dengan me-quote pesan asli
            await sendText(remoteJid, replyMessage, msg);
        }

    } catch (error) {
        logger.error({ error: error.message }, 'Error saat memproses pesan masuk');
    }
};
