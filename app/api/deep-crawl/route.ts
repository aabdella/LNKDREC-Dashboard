import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://clrzajerliyyddfyvggd.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const BRAVE_API_KEY = 'REDACTED_BRAVE_API_KEY';
const CF_ACCOUNT_ID = '51aee885fbff69595ec806189f5de591';
const CF_API_TOKEN = 'L4a0dJChoKZGpChtCcIJAWMQjLcbLAtyiuD7yGs4';

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

    const titleLine = jd
      .split('\n')[0]
      .replace(/[()&]/g, ' ')
      .replace(/[ ]+/g, ' ')
      .trim();

    const targetMarket = extractTargetMarket(jd);

    console.log(`🦞 [Deep Search] Discovering profiles for: ${titleLine}`);

    const queries = [
      `site:behance.net ${titleLine} Egypt`,
      `site:behance.net ${titleLine} ${targetMarket} Egypt`,
      `site:linkedin.com/in ${titleLine} Egypt ${targetMarket}`,
    ].filter((q, i, arr) => q.trim() && arr.indexOf(q) === i);

    const discoveryRuns = await Promise.all(queries.map(searchProfiles));
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
          titleLine,
          targetMarket,
          queries,
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

    for (let i = 0; i < extractionResults.length; i++) {
      const item = extractionResults[i];
      const targetUrl = targets[i];

      if (!item.ok) {
        failed.push({ url: targetUrl, phase: 'extract', error: item.error });
        continue;
      }

      const res = item.result;
      if (!res.full_name) {
        failed.push({ url: targetUrl, phase: 'validation', error: 'Missing full_name' });
        continue;
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
        titleLine,
        targetMarket,
        queries,
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
