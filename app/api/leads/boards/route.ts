import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const countryCode = searchParams.get('country') || 'GB';

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('leads_job_boards')
      .select('*')
      .eq('country_code', countryCode)
      .eq('is_active', true)
      .order('board_name', { ascending: true });

    if (error) {
      console.error('[boards] Supabase error:', error);
      return NextResponse.json({ success: false, error: 'Database query failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, boards: data || [] }, { status: 200 });
  } catch (err) {
    console.error('[boards] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}