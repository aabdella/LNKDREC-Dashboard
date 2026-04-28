import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number.parseInt(searchParams.get('limit') || '20', 10) || 20, 50);

  try {
    const { data: searches, error } = await supabase
      .from('leads_searches')
      .select(`
        id,
        country_code,
        job_title,
        status,
        total_results,
        boards_searched,
        created_at,
        completed_at,
        leads_results (
          id,
          board_slug,
          job_title,
          company_name,
          location,
          salary,
          job_url,
          created_at
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, searches: searches || [] });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load search history' },
      { status: 500 }
    );
  }
}
