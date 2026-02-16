
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Fail-safe init
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let candidates = body;
    
    // Handle single object or array
    if (!Array.isArray(body)) {
      candidates = [body];
    }

    if (candidates.length === 0) {
      return NextResponse.json({ error: 'No candidates provided' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('candidates')
      .upsert(candidates, { onConflict: 'email' }) // Assuming email is unique constraint
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
