import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractJobTitle } from '@/lib/extractJobTitle';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY || '';
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || '';
const CF_API_TOKEN = process.env.CF_API_TOKEN || '';

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
  if (blocked.some((part) => url.includes(part))) return false;

  return true;
}

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

async function searchProfiles(query: string) {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=20`;
  const resp = await fetch(url, {
    headers: {
      'X-Subscription-Token': BRAVE_API_KEY,
      Accept: 'application/json',
    },
  });

  const data = await resp.json();
  const rawResults = data.web?.results || [];
  const rawUrls = rawResults.map((r: any) => ({ title: r.title, url: r.url }));
  const filteredUrls = rawUrls.filter((r: any) => isLikelyCandidateProfile(r.url));

  return {
    query,
    status: resp.status,
    rawCount: rawResults.length,
    rawUrls,
    filteredUrls,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { jd } = await req.json();
    if (!jd) return NextResponse.json({ error: 'JD required' }, { status: 400 });

    // DIAGNOSTIC REMOVED — env vars confirmed present
    const { title: parsedTitle, techFallback } = extractJobTitle(jd);
    const titleLine = (parsedTitle || techFallback.slice(0, 2).join(' ') || jd.split('\n').find((l: string) => l.trim().length > 5) || 'Professional')
      .replace(/[()&]/g, ' ')
      .replace(/[ ]+/g, ' ')
      .trim();

    const targetMarket = extractTargetMarket(jd);

    // Creative roles: Behance is relevant; non-creative: LinkedIn only
    const isCreative = /designer|art.?director|creative|illustrat|visual|motion|graphic/i.test(parsedTitle);

    console.log(`🦞 [Deep Search] Discovering profiles for: "${titleLine}" | creative=${isCreative} | market=${targetMarket || 'none'}`);

    // Build queries anchored on the parsed title — no hardcoded role names
    const queries: string[] = [];

    // LinkedIn always included
    queries.push(`site:linkedin.com/in "${titleLine}" Egypt`);
    if (targetMarket) {
      queries.push(`site:linkedin.com/in "${titleLine}" Egypt ${targetMarket}`);
    } else {
      queries.push(`site:linkedin.com/in ${titleLine} Cairo`);
    }

    // Behance only for creative roles
    if (isCreative) {
      queries.push(`site:behance.net ${titleLine} Egypt`);
    }

    // Dedupe identical queries
    const uniqueQueries = [...new Set(queries.filter(q => q.trim()))];
    const discoveryRuns = await Promise.all(uniqueQueries.map(searchProfiles));
    const discovered = Array.from(
      new Set(
        discoveryRuns.flatMap((run) => run.filteredUrls?.map((r: any) => r.url) || [])
      )
    );
    console.log(`🦞 [Deep Search] Found ${discovered.length} candidate URLs from ${discoveryRuns.length} runs.`);

    if (discovered.length === 0) {
      return NextResponse.json({
        success: true,
        sourced: 0,
        debug: {
          mode: 'production-no-hits',
          parsedTitle,
          titleLine,
          targetMarket,
          queries: uniqueQueries,
          discoveryRuns,
          discovered: [],
        },
      });
    }

    const targets = discovered.slice(0, 3); // Dropping to 3 to stay under limits
    const extractionResults: any[] = [];
    
    // Sequential extraction with a sleep delay to clear Cloudflare sessions
    for (const url of targets) {
      console.log(`🦞 [Deep Search] Extracting: ${url}`);
      const result = await cfExtract(url, jd, targetMarket);
      extractionResults.push(result);
      // Wait 2 seconds before next request
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const extracted: any[] = [];
    const failed: any[] = [];
    const toInsert: any[] = [];

    // Build a map of URL -> Brave snippet data for fallback
    const braveSnippetMap: Record<string, { title: string; description: string }> = {};
    for (const run of discoveryRuns) {
      for (const r of (run.rawUrls || [])) {
        if (r.url) braveSnippetMap[r.url] = { title: r.title || '', description: '' };
      }
    }

    for (let i = 0; i < extractionResults.length; i++) {
      const item = extractionResults[i];
      const targetUrl = targets[i];
      const braveData = braveSnippetMap[targetUrl] || { title: '', description: '' };

      // Helper: derive name from LinkedIn slug (e.g. "ahmed-hassan-123" -> "Ahmed Hassan")
      function nameFromSlug(url: string): string {
        const m = url.match(/linkedin\.com\/in\/([a-zA-Z0-9-]+)/);
        if (!m) return '';
        return m[1].split('-').filter(p => !/^[0-9]+$/.test(p)).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
      }

      // Helper: derive name+title from Brave title snippet
      function parseFromBraveTitle(t: string): { name: string; title: string } {
        const cleaned = t.replace(/[|].*LinkedIn.*$/i, '').trim();
        const dash = cleaned.indexOf(' - ');
        if (dash > 0) return { name: cleaned.substring(0, dash).trim(), title: cleaned.substring(dash + 3).split(' at ')[0].trim() };
        return { name: cleaned.substring(0, 60), title: '' };
      }

      if (!item.ok) {
        // CF failed — fall back to Brave snippet data
        const slugName = nameFromSlug(targetUrl);
        const braveNameTitle = parseFromBraveTitle(braveData.title);
        const fallbackName = braveNameTitle.name || slugName;
        if (!fallbackName) {
          failed.push({ url: targetUrl, phase: 'extract', error: item.error });
          continue;
        }
        console.log(`🦞 [Deep Search] CF failed for ${targetUrl}, using Brave fallback: ${fallbackName}`);
        extracted.push({ url: targetUrl, candidate: { full_name: fallbackName, title: braveNameTitle.title || titleLine, source: 'brave-fallback' } });
        toInsert.push({
          full_name: fallbackName,
          title: braveNameTitle.title || titleLine,
          location: 'Egypt',
          match_score: 40,
          match_reason: `Discovered via Deep Search for "${titleLine}". Profile extraction was limited — review LinkedIn profile directly.`,
          linkedin_url: targetUrl.includes('linkedin.com') ? targetUrl : null,
          portfolio_url: targetUrl.includes('behance.net') ? targetUrl : null,
          source: 'Deep Sourced',
          status: 'Unvetted'
        });
        continue;
      }

      const res = item.result;
      if (!res.full_name) {
        // CF returned but no name — try Brave fallback
        const slugName = nameFromSlug(targetUrl);
        const braveNameTitle = parseFromBraveTitle(braveData.title);
        const fallbackName = braveNameTitle.name || slugName;
        if (!fallbackName) {
          failed.push({ url: targetUrl, phase: 'validation', error: 'Missing full_name, no Brave fallback available' });
          continue;
        }
        console.log(`🦞 [Deep Search] CF returned no name for ${targetUrl}, using Brave fallback: ${fallbackName}`);
        res.full_name = fallbackName;
        if (!res.title) res.title = braveNameTitle.title || titleLine;
        if (!res.match_reason) res.match_reason = `Discovered via Deep Search for "${titleLine}". Limited profile data — review LinkedIn profile directly.`;
        if (!res.match_score) res.match_score = 40;
      }

      extracted.push({ url: targetUrl, candidate: res });

      toInsert.push({
        full_name: res.full_name,
        title: res.title || titleLine,
        location: res.location || 'Egypt',
        match_score: res.match_score || 0,
        match_reason: res.match_reason || '',
        linkedin_url: targetUrl.includes('linkedin.com') ? targetUrl : null,
        portfolio_url: targetUrl.includes('behance.net') ? targetUrl : null,
        source: 'Deep Sourced',
        status: 'Unvetted'
      });
    }

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
        targets,
        extractedCount: extracted.length,
        extracted,
        failedCount: failed.length,
        failed,
        insertResult
      },
    });
  } catch (err: any) {
    console.error('Deep Search Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
