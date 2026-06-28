const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://clrzajerliyyddfyvggd.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BRAVE_API_KEY = process.env.BRAVE_API_KEY;

if (!supabaseKey || !BRAVE_API_KEY) {
  console.error('❌ Missing env vars: SUPABASE_SERVICE_ROLE_KEY and/or BRAVE_API_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const R = {
  linkedinSlug: new RegExp('linkedin[.]com/in/([a-zA-Z0-9_-]+)', 'i'),
  behanceSlug:  new RegExp('behance[.]net/([a-zA-Z0-9_-]+)', 'i'),
  locationEg: new RegExp('Egypt|Cairo|Alexandria|Giza|Maadi|Heliopolis|Dokki|Nasr[ \\t]City|Sheikh[ \\t]Zayed|October', 'i'),
};

function normalizeName(titleRaw) {
  const cleaned = titleRaw.replace(/[|][ \t]*LinkedIn.*$/i, '').trim();
  const dashIdx = cleaned.indexOf(' - ');
  if (dashIdx > 0) {
    const name = cleaned.substring(0, dashIdx).trim();
    const rest  = cleaned.substring(dashIdx + 3).split(' at ')[0].split(' | ')[0].trim();
    return { name, jobTitle: rest };
  }
  return { name: cleaned.split(' - ')[0].trim(), jobTitle: 'Art Director' };
}

function parseResult(result, keywords, platform) {
  const url      = result.url || '';
  const titleRaw = result.title || '';
  const desc     = result.description || '';

  if (platform === 'LinkedIn' && !url.includes('linkedin.com/in/')) return null;
  if (platform === 'Behance'  && !url.includes('behance.net'))       return null;

  let linkedin_url  = '';
  let portfolio_url = '';
  let full_name     = 'Unknown';
  let candidateTitle = 'Art Director';

  if (platform === 'LinkedIn') {
    const slugMatch = url.match(R.linkedinSlug);
    if (!slugMatch) return null;
    linkedin_url = `https://www.linkedin.com/in/${slugMatch[1]}`;
    const { name, jobTitle } = normalizeName(titleRaw);
    if (!name || name === name.toUpperCase()) return null;
    full_name      = name;
    candidateTitle = jobTitle || 'Art Director';
  } else if (platform === 'Behance') {
    const slugMatch = url.match(R.behanceSlug);
    portfolio_url = slugMatch ? `https://www.behance.net/${slugMatch[1]}` : url;
    const cleaned = titleRaw.replace(/[|].*Behance.*$/i, '').trim();
    full_name = cleaned.split(' - ')[0].replace('Portfolio', '').trim() || 'Unknown';
  }

  if (!full_name || full_name.trim() === '') return null;

  let location = 'Egypt';
  const combined = titleRaw + ' ' + desc;
  const locMatch = combined.match(R.locationEg);
  if (locMatch) location = locMatch[0];

  // Score: base + keyword hits + GCC/Saudi market bonus + AI tools bonus
  let score = 40;
  const lower = combined.toLowerCase();
  keywords.forEach(kw => { if (lower.includes(kw.toLowerCase())) score += 10; });
  if (lower.includes('saudi') || lower.includes('ksa') || lower.includes('gcc')) score += 20;
  if (lower.includes('ai tool') || lower.includes('midjourney') || lower.includes('dall-e') || lower.includes('generative ai')) score += 10;
  if (lower.includes('art director')) score += 10;
  if (lower.includes('campaign') || lower.includes('brand identity')) score += 5;
  if (score > 99) score = 99;

  return {
    full_name,
    title: candidateTitle.substring(0, 80),
    location,
    linkedin_url,
    portfolio_url,
    source: platform,
    match_reason: `Sourced via ${platform} | Keywords: ${keywords.join(', ')}`,
    match_score: score,
    status: 'New',
    uploaded_at: new Date().toISOString()
  };
}

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function braveSearch(query) {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`;
  const resp = await fetch(url, { headers: { 'X-Subscription-Token': BRAVE_API_KEY } });
  if (!resp.ok) throw new Error(`Brave API ${resp.status}: ${resp.statusText}`);
  const data = await resp.json();
  return data?.web?.results || [];
}

async function fetchExistingUrls() {
  const { data, error } = await supabase
    .from('unvetted')
    .select('linkedin_url')
    .not('linkedin_url', 'is', null);
  if (error) { console.warn('Could not fetch existing URLs:', error.message); return new Set(); }
  return new Set(data.map(r => r.linkedin_url).filter(Boolean));
}

async function sourceTalent() {
  console.log('🦞 Art Director Sourcing — starting...\n');

  const existingUrls = await fetchExistingUrls();
  console.log(`📋 ${existingUrls.size} existing candidates in unvetted table (for dedup)\n`);

  // Query sets targeting Art Director + Egypt + Saudi/GCC market
  const kwSets = [
    ['Art Director', 'Egypt', 'Saudi'],
    ['Art Director', 'Egypt', 'GCC campaigns'],
    ['Art Director', 'Egypt', 'marketing campaigns'],
    ['Creative Director', 'Egypt', 'Saudi market'],
    ['Art Director', 'Egypt', 'brand identity social media'],
    ['Art Director', 'Egypt', 'AI tools creative'],
    ['Art Director', 'Egypt', 'integrated campaigns'],
    ['Senior Art Director', 'Egypt', 'agency'],
  ];

  const platforms = [
    { name: 'LinkedIn', site: 'site:linkedin.com/in' },
    { name: 'Behance',  site: 'site:behance.net' },
  ];

  const allCandidates = [];
  const seen = new Set();
  let apiCallCount = 0;

  for (const platform of platforms) {
    for (const kws of kwSets) {
      const query = `${platform.site} ${kws.join(' ')}`;
      console.log(`🔍 [${platform.name}] ${query}`);

      try {
        const results = await braveSearch(query);
        apiCallCount++;

        for (const res of results) {
          const parsed = parseResult(res, kws, platform.name);
          if (!parsed) continue;
          const key = parsed.linkedin_url || parsed.portfolio_url;
          if (!key || seen.has(key) || existingUrls.has(key)) continue;
          seen.add(key);
          allCandidates.push(parsed);
        }
      } catch (e) {
        console.error(`  ⚠️  Search error: ${e.message}`);
      }

      // Respect Brave rate limits — 1 req/sec on free tier
      await delay(1100);
    }
  }

  allCandidates.sort((a, b) => b.match_score - a.match_score);
  const topCandidates = allCandidates.slice(0, 20);

  console.log(`\n📊 Found ${allCandidates.length} unique candidates. Staging top ${topCandidates.length}...\n`);

  let inserted = 0;
  let skipped  = 0;

  for (const c of topCandidates) {
    const row = {
      full_name:              c.full_name,
      title:                  c.title,
      location:               c.location,
      linkedin_url:           c.linkedin_url || null,
      portfolio_url:          c.portfolio_url || null,
      source:                 c.source,
      match_score:            c.match_score,
      match_reason:           c.match_reason,
      status:                 'New',
      uploaded_at:            c.uploaded_at,
      years_experience_total: 0,
    };

    const { error } = await supabase.from('unvetted').insert(row);
    if (error) {
      if (error.code === '23505') {
        console.log(`  ⏭️  Dup skipped: ${c.full_name}`);
        skipped++;
      } else {
        console.error(`  ❌ Error saving ${c.full_name}: ${error.message}`);
      }
    } else {
      console.log(`  ✅ Staged: ${c.full_name} (${c.match_score}%) — ${c.title} — ${c.location}`);
      inserted++;
    }
  }

  console.log(`\n🏁 Done. ${inserted} inserted, ${skipped} skipped (dups). ${apiCallCount} API calls made.`);
}

sourceTalent().catch(console.error);
