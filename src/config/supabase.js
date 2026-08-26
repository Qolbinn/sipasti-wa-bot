import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

// Singleton instance untuk Supabase Client
// Menggunakan SERVICE_ROLE_KEY agar Bot memiliki akses penuh (bypass RLS) 
// untuk membaca/menulis data sistem secara background.
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
