const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const supabaseUrl = 'https://clrzajerliyyddfyvggd.supabase.co';
const supabaseKey = 'REDACTED_SERVICE_ROLE_KEY';
const BRAVE_API_KEY = 'REDACTED_BRAVE_API_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

const R = {
  linkedinSlug: new RegExp('linkedin[.]com/in/([a-zA-Z0-9_-]+)', 'i'),
  locationEg: new RegExp('Egypt|Cairo|Alexandria|Giza|Maadi|Heliopolis|Dokki|Nasr[ \t]City|Sheikh[ \t]Zayed|October', 'i'),
};

function parseResult(result, company) {
  const url = result.url || '';
  const titleRaw = result.title || '';
  const desc = result.description || '';

  if (!url.includes('linkedin.com/in/')) return null;

  const combinedText = titleRaw + ' ' + desc;
  if (!R.locationEg.test(combinedText)) return null;

  let linkedin_url = '';
  let full_name = 'Unknown';
  let candidateTitle = 'Professional';

  const slugMatch = url.match(R.linkedinSlug);
  linkedin_url = slugMatch ? `https://www.linkedin.com/in/${slugMatch[1]}` : url;
  
  const cleaned = titleRaw.replace(new RegExp('[|][ \t]*LinkedIn.*$', 'i'), '').trim();
  const dashIdx = cleaned.indexOf(' - ');
  if (dashIdx > 0) {
    full_name = cleaned.substring(0, dashIdx).trim();
    candidateTitle = cleaned.substring(dashIdx + 3).split(' at ')[0].split(' | ')[0].trim();
  }

  if (full_name === 'Unknown' || !full_name || full_name === full_name.toUpperCase()) return null;

  let score = 75;
  const descLower = combinedText.toLowerCase();
  if (descLower.includes(company.toLowerCase())) score += 10;
  if (descLower.includes('senior') || descLower.includes('researcher')) score += 10;
  if (score > 99) score = 99;

  return {
    full_name,
    title: candidateTitle,
    location: 'Egypt',
    linkedin_url,
    source: 'Deep Search',
    match_reason: `Sourced from ${company} (ML/AI Focus) | Role: ${candidateTitle}`,
    match_score: score,
    status: 'Sourced',
    uploaded_at: new Date().toISOString()
  };
}

async function sourceTargetedCompanies() {
  // Curated list of companies with strong ML/AI presence in Egypt
  const companies = [
    'Instabug',
    'Valeo',
    'Si-Ware Systems',
    'Proton',
    'Vezeeta',
    'Swvl',
    'VOIS',
    'Siemens Healthineers'
  ];

  const roles = [
    'Senior ML Engineer',
    'AI Researcher',
    'Computer Vision Engineer',
    'Machine Learning Engineer'
  ];
  
  const allCandidates = [];
  const seen = new Set();

  for (const company of companies) {
    for (const role of roles) {
      const query = `site:linkedin.com/in "${role}" "${company}" Egypt`;
      console.log(`🔍 Searching: ${query}`);
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`;
      
      try {
        const resp = await fetch(url, { headers: { 'X-Subscription-Token': BRAVE_API_KEY } });
        const data = await resp.json();
        const results = data?.web?.results || [];

        for (const res of results) {
          const parsed = parseResult(res, company);
          const key = parsed?.linkedin_url;
          if (parsed && key && !seen.has(key)) {
            seen.add(key);
            allCandidates.push(parsed);
          }
        }
      } catch (e) { console.error('Search error:', e.message); }
    }
  }

  console.log(`📥 Staging ${allCandidates.length} high-fidelity candidates to Supabase...`);
  
  for (const c of allCandidates) {
    const { error } = await supabase.from('unvetted').insert(c);
    if (error) console.error(`Error saving ${c.full_name}:`, error.message);
    else console.log(`✅ Staged: ${c.full_name} (${c.match_score}%)`);
  }

  console.log('🏁 Sourcing complete.');
}

sourceTargetedCompanies();
