import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ─── Supabase Configuration ──────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://clrzajerliyyddfyvggd.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Cloudflare Configuration ────────────────────────────────────────────────
const CF_ACCOUNT_ID = '51aee885fbff69595ec806189f5de591';
const CF_API_TOKEN = 'L4a0dJChoKZGpChtCcIJAWMQjLcbLAtyiuD7yGs4';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function cfRequest(method: string, path: string, body: any = null) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/browser-rendering/${path}`;
  const options: any = {
    method,
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };
  if (body) options.body = JSON.stringify(body);
  
  const resp = await fetch(url, options);
  const data = await resp.json();
  if (!resp.ok || !data.success) return { error: true, data: data.errors || data };
  return { error: false, result: data.result };
}

// ─── Main Post Handler ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { jd, limit = 5 } = await req.json();

    if (!jd || jd.length < 20) {
      return NextResponse.json({ error: 'Please provide a valid JD.' }, { status: 400 });
    }

    // 1. Identify Search URL (Heuristic)
    // For now we target Behance as it's the most high-value for Cloudflare deep crawls
    const titleLine = jd.split('\n')[0].replace(/[()&]/g, ' ').trim();
    const isCreative = /designer|graphic|art|creative|visual/i.test(jd);
    const searchUrl = isCreative 
       ? `https://www.behance.net/search/users?search=${encodeURIComponent(titleLine)}&country=EG`
       : `https://www.google.com/search?q=site:linkedin.com/in+${encodeURIComponent(titleLine)}+Egypt`;

    console.log(`🦞 [Deep Crawl] Initiating for cleaned query: ${titleLine}`);
    console.log(`🦞 [Deep Crawl] URL: ${searchUrl}`);

    // 2. Start Cloudflare Crawl
    const crawlRes = await cfRequest('POST', 'crawl', {
      url: searchUrl,
      limit: 10,
      depth: 1,
      formats: ["markdown"]
    });

    if (crawlRes.error) throw new Error(`Crawl failed: ${JSON.stringify(crawlRes.data)}`);
    const jobId = crawlRes.result;

    // 3. Poll for Completion (with timeout logic)
    let status = 'running';
    let jobResult: any = null;
    let attempts = 0;
    while (status === 'running' && attempts < 15) {
      await sleep(10000); // 10s wait
      const statusRes = await cfRequest('GET', `crawl/${jobId}?limit=1`);
      if (!statusRes.error) {
        status = statusRes.result.status;
        jobResult = statusRes.result;
      }
      attempts++;
    }

    if (status !== 'completed') {
      return NextResponse.json({ error: 'Deep crawl timed out. It might still be running in the background.' }, { status: 202 });
    }

    // 4. Fetch Full Records and Extract
    const recordsRes = await cfRequest('GET', `crawl/${jobId}?status=completed`);
    const records = recordsRes.result.records || [];
    let sourcedCount = 0;

    for (const record of records) {
       // Filter for profile pages only (broader regex for Behance localized domains)
       const isBehanceProfile = /behance\.net\/([^/]+)$/.test(record.url.split('?')[0]);
       if (!isBehanceProfile || record.url.includes('/search')) continue;

       // Use AI Extraction
       const extractRes = await cfRequest('POST', 'json', {
         url: record.url,
         prompt: `Extract full name, professional title, location in Egypt, and a match reason explaining their experience with AI tools and the Saudi/GCC market based on this JD: ${jd.substring(0, 1000)}`,
         response_format: {
           type: "json_schema",
           json_schema: {
             name: "c",
             properties: {
               full_name: { type: "string" },
               title: { type: "string" },
               location: { type: "string" },
               match_reason: { type: "string" },
               match_score: { type: "number" }
             }
           }
         }
       });

       if (!extractRes.error && extractRes.result) {
         const c = extractRes.result;
         await supabase.from('unvetted').insert({
            full_name: c.full_name,
            title: c.title || "Professional",
            location: c.location || "Egypt",
            portfolio_url: record.url,
            source: 'Cloudflare',
            match_score: c.match_score || 85,
            match_reason: c.match_reason || "Deep-crawled via Cloudflare AI.",
            status: 'New',
            uploaded_at: new Date().toISOString()
         });
         sourcedCount++;
       }
    }

    return NextResponse.json({ success: true, sourced: sourcedCount });

  } catch (err: any) {
    console.error('Deep Crawl Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
