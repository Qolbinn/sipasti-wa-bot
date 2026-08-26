import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

const templatePath = path.join(process.cwd(), 'src', 'config', 'template_pesan.json');

/**
 * Mengambil template pesan dari cache JSON dan menyisipkan variabel dinamis.
 * 
 * @param {string} tipe - Tipe template (cth: 'greeting', 'create_ticket')
 * @param {Object} variables - Key-value pair untuk disisipkan (cth: { customerName: 'Andi' })
 * @returns {string|null} - Teks pesan yang sudah disisipkan variabel, atau null jika gagal/tidak ditemukan.
 */
export const getTemplate = (tipe, variables = {}) => {
    try {
        if (!fs.existsSync(templatePath)) return null;
        
        const fileContent = fs.readFileSync(templatePath, 'utf-8');
        if (!fileContent) return null;
        
        const templates = JSON.parse(fileContent);
        const template = templates.find(t => t.tipe === tipe);
        
        if (!template || !template.konten) return null;
        
        let content = template.konten;
        
        // Ganti semua occurence dari {{key}} dengan value yang dipassing
        for (const [key, value] of Object.entries(variables)) {
            // Gunakan RegExp global untuk mengganti semua kemunculan variabel tersebut
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            content = content.replace(regex, value);
        }
        
        return content;
    } catch (error) {
        logger.error({ error: error.message }, `Gagal membaca/memproses template tipe: ${tipe}`);
        return null;
    }
};
