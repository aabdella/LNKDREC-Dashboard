import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function getSupabaseClient() {
  const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is required.');
  }
  return createClient(supabaseUrl, supabaseKey);
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await req.json();
    let candidates = body;

    if (!Array.isArray(body)) {
      candidates = [body];
    }

    if (candidates.length === 0) {
      return NextResponse.json({ error: 'No candidates provided' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('candidates')
      .upsert(candidates, { onConflict: 'email' })
      .select();

    if (error) {
      console.error('Supabase Error:', error);
      throw error;
    }

    return NextResponse.json({ success: true, count: data?.length || 0 });
  } catch (error: any) {
    console.error('Batch ingest error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
