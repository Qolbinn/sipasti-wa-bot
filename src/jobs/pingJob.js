import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { updateBotStatus } from '../services/database.js';

export const initPingJob = () => {
    logger.info('Mendaftarkan Scheduler (Cron Jobs) untuk Status Ping...');

    // Ping status setiap 10 menit
    cron.schedule('*/10 * * * *', async () => {
        try {
            await updateBotStatus('ONLINE');
        } catch (error) {
            logger.error({ error: error.message }, 'Gagal mengeksekusi cron ping status');
        }
    });

    logger.info('✅ Ping scheduler berhasil didaftarkan.');
};
