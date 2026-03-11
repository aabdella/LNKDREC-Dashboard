const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://clrzajerliyyddfyvggd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNscnphamVybGl5eWRkZnl2Z2dkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE5OTg4NCwiZXhwIjoyMDg2Nzc1ODg0fQ.SslgVjrgDU6kvmn1bpaJ1rpWLyvQYF-VqRuYboE_YN8';
const BRAVE_API_KEY = 'BSAkO1bNAF5QCq4K_b3UCuQlR8FNKEP';

const supabase = createClient(supabaseUrl, supabaseKey);

const R = {
  linkedinSlug: new RegExp('linkedin[.]com/in/([a-zA-Z0-9_-]+)', 'i'),
  behanceSlug:  new RegExp('behance[.]net/([a-zA-Z0-9_-]+)', 'i'),
  locationEg: new RegExp('Egypt|Cairo|Alexandria|Giza|Maadi|Heliopolis|Dokki|Nasr[ \t]City|Sheikh[ \t]Zayed|October', 'i'),
  locationSa: new RegExp('Riyadh|Jeddah|Saudi', 'i'),
  companyAt: new RegExp('at[ \\t]+([A-Z][a-zA-Z0-9[ \\t\\-_]+)', 'i'),
  companyDash: new RegExp('[ \\t]-[ \\t]+([A-Z][a-zA-Z0-9[ \\t\\-_]+)', 'i'),
};

function normalizeTitleAndCompany(titleRaw) {
  let title = titleRaw;
  let company = '';
  const atMatch = title.match(R.companyAt);
  if (atMatch) {
    company = atMatch[1].trim();
    title = title.substring(0, title.toLowerCase().indexOf(' at ' + company.toLowerCase())).trim();
  } else {
    const dashMatch = title.match(R.companyDash);
    if (dashMatch) {
      company = dashMatch[1].trim();
      const dashIdx = title.toLowerCase().indexOf(' - ' + company.toLowerCase());
      if (dashIdx > 0) title = title.substring(0, dashIdx).trim();
    }
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
    if (!full_name || full_name === full_name.toUpperCase()) return null;
  } else if (platform === 'Behance') {
    const slugMatch = url.match(R.behanceSlug);
    portfolio_url = slugMatch ? `https://www.behance.net/${slugMatch[1]}` : url;
    const cleaned = titleRaw.replace(new RegExp('[|].*Behance.*$', 'i'), '').trim();
    full_name = cleaned.split(' - ')[0].replace('Portfolio', '').trim();
  }

  let location = 'Egypt';
  const combinedText = titleRaw + ' ' + desc;
  const m = combinedText.match(R.locationEg);
  if (m) location = m[0];

  const { title: normalizedTitle, company } = normalizeTitleAndCompany(titleRaw + ' ' + desc);
  if (normalizedTitle && normalizedTitle !== 'Professional') candidateTitle = normalizedTitle;

  let score = 45;
  const descLower = combinedText.toLowerCase();
  keywords.forEach(kw => { if (descLower.includes(kw.toLowerCase())) score += 12; });
  if (descLower.includes('saudi') || descLower.includes('ksa')) score += 20;
  if (score > 99) score = 99;

  return {
    full_name,
    title: candidateTitle,
    location,
    linkedin_url,
    portfolio_url,
    source: platform,
    match_reason: `Sourced via ${platform} | Match: ${keywords.join(', ')}`,
    match_score: score,
    status: 'New',
    uploaded_at: new Date().toISOString()
  };
}

async function sourceTalent(jdText) {
  console.log('🦞 Starting Sourcing Engine...');
  const kwSets = [
    ['Senior Graphic Designer', 'Egypt', 'Saudi'],
    ['Social Media Designer', 'Egypt', 'Campaigns'],
    ['Art Director', 'Egypt', 'Adobe'],
    ['Visual Designer', 'Egypt', 'AI tools'],
    ['Graphic Designer', 'Egypt', 'Agency']
  ];

  const platforms = [
    { name: 'LinkedIn', site: 'site:linkedin.com/in' },
    { name: 'Behance', site: 'site:behance.net' }
  ];

  const allCandidates = [];
  const seen = new Set();

  for (const platform of platforms) {
    for (const kws of kwSets) {
      const query = `${platform.site} ${kws.join(' ')}`;
      console.log(`🔍 Searching ${platform.name}: ${query}`);
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`;
      
      try {
        const resp = await fetch(url, { headers: { 'X-Subscription-Token': BRAVE_API_KEY } });
        const data = await resp.json();
        const results = data?.web?.results || [];

        for (const res of results) {
          const parsed = parseResult(res, kws, platform.name);
          if (parsed && !seen.has(parsed.linkedin_url || parsed.portfolio_url)) {
            seen.add(parsed.linkedin_url || parsed.portfolio_url);
            allCandidates.push(parsed);
          }
        }
      } catch (e) { console.error('Search error:', e.message); }
    }
  }

  allCandidates.sort((a, b) => b.match_score - a.match_score);
  const topCandidates = allCandidates.slice(0, 15);

  console.log(`📥 Staging ${topCandidates.length} candidates to Supabase...`);
  
  for (const c of topCandidates) {
    const row = {
      full_name: c.full_name,
      title: c.title,
      location: c.location,
      linkedin_url: c.linkedin_url,
      portfolio_url: c.portfolio_url || null,
      source: c.source,
      match_score: c.match_score,
      match_reason: c.match_reason,
      status: 'New',
      uploaded_at: c.uploaded_at,
      years_experience_total: 0
    };
    const { error } = await supabase.from('unvetted').insert(row);
    if (error) console.error(`Error saving ${c.full_name}:`, error.message);
    else console.log(`✅ Staged: ${c.full_name} (${c.match_score}%)`);
  }

  console.log('🏁 Sourcing complete.');
}

const jd = `Position: Senior Graphic Designer (Social Media & Campaigns)
Role Summary:
We are seeking a Senior Graphic Designer with hands-on experience in designing high-impact visuals for social media and marketing campaigns.
Living in Egypt
Key Requirements:
Proven experience in the Saudi market is essential.
Strong portfolio in social media design and campaign-based creatives.
Hands-on experience using AI-powered design and creative tools to enhance speed, quality, and ideation.
Excellent skills in Adobe Creative Suite.
Ability to translate briefs into engaging visual content aligned with brand guidelines.
Experience working with marketing teams and fast-paced agency environments.`;

sourceTalent(jd);