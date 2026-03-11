import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

// ─── CONFIGURATION ───────────────────────────────────────────────────────────
const CF_ACCOUNT_ID = '51aee885fbff69595ec806189f5de591';
const CF_API_TOKEN = 'L4a0dJChoKZGpChtCcIJAWMQjLcbLAtyiuD7yGs4';
const SUPABASE_URL = 'https://clrzajerliyyddfyvggd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNscnphamVybGl5eWRkZnl2Z2dkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE5OTg4NCwiZXhwIjoyMDg2Nzc1ODg0fQ.SslgVjrgDU6kvmn1bpaJ1rpWLyvQYF-VqRuYboE_YN8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── HELPERS ─────────────────────────────────────────────────────────────────
async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function cfRequest(method, path, body = null) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/browser-rendering/${path}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };
  if (body) options.body = JSON.stringify(body);
  
  const resp = await fetch(url, options);
  const data = await resp.json();
  
  // Handle 1001 "Crawl job not found" as a retryable state
  if (!resp.ok || !data.success) {
    return { error: true, data: data.errors || data };
  }
  return { error: false, result: data.result };
}

// ─── MAIN EXECUTION ──────────────────────────────────────────────────────────
async function runPrototype(startUrl) {
  try {
    console.log(`🦞 [Cloudflare] Initiating deep crawl for: ${startUrl}`);
    
    // 1. Start Crawl Job
    const postRes = await cfRequest('POST', 'crawl', {
      url: startUrl,
      limit: 5,
      depth: 1,
      formats: ["markdown"]
    });
    
    if (postRes.error) throw new Error(`Create failed: ${JSON.stringify(postRes.data)}`);
    const jobId = postRes.result;
    console.log(`⏳ [Cloudflare] Crawl Job ID: ${jobId}. Polling for completion...`);

    // 2. Poll for Completion with Retry Logic
    let jobStatus = 'running';
    let result = null;
    let retries = 0;
    
    while (jobStatus === 'running' && retries < 20) {
      await sleep(10000); // 10s delay between checks
      const getRes = await cfRequest('GET', `crawl/${jobId}?limit=1`);
      
      if (getRes.error) {
        console.log(`   Waiting for job to propogate... (${retries}/20)`);
        retries++;
        continue;
      }
      
      result = getRes.result;
      jobStatus = result.status;
      console.log(`   Status: ${jobStatus} (${result.finished || 0}/${result.total || 0} pages)`);
    }

    if (jobStatus !== 'completed') {
      throw new Error(`Crawl timed out or failed with status: ${jobStatus}`);
    }

    // 3. Extract and Ingest
    console.log(`✅ [Cloudflare] Crawl complete. Fetching records...`);
    const fullRes = await cfRequest('GET', `crawl/${jobId}?status=completed`);
    const records = fullRes.result.records || [];

    for (const record of records) {
      if (!record.url.includes('/behance.net/') || record.url.includes('/search')) continue;
      
      console.log(`🔍 [Cloudflare AI] Analyzing: ${record.url}`);
      
      // Note: Cloudflare's /json can also be called separately
      const extractRes = await cfRequest('POST', 'json', {
        url: record.url,
        prompt: "Extract Name, Professional Title, and Location.",
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "c",
            properties: {
              full_name: { type: "string" },
              title: { type: "string" },
              location: { type: "string" }
            }
          }
        }
      });

      if (!extractRes.error && extractRes.result) {
        const c = extractRes.result;
        console.log(`📥 [Supabase] Staging: ${c.full_name}`);
        await supabase.from('unvetted').insert({
          full_name: c.full_name,
          title: c.title || "Graphic Designer",
          location: c.location || "Egypt",
          portfolio_url: record.url,
          source: 'Cloudflare',
          match_score: 85,
          match_reason: "Deep-crawled via Cloudflare Browser Rendering API.",
          status: 'New',
          uploaded_at: new Date().toISOString()
        });
      }
    }

    console.log('🏁 Prototype run finished.');
  } catch (err) {
    console.error('❌ Prototype Error:', err.message);
  }
}

const testUrl = "https://www.behance.net/search/users?search=Graphic%20Designer&country=EG";
runPrototype(testUrl);
