import dotenv from 'dotenv';

// Load variables from .env file
dotenv.config();

export const env = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    BOT_PHONE_NUMBER: process.env.BOT_PHONE_NUMBER || '',
    ADMIN_PHONE_NUMBER: process.env.ADMIN_PHONE_NUMBER || '',
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
};

// Validasi mandatory environment variables
const missingVars = [];
if (!env.SUPABASE_URL) missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
if (!env.SUPABASE_SERVICE_ROLE_KEY) missingVars.push('SUPABASE_SERVICE_ROLE_KEY');

if (missingVars.length > 0) {
    console.error(`❌ ERROR: Variabel environment berikut belum diatur di file .env: ${missingVars.join(', ')}`);
    process.exit(1); // Matikan proses jika credential Supabase tidak ada
}

if (env.NODE_ENV === 'production') {
    if (!env.ADMIN_PHONE_NUMBER) {
        console.warn('⚠️ WARNING: ADMIN_PHONE_NUMBER is not set. Fallback notifications will not work.');
    }
}
