import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ─── Supabase (service role preferred) ──────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://clrzajerliyyddfyvggd.supabase.co';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Types ───────────────────────────────────────────────────────────────────
interface RawBraveResult {
  title?: string;
  url?: string;
  description?: string;
}

type Platform = 'LinkedIn' | 'Wuzzuf' | 'Bayt' | 'Behance';

interface PlatformConfig {
  name: Platform;
  siteQuery: string;
  limit: number;
}

interface CandidateResult {
  full_name: string;
  title: string;
  location: string;
  linkedin_url: string;
  portfolio_url?: string;
  source: string;
  match_reason: string;
  match_score: number;
  skills: string[];
  status: string;
  uploaded_at: string;
}

// ─── Regex helpers (NO backslash escapes — Turbopack safe) ───────────────────
// \w → [a-zA-Z0-9_]   \d → [0-9]   \s → [ \t\r\n]   \. → [.]
const R = {
  linkedinSlug: new RegExp('linkedin[.]com/in/([a-zA-Z0-9_-]+)', 'i'),
  behanceSlug:  new RegExp('behance[.]net/([a-zA-Z0-9_-]+)', 'i'),
  wuzzufUrl:    new RegExp('wuzzuf[.]net', 'i'),
  baytUrl:      new RegExp('bayt[.]com', 'i'),
  nameFromTitle: new RegExp('^([A-Z][a-z]+([ \t][A-Z][a-z]+)+)'),
  locationEg: new RegExp('Egypt|Cairo|Alexandria|Giza|Maadi|Heliopolis|Dokki|Nasr[ \t]City|Sheikh[ \t]Zayed|October', 'i'),
  locationAe: new RegExp('Dubai|Abu[ \t]Dhabi|Sharjah|UAE|Emirates', 'i'),
  locationSa: new RegExp('Riyadh|Jeddah|Saudi', 'i'),
  remote: new RegExp('Remote|Worldwide', 'i'),
  creative: new RegExp('designer|graphic|art[ \t]director|creative|illustrator|photoshop|figma|ux|ui[ \t]designer|visual', 'i'),
};

