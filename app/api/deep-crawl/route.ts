import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractJobTitle } from '@/lib/extractJobTitle';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY || '';
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || '';
const CF_API_TOKEN = process.env.CF_API_TOKEN || '';

const MAX_TARGETS = 10;
// Max parallel CF requests — avoids hammering the API
const CF_CONCURRENCY = 3;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractTargetMarket(jd: string): string {
  const lower = jd.toLowerCase();
  if (lower.includes('saudi')) return 'Saudi';
  if (lower.includes('gcc')) return 'GCC';
  if (lower.includes('uae')) return 'UAE';
  if (lower.includes('egypt')) return 'Egypt';
  return '';
}

function isLikelyCandidateProfile(rawUrl: string): boolean {
  const url = rawUrl.toLowerCase();
  if (url.includes('linkedin.com/in/')) return true;
  if (!url.includes('behance.net/')) return false;
  const blocked = ['/search', '/projects', '/joblist', '/assets', '/hire/', '/services/'];
  return !blocked.some((part) => url.includes(part));
}

/** "ahmed-hassan-123abc" → "Ahmed Hassan" */
function nameFromSlug(url: string): string {
  const m = url.match(/linkedin\.com\/in\/([a-zA-Z0-9-]+)/);
  if (!m) return '';
  return m[1]
    .split('-')
    .filter(p => !/^[0-9a-f]{4,}$/i.test(p)) // strip numeric/hex suffixes
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
    .trim();
}

/** "Ahmed Hassan - Senior Engineer at Vodafone | LinkedIn" → { name, title } */
function parseFromBraveTitle(t: string): { name: string; title: string } {
  // Strip trailing "| LinkedIn", "| Behance" etc.
  const cleaned = t.replace(/\s*[|–-]\s*(LinkedIn|Behance|Wuzzuf|Bayt).*$/i, '').trim();
  // "Name - Title at Company" or "Name - Title"
  const dash = cleaned.indexOf(' - ');
  if (dash > 0) {
    const name = cleaned.substring(0, dash).trim();
    const rest = cleaned.substring(dash + 3);
    const title = rest.split(/ at | @ /i)[0].trim();
    return { name, title };
  }
  // "Name | Title" fallback
  const pipe = cleaned.indexOf(' | ');
  if (pipe > 0) {
    return { name: cleaned.substring(0, pipe).trim(), title: cleaned.substring(pipe + 3).trim() };
  }
  return { name: cleaned.substring(0, 60).trim(), title: '' };
}

// ─── Cloudflare Browser Rendering ────────────────────────────────────────────

async function cfExtract(url: string, jd: string, targetMarket: string) {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/browser-rendering/json`;
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      prompt: `Analyze this candidate profile against this JD: "${jd.substring(0, 1200)}".
Extract these fields:
- full_name
- title
- location
- match_reason
- match_score
Rules:
- Prefer evidence from the profile bio/about/resume/project context.
- If a target market is mentioned in the JD, check for matching market experience. Target market: ${targetMarket || 'not specified'}.
- Mention AI tools only if actually evidenced.
- Score 70+ only for clearly relevant candidates.
- Score below 40 for weak or unrelated profiles.`,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'candidate',
          properties: {
            full_name: { type: 'string' },
            title: { type: 'string' },
            location: { type: 'string' },
            match_reason: { type: 'string' },
            match_score: { type: 'number' },
          },
        },
      },
    }),
  });

  const data = await resp.json();
  if (!resp.ok || !data.success) return { ok: false, error: data };
  return { ok: true, result: data.result };
}

/** Run cfExtract in parallel with a concurrency cap */
async function parallelExtract(
  urls: string[],
  jd: string,
  targetMarket: string,
  concurrency: number
): Promise<Array<{ url: string; result: Awaited<ReturnType<typeof cfExtract>> }>> {
  const results: Array<{ url: string; result: Awaited<ReturnType<typeof cfExtract>> }> = [];
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (url) => ({ url, result: await cfExtract(url, jd, targetMarket) }))
    );
    results.push(...batchResults);
  }
  return results;
}

// ─── Brave Search ─────────────────────────────────────────────────────────────

async function searchProfiles(query: string) {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=20`;
  const resp = await fetch(url, {
    headers: { 'X-Subscription-Token': BRAVE_API_KEY, Accept: 'application/json' },
  });
  const data = await resp.json();
  const rawResults = data.web?.results || [];
  const rawUrls = rawResults.map((r: any) => ({ title: r.title, url: r.url, description: r.description || '' }));
  const filteredUrls = rawUrls.filter((r: any) => isLikelyCandidateProfile(r.url));
  return { query, status: resp.status, rawCount: rawResults.length, rawUrls, filteredUrls };
}

