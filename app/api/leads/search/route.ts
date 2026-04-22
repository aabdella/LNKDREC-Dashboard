import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { deduplicateResults, scrapeBoard, type JobResult } from '@/lib/leads/scrapers';

interface SearchRequestBody {
  country_code?: string;
  board_slugs?: string[];
  job_title?: string;
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  let searchId: string | null = null;

  try {
    const body = (await request.json()) as SearchRequestBody;
    const countryCode = body.country_code?.trim();
    const boardSlugs = Array.isArray(body.board_slugs)
      ? body.board_slugs.filter((slug): slug is string => typeof slug === 'string' && slug.trim().length > 0)
      : [];
    const jobTitle = body.job_title?.trim();

    if (!countryCode || boardSlugs.length === 0 || !jobTitle) {
      return NextResponse.json(
        { error: 'Missing required fields: country_code, board_slugs[], job_title' },
        { status: 400 }
      );
    }

    const { data: searchRecord, error: searchError } = await supabase
      .from('leads_searches')
      .insert({
        country_code: countryCode,
        job_title: jobTitle,
        boards_searched: boardSlugs,
        status: 'running',
      })
      .select('id')
      .single();

    if (searchError || !searchRecord) {
      console.error('[search] Failed to create search record:', searchError);
      return NextResponse.json({ error: 'Failed to initiate search' }, { status: 500 });
    }

    searchId = searchRecord.id;

    const scrapeResults = await Promise.all(
      boardSlugs.map(async (slug) => {
        try {
          if (slug === 'career-crawler') {
              console.log(`[search] Spawning Career Crawler for search: ${searchId}`);
              const { execSync } = require('child_process');
              try {
                  // Run crawler synchronously for this specific search and query
                  execSync(`node projects/LNKDREC/dashboard/scripts/career_crawler.js "${searchId}" "${jobTitle}"`, { stdio: 'inherit' });
                  
                  // Fetch the count of results inserted by the crawler for this search
                  const { count } = await supabase
                    .from('leads_results')
                    .select('*', { count: 'exact', head: true })
                    .eq('search_id', searchId)
                    .eq('board_slug', 'career-crawler');
                    
                  return { slug, results: Array(count || 0).fill({}) }; // Return dummy results to increment total count
              } catch (e: any) {
                  console.error(`[search] Career Crawler failed:`, e.message);
                  return { slug, results: [] };
              }
          }
          const results = await scrapeBoard(slug, jobTitle);
          return { slug, results };
        } catch (error) {
          console.error(`[search] Scraping failed for ${slug}:`, error);
          return { slug, results: [] as JobResult[] };
        }
      })
    );

    const combinedResults = deduplicateResults(scrapeResults.flatMap((entry) => entry.results));

    if (combinedResults.length > 0) {
      const rows = combinedResults.map((result) => ({
        search_id: searchId,
        board_slug: result.board_slug,
        job_title: result.job_title,
        company_name: result.company_name,
        location: result.location,
        salary: result.salary,
        job_url: result.job_url,
        raw_data: result.raw_data,
      }));

      const { error: insertError } = await supabase.from('leads_results').insert(rows);
      if (insertError) {
        console.error('[search] Failed to insert results:', insertError);
        throw insertError;
      }
    }

    const boardsCompleted = scrapeResults.length;
    const totalResults = combinedResults.length;

    const { error: updateError } = await supabase
      .from('leads_searches')
      .update({
        status: 'complete',
        total_results: totalResults,
        completed_at: new Date().toISOString(),
      })
      .eq('id', searchId);

    if (updateError) {
      console.error('[search] Failed to finalize search:', updateError);
      throw updateError;
    }

    return NextResponse.json(
      {
        success: true,
        search_id: searchId,
        total_results: totalResults,
        boards_completed: boardsCompleted,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[search] Unexpected error:', error);

    if (searchId) {
      await supabase
        .from('leads_searches')
        .update({ status: 'failed', completed_at: new Date().toISOString() })
        .eq('id', searchId);
    }

    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
