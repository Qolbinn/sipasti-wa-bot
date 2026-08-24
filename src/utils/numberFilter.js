import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

const allowedPath = path.join(process.cwd(), 'src', 'config', 'allowed_numbers.json');
const ignoredPath = path.join(process.cwd(), 'src', 'config', 'ignored_numbers.json');

// Cache di RAM agar komputasi sangat ringan (O(1) tanpa I/O file setiap ada pesan)
let allowedCache = [];
let ignoredCache = [];

const loadConfig = () => {
    try {
        if (fs.existsSync(allowedPath)) {
            const allowed = JSON.parse(fs.readFileSync(allowedPath, 'utf-8'));
            allowedCache = allowed.flatMap(u => {
                const arr = [];
                if (u.lid) arr.push(String(u.lid));
                if (u.phone) arr.push(String(u.phone));
                return arr;
            }).filter(Boolean);
        }
    } catch (e) {
        logger.error('Gagal mem-parsing allowed_numbers.json');
    }

    try {
        if (fs.existsSync(ignoredPath)) {
            const ignored = JSON.parse(fs.readFileSync(ignoredPath, 'utf-8'));
            ignoredCache = ignored.flatMap(u => {
                const arr = [];
                if (u.lid) arr.push(String(u.lid));
                if (u.phone) arr.push(String(u.phone));
                return arr;
            }).filter(Boolean);
        }
    } catch (e) {
        logger.error('Gagal mem-parsing ignored_numbers.json');
    }
};

// Load pertama kali saat bot dijalankan
loadConfig();

// Watcher file background: Hanya membaca file ulang jika file tersebut diedit
// (Hot-reload tanpa membebani event loop utama)
fs.watchFile(allowedPath, { interval: 2000 }, () => {
    logger.info('File allowed_numbers.json berubah, memuat ulang konfigurasi...');
    loadConfig();
});

fs.watchFile(ignoredPath, { interval: 2000 }, () => {
    logger.info('File ignored_numbers.json berubah, memuat ulang konfigurasi...');
    loadConfig();
});

/**
 * Mengecek apakah pesan dari nomor tersebut boleh dibalas
 * @param {string} phone - Nomor pengirim
 * @returns {boolean} True jika diizinkan
 */
export const isMessageAllowed = (phone) => {
    if (allowedCache.length > 0 && !allowedCache.includes(phone)) {
        return false;
    }
    if (ignoredCache.includes(phone)) {
        return false;
    }
    return true;
};
