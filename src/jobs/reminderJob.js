import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { getPetugasPiketHariIni, getEskalasiStats, logBotNotif } from '../services/database.js';
import { getTemplate } from '../services/templateService.js';
import { sendText } from '../providers/whatsapp.js';

export const initReminderJob = () => {
    logger.info('Mendaftarkan Scheduler (Cron Jobs) untuk Reminder...');

    // 1. Pengingat Jadwal Piket (Setiap Pukul 07:30)
    // Format: menit jam hari_bulan bulan hari_minggu
    cron.schedule('30 07 * * *', async () => {
        logger.info('Mengeksekusi Cron Job: Pengingat Jadwal Piket (07:30)');
        try {
            const jadwalList = await getPetugasPiketHariIni();

            if (jadwalList.length === 0) {
                logger.info('Tidak ada jadwal piket untuk hari ini.');
                return;
            }

            // Ambil statistik eskalasi terlebih dahulu untuk disisipkan
            const stats = await getEskalasiStats();

            for (const row of jadwalList) {
                const pegawai = row.pegawai;
                if (!pegawai || !pegawai.lid_wa) continue;

                const fallbackMsg = `Selamat pagi, ${pegawai.name}\nHari ini adalah jadwal piket Anda\n\nJangan lupa untuk absen dan memantau layanan eskalasi yang masuk melalui link berikut\n_pst-bps-3603/dashboard_\n_pst-bps-3603/dashboard_\n\nBerikut merupakan jumlah tiket eskalasi yang belum diselesaikan\n*Tiket Open* : ${stats.openTicket}\n*Tiket Diproses* : ${stats.onProcessTicket}`;

                const msg = getTemplate('reminder_jadwal', {
                    operatorName: pegawai.name,
                    openTicket: stats.openTicket,
                    onProcessTicket: stats.onProcessTicket
                }) || fallbackMsg;

                await sendText(pegawai.lid_wa, msg);
                await logBotNotif('reminder_jadwal', pegawai.lid_wa, 'SUCCESS');
            }
            logger.info(`✅ Berhasil mengirim pengingat jadwal piket ke ${jadwalList.length} petugas.`);
        } catch (error) {
            logger.error({ error: error.message }, 'Gagal mengeksekusi cron pengingat jadwal');
        }
    });

    // 2. Pengingat Tiket Eskalasi Belum Selesai (Pukul 10:00 dan 13:00)
    cron.schedule('00 10,13 * * *', async () => {
        const jam = new Date().getHours();
        logger.info(`Mengeksekusi Cron Job: Pengingat Eskalasi (${jam}:00)`);

        try {
            const stats = await getEskalasiStats();

            if (stats.openTicket === 0 && stats.onProcessTicket === 0) {
                logger.info('Tidak ada tiket eskalasi yang tertunda. Skip reminder.');
                return;
            }

            const jadwalList = await getPetugasPiketHariIni();
            if (jadwalList.length === 0) {
                logger.warn('Ada tiket tertunda, tapi tidak ada petugas piket hari ini!');
                return;
            }

            const isPagi = jam < 12;
            const fallbackMsg = `Selamat ${isPagi ? 'pagi' : 'siang'},\nBerikut tiket eskalasi yang belum diselesaikan:\nTiket Open: ${stats.openTicket}\nTiket Diproses: ${stats.onProcessTicket}`;

            for (const row of jadwalList) {
                const pegawai = row.pegawai;
                if (!pegawai || !pegawai.lid_wa) continue;

                const msg = getTemplate('reminder_eskalasi', {
                    operatorName: pegawai.name,
                    openTicket: stats.openTicket,
                    onProcessTicket: stats.onProcessTicket
                }) || fallbackMsg;

                await sendText(pegawai.lid_wa, msg);
                await logBotNotif('reminder_eskalasi', pegawai.lid_wa, 'SUCCESS');
            }
            logger.info(`✅ Berhasil mengirim reminder eskalasi ke ${jadwalList.length} petugas.`);
        } catch (error) {
            logger.error({ error: error.message }, 'Gagal mengeksekusi cron pengingat eskalasi');
        }
    });

    logger.info('✅ Reminder scheduler berhasil didaftarkan.');
};
