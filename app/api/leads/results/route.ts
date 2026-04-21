import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const searchId = searchParams.get('search_id');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!searchId) {
      return NextResponse.json({ error: 'Missing search_id query parameter' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Get search metadata
    const { data: searchMeta, error: metaError } = await supabase
      .from('leads_searches')
      .select('*')
      .eq('id', searchId)
      .maybeSingle();

    if (metaError || !searchMeta) {
      return NextResponse.json({ success: false, error: 'Search not found' }, { status: 404 });
    }

    // Get paginated results
    const { data: results, error: resultsError, count } = await supabase
      .from('leads_results')
      .select('*', { count: 'exact' })
      .eq('search_id', searchId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (resultsError) {
      console.error('[results] Query error:', resultsError);
      return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 });
    }

    // Map DB fields to frontend field names
    const mappedResults = (results || []).map((r: any) => ({
      board: r.board_slug,
      job_title: r.job_title,
      company: r.company_name,
      location: r.location,
      salary: r.salary,
      url: r.job_url,
      raw_data: r.raw_data,
      created_at: r.created_at,
    }));

    return NextResponse.json({
      success: true,
      status: searchMeta.status,
      search: searchMeta,
      results: mappedResults,
      total: count || 0,
      limit,
      offset,
    }, { status: 200 });
  } catch (err) {
    console.error('[results] Unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}