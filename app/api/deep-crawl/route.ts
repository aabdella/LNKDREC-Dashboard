import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseJD, SKILL_RARITY } from '@/lib/parseJD';

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

/** Build deep-search queries from ParsedJD — 6 genuinely different strategies */
function buildDeepQueries(parsed: ReturnType<typeof parseJD>, isCreative: boolean): string[] {
  const { role_title, title_variants, must_have_skills, seniority_prefix, location, search_hints } = parsed;
  const loc = location || 'Egypt';

  const primaryTitle = (seniority_prefix && !role_title.toLowerCase().startsWith(seniority_prefix.toLowerCase()))
    ? `${seniority_prefix} ${role_title}`
    : role_title;

  const allTitles = [primaryTitle, ...title_variants].slice(0, 3);
  const nicheTerm    = search_hints.niche_terms[0] || null;
  const nicheTerm2   = search_hints.niche_terms[1] || null;
  const domainSkill  = search_hints.must_include[0] || must_have_skills[0] || null;
  const domainSkill2 = search_hints.must_include[1] || must_have_skills[1] || null;
  const company      = search_hints.company_targets[0] || null;
  const roleConcept  = search_hints.role_concept !== primaryTitle ? search_hints.role_concept : null;

  const queries: string[] = [];

  // Strategy 1: Exact quoted title + location (precision baseline)
  queries.push(`site:linkedin.com/in "${allTitles[0]}" ${loc}`);

  // Strategy 2: Niche tool anchor — find people who list the specific platform
  // e.g. site:linkedin.com/in "Talkwalker" Egypt — catches profiles mentioning the tool
  if (nicheTerm) queries.push(`site:linkedin.com/in "${nicheTerm}" ${loc}`);
  else if (domainSkill) queries.push(`site:linkedin.com/in "${allTitles[0]}" "${domainSkill}" ${loc}`);

  // Strategy 3: Industry-aware compound concept (unquoted for broader recall)
  // e.g. site:linkedin.com/in Media Analytics Engineer Egypt
  if (roleConcept) queries.push(`site:linkedin.com/in ${roleConcept} ${loc}`);
  else if (domainSkill) queries.push(`site:linkedin.com/in "${allTitles[0]}" ${domainSkill} ${loc}`);

  // Strategy 4: Title variant + domain skill
  if (allTitles[1] && (nicheTerm || domainSkill)) {
    queries.push(`site:linkedin.com/in "${allTitles[1]}" ${nicheTerm || domainSkill} ${loc}`);
  } else if (allTitles[1]) {
    queries.push(`site:linkedin.com/in "${allTitles[1]}" ${loc}`);
  }

  // Strategy 5: Company-targeted search
  // e.g. site:linkedin.com/in "Data Engineer" Vodafone Egypt
  if (company) queries.push(`site:linkedin.com/in "${allTitles[0]}" ${company} ${loc}`);
  else if (nicheTerm2) queries.push(`site:linkedin.com/in "${nicheTerm2}" ${loc}`);
  else if (domainSkill2) queries.push(`site:linkedin.com/in "${allTitles[0]}" ${domainSkill2} ${loc}`);

  // Strategy 6: Second title variant or Cairo city-level
  if (allTitles[2]) queries.push(`site:linkedin.com/in "${allTitles[2]}" ${loc}`);
  else if (nicheTerm) queries.push(`site:linkedin.com/in "${nicheTerm}" Cairo`);
  else queries.push(`site:linkedin.com/in "${allTitles[0]}" Cairo`);

  // Strategy 7: Unquoted broad sweep for recall on lesser-known profiles
  queries.push(`site:linkedin.com/in ${allTitles[0]} ${loc}`);

  // Strategy 8: Behance for creative roles
  if (isCreative) queries.push(`site:behance.net ${allTitles[0]} Egypt`);

  return [...new Set(queries.filter(q => q.trim()))].slice(0, 8);
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

// ─── Deduplication against existing unvetted records ─────────────────────────

async function getExistingUrls(urls: string[]): Promise<Set<string>> {
  const supabase = getSupabaseClient();
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
    const supabase = getSupabaseClient();
    const { jd } = await req.json();
    if (!jd) return NextResponse.json({ error: 'JD required' }, { status: 400 });

    const parsed = parseJD(jd);
    const titleLine = parsed.seniority_prefix && !parsed.role_title.toLowerCase().startsWith(parsed.seniority_prefix.toLowerCase())
      ? `${parsed.seniority_prefix} ${parsed.role_title}`
      : parsed.role_title;
    const parsedTitle = parsed.role_title;
    const targetMarket = parsed.location || extractTargetMarket(jd);
    const isCreative = /designer|art.?director|creative|illustrat|visual|motion|graphic/i.test(parsedTitle);

    console.log(`🦞 [Deep Search] title="${titleLine}" | industry=${parsed.industry} | market=${targetMarket || 'none'} | variants=${parsed.title_variants.join(', ')}`);

    // ── Discovery ──────────────────────────────────────────────────────────
    const uniqueQueries = buildDeepQueries(parsed, isCreative);
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
        if (!res.title) res.title = braveNameTitle.title || titleLine;
        if (!res.location) res.location = 'Egypt';
        if (!res.match_reason) res.match_reason = `Discovered via Deep Search for "${titleLine}".`;
        // Normalize CF score into meaningful tiers:
        // CF returns raw 0-100; clamp to our tiers (70+ strong, 50-69 domain, 35-49 weak)
        if (!res.match_score) res.match_score = 50;
        else if (res.match_score >= 70) res.match_score = Math.min(res.match_score, 95);
        else if (res.match_score >= 50) res.match_score = Math.min(res.match_score, 69);
        else res.match_score = Math.max(res.match_score, 35);
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
          match_score: 35,  // fallback — title match only, no profile data
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
