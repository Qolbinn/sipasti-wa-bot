import { describe, it, expect, vi, beforeEach } from 'vitest';
import cron from 'node-cron';
import { initPingJob } from '../../../src/jobs/pingJob.js';
import { updateBotStatus } from '../../../src/services/database.js';

// Mock dependensi
vi.mock('node-cron', () => ({
    default: {
        schedule: vi.fn()
    }
}));

vi.mock('../../../src/services/database.js', () => ({
    updateBotStatus: vi.fn(() => Promise.resolve())
}));

describe('Ping Scheduler (Cron Job)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('harus mendaftarkan cron job dengan interval setiap 10 menit', () => {
        initPingJob();
        expect(cron.schedule).toHaveBeenCalledTimes(1);
        
        // Pengecekan parameter jadwal
        expect(cron.schedule.mock.calls[0][0]).toBe('*/10 * * * *');
    });

    it('Cron Ping - harus memanggil updateBotStatus', async () => {
        initPingJob();
        
        // Dapatkan fungsi callback untuk cron ping
        const jobPing = cron.schedule.mock.calls[0][1];
        await jobPing(); // eksekusi manual

        expect(updateBotStatus).toHaveBeenCalledTimes(1);
        expect(updateBotStatus).toHaveBeenCalledWith('ONLINE');
    });
});
