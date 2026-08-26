import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getGreetingText, checkAndRecordGreeting } from '../../../src/services/greetingService.js';

// Mock dependensi eksternal agar unit test tidak menyentuh file asli / database
vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn(() => false),
        readFileSync: vi.fn(),
        writeFileSync: vi.fn(),
        mkdirSync: vi.fn(),
    }
}));

vi.mock('../../../src/services/database.js', () => ({
    recordDailyChat: vi.fn(() => Promise.resolve())
}));

describe('greetingService', () => {
    
    // --- SKENARIO UJI 1: FUNGSI getGreetingText ---
    describe('getGreetingText', () => {
        beforeEach(() => {
            // Gunakan fake timers sebelum setiap test time-travel
            vi.useFakeTimers();
        });

        afterEach(() => {
            // Kembalikan ke waktu normal
            vi.useRealTimers();
        });

        it('harus membalas "Selamat pagi" jika jam 09:00', () => {
            // Set waktu palsu ke 09:00:00
            const date = new Date(2026, 1, 1, 9, 0, 0);
            vi.setSystemTime(date);

            const result = getGreetingText('Andi');
            expect(result).toContain('Selamat pagi Andi');
        });

        it('harus membalas "Selamat siang" jika jam 13:00', () => {
            // Set waktu palsu ke 13:00:00
            const date = new Date(2026, 1, 1, 13, 0, 0);
            vi.setSystemTime(date);

            const result = getGreetingText('Budi');
            expect(result).toContain('Selamat siang Budi');
        });

        it('harus membalas "Selamat sore" jika jam 16:30', () => {
            const date = new Date(2026, 1, 1, 16, 30, 0);
            vi.setSystemTime(date);

            const result = getGreetingText('Caca');
            expect(result).toContain('Selamat sore Caca');
        });

        it('harus membalas "Selamat malam" jika jam 21:00', () => {
            const date = new Date(2026, 1, 1, 21, 0, 0);
            vi.setSystemTime(date);

            const result = getGreetingText('Doni');
            expect(result).toContain('Selamat malam Doni');
        });

        it('harus membalas dengan fallback jika pushName kosong', () => {
            const date = new Date(2026, 1, 1, 9, 0, 0);
            vi.setSystemTime(date);

            const result = getGreetingText('');
            expect(result).toContain('Selamat pagi Bapak/Ibu/Kak');
        });
    });

    // --- SKENARIO UJI 2: FUNGSI checkAndRecordGreeting ---
    describe('checkAndRecordGreeting', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            // Reset tanggal untuk pengujian konsisten
            vi.setSystemTime(new Date(2026, 1, 1, 10, 0, 0));
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('harus mengembalikan true pada interaksi pertama nomor baru', () => {
            // Simulasi interaksi pertama
            const isNew = checkAndRecordGreeting('628111222333');
            expect(isNew).toBe(true);
        });

        it('harus mengembalikan false jika nomor yang sama chat lagi di hari yang sama', () => {
            // Interaksi pertama (sudah tersimpan di memori dari test di atas atau kita panggil lagi)
            checkAndRecordGreeting('628999888777');
            
            // Interaksi kedua (harus false)
            const isNew = checkAndRecordGreeting('628999888777');
            expect(isNew).toBe(false);
        });
        
        it('harus me-reset memori dan mengembalikan true jika berganti hari', () => {
            // Hari pertama
            checkAndRecordGreeting('628444555666');
            let isNew = checkAndRecordGreeting('628444555666');
            expect(isNew).toBe(false); // Memastikan hari pertama sudah dicatat

            // Berganti hari ke keesokan harinya
            vi.setSystemTime(new Date(2026, 1, 2, 10, 0, 0)); // Tanggal 2
            
            isNew = checkAndRecordGreeting('628444555666');
            expect(isNew).toBe(true); // Karena hari sudah berganti, dianggap baru lagi
        });
    });
});
