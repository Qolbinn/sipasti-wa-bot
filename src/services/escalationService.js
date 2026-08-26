import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { updateSession, clearSession } from './sessionService.js';
import { insertEscalation } from './database.js';
import { getTemplate } from './templateService.js';

const configDir = path.join(process.cwd(), 'src', 'config');

/**
 * Mendapatkan daftar kategori aktif dari file cache
 */
const getKategori = () => {
    try {
        const filePath = path.join(configDir, 'kategori_layanan.json');
        if (!fs.existsSync(filePath)) return [];
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (error) {
        logger.error('Gagal membaca cache kategori:', error.message);
        return [];
    }
};

/**
 * Memproses balasan pengguna yang sedang berada di dalam alur Eskalasi
 * @param {string} senderNumber - Nomor pengirim
 * @param {string} text - Pesan dari pengguna
 * @param {Object} session - Sesi saat ini
 * @returns {Promise<Object>} { message: string, addLabel?: boolean }
 */
export const processEscalation = async (senderNumber, text, session) => {
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
            
            const categories = getKategori();
            if (categories.length === 0) {
                return { message: "Mohon maaf, layanan eskalasi sedang tidak tersedia karena daftar kategori kosong. Silakan ketik *BATAL*." };
            }

            let catMessage = `Halo *${input}*, silakan pilih Kategori Layanan yang Anda butuhkan dengan membalas *nomor urutnya* saja:\n\n`;
            categories.forEach((cat, index) => {
                catMessage += `${index + 1}. ${cat.nama}\n`;
            });
            catMessage += `\n_(Ketik *BATAL* untuk membatalkan)_`;

            updateSession(senderNumber, 'ESCALATION_ASK_CATEGORY', { name: input });
            return { message: catMessage };

        case 'ESCALATION_ASK_CATEGORY':
            const cats = getKategori();
            const choiceIndex = parseInt(input) - 1;
            
            if (isNaN(choiceIndex) || choiceIndex < 0 || choiceIndex >= cats.length) {
                return { message: "Pilihan tidak valid. Silakan balas dengan *angka* yang sesuai dengan pilihan kategori." };
            }
            
            const selectedCat = cats[choiceIndex];
            
            updateSession(senderNumber, 'ESCALATION_ASK_DESC', { 
                name: session.data.name, 
                kategori_kode: selectedCat.kode,
                kategori_nama: selectedCat.nama
            });
            
            return { message: `Anda memilih kategori *${selectedCat.nama}*.\n\nSilakan jelaskan secara detail kendala atau keperluan Anda (Ketik *BATAL* untuk membatalkan):` };

        case 'ESCALATION_ASK_DESC':
            // Asumsikan input yang masuk adalah Deskripsi Keperluan
            if (input.length < 10) {
                return { message: "Deskripsi terlalu singkat. Mohon jelaskan lebih detail agar petugas kami dapat membantu Anda dengan baik (Ketik *BATAL* untuk membatalkan):" };
            }
            updateSession(senderNumber, 'ESCALATION_CONFIRM', { 
                name: session.data.name,
                kategori_kode: session.data.kategori_kode,
                kategori_nama: session.data.kategori_nama,
                description: input 
            });
            return { message: `📋 *Konfirmasi Permintaan Layanan*\n\n*Nama:* ${session.data.name}\n*Kategori:* ${session.data.kategori_nama}\n*Keperluan:* ${input}\n\nApakah data di atas sudah benar?\n\nKetik *1* untuk SETUJU & KIRIM\nKetik *0* untuk ULANGI\nKetik *BATAL* untuk membatalkan` };

        case 'ESCALATION_CONFIRM':
            if (input === '1') {
                const payload = {
                    pelanggan_lid: senderNumber,
                    nama_pelanggan: session.data.name,
                    kategori_kode: session.data.kategori_kode,
                    detail: session.data.description,
                    channel: 'whatsapp'
                };
                
                const ticket = await insertEscalation(payload);
                clearSession(senderNumber);
                
                if (ticket) {
                    const customTemplate = getTemplate('create_ticket', {
                        customerName: session.data.name
                    });
                    
                    const successMsg = customTemplate || `✅ *Tiket Berhasil Dibuat*\n\nTerima kasih ${session.data.name}, keperluan Anda telah diteruskan ke petugas kami.`;
                    
                    return { 
                        message: successMsg,
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
 * (Dalam arsitektur baru, petugas akan menutup dari Web App, tapi jika agen menutup via WA (cmd /selesai))
 * @param {string} senderNumber - Nomor pelanggan
 * @returns {boolean}
 */
export const resolveEscalation = (senderNumber) => {
    // Karena kita tidak menyimpan state eskalasi di lokal JSON, maka resolve via WA cmd /selesai harus 
    // mengeksekusi update DB Supabase jika diperlukan. 
    // Tapi karena agen membalas dari HP-nya langsung, dia tidak mengubah status di DB web app secara atomik.
    // Fitur /selesai di WA ini sementara hanya membuang label chat WA business.
    return true; 
};

/**
 * Trigger awal ketika pengguna mengetik kode 99
 */
export const startEscalation = (senderNumber) => {
    updateSession(senderNumber, 'ESCALATION_ASK_NAME');
    return "Anda memilih layanan eskalasi ke petugas.\n\nSilakan tuliskan *nama lengkap* Anda:\n\n_(Catatan: Sesi ini akan otomatis dibatalkan jika Anda tidak membalas dalam 15 menit. Ketik *BATAL* untuk kembali sekarang.)_";
};

