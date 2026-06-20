import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

let browserClient: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (browserClient) {
    return browserClient;
  }

  const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseKey = getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  browserClient = createClient(supabaseUrl, supabaseKey);
  return browserClient;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseClient();
    return Reflect.get(client as object, prop, receiver);
  },
});

export const getSupabaseAdmin = () => {
  const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