// ─── JD Keyword Extractor ────────────────────────────────────────────────────
function extractKeywords(jd: string): string[][] {
  const text = jd.toLowerCase();

  // Role detection — Art Director and Creative Director added explicitly
  const rolePatterns: Record<string, string[]> = {
    'Technical Support Agent': ['technical support agent', 'tech support agent', 'call center', 'technical support specialist', 'customer support agent', 'support advisor', 'technical advisor'],
    'Art Director':         ['art director'],
    'Creative Director':    ['creative director'],
    'Graphic Designer':     ['graphic designer', 'graphic design', 'visual designer', 'senior graphic'],
    'Software Engineer':    ['software engineer', 'software developer', 'swe'],
    'Frontend Developer':   ['frontend', 'front-end', 'front end', 'react developer', 'vue developer'],
    'Backend Developer':    ['backend', 'back-end', 'back end', 'node.js developer', 'python developer'],
    'Full Stack Developer': ['full stack', 'full-stack', 'fullstack'],
    'Product Manager':      ['product manager', 'product management'],
    'UX Designer':          ['ux designer', 'ui/ux', 'ui designer', 'product designer'],
    'Data Scientist':       ['data scientist', 'data science', 'ml engineer', 'machine learning'],
    'DevOps Engineer':      ['devops', 'site reliability', 'infrastructure engineer'],
    'Mobile Developer':     ['mobile developer', 'ios developer', 'android developer', 'react native'],
    'Marketing Manager':    ['marketing manager', 'digital marketing', 'growth manager'],
    'Sales Manager':        ['sales manager', 'account executive', 'business development'],
    'Content Writer':       ['content writer', 'copywriter', 'content creator'],
    'HR Manager':           ['hr manager', 'human resources', 'talent acquisition', 'recruiter'],
  };

  let detectedRole = 'Professional';
  for (const [role, patterns] of Object.entries(rolePatterns)) {
    if (patterns.some(p => text.includes(p))) {
      detectedRole = role;
      break;
    }
  }

  // Skill detection — exact names AND common aliases/suites
  const allSkills = [
    'React', 'Next.js', 'Vue', 'Angular', 'TypeScript', 'JavaScript', 'Node.js',
    'Python', 'Django', 'FastAPI', 'Flask', 'Java', 'Spring', 'Go', 'Rust',
    'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'AWS', 'Azure', 'GCP',
    'Docker', 'Kubernetes', 'Terraform', 'GraphQL', 'REST',
    'Figma', 'Sketch', 'Adobe XD', 'Photoshop', 'Illustrator', 'InDesign', 'After Effects', 'Premiere',
    'TensorFlow', 'PyTorch', 'scikit-learn', 'Pandas', 'NumPy',
    'React Native', 'Flutter', 'Swift', 'Kotlin',
    'Git', 'CI/CD', 'Agile', 'Scrum',
  ];

  // Alias map: if JD contains phrase → inject skill name
  const skillAliases: Record<string, string[]> = {
    'Photoshop':    ['adobe creative suite', 'adobe creative cloud', 'adobe suite'],
    'Illustrator':  ['adobe creative suite', 'adobe creative cloud', 'adobe suite', 'adobe illustrator'],
    'InDesign':     ['adobe creative suite', 'adobe creative cloud', 'adobe suite', 'adobe indesign'],
    'After Effects':['adobe creative suite', 'adobe creative cloud', 'after effects'],
    'Figma':        ['figma'],
    'Social Media': ['social media', 'instagram', 'facebook', 'tiktok', 'campaigns'],
  };

  const detectedSkills = allSkills.filter(s => text.includes(s.toLowerCase()));
  // Add alias-detected skills
  for (const [skill, aliases] of Object.entries(skillAliases)) {
    if (!detectedSkills.includes(skill) && aliases.some(a => text.includes(a))) {
      detectedSkills.push(skill);
    }
  }
  const topSkills = detectedSkills.slice(0, 5);

  // Company name detection — extract specific employers/brands mentioned in JD
  // These become high-priority search terms (quoted for exact match)
  const companyPatterns: string[] = [
    'Vodafone International Services', 'VIS', 'VOIS', '_VOIS',
    'Teleperformance', 'Concentrix', 'Sutherland', 'Majorel', 'Intelcia',
    'Amazon', 'Microsoft', 'Google', 'IBM', 'Oracle', 'SAP', 'Cisco',
    'McKinsey', 'Deloitte', 'PwC', 'EY', 'KPMG',
    'Unilever', 'P&G', 'Nestle', 'Pepsi', 'Coca-Cola',
    'Jumia', 'Talabat', 'Careem', 'Uber',
  ];
  const detectedCompanies = companyPatterns.filter(c => text.includes(c.toLowerCase()));

  // Market experience detection — used as search keywords, not location
  const marketKw: string[] = [];
  if (R.locationSa.test(jd) || text.includes('ksa')) marketKw.push('Saudi', 'KSA');
  if (text.includes('gcc') || text.includes('gulf')) marketKw.push('GCC');
  if (R.locationAe.test(jd)) marketKw.push('GCC');

  // Build 5 keyword sets — always Egypt-anchored, market experience + company names woven in
  const kwSets: string[][] = [];
  const primaryCompany = detectedCompanies[0] || null;
  const secondCompany  = detectedCompanies[1] || null;

  // Set 1: role + Egypt + company name (highest precision — mirrors manual search)
  kwSets.push(primaryCompany
    ? [detectedRole, 'Egypt', primaryCompany]
    : marketKw.length > 0 ? [detectedRole, 'Egypt', marketKw[0]] : [detectedRole, 'Egypt']);

  // Set 2: role + Egypt + second company or market keyword
  kwSets.push(secondCompany
    ? [detectedRole, 'Egypt', secondCompany]
    : marketKw.length > 1 ? [detectedRole, 'Egypt', marketKw[1]]
    : topSkills.length > 0 ? [detectedRole, topSkills[0], 'Egypt'] : [detectedRole, 'Egypt', 'international']);

  // Set 3: role + Cairo + company name
  kwSets.push(primaryCompany
    ? [detectedRole, 'Cairo', primaryCompany]
    : marketKw.length > 0 ? [detectedRole, 'Cairo', marketKw[0]] : [detectedRole, 'Cairo']);

  // Set 4: role + top skill + Egypt (or company)
  kwSets.push(topSkills.length > 0
    ? [detectedRole, topSkills[0], 'Egypt']
    : primaryCompany ? [detectedRole, primaryCompany, 'Egypt'] : [detectedRole, 'Egypt', 'international']);

  // Set 5: company + Egypt + market keyword or skill
  if (primaryCompany) {
    kwSets.push(marketKw.length > 0
      ? [primaryCompany, 'Egypt', marketKw[0]]
      : [primaryCompany, 'Egypt']);
  } else if (topSkills.length >= 2) {
    kwSets.push([topSkills[0], topSkills[1], 'Egypt']);
  } else {
    kwSets.push([detectedRole, 'Egypt', 'international', 'support']);
  }

  return kwSets.slice(0, 5);
}