// ─── Query Builder ────────────────────────────────────────────────────────────

function buildQueries(titleLine: string, parsedTitle: string, targetMarket: string, isCreative: boolean): string[] {
  const queries: string[] = [];

  // Title variations — handle common alternate phrasings
  const titleVariants: string[] = [titleLine];
  const tl = titleLine.toLowerCase();

  if (tl.includes('data engineer')) titleVariants.push('Analytics Engineer');
  if (tl.includes('software engineer')) titleVariants.push('Software Developer');
  if (tl.includes('frontend') || tl.includes('front-end')) titleVariants.push('Front End Developer');
  if (tl.includes('backend') || tl.includes('back-end')) titleVariants.push('Back End Developer');
  if (tl.includes('machine learning')) titleVariants.push('ML Engineer');
  if (tl.includes('devops')) titleVariants.push('Platform Engineer');
  if (tl.includes('product manager')) titleVariants.push('Product Owner');
  if (tl.includes('ui') || tl.includes('ux')) titleVariants.push('Product Designer');

  // For each title variant, build location-anchored queries
  for (const variant of titleVariants.slice(0, 2)) {
    // Quoted exact match + Egypt
    queries.push(`site:linkedin.com/in "${variant}" Egypt`);
    // City-level
    queries.push(`site:linkedin.com/in "${variant}" Cairo`);
    // With market signal if present
    if (targetMarket && targetMarket !== 'Egypt') {
      queries.push(`site:linkedin.com/in "${variant}" Egypt ${targetMarket}`);
    }
  }

  // Unquoted broader sweep for the primary title
  queries.push(`site:linkedin.com/in ${titleLine} Egypt`);

  // Alexandria — second largest city, often missed
  queries.push(`site:linkedin.com/in "${titleLine}" Alexandria Egypt`);

  // Behance only for creative roles
  if (isCreative) {
    queries.push(`site:behance.net ${titleLine} Egypt`);
  }

  // Dedupe and cap
  return [...new Set(queries.filter(q => q.trim()))].slice(0, 8);
}

// ─── Deduplication against existing unvetted records ─────────────────────────

