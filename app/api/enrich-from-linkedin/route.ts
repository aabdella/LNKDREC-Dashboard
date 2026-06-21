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

function buildPrompt(platform: Platform): string {
  if (platform === 'linkedin') {
    return `Extract the following fields from this LinkedIn profile page. Return ONLY valid JSON, no extra text.

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
  }

  if (platform === 'github') {
    return `Extract the following fields from this GitHub profile page. Return ONLY valid JSON, no extra text.

Fields to extract:
- full_name: string — the person's display name (not username)
- title: string — their bio or headline
- location: string — their listed location
- company: string — their listed company or organisation
- years_experience_total: number — 0 (cannot determine from GitHub alone)
- summary: string — their bio (max 300 chars)
- skills: array of strings — programming languages and tools visible on the profile (up to 10)
- work_history: array — empty array []

Rules:
- Use the display name, not the @username.
- If a field is missing, use empty string or 0.
- Return valid JSON only.`;
  }

  // behance
  return `Extract the following fields from this Behance profile page. Return ONLY valid JSON, no extra text.

Fields to extract:
- full_name: string — the person's full name
- title: string — their listed creative role or specialisation
- location: string — their listed location
- company: string — empty string (usually not listed)
- years_experience_total: number — 0 (cannot determine from Behance alone)
- summary: string — their bio or about section (max 300 chars)
- skills: array of strings — creative tools and skills listed (up to 10, e.g. Figma, Illustrator, After Effects)
- work_history: array — empty array []

Rules:
- If a field is missing, use empty string or 0.
- Return valid JSON only.`;
}

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

    if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
      return NextResponse.json({ error: 'Cloudflare credentials not configured.' }, { status: 500 });
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
        prompt: buildPrompt(platform),
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'profile',
            properties: {
              full_name:              { type: 'string' },
              title:                  { type: 'string' },
              location:               { type: 'string' },
              company:                { type: 'string' },
              years_experience_total: { type: 'number' },
              summary:                { type: 'string' },
              skills:                 { type: 'array', items: { type: 'string' } },
              work_history:           { type: 'array', items: {
                type: 'object',
                properties: {
                  title:   { type: 'string' },
                  company: { type: 'string' },
                  years:   { type: 'number' },
                },
              }},
            },
          },
        },
      }),
    });

    const cfData = await cfRes.json();

    if (!cfRes.ok || !cfData.success) {
      console.error('[enrich-from-linkedin] CF error:', JSON.stringify(cfData));
      const cfErrorMsg = cfData?.errors?.[0]?.message || cfData?.error || JSON.stringify(cfData);
      return NextResponse.json(
        { error: `Cloudflare extraction failed: ${cfErrorMsg}` },
        { status: 502 }
      );
    }

    const result = cfData.result;

    if (!result?.full_name && !result?.title) {
      return NextResponse.json(
        { error: 'Profile appears to be private or no data was extractable.' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      platform,
      profile: {
        full_name:              result.full_name              || '',
        title:                  result.title                  || '',
        location:               result.location               || '',
        company:                result.company                || '',
        years_experience_total: result.years_experience_total || 0,
        summary:                result.summary                || '',
        skills:                 Array.isArray(result.skills)       ? result.skills.slice(0, 10)      : [],
        work_history:           Array.isArray(result.work_history) ? result.work_history.slice(0, 5) : [],
      },
    });
  } catch (err: any) {
    console.error('[enrich-from-linkedin] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

