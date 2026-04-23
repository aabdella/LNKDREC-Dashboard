import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim() || '';
  const limit = parseInt(searchParams.get('limit') || '100', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  try {
    // Get last crawl time
    const { data: lastCrawl } = await supabase
      .from('leads_searches')
      .select('completed_at')
      .eq('boards_searched', JSON.stringify(['career-crawler']))
      .eq('status', 'complete')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let dbQuery = supabase
      .from('leads_results')
      .select('*', { count: 'exact' })
      .eq('board_slug', 'career-crawler')
      .order('created_at', { ascending: false });

    if (query) {
      dbQuery = dbQuery.ilike('job_title', `%${query}%`);
    }

    const { data: results, error, count } = await dbQuery.range(offset, offset + limit - 1);

    if (error) {
      console.error('[catalog] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch catalog' }, { status: 500 });
    }

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
      results: mappedResults,
      total: count || 0,
      last_crawled: lastCrawl?.completed_at || null,
      limit,
      offset,
    });
  } catch (err) {
    console.error('[catalog] Unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
