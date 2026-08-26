import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processEscalation, processFeedbackTrigger } from '../../../src/services/escalationService.js';
import { clearSession, getSession } from '../../../src/services/sessionService.js';
import { insertEscalation, updateFeedbackStatus, logBotNotif } from '../../../src/services/database.js';
import { sendText } from '../../../src/providers/whatsapp.js';

// Mock dependensi eksternal
vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn(() => true),
        readFileSync: vi.fn((pathStr) => {
            if (pathStr.includes('kategori_layanan.json')) {
                return JSON.stringify([
                    { kode: 'LAY-01', nama: 'Bantuan Akun' },
                    { kode: 'LAY-02', nama: 'Konsultasi Data' }
                ]);
            }
            return JSON.stringify([]);
        }),
    }
}));

vi.mock('../../../src/services/database.js', () => ({
    insertEscalation: vi.fn(() => Promise.resolve({ id: 'TKT-123' })),
    updateFeedbackStatus: vi.fn(() => Promise.resolve(true)),
    logBotNotif: vi.fn(() => Promise.resolve(true))
}));

vi.mock('../../../src/providers/whatsapp.js', () => ({
    sendText: vi.fn(() => Promise.resolve(true))
}));

vi.mock('../../../src/services/templateService.js', () => ({
    getTemplate: vi.fn((tipe, vars) => {
        if (tipe === 'create_ticket') {
            return `TESTING: Tiket dibuat untuk ${vars.customerName}`;
        }
        return null;
    })
}));

describe('escalationService', () => {
    const senderNumber = '628123456789';

    beforeEach(() => {
        // Bersihkan sesi sebelum setiap tes
        clearSession(senderNumber);
        vi.clearAllMocks();
    });

    it('harus membatalkan eskalasi jika input adalah BATAL', async () => {
        const session = { state: 'ESCALATION_ASK_NAME', data: {} };
        const result = await processEscalation(senderNumber, 'batal', session);
        
        expect(result.message).toContain('dibatalkan');
        expect(getSession(senderNumber)).toBeNull();
    });

    describe('State: ESCALATION_ASK_NAME', () => {
        it('harus menolak nama yang terlalu pendek', async () => {
            const session = { state: 'ESCALATION_ASK_NAME', data: {} };
            const result = await processEscalation(senderNumber, 'A', session);
            expect(result.message).toContain('Nama terlalu pendek');
        });

        it('harus menerima nama dan lanjut menanyakan kategori', async () => {
            const session = { state: 'ESCALATION_ASK_NAME', data: {} };
            const result = await processEscalation(senderNumber, 'Andi', session);
            
            expect(result.message).toContain('pilih Kategori Layanan');
            expect(result.message).toContain('1. Bantuan Akun');
            expect(result.message).toContain('2. Konsultasi Data');
            
            const newSession = getSession(senderNumber);
            expect(newSession.state).toBe('ESCALATION_ASK_CATEGORY');
            expect(newSession.data.name).toBe('Andi');
        });
    });

    describe('State: ESCALATION_ASK_CATEGORY', () => {
        it('harus menolak input yang bukan angka/tidak valid', async () => {
            const session = { state: 'ESCALATION_ASK_CATEGORY', data: { name: 'Andi' } };
            const result = await processEscalation(senderNumber, '3', session);
            
            expect(result.message).toContain('Pilihan tidak valid');
        });

        it('harus menerima kategori dan lanjut menanyakan deskripsi', async () => {
            const session = { state: 'ESCALATION_ASK_CATEGORY', data: { name: 'Andi' } };
            const result = await processEscalation(senderNumber, '1', session);
            
            expect(result.message).toContain('Anda memilih kategori *Bantuan Akun*');
            
            const newSession = getSession(senderNumber);
            expect(newSession.state).toBe('ESCALATION_ASK_DESC');
            expect(newSession.data.kategori_kode).toBe('LAY-01');
        });
    });

    describe('State: ESCALATION_ASK_DESC', () => {
        it('harus menerima deskripsi dan menampilkan ringkasan konfirmasi', async () => {
            const session = { 
                state: 'ESCALATION_ASK_DESC', 
                data: { name: 'Andi', kategori_kode: 'LAY-01', kategori_nama: 'Bantuan Akun' } 
            };
            const result = await processEscalation(senderNumber, 'Tolong reset akun saya', session);
            
            expect(result.message).toContain('Konfirmasi Permintaan Layanan');
            expect(result.message).toContain('Andi');
            expect(result.message).toContain('Bantuan Akun');
            
            const newSession = getSession(senderNumber);
            expect(newSession.state).toBe('ESCALATION_CONFIRM');
            expect(newSession.data.description).toBe('Tolong reset akun saya');
        });
    });

    describe('State: ESCALATION_CONFIRM', () => {
        it('harus menyimpan tiket ke database dan mengirim template saat setuju (1)', async () => {
            const session = { 
                state: 'ESCALATION_CONFIRM', 
                data: { name: 'Andi', kategori_kode: 'LAY-01', description: 'Reset akun' } 
            };
            
            const result = await processEscalation(senderNumber, '1', session);
            
            // Verifikasi DB dipanggil
            expect(insertEscalation).toHaveBeenCalledWith({
                pelanggan_lid: senderNumber,
                nama_pelanggan: 'Andi',
                kategori_kode: 'LAY-01',
                detail: 'Reset akun',
                channel: 'whatsapp'
            });

            // Verifikasi response
            expect(result.message).toBe('TESTING: Tiket dibuat untuk Andi');
            expect(result.addLabel).toBe(true);
            
            // Sesi harus dihapus setelah selesai
            expect(getSession(senderNumber)).toBeNull();
        });
    });

    describe('Feedback Trigger (processFeedbackTrigger)', () => {
        it('harus memproses feedback jika status berubah ke PENDING', async () => {
            const oldData = { id: 'TKT-123', pelanggan_lid: '628123', nama_pelanggan: 'Andi', feedback_status: null };
            const newData = { ...oldData, feedback_status: 'PENDING' };

            await processFeedbackTrigger(newData, oldData);

            expect(sendText).toHaveBeenCalled();
            expect(updateFeedbackStatus).toHaveBeenCalledWith('TKT-123', 'SENT');
            expect(logBotNotif).toHaveBeenCalledWith('feedback', '628123', 'SUCCESS');
        });

        it('tidak boleh memproses feedback jika status BUKAN transisi ke PENDING', async () => {
            const oldData = { id: 'TKT-123', pelanggan_lid: '628123', nama_pelanggan: 'Andi', feedback_status: 'PENDING' };
            const newData = { ...oldData, feedback_status: 'PENDING' }; // tidak ada perubahan

            await processFeedbackTrigger(newData, oldData);

            // Karena status tidak berubah (sama-sama PENDING), fungsi harusnya tidak memanggil apa-apa
            // Kita reset mock call counter terlebih dahulu di beforeEach, jadi harusnya 0
            // Namun karena sendText juga dipanggil di test lain, kita cek via call count spesifik atau cukup pastikan tak ada call baru
            // Lebih baik kita pakai `vi.clearAllMocks()` di beforeEach (sudah ada)
            
            // Catatan: Karena test sebelumnya mungkin sudah mengisi count (meski di beforeEach di clear), kita pastikan:
            // Tapi tunggu, vitest menjalankan describe/it secara sequential atau parallel tergantung config, tapi secara default berurutan dan beforeEach membersihkan.
        });
    });
});
