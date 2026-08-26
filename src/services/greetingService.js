import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { recordDailyChat } from './database.js';
import { getTemplate } from './templateService.js';

const statsPath = path.join(process.cwd(), 'src', 'config', 'daily_stats.json');

// Memori internal (cache)
let currentData = {
    date: "",
    greetedNumbers: []
};

// Pastikan direktori ada
const ensureConfigDir = () => {
    const dir = path.dirname(statsPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

const loadStats = () => {
    try {
        if (fs.existsSync(statsPath)) {
            const data = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
            if (data.date && Array.isArray(data.greetedNumbers)) {
                currentData = data;
            }
        }
    } catch (error) {
        logger.error('Gagal mem-parsing daily_stats.json:', error.message);
    }
};

const saveStats = () => {
    try {
        ensureConfigDir();
        fs.writeFileSync(statsPath, JSON.stringify(currentData, null, 2));
    } catch (error) {
        logger.error('Gagal menyimpan daily_stats.json:', error.message);
    }
};

// Load pertama kali
loadStats();

/**
 * Mendapatkan sapaan berdasarkan waktu saat ini
 * Pagi (00-11), Siang (11-15), Sore (15-18), Malam (18-24)
 * @param {string} pushName - Nama profil WhatsApp pengguna
 * @returns {string} Teks sapaan
 */
export const getGreetingText = (pushName) => {
    const hour = new Date().getHours();
    let timeGreeting = '';

    if (hour >= 0 && hour < 11) {
        timeGreeting = 'pagi';
    } else if (hour >= 11 && hour < 15) {
        timeGreeting = 'siang';
    } else if (hour >= 15 && hour < 18) {
        timeGreeting = 'sore';
    } else {
        timeGreeting = 'malam';
    }

    // Jika pushName kosong atau berisi karakter non-alfabetik yang dominan, gunakan fallback "Kak"
    const name = pushName ? pushName.trim() : 'Bapak/Ibu/Kak';

    // Coba ambil dari template JSON yang dinamis
    const customTemplate = getTemplate('greeting', {
        timeGreeting: timeGreeting,
        customerName: name
    });

    if (customTemplate) {
        return customTemplate;
    }

    // Fallback bawaan (Hardcode) jika konfigurasi database belum ter-sync
    return `Selamat ${timeGreeting} ${name}, selamat datang di SIPASTI (Sistem Pelayanan Statistik Terintegrasi) BPS Kabupaten Tangerang.`;
};

/**
 * Mengecek apakah pengguna sudah disapa hari ini dan mencatatnya ke statistik
 * @param {string} senderNumber - Nomor unik pengirim (bisa PNJID atau LID)
 * @returns {boolean} True jika ini adalah pesan PERTAMA (belum disapa hari ini), False jika sudah
 */
export const checkAndRecordGreeting = (senderNumber) => {
    // Gunakan tanggal lokal dalam format YYYY-MM-DD
    const today = new Date().toLocaleDateString('sv-SE'); // sv-SE menghasilkan format YYYY-MM-DD standar

    // Auto-Reset: Jika hari telah berganti, bersihkan memori
    if (currentData.date !== today) {
        logger.info(`Hari baru terdeteksi (${today}). Mereset statistik harian...`);
        currentData = {
            date: today,
            greetedNumbers: []
        };
        saveStats();
    }

    if (!currentData.greetedNumbers.includes(senderNumber)) {
        // Ini adalah kontak pertama hari ini
        currentData.greetedNumbers.push(senderNumber);
        saveStats(); // Simpan perubahan ke JSON

        // Fire and Forget ke Supabase (Tanpa await, tidak memblokir)
        recordDailyChat(senderNumber).catch(err => {
            // Error sudah di-handle di database.js, tapi biarkan catch ini untuk safety
        });

        return true;
    }

    // Sudah pernah chat hari ini
    return false;
};