async function getExistingUrls(urls: string[]): Promise<Set<string>> {
  const linkedinUrls = urls.filter(u => u.includes('linkedin.com'));
  const behanceUrls = urls.filter(u => u.includes('behance.net'));
  const existing = new Set<string>();

  if (linkedinUrls.length > 0) {
    const { data } = await supabase
      .from('unvetted')
      .select('linkedin_url')
      .in('linkedin_url', linkedinUrls);
    (data || []).forEach((r: any) => r.linkedin_url && existing.add(r.linkedin_url));
  }
  if (behanceUrls.length > 0) {
    const { data } = await supabase
      .from('unvetted')
      .select('portfolio_url')
      .in('portfolio_url', behanceUrls);
    (data || []).forEach((r: any) => r.portfolio_url && existing.add(r.portfolio_url));
  }
  return existing;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { jd } = await req.json();
    if (!jd) return NextResponse.json({ error: 'JD required' }, { status: 400 });

    const { title: parsedTitle, techFallback } = extractJobTitle(jd);
    const titleLine = (parsedTitle || techFallback.slice(0, 2).join(' ') || jd.split('\n').find((l: string) => l.trim().length > 5) || 'Professional')
      .replace(/[()&]/g, ' ')
      .replace(/[ ]+/g, ' ')
      .trim();

    const targetMarket = extractTargetMarket(jd);
    const isCreative = /designer|art.?director|creative|illustrat|visual|motion|graphic/i.test(parsedTitle);

    console.log(`🦞 [Deep Search] title="${titleLine}" | creative=${isCreative} | market=${targetMarket || 'none'}`);

    // ── Discovery ──────────────────────────────────────────────────────────
    const uniqueQueries = buildQueries(titleLine, parsedTitle, targetMarket, isCreative);
    const discoveryRuns = await Promise.all(uniqueQueries.map(searchProfiles));

    // Collect all discovered URLs, dedupe, preserve Brave snippet metadata
    const braveSnippetMap: Record<string, { title: string; description: string }> = {};
    const seenUrls = new Set<string>();
    const discovered: string[] = [];

    for (const run of discoveryRuns) {
      for (const r of (run.rawUrls || [])) {
        if (r.url) braveSnippetMap[r.url] = { title: r.title || '', description: r.description || '' };
      }
      for (const r of (run.filteredUrls || [])) {
        if (!seenUrls.has(r.url)) {
          seenUrls.add(r.url);
          discovered.push(r.url);
        }
      }
    }

    console.log(`🦞 [Deep Search] Discovered ${discovered.length} unique profile URLs`);

    if (discovered.length === 0) {
      return NextResponse.json({
        success: true,
        sourced: 0,
        debug: { mode: 'no-hits', parsedTitle, titleLine, targetMarket, queries: uniqueQueries, discoveryRuns, discovered: [] },
      });
    }

    // ── Cross-run deduplication against existing unvetted records ──────────
    const existingUrls = await getExistingUrls(discovered);
    const freshUrls = discovered.filter(u => !existingUrls.has(u));
    console.log(`🦞 [Deep Search] ${freshUrls.length} fresh URLs after dedup (${existingUrls.size} already in DB)`);

    const targets = freshUrls.slice(0, MAX_TARGETS);

    if (targets.length === 0) {
      return NextResponse.json({
        success: true,
        sourced: 0,
        debug: { mode: 'all-duplicates', parsedTitle, titleLine, targetMarket, queries: uniqueQueries, discoveryRuns, discovered, targets: [] },
      });
    }

    // ── Parallel extraction ────────────────────────────────────────────────
    console.log(`🦞 [Deep Search] Extracting ${targets.length} profiles (concurrency=${CF_CONCURRENCY})`);
    const extractionResults = await parallelExtract(targets, jd, targetMarket, CF_CONCURRENCY);

    // ── Process results ────────────────────────────────────────────────────
    const extracted: any[] = [];
    const failed: any[] = [];
    const toInsert: any[] = [];
    // In-run dedupe by name (across parallel results)
    const insertedNames = new Set<string>();

    for (const { url: targetUrl, result: item } of extractionResults) {
      const braveData = braveSnippetMap[targetUrl] || { title: '', description: '' };

      // ── Smarter fallback: slug first, then Brave title ─────────────────
      const slugName = nameFromSlug(targetUrl);
      const braveNameTitle = parseFromBraveTitle(braveData.title);

      let candidateData: { full_name: string; title: string; location: string; match_reason: string; match_score: number; source: string };

      if (item.ok && item.result?.full_name) {
        // CF succeeded
        const res = item.result;
        // Fill any missing fields from fallback chain
        if (!res.title) res.title = braveNameTitle.title || titleLine;
        if (!res.location) res.location = 'Egypt';
        if (!res.match_reason) res.match_reason = `Discovered via Deep Search for "${titleLine}".`;
        if (!res.match_score) res.match_score = 50;
        candidateData = { ...res, source: 'Deep Sourced' };
      } else {
        // CF failed or returned no name — use fallback chain
        const fallbackName = braveNameTitle.name || slugName;
        if (!fallbackName) {
          failed.push({ url: targetUrl, phase: item.ok ? 'validation' : 'extract', error: item.ok ? 'Missing full_name' : item.error });
          continue;
        }
        console.log(`🦞 [Deep Search] CF fallback for ${targetUrl}: "${fallbackName}"`);
        candidateData = {
          full_name: fallbackName,
          title: braveNameTitle.title || titleLine,
          location: 'Egypt',
          match_score: 40,
          match_reason: `Discovered via Deep Search for "${titleLine}". Profile extraction was limited — review LinkedIn profile directly.`,
          source: 'Deep Sourced',
        };
      }

      // In-run name dedupe
      const nameKey = candidateData.full_name.toLowerCase().trim();
      if (insertedNames.has(nameKey)) continue;
      insertedNames.add(nameKey);

      extracted.push({ url: targetUrl, candidate: candidateData });
      toInsert.push({
        full_name: candidateData.full_name,
        title: candidateData.title,
        location: candidateData.location,
        match_score: candidateData.match_score,
        match_reason: candidateData.match_reason,
        linkedin_url: targetUrl.includes('linkedin.com') ? targetUrl : null,
        portfolio_url: targetUrl.includes('behance.net') ? targetUrl : null,
        source: candidateData.source,
        status: 'Unvetted',
        years_experience_total: 0,
        email: null,
        phone: null,
        resume_url: null,
        resume_text: null,
        uploaded_at: new Date().toISOString(),
      });
    }

    // ── Insert ─────────────────────────────────────────────────────────────
    let insertResult = null;
    if (toInsert.length > 0) {
      insertResult = await supabase.from('unvetted').insert(toInsert).select();
    }

    return NextResponse.json({
      success: true,
      sourced: toInsert.length,
      debug: {
        mode: 'production',
        parsedTitle,
        titleLine,
        targetMarket,
        queries: uniqueQueries,
        discoveryRuns,
        discovered,
        freshUrls,
        targets,
        extractedCount: extracted.length,
        extracted,
        failedCount: failed.length,
        failed,
        insertResult,
      },
    });
  } catch (err: any) {
    console.error('Deep Search Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
