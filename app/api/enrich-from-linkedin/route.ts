import { NextRequest, NextResponse } from 'next/server';

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || '';
const CF_API_TOKEN  = process.env.CF_API_TOKEN  || '';

export async function POST(req: NextRequest) {
  try {
    const { linkedin_url } = await req.json();

    if (!linkedin_url || !linkedin_url.includes('linkedin.com/in/')) {
      return NextResponse.json({ error: 'A valid LinkedIn profile URL is required.' }, { status: 400 });
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
        url: linkedin_url,
        prompt: `Extract the following fields from this LinkedIn profile page. Return ONLY valid JSON, no extra text.

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
- Return valid JSON only.`,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'linkedin_profile',
            properties: {
              full_name:              { type: 'string' },
              title:                  { type: 'string' },
              location:               { type: 'string' },
              company:                { type: 'string' },
              years_experience_total: { type: 'number' },
              summary:                { type: 'string' },
              skills:                 { type: 'array',  items: { type: 'string' } },
              work_history:           { type: 'array',  items: {
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
      return NextResponse.json(
        { error: 'Cloudflare extraction failed. The profile may be private or rate-limited.' },
        { status: 502 }
      );
    }

    const result = cfData.result;

    // Sanity check — if CF returned nothing useful, surface that
    if (!result?.full_name && !result?.title) {
      return NextResponse.json(
        { error: 'Profile appears to be private or no data was extractable.' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: {
        full_name:              result.full_name              || '',
        title:                  result.title                  || '',
        location:               result.location               || '',
        company:                result.company                || '',
        years_experience_total: result.years_experience_total || 0,
        summary:                result.summary                || '',
        skills:                 Array.isArray(result.skills) ? result.skills.slice(0, 10) : [],
        work_history:           Array.isArray(result.work_history) ? result.work_history.slice(0, 5) : [],
      },
    });
  } catch (err: any) {
    console.error('[enrich-from-linkedin] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
