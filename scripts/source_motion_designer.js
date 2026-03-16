const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://clrzajerliyyddfyvggd.supabase.co';
const supabaseKey = 'REDACTED_SERVICE_ROLE_KEY';
const BRAVE_API_KEY = 'REDACTED_BRAVE_API_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

const R = {
  linkedinSlug: new RegExp('linkedin[.]com/in/([a-zA-Z0-9_-]+)', 'i'),
  behanceSlug:  new RegExp('behance[.]net/([a-zA-Z0-9_-]+)', 'i'),
  locationEg: new RegExp('Egypt|Cairo|Alexandria|Giza|Maadi|Heliopolis|Dokki|Nasr[ \t]City|Sheikh[ \t]Zayed|October', 'i'),
};

function normalizeTitleAndCompany(titleRaw) {
  let title = titleRaw;
  let company = '';
  const companyAt = new RegExp('at[ \\t]+([A-Z][a-zA-Z0-9[ \\t\\-_]+)', 'i');
  const atMatch = title.match(companyAt);
  if (atMatch) {
    company = atMatch[1].trim();
    title = title.substring(0, title.toLowerCase().indexOf(' at ' + company.toLowerCase())).trim();
  }
  return { title: title.substring(0, 80) || 'Professional', company };
}

function parseResult(result, keywords, platform) {
  const url = result.url || '';
  const titleRaw = result.title || '';
  const desc = result.description || '';

  if (platform === 'LinkedIn' && !url.includes('linkedin.com/in/')) return null;
  if (platform === 'Behance' && !url.includes('behance.net')) return null;

  let linkedin_url = '';
  let portfolio_url = '';
  let full_name = 'Unknown';
  let candidateTitle = 'Professional';

  if (platform === 'LinkedIn') {
    const slugMatch = url.match(R.linkedinSlug);
    linkedin_url = slugMatch ? `https://www.linkedin.com/in/${slugMatch[1]}` : url;
    const cleaned = titleRaw.replace(new RegExp('[|][ \t]*LinkedIn.*$', 'i'), '').trim();
    const dashIdx = cleaned.indexOf(' - ');
    if (dashIdx > 0) {
      full_name = cleaned.substring(0, dashIdx).trim();
      candidateTitle = cleaned.substring(dashIdx + 3).split(' at ')[0].split(' | ')[0].trim();
    }
  } else if (platform === 'Behance') {
    const slugMatch = url.match(R.behanceSlug);
    portfolio_url = slugMatch ? `https://www.behance.net/${slugMatch[1]}` : url;
    const cleaned = titleRaw.replace(new RegExp('[|].*Behance.*$', 'i'), '').trim();
    full_name = cleaned.split(' - ')[0].replace('Portfolio', '').trim();
  }

  if (full_name === 'Unknown' || !full_name || full_name === full_name.toUpperCase()) return null;

  let location = 'Egypt';
  const combinedText = titleRaw + ' ' + desc;
  const m = combinedText.match(R.locationEg);
  if (m) location = m[0];

  const { title: normalizedTitle } = normalizeTitleAndCompany(titleRaw + ' ' + desc);
  if (normalizedTitle && normalizedTitle !== 'Professional') candidateTitle = normalizedTitle;

  let score = 40;
  const descLower = combinedText.toLowerCase();
  keywords.forEach(kw => { if (descLower.includes(kw.toLowerCase())) score += 10; });
  if (descLower.includes('saudi') || descLower.includes('ksa') || descLower.includes('riyadh')) score += 25;
  if (descLower.includes('after effects')) score += 15;
  if (score > 99) score = 99;

  return {
    full_name,
    title: candidateTitle,
    location,
    linkedin_url,
    portfolio_url,
    source: platform,
    match_reason: `Sourced for Motion Graphics Designer | Egypt | Saudi Exp. Match: ${keywords.join(', ')}`,
    match_score: score,
    status: 'Sourced',
    uploaded_at: new Date().toISOString()
  };
}

async function sourceMotionDesigner() {
  console.log('🦞 Starting Deep Search for Motion Graphics Designers...');
  
  const kwSets = [
    ['Motion Graphics Designer', 'Egypt', 'Saudi'],
    ['2D Animator', 'Egypt', 'After Effects'],
    ['Video Editor', 'Motion Graphics', 'Egypt'],
    ['Explainer Video', 'Egypt', 'KSA'],
    ['Visual Effects', 'Egypt', 'Adobe Premiere']
  ];

  const platforms = [
    { name: 'LinkedIn', site: 'site:eg.linkedin.com/in' },
    { name: 'Behance', site: 'site:behance.net Egypt' }
  ];

  const allCandidates = [];
  const seen = new Set();

  for (const platform of platforms) {
    for (const kws of kwSets) {
      const query = `${platform.site} ${kws.join(' ')}`;
      console.log(`🔍 Searching ${platform.name}: ${query}`);
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=20`;
      
      try {
        const resp = await fetch(url, { headers: { 'X-Subscription-Token': BRAVE_API_KEY } });
        const data = await resp.json();
        const results = data?.web?.results || [];

        for (const res of results) {
          const parsed = parseResult(res, kws, platform.name);
          const key = parsed?.linkedin_url || parsed?.portfolio_url;
          if (parsed && key && !seen.has(key)) {
            seen.add(key);
            allCandidates.push(parsed);
          }
        }
      } catch (e) { console.error('Search error:', e.message); }
    }
  }

  allCandidates.sort((a, b) => b.match_score - a.match_score);
  const topCandidates = allCandidates.slice(0, 20);

  console.log(`📥 Staging ${topCandidates.length} candidates to Supabase (unvetted table)...`);
  
  for (const c of topCandidates) {
    const row = {
      ...c,
      years_experience_total: 0
    };
    const { error } = await supabase.from('unvetted').insert(row);
    if (error) console.error(`Error saving ${c.full_name}:`, error.message);
    else console.log(`✅ Staged: ${c.full_name} (${c.match_score}%)`);
  }

  console.log('🏁 Sourcing complete.');
}

sourceMotionDesigner();