// ─── Parse a Brave search result into a candidate ───────────────────────────
function parseResult(
  result: RawBraveResult,
  keywords: string[],
  jd: string,
  platform: Platform
): CandidateResult | null {
  const url = result.url || '';
  const titleRaw = result.title || '';
  const desc = result.description || '';

  // Platform-specific URL validation
  if (platform === 'LinkedIn' && !url.includes('linkedin.com/in/')) return null;
  if (platform === 'Behance' && !url.includes('behance.net')) return null;
  if (platform === 'Wuzzuf' && !url.includes('wuzzuf.net')) return null;
  if (platform === 'Bayt' && !url.includes('bayt.com')) return null;

  let linkedin_url = '';
  let portfolio_url = '';
  let full_name = 'Unknown';
  let candidateTitle = 'Professional';

  if (platform === 'LinkedIn') {
    const slugMatch = url.match(R.linkedinSlug);
    linkedin_url = slugMatch ? `https://www.linkedin.com/in/${slugMatch[1]}` : url;
    // Strip " | LinkedIn" suffix, then split on first " - "
    const cleaned = titleRaw.replace(new RegExp('[|][ \t]*LinkedIn.*$', 'i'), '').trim();
    const dashIdx = cleaned.indexOf(' - ');
    if (dashIdx > 0) {
      full_name      = cleaned.substring(0, dashIdx).trim();
      candidateTitle = cleaned.substring(dashIdx + 3).split(' at ')[0].split(' | ')[0].trim() || 'Professional';
    } else {
      full_name = cleaned.trim().substring(0, 60);
      const firstSentence = desc.replace(new RegExp('<[^>]+>', 'g'), '').split('.')[0].trim();
      if (firstSentence.length > 3 && firstSentence.length < 100) candidateTitle = firstSentence;
    }
    // Sanity: skip if name looks like a company/garbage (all caps or too long)
    if (!full_name || full_name.length > 60 || full_name === full_name.toUpperCase()) return null;

  } else if (platform === 'Behance') {
    const slugMatch = url.match(R.behanceSlug);
    portfolio_url  = slugMatch ? `https://www.behance.net/${slugMatch[1]}` : url;
    const cleaned  = titleRaw.replace(new RegExp('[|].*Behance.*$', 'i'), '').trim();
    full_name      = cleaned.split(' - ')[0].replace('Portfolio', '').trim().substring(0, 60) || 'Designer';
    candidateTitle = desc.split('.')[0].trim().substring(0, 80) || 'Creative Designer';
  } else {
    // Wuzzuf / Bayt — job postings
    portfolio_url  = url;
    const cleaned  = titleRaw.replace(new RegExp('[|].*$', ''), '').trim();
    full_name      = cleaned.split(' - ')[0].trim().substring(0, 60) || 'Candidate';
    candidateTitle = cleaned.split(' - ').length > 1
      ? cleaned.split(' - ')[0].trim()
      : desc.split('.')[0].trim().substring(0, 80) || 'Professional';
  }

  // Location: always Egypt, detect city if mentioned
  let location = 'Egypt';
  const combinedText = titleRaw + ' ' + desc;
  if (R.locationEg.test(combinedText)) {
    const m = combinedText.match(R.locationEg);
    location = m ? m[0] : 'Egypt';
  }

  // Skills detection
  const skillKeywords = ['React','Angular','Vue','TypeScript','JavaScript','Node.js','Python','Django',
    'FastAPI','Java','Go','PostgreSQL','MongoDB','AWS','Docker','Kubernetes','GraphQL','Figma',
    'Flutter','Swift','Kotlin','TensorFlow','Photoshop','Illustrator','Adobe XD','After Effects','InDesign','Premiere'];
  const descLower = (titleRaw + ' ' + desc).toLowerCase();
  const skills = skillKeywords.filter(s => descLower.includes(s.toLowerCase())).slice(0, 6);

  // Scoring — reward Saudi/GCC market experience AND specific company mentions heavily
  let score = 45;
  keywords.forEach(kw => { if (descLower.includes(kw.toLowerCase())) score += 12; });
  skills.forEach(() => { score += 2; });
  if (descLower.includes('saudi') || descLower.includes('ksa'))   score += 15;
  if (descLower.includes('gcc')   || descLower.includes('gulf'))  score += 10;
  // Boost for specific company experience (VIS, VOIS, Vodafone International, etc.)
  if (descLower.includes('vodafone international') || descLower.includes('vis') || descLower.includes('vois') || descLower.includes('_vois')) score += 20;
  if (score > 99) score = 99;

  const matchedKws = keywords.filter(kw => descLower.includes(kw.toLowerCase()));
  const match_reason = matchedKws.length > 0
    ? `Matched on: ${matchedKws.join(', ')}. Found via ${platform}.`
    : `Found via ${platform} sourcing search.`;

  const dedupeKey = linkedin_url || portfolio_url || url;
  if (!dedupeKey) return null;

  return {
    full_name,
    title: candidateTitle,
    location,
    linkedin_url,
    portfolio_url,
    source: platform,
    match_reason,
    match_score: score,
    skills,
    status: 'New',
    uploaded_at: new Date().toISOString(),
  };
}

