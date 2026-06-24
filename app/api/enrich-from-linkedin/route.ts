import { NextRequest, NextResponse } from 'next/server';

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || '';
const CF_API_TOKEN  = process.env.CF_API_TOKEN  || '';

type Platform = 'linkedin' | 'github' | 'behance';

function detectPlatform(url: string): Platform | null {
  if (url.includes('linkedin.com/in/')) return 'linkedin';
  if (url.includes('github.com/'))      return 'github';
  if (url.includes('behance.net/'))     return 'behance';
  return null;
}

// ─── Cloudflare Browser Rendering — LinkedIn only ────────────────────────────
// LinkedIn blocks direct fetch; CF headless browser gets around it.

const LINKEDIN_PROMPT = `Extract the following fields from this LinkedIn profile page. Return ONLY valid JSON, no extra text.

Fields to extract:
- full_name: string — the person's full name
- title: string — their current job title
- location: string — their location (city, country)
- company: string — their current employer
- years_experience_total: number — estimated total years of professional experience (integer, 0 if unknown)
- summary: string — their LinkedIn about/summary section (max 500 chars), or empty string if not present
- skills: array of strings — up to 10 key skills listed on the profile
- work_history: array of objects with { title, company, years } — up to 5 most recent roles

Rules:
- If a field is not visible or the profile is private, use null for strings and 0 for numbers.
- Do not fabricate data. Only extract what is explicitly on the page.
- Return valid JSON only.`;

const CF_SCHEMA = {
  type: 'object',
  properties: {
    full_name:              { type: 'string' },
    title:                  { type: 'string' },
    location:               { type: 'string' },
    company:                { type: 'string' },
    years_experience_total: { type: 'number' },
    summary:                { type: 'string' },
    skills:                 { type: 'array', items: { type: 'string' } },
    work_history: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title:   { type: 'string' },
          company: { type: 'string' },
          years:   { type: 'number' },
        },
      },
    },
  },
};

async function enrichLinkedIn(url: string) {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    throw new Error('Cloudflare credentials not configured.');
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/browser-rendering/json`;

  const cfRes = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      prompt: LINKEDIN_PROMPT,
      response_format: {
        type: 'json_schema',
        schema: CF_SCHEMA,
      },
      gotoOptions: {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      },
      waitForTimeout: 2500,
    }),
  });

  const cfData = await cfRes.json();

  if (!cfRes.ok || !cfData.success) {
    console.error('[enrich] CF error:', JSON.stringify(cfData));
    const msg = cfData?.errors?.[0]?.message || cfData?.error || JSON.stringify(cfData);
    throw new Error(`Cloudflare extraction failed: ${msg}`);
  }

  return cfData.result;
}

// ─── Direct fetch — GitHub ────────────────────────────────────────────────────
// GitHub profile pages are public HTML. We extract what's available via regex.

async function enrichGitHub(url: string) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LNKDREC/1.0)',
      Accept: 'text/html',
    },
  });

  if (!res.ok) throw new Error(`GitHub fetch failed: ${res.status}`);

  const html = await res.text();

  // Display name (itemprop="name" or og:title)
  const nameMatch =
    html.match(/<span\s+itemprop="name"[^>]*>\s*([^<]+)\s*<\/span>/i) ||
    html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
  const full_name = nameMatch?.[1]?.trim() || '';

  // Bio
  const bioMatch =
    html.match(/<div\s+class="[^"]*p-note[^"]*"[^>]*>\s*<div[^>]*>([\s\S]*?)<\/div>/i) ||
    html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
  const summary = bioMatch?.[1]
    ? bioMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 300)
    : '';

  // Location
  const locMatch = html.match(/<span\s+itemprop="homeLocation"[^>]*>\s*([^<]+)\s*<\/span>/i);
  const location = locMatch?.[1]?.trim() || '';

  // Company
  const companyMatch = html.match(/<span\s+itemprop="worksFor"[^>]*>\s*([^<]+)\s*<\/span>/i);
  const company = companyMatch?.[1]?.trim().replace(/^@/, '') || '';

  // Top languages from pinned repos section (best effort)
  const langMatches = [...html.matchAll(/itemprop="programmingLanguage"[^>]*>([^<]+)</gi)];
  const skills = [...new Set(langMatches.map(m => m[1].trim()))].slice(0, 10);

  return { full_name, title: summary.split('\n')[0] || '', location, company, summary, skills, work_history: [], years_experience_total: 0 };
}

// ─── Direct fetch — Behance ───────────────────────────────────────────────────
// Behance profile pages are public. Extract name, bio, location, tools.

async function enrichBehance(url: string) {
  // Behance renders mostly server-side HTML; fetch the profile page directly.
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LNKDREC/1.0)',
      Accept: 'text/html',
    },
  });

  if (!res.ok) throw new Error(`Behance fetch failed: ${res.status}`);

  const html = await res.text();

  // og:title usually contains "Name on Behance"
  const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)?.[1] || '';
  const full_name = ogTitle.replace(/\s+on Behance\s*$/i, '').trim();

  // og:description — often their bio
  const ogDesc = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i)?.[1] || '';
  const summary = ogDesc.slice(0, 300);

  // Location (various Behance markup patterns)
  const locMatch =
    html.match(/"location"\s*:\s*"([^"]+)"/i) ||
    html.match(/class="[^"]*UserInfo-location[^"]*"[^>]*>([^<]+)</i);
  const location = locMatch?.[1]?.trim() || '';

  // Creative field / title
  const fieldMatch =
    html.match(/"creative_field"\s*:\s*"([^"]+)"/i) ||
    html.match(/class="[^"]*UserInfo-field[^"]*"[^>]*>([^<]+)</i);
  const title = fieldMatch?.[1]?.trim() || '';

  // Tools / skills from JSON-LD or data attributes
  const toolMatches = [...html.matchAll(/"tool_name"\s*:\s*"([^"]+)"/gi)];
  const skills = [...new Set(toolMatches.map(m => m[1].trim()))].slice(0, 10);

  return { full_name, title, location, company: '', summary, skills, work_history: [], years_experience_total: 0 };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { linkedin_url, portfolio_url } = await req.json();

    const url      = linkedin_url?.trim() || portfolio_url?.trim() || '';
    const platform = detectPlatform(url);

    if (!url || !platform) {
      return NextResponse.json(
        { error: 'Provide a valid LinkedIn, GitHub, or Behance URL.' },
        { status: 400 }
      );
    }

    let raw: Record<string, any>;

    if (platform === 'linkedin') {
      raw = await enrichLinkedIn(url);
    } else if (platform === 'github') {
      raw = await enrichGitHub(url);
    } else {
      raw = await enrichBehance(url);
    }

    if (!raw?.full_name && !raw?.title && !raw?.summary) {
      return NextResponse.json(
        { error: 'Profile appears to be private or no data was extractable.' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      platform,
      profile: {
        full_name:              raw.full_name              || '',
        title:                  raw.title                  || '',
        location:               raw.location               || '',
        company:                raw.company                || '',
        years_experience_total: raw.years_experience_total || 0,
        summary:                raw.summary                || '',
        skills:                 Array.isArray(raw.skills)       ? raw.skills.slice(0, 10)      : [],
        work_history:           Array.isArray(raw.work_history) ? raw.work_history.slice(0, 5) : [],
      },
    });
  } catch (err: any) {
    console.error('[enrich-from-linkedin] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
