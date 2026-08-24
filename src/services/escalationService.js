import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { updateSession, clearSession } from './sessionService.js';

const escalationsPath = path.join(process.cwd(), 'src', 'config', 'escalations.json');

// Pastikan file ada
if (!fs.existsSync(escalationsPath)) {
    fs.writeFileSync(escalationsPath, JSON.stringify([]));
}

/**
 * Menyimpan tiket eskalasi ke database/JSON
 */
const saveEscalation = (senderNumber, data) => {
    try {
        const escalations = JSON.parse(fs.readFileSync(escalationsPath, 'utf-8'));
        const newTicket = {
            id: `TKT-${Date.now()}`,
            sender: senderNumber,
            name: data.name,
            description: data.description,
            status: 'OPEN',
            created_at: new Date().toISOString()
        };
        escalations.push(newTicket);
        fs.writeFileSync(escalationsPath, JSON.stringify(escalations, null, 2));
        return newTicket;
    } catch (error) {
        logger.error('Gagal menyimpan tiket eskalasi:', error.message);
        return null;
    }
};

/**
 * Memproses balasan pengguna yang sedang berada di dalam alur Eskalasi
 * @param {string} senderNumber - Nomor pengirim
 * @param {string} text - Pesan dari pengguna
 * @param {Object} session - Sesi saat ini
 * @returns {Object} { message: string, addLabel?: boolean }
 */
export const processEscalation = (senderNumber, text, session) => {
    const input = text.trim();
    
    // Fitur Batal Global
    if (input.toUpperCase() === 'BATAL') {
        clearSession(senderNumber);
        return { message: "🛑 Permintaan eskalasi dibatalkan. Anda telah kembali ke mode FAQ biasa." };
    }

    switch (session.state) {
        case 'ESCALATION_ASK_NAME':
            // Asumsikan input yang masuk adalah Nama pengguna
            if (input.length < 2) {
                return { message: "Nama terlalu pendek. Silakan tuliskan nama lengkap Anda yang sebenarnya (Ketik *BATAL* untuk membatalkan):" };
            }
            updateSession(senderNumber, 'ESCALATION_ASK_DESC', { name: input });
            return { message: `Halo *${input}*, silakan jelaskan secara detail kendala atau keperluan Anda (Ketik *BATAL* untuk membatalkan):` };

        case 'ESCALATION_ASK_DESC':
            // Asumsikan input yang masuk adalah Deskripsi Keperluan
            if (input.length < 10) {
                return { message: "Deskripsi terlalu singkat. Mohon jelaskan lebih detail agar petugas kami dapat membantu Anda dengan baik (Ketik *BATAL* untuk membatalkan):" };
            }
            updateSession(senderNumber, 'ESCALATION_CONFIRM', { description: input });
            return { message: `📋 *Konfirmasi Permintaan Layanan*\n\n*Nama:* ${session.data.name}\n*Keperluan:* ${input}\n\nApakah data di atas sudah benar?\n\nKetik *1* untuk SETUJU & KIRIM\nKetik *0* untuk ULANGI\nKetik *BATAL* untuk membatalkan` };

        case 'ESCALATION_CONFIRM':
            if (input === '1') {
                const ticket = saveEscalation(senderNumber, session.data);
                clearSession(senderNumber);
                if (ticket) {
                    return { 
                        message: `✅ *Tiket Berhasil Dibuat* (ID: ${ticket.id})\n\nKeperluan Anda telah diteruskan ke petugas kami. Petugas akan segera membalas pesan Anda di obrolan ini. Mohon ditunggu ya!`,
                        addLabel: true // Flag agar handler tahu harus menambahkan label
                    };
                } else {
                    return { message: "❌ Terjadi kesalahan pada sistem saat menyimpan tiket. Silakan coba lagi nanti." };
                }
            } else if (input === '0') {
                updateSession(senderNumber, 'ESCALATION_ASK_NAME', { name: '', description: '' });
                return { message: "Mari kita ulangi dari awal.\n\nSilakan tuliskan nama lengkap Anda:" };
            } else {
                return { message: "Pilihan tidak valid.\nKetik *1* untuk SETUJU, *0* untuk ULANGI, atau *BATAL*." };
            }

        default:
            clearSession(senderNumber);
            return { message: "Terjadi kesalahan sesi. Sesi direset." };
    }
};

/**
 * Menutup tiket eskalasi yang masih OPEN berdasarkan nomor pengirim
 * @param {string} senderNumber - Nomor pelanggan
 * @returns {boolean} True jika berhasil menemukan dan menutup tiket
 */
export const resolveEscalation = (senderNumber) => {
    try {
        const escalations = JSON.parse(fs.readFileSync(escalationsPath, 'utf-8'));
        let found = false;
        
        // Cari tiket terakhir yang masih OPEN untuk nomor ini
        for (let i = escalations.length - 1; i >= 0; i--) {
            if (escalations[i].sender === senderNumber && escalations[i].status === 'OPEN') {
                escalations[i].status = 'RESOLVED';
                escalations[i].resolved_at = new Date().toISOString();
                found = true;
                break; // Tutup 1 tiket terbaru saja
            }
        }

        if (found) {
            fs.writeFileSync(escalationsPath, JSON.stringify(escalations, null, 2));
            return true;
        }
        return false;
    } catch (error) {
        logger.error('Gagal resolve tiket:', error.message);
        return false;
    }
};

/**
 * Trigger awal ketika pengguna mengetik kode 99
 */
export const startEscalation = (senderNumber) => {
    updateSession(senderNumber, 'ESCALATION_ASK_NAME');
    return "Anda memilih layanan eskalasi ke petugas.\n\nSilakan tuliskan *nama lengkap* Anda:\n\n_(Catatan: Sesi ini akan otomatis dibatalkan jika Anda tidak membalas dalam 15 menit. Ketik *BATAL* untuk kembali sekarang.)_";
};
