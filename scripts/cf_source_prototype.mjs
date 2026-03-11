import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

// ─── CONFIGURATION ───────────────────────────────────────────────────────────
const CF_ACCOUNT_ID = '51aee885fbff69595ec806189f5de591';
const CF_API_TOKEN = 'L4a0dJChoKZGpChtCcIJAWMQjLcbLAtyiuD7yGs4';
const SUPABASE_URL = 'https://clrzajerliyyddfyvggd.supabase.co';
const SUPABASE_KEY = 'REDACTED_SERVICE_ROLE_KEY';

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
  if (!resp.ok || !data.success) {
    throw new Error(`Cloudflare Error: ${JSON.stringify(data.errors || data)}`);
  }
  return data.result;
}

// ─── MAIN EXECUTION ──────────────────────────────────────────────────────────
async function runPrototype(startUrl) {
  try {
    console.log(`🦞 [Cloudflare] Initiating deep crawl for: ${startUrl}`);
    
    // 1. Start Crawl Job
    // We limit to 5 pages for the prototype to save credits/time
    const jobId = await cfRequest('POST', 'crawl', {
      url: startUrl,
      limit: 5,
      depth: 1,
      formats: ["markdown"],
      options: {
        includePatterns: ["**/behance.net/*"]
      }
    });
    
    console.log(`⏳ [Cloudflare] Crawl Job ID: ${jobId}. Polling for completion...`);

    // 2. Poll for Completion
    let jobStatus = 'running';
    let result = null;
    while (jobStatus === 'running') {
      await sleep(5000);
      result = await cfRequest('GET', `crawl/${jobId}?limit=1`);
      jobStatus = result.status;
      console.log(`   Status: ${jobStatus} (${result.finished || 0}/${result.total || 0} pages)`);
    }

    if (jobStatus !== 'completed') {
      throw new Error(`Crawl failed with status: ${jobStatus}`);
    }

    // 3. Fetch Full Results
    console.log(`✅ [Cloudflare] Crawl complete. Extracting candidate details...`);
    const fullResult = await cfRequest('GET', `crawl/${jobId}?status=completed`);
    const records = fullResult.records || [];

    for (const record of records) {
      if (!record.url.includes('/behance.net/') || record.url.includes('/search')) continue;
      
      console.log(`🔍 [Cloudflare AI] Analyzing profile: ${record.url}`);
      
      // 4. Use /json endpoint for structured extraction from the markdown content
      // Note: We send the markdown directly to Cloudflare's AI extraction
      try {
        const extracted = await cfRequest('POST', 'json', {
          url: record.url,
          prompt: "Extract the person's full name, their professional title, their location in Egypt, and a summary of their Saudi market experience or top design skills.",
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
        });

        if (extracted && extracted.full_name) {
          console.log(`📥 [Supabase] Staging: ${extracted.full_name} (${extracted.match_score || 80}%)`);
          
          await supabase.from('unvetted').insert({
            full_name: extracted.full_name,
            title: extracted.title || "Graphic Designer",
            location: extracted.location || "Egypt",
            portfolio_url: record.url,
            source: 'Cloudflare',
            match_score: extracted.match_score || 85,
            match_reason: extracted.match_reason || "Extracted via Cloudflare AI Browser Rendering.",
            status: 'New',
            uploaded_at: new Date().toISOString()
          });
        }
      } catch (e) {
        console.warn(`⚠️ Failed to extract from ${record.url}: ${e.message}`);
      }
    }

    console.log('🏁 [Cloudflare] Prototype run finished.');
  } catch (err) {
    console.error('❌ Prototype Error:', err.message);
  }
}

// Test with a specific search URL
const testUrl = "https://www.behance.net/search/users?search=Graphic%20Designer&country=EG";
runPrototype(testUrl);
