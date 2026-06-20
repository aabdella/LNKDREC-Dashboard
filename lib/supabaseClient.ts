import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Lazy singleton — only initialised on first use (never at import/build time)
let _browserClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!_browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Supabase env vars are not set.');
    _browserClient = createClient(url, key);
  }
  return _browserClient;
}

// Named export used across the codebase — lazy, never throws at module load time
export const supabase = new Proxy({} as SupabaseClient, {
  get(_t, prop, receiver) {
    return Reflect.get(getSupabaseClient() as object, prop, receiver);
  },
});

// Server-side admin client (service role key, no singleton needed)
export const getSupabaseAdmin = (): SupabaseClient => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin env vars are not set.');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};
