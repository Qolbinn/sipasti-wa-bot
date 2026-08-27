import { logger } from '../utils/logger.js';
import { initReminderJob } from './reminderJob.js';
import { initPingJob } from './pingJob.js';

export const initAllCronJobs = () => {
    logger.info('Menginisialisasi semua Scheduler (Cron Jobs)...');
    
    // Inisialisasi Job untuk Reminder Jadwal & Eskalasi (Hari 5)
    initReminderJob();

    // Inisialisasi Job untuk Ping Status Bot (Hari 6)
    initPingJob();
};
