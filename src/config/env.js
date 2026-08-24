import dotenv from 'dotenv';

// Load variables from .env file
dotenv.config();

export const env = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    BOT_PHONE_NUMBER: process.env.BOT_PHONE_NUMBER || '',
    ADMIN_PHONE_NUMBER: process.env.ADMIN_PHONE_NUMBER || '',
};

// Basic validation for critical variables (can be expanded later)
if (env.NODE_ENV === 'production') {
    if (!env.ADMIN_PHONE_NUMBER) {
        console.warn('⚠️ WARNING: ADMIN_PHONE_NUMBER is not set. Fallback notifications will not work.');
    }
}
