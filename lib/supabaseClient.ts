
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://clrzajerliyyddfyvggd.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key-here'; // We'll need to inject the real key here or ensure it's in .env

export const supabase = createClient(supabaseUrl, supabaseKey);
