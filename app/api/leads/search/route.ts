import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { deduplicateResults, scrapeBoard, type JobResult } from '@/lib/leads/scrapers';

interface SearchRequestBody {
  country_code?: string;
  board_slugs?: string[];
  job_title?: string;
  remote_only?: boolean;
}

// Generate title variations: "full stack" → ["full stack", "full-stack", "fullstack"]
function getTitleVariations(title: string): string[] {
  const base = title.trim().toLowerCase();
  const variations = new Set<string>([base]);
  // hyphenated ↔ spaced ↔ joined
  variations.add(base.replace(/\s+/g, '-'));
  variations.add(base.replace(/[-\s]+/g, ''));
  variations.add(base.replace(/-/g, ' '));
  // common abbreviations
  const abbrevMap: Record<string, string[]> = {
    'frontend': ['front end', 'front-end'],
    'front end': ['frontend', 'front-end'],
    'front-end': ['frontend', 'front end'],
    'backend': ['back end', 'back-end'],
    'back end': ['backend', 'back-end'],
    'back-end': ['backend', 'back end'],
    'fullstack': ['full stack', 'full-stack'],
    'full stack': ['fullstack', 'full-stack'],
    'full-stack': ['fullstack', 'full stack'],
    'devops': ['dev ops', 'dev-ops'],
    'ml': ['machine learning'],
    'ai': ['artificial intelligence'],
  };
  if (abbrevMap[base]) abbrevMap[base].forEach(v => variations.add(v));
  return Array.from(variations);
}

function isRemoteResult(result: JobResult): boolean {
  const loc = (result.location || '').toLowerCase();
  const title = (result.job_title || '').toLowerCase();
  const raw = JSON.stringify(result.raw_data || '').toLowerCase();
  return loc.includes('remote') || title.includes('remote') || raw.includes('remote');
}

async function scrapeAdzuna(jobTitle: string, remoteOnly: boolean): Promise<JobResult[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    console.warn('[adzuna] API credentials not configured');
    return [];
  }

  const variations = getTitleVariations(jobTitle);
  const allResults: JobResult[] = [];

  for (const variant of variations.slice(0, 3)) { // max 3 variants to avoid rate limits
    try {
      const params = new URLSearchParams({
        app_id: appId,
        app_key: appKey,
        results_per_page: '50',
        what: variant,
        where: 'london',
        'content-type': 'application/json',
        ...(remoteOnly ? { title_only: '1' } : {}),
      });

      const url = `https://api.adzuna.com/v1/api/jobs/gb/search/1?${params}`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) continue;

      const data = await res.json();
      const jobs = data.results || [];

      for (const job of jobs) {
        const location = job.location?.display_name || 'London, UK';
        if (remoteOnly && !location.toLowerCase().includes('remote') && !job.title?.toLowerCase().includes('remote')) continue;

        allResults.push({
          board_slug: 'adzuna',
          job_title: job.title,
          company_name: job.company?.display_name || null,
          location,
          salary: job.salary_min ? `£${Math.round(job.salary_min).toLocaleString()} - £${Math.round(job.salary_max || job.salary_min).toLocaleString()}` : null,
          job_url: job.redirect_url || job.adref || '',
          raw_data: { source: 'adzuna', id: job.id, scraped_at: new Date().toISOString() },
        });
      }
    } catch (e: any) {
      console.error(`[adzuna] Error for variant "${variant}":`, e.message);
    }
  }

  return deduplicateResults(allResults);
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
    const remoteOnly = body.remote_only === true;

    if (!countryCode || boardSlugs.length === 0 || !jobTitle) {
      return NextResponse.json(
        { error: 'Missing required fields: country_code, board_slugs[], job_title' },
        { status: 400 }
      );
    }

    const titleVariations = getTitleVariations(jobTitle);

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
          // Career Crawler — query pre-crawled DB catalog
          if (slug === 'career-crawler') {
            let query = supabase
              .from('leads_results')
              .select('board_slug, job_title, company_name, location, salary, job_url, raw_data')
              .eq('board_slug', 'career-crawler');

            // Match any title variation
            const orFilter = titleVariations.map(v => `job_title.ilike.%${v}%`).join(',');
            query = query.or(orFilter);

            const { data: catalogRows, error: catalogError } = await query;
            if (catalogError) {
              console.error('[search] Catalog query failed:', catalogError.message);
              return { slug, results: [] as JobResult[] };
            }

            let mapped: JobResult[] = (catalogRows || []).map((r: any) => ({
              board_slug: r.board_slug,
              job_title: r.job_title,
              company_name: r.company_name,
              location: r.location,
              salary: r.salary,
              job_url: r.job_url,
              raw_data: r.raw_data,
            }));

            if (remoteOnly) mapped = mapped.filter(isRemoteResult);
            return { slug, results: mapped };
          }

          // Adzuna — dedicated API scraper
          if (slug === 'adzuna') {
            const results = await scrapeAdzuna(jobTitle, remoteOnly);
            return { slug, results };
          }

          // All other boards — use scraper with primary title
          let results = await scrapeBoard(slug, jobTitle);

          // Also scrape with variations and merge
          for (const variant of titleVariations.slice(1, 2)) {
            try {
              const extra = await scrapeBoard(slug, variant);
              results = deduplicateResults([...results, ...extra]);
            } catch { /* ignore variant failures */ }
          }

          if (remoteOnly) results = results.filter(isRemoteResult);
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

    const { error: updateError } = await supabase
      .from('leads_searches')
      .update({
        status: 'complete',
        total_results: combinedResults.length,
        completed_at: new Date().toISOString(),
      })
      .eq('id', searchId);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      search_id: searchId,
      total_results: combinedResults.length,
      boards_completed: scrapeResults.length,
    }, { status: 200 });

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
