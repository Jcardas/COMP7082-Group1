import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

const isConfigured = Boolean(
  config.supabase.url &&
    config.supabase.anonKey &&
    !config.supabase.url.includes('your-project-id') &&
    !config.supabase.anonKey.includes('your-supabase-anon-key')
);

if (!isConfigured) {
  console.log(
    'ℹ️  [Supabase] Running in offline demo mode. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env to enable cloud database & pgvector.'
  );
}

export const supabase = isConfigured
  ? createClient(config.supabase.url, config.supabase.serviceRoleKey || config.supabase.anonKey)
  : null;
