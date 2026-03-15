import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ─── Configuration ───────────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://clrzajerliyyddfyvggd.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const BRAVE_API_KEY = 'REDACTED_BRAVE_API_KEY';
const CF_ACCOUNT_ID = '51aee885fbff69595ec806189f5de591';
const CF_API_TOKEN = 'L4a0dJChoKZGpChtCcIJAWMQjLcbLAtyiuD7yGs4';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function cfExtract(url: string, jd: string) {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/browser-rendering/json`;
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url,
      prompt: `Analyze this candidate profile against this JD: "${jd.substring(0, 800)}". 
               Extract: full_name, professional title, location (in Egypt), match_reason (focus on AI tools and target markets like Saudi/GCC), and match_score (0-100).`,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "candidate",
          properties: {
            full_name: { type: "string" },
            title: { type: "string" },
            location: { type: "string" },
            match_reason: { type: "string" },
            match_score: { type: "number" }
          }
        }
      }
    })
  });
  const data = await resp.json();
  if (!resp.ok || !data.success) return null;
  return data.result;
}

async function searchProfiles(query: string) {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=15`;
  const resp = await fetch(url, {
    headers: { 'X-Subscription-Token': BRAVE_API_KEY, 'Accept': 'application/json' }
  });
  const data = await resp.json();
  return (data.web?.results || [])
    .map((r: any) => r.url)
    .filter((u: string) => 
      (u.includes('behance.net/') && u.split('/').length === 4) || 
      (u.includes('linkedin.com/in/'))
    );
}

// ─── Main Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { jd } = await req.json();
    if (!jd) return NextResponse.json({ error: 'JD required' }, { status: 400 });

    const titleLine = jd.split('\n')[0].replace(/[()&]/g, ' ').trim();
    
    // Step 1: Discovery (Brave API)
    console.log(`🦞 [Deep Source] Discovering profiles for: ${titleLine}`);
    const queries = [
      `site:behance.net "${titleLine}" Egypt`,
      `site:linkedin.com/in "${titleLine}" Egypt Saudi market`
    ];
    
    const profileUrls = Array.from(new Set((await Promise.all(queries.map(searchProfiles))).flat()));
    console.log(`🦞 [Deep Source] Found ${profileUrls.length} candidate URLs.`);

    if (profileUrls.length === 0) {
      return NextResponse.json({ success: true, sourced: 0, message: 'No profiles found during discovery.' });
    }

    // Step 2: Hydration (Cloudflare AI)
    // We process top 8 in parallel to stay within reasonable time/rate limits
    const targets = profileUrls.slice(0, 8);
    let sourcedCount = 0;

    const extractions = await Promise.all(targets.map(url => cfExtract(url, jd)));

    for (let i = 0; i < extractions.length; i++) {
      const c = extractions[i];
      if (c && c.full_name && c.match_score > 40) {
        await supabase.from('unvetted').insert({
          full_name: c.full_name,
          title: c.title || "Professional",
          location: c.location || "Egypt",
          portfolio_url: targets[i],
          source: 'Deep Source',
          match_score: c.match_score,
          match_reason: c.match_reason,
          status: 'New',
          uploaded_at: new Date().toISOString()
        });
        sourcedCount++;
      }
    }

    return NextResponse.json({ success: true, sourced: sourcedCount });

  } catch (err: any) {
    console.error('Deep Source Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
