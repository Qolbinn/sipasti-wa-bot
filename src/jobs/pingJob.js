import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { updateBotStatus } from '../services/database.js';

export const initPingJob = () => {
    logger.info('Mendaftarkan Scheduler (Cron Jobs) untuk Status Ping...');

    // Lakukan ping pertama kali secara langsung saat bot baru dinyalakan
    updateBotStatus('ONLINE').catch(err => {
        logger.error({ error: err.message }, 'Gagal melakukan ping awal');
    });

    // Ping status secara periodik setiap 5 menit
    cron.schedule('*/5 * * * *', async () => {
        try {
            await updateBotStatus('ONLINE');
        } catch (error) {
            logger.error({ error: error.message }, 'Gagal mengeksekusi cron ping status');
        }
    });

    logger.info('✅ Ping scheduler berhasil didaftarkan (interval: 5 menit).');
};
