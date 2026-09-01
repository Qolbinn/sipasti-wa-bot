import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
    initActiveEscalations, 
    addActiveEscalation, 
    removeActiveEscalation, 
    hasActiveEscalation 
} from '../../../src/services/activeEscalationTracker.js';
import { fetchActiveEscalationLids } from '../../../src/services/database.js';

// Mock database.js
vi.mock('../../../src/services/database.js', () => ({
    fetchActiveEscalationLids: vi.fn(() => Promise.resolve(['62811111111', '62822222222']))
}));

describe('activeEscalationTracker', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        // Reset state dengan init ulang
        await initActiveEscalations();
    });

    it('harus memuat data awal tiket aktif dari database saat inisialisasi', () => {
        expect(fetchActiveEscalationLids).toHaveBeenCalledTimes(1);
        expect(hasActiveEscalation('62811111111')).toBe(true);
        expect(hasActiveEscalation('62822222222')).toBe(true);
        expect(hasActiveEscalation('62833333333')).toBe(false);
    });

    it('harus dapat menambahkan nomor baru ke tracker (addActiveEscalation)', () => {
        addActiveEscalation('62833333333');
        expect(hasActiveEscalation('62833333333')).toBe(true);
    });

    it('harus dapat menghapus nomor dari tracker (removeActiveEscalation)', () => {
        expect(hasActiveEscalation('62811111111')).toBe(true);
        removeActiveEscalation('62811111111');
        expect(hasActiveEscalation('62811111111')).toBe(false);
    });

    it('harus menangani nilai null/undefined dengan aman', () => {
        expect(hasActiveEscalation(null)).toBe(false);
        expect(hasActiveEscalation(undefined)).toBe(false);
        
        // Tidak throw error saat dipanggil dengan null
        addActiveEscalation(null);
        removeActiveEscalation(null);
    });
});
