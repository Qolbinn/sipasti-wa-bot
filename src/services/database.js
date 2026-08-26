import { supabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

/**
 * Mengambil semua data FAQ aktif dari database, diurutkan berdasarkan urutan.
 * @returns {Promise<Array>} Array of FAQ objects
 */
export const fetchAllFaq = async () => {
    try {
        const { data, error } = await supabase
            .from('faq_menu')
            .select('*')
            .eq('is_active', true)
            .order('parent_id', { ascending: true, nullsFirst: true })
            .order('urutan', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        logger.error({ error: error.message }, 'Gagal mengambil data FAQ dari Supabase');
        throw error;
    }
};

/**
 * Mengambil semua template pesan dari database.
 * @returns {Promise<Array>} Array of template objects
 */
export const fetchAllTemplates = async () => {
    try {
        const { data, error } = await supabase
            .from('template_pesan')
            .select('*');

        if (error) throw error;
        return data || [];
    } catch (error) {
        logger.error({ error: error.message }, 'Gagal mengambil data Template Pesan dari Supabase');
        throw error;
    }
};
