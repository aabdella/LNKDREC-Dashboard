import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { candidates } = await req.json();

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return NextResponse.json({ error: 'No candidates provided' }, { status: 400 });
    }

    // Upsert batch (assuming LinkedIn URL is unique identifier if present)
    const { data, error } = await supabase
      .from('candidates')
      .upsert(candidates, { onConflict: 'linkedin_url' }) // Or email if preferred
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, count: data.length });

  } catch (error: any) {
    console.error('Batch ingest error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
