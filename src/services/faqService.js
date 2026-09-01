import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

const faqPath = path.join(process.cwd(), 'src', 'config', 'faq_data.json');

// In-memory cache untuk O(1) atau pencarian cepat tanpa I/O berulang
let faqData = [];

const loadFaqData = () => {
    try {
        if (fs.existsSync(faqPath)) {
            faqData = JSON.parse(fs.readFileSync(faqPath, 'utf-8'));
            logger.info('Berhasil memuat faq_data.json');
        }
    } catch (error) {
        logger.error('Gagal mem-parsing faq_data.json:', error.message);
    }
};

// Load pertama kali
loadFaqData();

// Watcher untuk fitur hot-reload
fs.watchFile(faqPath, { interval: 2000 }, () => {
    logger.info('File faq_data.json berubah, memuat ulang data...');
    loadFaqData();
});

/**
 * Mengambil balasan FAQ berdasarkan pesan (ID) pengguna
 * @param {string} userMessage - Pesan masuk dari pengguna
 * @returns {string} String balasan lengkap
 */
export const getFaqResponse = (userMessage) => {
    // Normalisasi input (menghapus spasi dan menjadikan huruf besar)
    const queryKode = String(userMessage).trim().toUpperCase();

    // Cari spesifik menu/jawaban berdasarkan kode (bukan ID)
    const match = faqData.find(item => String(item.kode).toUpperCase() === queryKode);

    if (match) {
        if (match.is_menu) {
            // Ini adalah menu (kategori), cari anak-anaknya (children) berdasarkan parent_id = match.id
            let children = faqData.filter(item => String(item.parent_id).toUpperCase() === match.id.toUpperCase());

            // Urutkan berdasarkan kolom 'urutan', lalu 'kode'
            children = children.sort((a, b) => {
                if (a.urutan !== b.urutan) return a.urutan - b.urutan;
                return parseInt(a.kode) - parseInt(b.kode);
            });

            let response = `*${match.title}*\n${match.content}\n\n`;
            children.forEach(child => {
                response += `*[${child.kode}]* ${child.title}\n`;
            });
            response += `\n_Balas dengan kode (contoh: ${children[0]?.kode || 'kode'}) untuk memilih._`;

            return response;
        } else {
            // Ini adalah jawaban (daun akhir)
            return `*${match.title}*\n\n${match.content}\n\n_Ketik *MENU* atau *0* untuk kembali ke menu FAQ awal._`;
        }
    } else {
        // Jika tidak ada ID yang cocok, cek apakah pesannya adalah trigger menu utama
        const triggerKeywords = ['0', 'HALO', 'MENU', 'INFO', 'PING', 'BANTUAN', 'HAI'];

        if (triggerKeywords.includes(queryKode)) {
            // Ambil menu utama (parent_id = null)
            let mainMenus = faqData.filter(item => item.parent_id === null || item.parent_id === "");

            // Urutkan berdasarkan kolom 'urutan', lalu 'kode'
            mainMenus = mainMenus.sort((a, b) => {
                if (a.urutan !== b.urutan) return a.urutan - b.urutan;
                return parseInt(a.kode) - parseInt(b.kode);
            });

            let response = `👋 Halo! Selamat datang di Layanan Informasi BPS.\nSilakan pilih menu informasi berikut:\n\n`;
            mainMenus.forEach(menu => {
                response += `*[${menu.kode}]* ${menu.title}\n`;
            });
            response += `\n_Balas dengan angka/kode menu di atas untuk mengakses informasi._`;

            return response;
        }

        // Jika bukan trigger keyword dan bukan kode menu yang valid, abaikan pesan (bot diam)
        return null;
    }
};