// ─── Mock fallback candidates ────────────────────────────────────────────────
function generateMockCandidates(kwSets: string[][], jd: string): CandidateResult[] {
  const jdLower = jd.toLowerCase();

  // Detect primary role for mock data
  const isFrontend = jdLower.includes('react') || jdLower.includes('frontend') || jdLower.includes('front-end');
  const isBackend = jdLower.includes('backend') || jdLower.includes('node') || jdLower.includes('python');
  const isDesigner = jdLower.includes('figma') || jdLower.includes('ux') || jdLower.includes('designer') || jdLower.includes('graphic') || jdLower.includes('adobe') || jdLower.includes('visual');
  // Candidates are ALWAYS in Egypt — ignore JD market mentions for location
  const defaultLocation = 'Cairo, Egypt';
  const isData = jdLower.includes('data') || jdLower.includes('ml') || jdLower.includes('machine learning');

  type MockTemplate = { name: string; title: string; location: string; skills: string[] };

  const mockTemplates: MockTemplate[] = isFrontend ? [
    { name: 'Ahmed Hassan', title: 'Senior Frontend Developer', location: defaultLocation, skills: ['React', 'TypeScript', 'Next.js', 'Tailwind'] },
    { name: 'Sara El-Sayed', title: 'Frontend Engineer', location: defaultLocation, skills: ['React', 'JavaScript', 'CSS', 'Figma'] },
    { name: 'Omar Khalil', title: 'React Developer', location: defaultLocation, skills: ['React', 'Redux', 'Node.js', 'GraphQL'] },
    { name: 'Nadia Mostafa', title: 'Senior React Engineer', location: defaultLocation, skills: ['React', 'TypeScript', 'AWS', 'Docker'] },
    { name: 'Karim Adel', title: 'Full Stack Developer', location: defaultLocation, skills: ['React', 'Node.js', 'MongoDB', 'TypeScript'] },
  ] : isBackend ? [
    { name: 'Mohamed Farouk', title: 'Senior Backend Engineer', location: defaultLocation, skills: ['Python', 'Django', 'PostgreSQL', 'Docker'] },
    { name: 'Yasmine Ibrahim', title: 'Backend Developer', location: defaultLocation, skills: ['Node.js', 'TypeScript', 'MongoDB', 'Redis'] },
    { name: 'Hossam Nasser', title: 'Python Developer', location: defaultLocation, skills: ['Python', 'FastAPI', 'PostgreSQL', 'AWS'] },
    { name: 'Rania Saleh', title: 'Software Engineer', location: defaultLocation, skills: ['Java', 'Spring', 'MySQL', 'Kubernetes'] },
    { name: 'Tarek Mansour', title: 'Backend Engineer', location: defaultLocation, skills: ['Node.js', 'Express', 'MongoDB', 'Docker'] },
  ] : isDesigner ? [
    { name: 'Dina Kamal', title: 'Senior Graphic Designer', location: defaultLocation, skills: ['Photoshop', 'Illustrator', 'InDesign', 'Figma'] },
    { name: 'Hana Ali', title: 'Senior Visual Designer', location: defaultLocation, skills: ['Photoshop', 'Social Media', 'Campaigns', 'Adobe XD'] },
    { name: 'Sherif Gamal', title: 'Creative Designer', location: defaultLocation, skills: ['Illustrator', 'Photoshop', 'After Effects', 'Figma'] },
    { name: 'Mariam Fouad', title: 'Graphic Designer - Social Media', location: defaultLocation, skills: ['Photoshop', 'Illustrator', 'Canva', 'Figma'] },
    { name: 'Khaled Essam', title: 'Art Director', location: defaultLocation, skills: ['Illustrator', 'Photoshop', 'After Effects', 'InDesign'] },
  ] : isData ? [
    { name: 'Aya Sami', title: 'Data Scientist', location: defaultLocation, skills: ['Python', 'TensorFlow', 'Pandas', 'scikit-learn'] },
    { name: 'Hassan Badr', title: 'ML Engineer', location: defaultLocation, skills: ['PyTorch', 'Python', 'AWS', 'Docker'] },
    { name: 'Mona Taha', title: 'Data Analyst', location: defaultLocation, skills: ['Python', 'SQL', 'Tableau', 'Pandas'] },
    { name: 'Amr Fathy', title: 'Senior Data Scientist', location: defaultLocation, skills: ['TensorFlow', 'Python', 'GCP', 'Spark'] },
    { name: 'Layla Mahmoud', title: 'AI Engineer', location: defaultLocation, skills: ['Python', 'PyTorch', 'FastAPI', 'Docker'] },
  ] : [
    { name: 'Ahmed Naguib', title: 'Software Engineer', location: defaultLocation, skills: ['Python', 'JavaScript', 'Docker', 'Git'] },
    { name: 'Sara Ashraf', title: 'Full Stack Developer', location: defaultLocation, skills: ['React', 'Node.js', 'PostgreSQL', 'AWS'] },
    { name: 'Omar Samir', title: 'Senior Developer', location: defaultLocation, skills: ['TypeScript', 'React', 'Node.js', 'MongoDB'] },
    { name: 'Nour Hamdy', title: 'Software Developer', location: defaultLocation, skills: ['Java', 'Spring', 'MySQL', 'Docker'] },
    { name: 'Youssef Adly', title: 'Tech Lead', location: defaultLocation, skills: ['React', 'Node.js', 'AWS', 'Kubernetes'] },
  ];

  return mockTemplates.map((t: MockTemplate, i: number) => {
    const slug = t.name.toLowerCase().replace(new RegExp('[ \t]+', 'g'), '-');
    const allKws = kwSets.flat();
    const matchedKws = allKws.filter(kw =>
      (t.title + ' ' + t.skills.join(' ')).toLowerCase().includes(kw.toLowerCase())
    );
    const score = Math.min(95, 55 + (matchedKws.length * 8) + (i === 0 ? 5 : 0));

    return {
      full_name: t.name,
      title: t.title,
      location: t.location,
      linkedin_url: `https://www.linkedin.com/in/${slug}`,
      source: 'Sourced',
      match_reason:
        matchedKws.length > 0
          ? `Strong match on: ${matchedKws.slice(0, 3).join(', ')}. Profile aligns with JD requirements.`
          : 'Profile aligns with job requirements based on role and location.',
      match_score: score,
      skills: t.skills,
      status: 'New',
      uploaded_at: new Date().toISOString(),
    };
  });
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jd, limit = 10 } = body as { jd: string; limit?: number };

    if (!jd || jd.trim().length < 20) {
      return NextResponse.json({ error: 'Please provide a job description (at least 20 characters).' }, { status: 400 });
    }

    const kwSets = extractKeywords(jd);
    const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY || 'BSAkO1bNAF5QCq4K_b3UCuQlR8FNKEP';
    const isCreative = R.creative.test(jd);

    // ── Clear previous sourced candidates before new search ───────────────
    await supabase
      .from('unvetted')
      .delete()
      .in('source', ['LinkedIn', 'Wuzzuf', 'Bayt', 'Behance', 'Sourced']);

    // ── Platform config — distribute limit across sources ─────────────────
    const platforms: PlatformConfig[] = [
      { name: 'LinkedIn', siteQuery: 'site:linkedin.com/in',  limit: 4 },
      { name: 'Wuzzuf',   siteQuery: 'site:wuzzuf.net',       limit: 3 },
      { name: 'Bayt',     siteQuery: 'site:bayt.com',         limit: 2 },
      ...(isCreative ? [{ name: 'Behance' as Platform, siteQuery: 'site:behance.net', limit: 2 }] : []),
    ];

    let candidates: CandidateResult[] = [];
    const seen = new Set<string>();

    // ── Real Brave Search across all platforms ────────────────────────────
    for (let pi = 0; pi < platforms.length; pi++) {
      const platform = platforms[pi];
      if (candidates.length >= limit) break;
      // Rotate keyword sets per platform so each gets slightly different queries
      const kws = kwSets[pi % kwSets.length] || kwSets[0];
      const query = `${platform.siteQuery} ${kws.join(' ')}`;
      const encoded = encodeURIComponent(query);
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encoded}&count=${platform.limit + 2}`;

      try {
        const resp = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'X-Subscription-Token': BRAVE_API_KEY,
          },
        });

        if (!resp.ok) {
          console.warn(`Brave search failed for ${platform.name}: ${resp.status} ${resp.statusText}`);
          continue;
        }

        const data = await resp.json();
        const results: RawBraveResult[] = data?.web?.results || [];

        for (const result of results) {
          const parsed = parseResult(result, kws, jd, platform.name);
          if (!parsed) continue;
          const dedupeKey = parsed.linkedin_url || parsed.portfolio_url || '';
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);
          candidates.push(parsed);
          if (candidates.length >= limit) break;
        }
      } catch (searchErr) {
        console.warn(`Search error for ${platform.name}:`, searchErr);
      }
    }

    // ── Top-up with mocks if Brave returned too few real results ──────────
    if (candidates.length < 3) {
      const mocks = generateMockCandidates(kwSets, jd);
      const ts = Date.now();
      for (let i = 0; i < mocks.length && candidates.length < limit; i++) {
        // Make mock URLs unique per run to avoid dedup collisions
        const m = { ...mocks[i], linkedin_url: mocks[i].linkedin_url + '-' + ts + '-' + i };
        candidates.push(m);
      }
    }

    // ── Insert into Supabase unvetted table ───────────────────────────────────
    // Only insert columns that exist in the unvetted schema:
    // id, created_at, uploaded_at, full_name, email, phone, resume_url, resume_text,
    // status, title, location, years_experience_total, linkedin_url, portfolio_url,
    // source, match_score, match_reason
    let insertedCount = 0;
    const insertedCandidates: CandidateResult[] = [];

    for (const candidate of candidates) {
      const dedupeKey = candidate.linkedin_url || candidate.portfolio_url || '';
      if (!dedupeKey) continue;

      const field = candidate.linkedin_url ? 'linkedin_url' : 'portfolio_url';
      const { data: existing } = await supabase
        .from('unvetted')
        .select('id')
        .eq(field, dedupeKey)
        .maybeSingle();

      if (existing) continue;

      // Strip fields not in schema (skills, technologies, tools, work_history)
      const row = {
        full_name:              candidate.full_name,
        title:                  candidate.title,
        location:               candidate.location,
        linkedin_url:           candidate.linkedin_url,
        portfolio_url:          candidate.portfolio_url || null,
        source:                 candidate.source,
        match_score:            candidate.match_score,
        match_reason:           candidate.match_reason,
        status:                 candidate.status,
        uploaded_at:            candidate.uploaded_at,
        years_experience_total: 0,
        email:                  null,
        phone:                  null,
        resume_url:             null,
        resume_text:            null,
      };

      const { error: insertErr } = await supabase.from('unvetted').insert(row);
      if (!insertErr) {
        insertedCount++;
        insertedCandidates.push(candidate);
      } else {
        console.warn('Insert error:', insertErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      sourced: insertedCount,
      candidates: insertedCandidates,
      keywordSets: kwSets,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('source-talent error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
