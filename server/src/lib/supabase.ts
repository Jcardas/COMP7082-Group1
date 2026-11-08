import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

// Resolve the active key: prioritize service role on backend
const activeKey = config.supabase.serviceRoleKey || config.supabase.anonKey;

const isConfigured = Boolean(
  config.supabase.url &&
    activeKey &&
    !config.supabase.url.includes('your-project-id') &&
    !activeKey.includes('your-supabase-')
);

if (!isConfigured) {
  console.log(
    'ℹ️  [Supabase] Running in offline demo mode. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) in .env to enable cloud database & pgvector.'
  );
} else {
  console.log('✅ [Supabase] Connected using:', config.supabase.serviceRoleKey ? 'Service Role Key (bypasses RLS)' : 'Anon Key');
}

export const supabase = isConfigured
  ? createClient(config.supabase.url, activeKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;
