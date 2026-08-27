import { describe, it, expect, vi, beforeEach } from 'vitest';
import cron from 'node-cron';
import { initReminderJob } from '../../../src/jobs/reminderJob.js';
import { getPetugasPiketHariIni, getEskalasiStats, logBotNotif } from '../../../src/services/database.js';
import { sendText } from '../../../src/providers/whatsapp.js';
import { getTemplate } from '../../../src/services/templateService.js';

// Mock dependensi
vi.mock('node-cron', () => ({
    default: {
        schedule: vi.fn()
    }
}));

vi.mock('../../../src/services/database.js', () => ({
    getPetugasPiketHariIni: vi.fn(),
    getEskalasiStats: vi.fn(),
    logBotNotif: vi.fn(() => Promise.resolve(true))
}));

vi.mock('../../../src/providers/whatsapp.js', () => ({
    sendText: vi.fn(() => Promise.resolve(true))
}));

vi.mock('../../../src/services/templateService.js', () => ({
    getTemplate: vi.fn(() => null) // biarkan fallback message berjalan
}));

describe('Reminder Scheduler (Cron Jobs)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('harus mendaftarkan dua cron jobs', () => {
        initReminderJob();
        expect(cron.schedule).toHaveBeenCalledTimes(2);
        
        // Pengecekan parameter jadwal
        expect(cron.schedule.mock.calls[0][0]).toBe('30 07 * * *');
        expect(cron.schedule.mock.calls[1][0]).toBe('00 10,13 * * *');
    });

    it('Cron 07:30 - harus mengirim pesan jadwal ke petugas piket hari ini beserta jumlah tiket', async () => {
        // Mock data
        getPetugasPiketHariIni.mockResolvedValueOnce([
            { pegawai: { name: 'Andi', lid_wa: '628123' } },
            { pegawai: { name: 'Budi', lid_wa: '628456' } }
        ]);
        getEskalasiStats.mockResolvedValueOnce({ openTicket: 1, onProcessTicket: 2 });

        initReminderJob();
        
        // Dapatkan fungsi callback untuk cron pertama (07:30)
        const jobPiket = cron.schedule.mock.calls[0][1];
        await jobPiket(); // eksekusi manual

        expect(getPetugasPiketHariIni).toHaveBeenCalled();
        expect(getEskalasiStats).toHaveBeenCalled();
        expect(sendText).toHaveBeenCalledTimes(2);
        expect(sendText).toHaveBeenCalledWith('628123', expect.stringContaining('Andi'));
        expect(sendText).toHaveBeenCalledWith('628123', expect.stringContaining('Tiket Open* : 1'));
        expect(logBotNotif).toHaveBeenCalledWith('reminder_jadwal', '628123', 'SUCCESS');
    });

    it('Cron 10:00/13:00 - harus tidak mengirim pesan jika tiket eskalasi nol', async () => {
        getEskalasiStats.mockResolvedValueOnce({ openTicket: 0, onProcessTicket: 0 });

        initReminderJob();
        
        // Dapatkan fungsi callback untuk cron kedua
        const jobEskalasi = cron.schedule.mock.calls[1][1];
        await jobEskalasi();

        expect(getEskalasiStats).toHaveBeenCalled();
        expect(getPetugasPiketHariIni).not.toHaveBeenCalled(); // Karena return lebih awal
        expect(sendText).not.toHaveBeenCalled();
    });

    it('Cron 10:00/13:00 - harus mengirim pesan eskalasi jika ada tiket tertunda', async () => {
        getEskalasiStats.mockResolvedValueOnce({ openTicket: 2, onProcessTicket: 1 });
        getPetugasPiketHariIni.mockResolvedValueOnce([
            { pegawai: { name: 'Andi', lid_wa: '628123' } }
        ]);

        initReminderJob();
        
        const jobEskalasi = cron.schedule.mock.calls[1][1];
        await jobEskalasi();

        expect(getEskalasiStats).toHaveBeenCalled();
        expect(getPetugasPiketHariIni).toHaveBeenCalled();
        expect(sendText).toHaveBeenCalledTimes(1);
        expect(sendText).toHaveBeenCalledWith('628123', expect.stringContaining('Open: 2'));
        expect(logBotNotif).toHaveBeenCalledWith('reminder_eskalasi', '628123', 'SUCCESS');
    });
});
