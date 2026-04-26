import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseJD } from '@/lib/parseJD';

// ─── Supabase ────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
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
}

interface CandidateResult {
  full_name: string;
  title: string;
  location: string;
  company?: string;
  linkedin_url: string;
  portfolio_url?: string;
  source: string;
  match_reason: string;
  match_score: number;
  skills: string[];
  status: string;
  uploaded_at: string;
  keywords_matched: string[];
  skills_matched: string[];
  completeness_score: number;
  company_matched: boolean;
}

// ─── Regex helpers ────────────────────────────────────────────────────────────
const R = {
  linkedinSlug:  new RegExp('linkedin[.]com/in/([a-zA-Z0-9_-]+)', 'i'),
  behanceSlug:   new RegExp('behance[.]net/([a-zA-Z0-9_-]+)', 'i'),
  locationEg:    new RegExp('Egypt|Cairo|Alexandria|Giza|Maadi|Heliopolis|Dokki|Nasr[ \t]City|Sheikh[ \t]Zayed|October', 'i'),
  companyAt:     new RegExp('at[ \\t]+([A-Z][a-zA-Z0-9 \\t\\-_]+)', 'i'),
  companyDash:   new RegExp('[ \\t]-[ \\t]+([A-Z][a-zA-Z0-9 \\t\\-_]+)', 'i'),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeTitleAndCompany(titleRaw: string): { title: string; company: string } {
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
  title = title.replace(new RegExp('[|][ \\t]*(LinkedIn|Behance|Wuzzuf|Bayt).*$', 'i'), '').trim();
  return { title: title.substring(0, 80) || 'Professional', company };
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(new RegExp('[\\.\\-\'_]', 'g'), ' ').replace(new RegExp('[ \\t]+', 'g'), ' ').trim();
}

function namesSimilar(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return true;
  return na.length > 3 && nb.length > 3 && (na.includes(nb) || nb.includes(na));
}

function calcCompleteness(candidate: Partial<CandidateResult>): number {
  let score = 0;
  if (candidate.full_name && candidate.full_name !== 'Unknown') score += 20;
  if (candidate.title && candidate.title !== 'Professional') score += 20;
  if (candidate.location && candidate.location !== 'Egypt') score += 20;
  if (candidate.company) score += 20;
  if (candidate.skills && candidate.skills.length > 0) score += 20;
  return score;
}

// ─── Build keyword sets from ParsedJD ────────────────────────────────────────
// Returns an array of keyword arrays — each array becomes one Brave query.
function buildKeywordSets(parsed: ReturnType<typeof parseJD>): string[][] {
  const { role_title, title_variants, must_have_skills, skill_aliases, location, seniority_prefix } = parsed;

  // Primary title — use seniority-prefixed version if not already present
  const primaryTitle = (seniority_prefix && !role_title.toLowerCase().startsWith(seniority_prefix.toLowerCase()))
    ? `${seniority_prefix} ${role_title}`
    : role_title;

  // All title forms to anchor queries on
  const allTitles = [primaryTitle, ...title_variants].slice(0, 3);

  // Top skills for query refinement
  const skill1 = must_have_skills[0] || null;
  const skill2 = must_have_skills[1] || null;
  const alias1 = skill_aliases[0] || null;

  // Location anchor — default Egypt
  const loc = location || 'Egypt';

  const sets: string[][] = [];

  // Set 1: primary title + location (broadest)
  sets.push([allTitles[0], loc]);

  // Set 2: primary title + Cairo (city precision)
  sets.push([allTitles[0], 'Cairo']);

  // Set 3: primary title + top skill + location
  if (skill1) sets.push([allTitles[0], skill1, loc]);
  else sets.push([allTitles[0], loc]);

  // Set 4: primary title + second skill + location
  if (skill2) sets.push([allTitles[0], skill2, loc]);
  else if (alias1) sets.push([allTitles[0], alias1, loc]);
  else sets.push([allTitles[0], loc]);

  // Set 5: first title variant + location
  if (allTitles[1]) sets.push([allTitles[1], loc]);
  else sets.push([allTitles[0], 'Alexandria', loc]);

  // Set 6: second title variant + skill
  if (allTitles[2] && skill1) sets.push([allTitles[2], skill1, loc]);
  else if (allTitles[1] && skill2) sets.push([allTitles[1], skill2, loc]);
  else sets.push([allTitles[0], 'Alexandria']);

  // Dedupe sets
  const seen = new Set<string>();
  return sets.filter(s => {
    const key = s.join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Parse a Brave result into a candidate ────────────────────────────────────
function parseResult(
  result: RawBraveResult,
  keywords: string[],
  jd: string,
  platform: Platform
): CandidateResult | null {
  const url = result.url || '';
  const titleRaw = result.title || '';
  const desc = result.description || '';

  if (platform === 'LinkedIn' && !url.includes('linkedin.com/in/')) return null;
  if (platform === 'Behance'  && !url.includes('behance.net'))       return null;
  if (platform === 'Wuzzuf'   && !url.includes('wuzzuf.net'))        return null;
  if (platform === 'Bayt'     && !url.includes('bayt.com'))          return null;
  if (platform === 'Bayt' && /\/jobs\/|\/job\/|job-search|jobseeker/i.test(url)) return null;

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
      full_name      = cleaned.substring(0, dashIdx).trim();
      candidateTitle = cleaned.substring(dashIdx + 3).split(' at ')[0].split(' | ')[0].trim() || 'Professional';
    } else {
      full_name = cleaned.trim().substring(0, 60);
      const firstSentence = desc.replace(new RegExp('<[^>]+>', 'g'), '').split('.')[0].trim();
      if (firstSentence.length > 3 && firstSentence.length < 100) candidateTitle = firstSentence;
    }
    if (!full_name || full_name.length > 60 || full_name === full_name.toUpperCase()) return null;
  } else if (platform === 'Behance') {
    const slugMatch = url.match(R.behanceSlug);
    portfolio_url  = slugMatch ? `https://www.behance.net/${slugMatch[1]}` : url;
    const cleaned  = titleRaw.replace(new RegExp('[|].*Behance.*$', 'i'), '').trim();
    full_name      = cleaned.split(' - ')[0].replace('Portfolio', '').trim().substring(0, 60) || 'Designer';
    candidateTitle = desc.split('.')[0].trim().substring(0, 80) || 'Creative Designer';
  } else {
    portfolio_url  = url;
    const cleaned  = titleRaw.replace(new RegExp('[|].*$', ''), '').trim();
    full_name      = cleaned.split(' - ')[0].trim().substring(0, 60) || 'Candidate';
    candidateTitle = cleaned.split(' - ').length > 1
      ? cleaned.split(' - ')[0].trim()
      : desc.split('.')[0].trim().substring(0, 80) || 'Professional';
  }

  let location = 'Egypt';
  const combinedText = titleRaw + ' ' + desc;
  if (R.locationEg.test(combinedText)) {
    const m = combinedText.match(R.locationEg);
    location = m ? m[0] : 'Egypt';
  }

  const skillKeywords = [
    'React','Angular','Vue','TypeScript','JavaScript','Node.js','Python','Django',
    'FastAPI','Java','Go','PostgreSQL','MongoDB','AWS','Docker','Kubernetes','GraphQL','Figma',
    'Flutter','Swift','Kotlin','TensorFlow','Photoshop','Illustrator','Adobe XD','After Effects','InDesign','Premiere',
  ];
  const descLower = (titleRaw + ' ' + desc).toLowerCase();
  const skills = skillKeywords.filter(s => descLower.includes(s.toLowerCase())).slice(0, 6);
  const skillsMatched = skills.filter(s => keywords.some(kw => kw.toLowerCase().includes(s.toLowerCase())));

  const { title: normalizedTitle, company: extractedCompany } = normalizeTitleAndCompany(titleRaw + ' ' + desc);
  if (normalizedTitle && normalizedTitle !== 'Professional') candidateTitle = normalizedTitle;
  const company = extractedCompany;

  const keywordsMatched = keywords.filter(kw => descLower.includes(kw.toLowerCase()));
  const companyMatched = company ? keywords.some(kw => kw.toLowerCase() === company.toLowerCase()) : false;

  let score = 45;
  keywords.forEach(kw => { if (descLower.includes(kw.toLowerCase())) score += 12; });
  skills.forEach(() => { score += 2; });
  if (descLower.includes('saudi') || descLower.includes('ksa'))  score += 15;
  if (descLower.includes('gcc')   || descLower.includes('gulf')) score += 10;
  const visRegex = new RegExp('\\b(vis|vois|_vois|vodafone international)\\b', 'i');
  if (visRegex.test(descLower)) score += 20;
  if (companyMatched) score += 15;
  if (score > 99) score = 99;

  const matchReasonParts: string[] = [];
  if (keywordsMatched.length > 0) matchReasonParts.push(`Keywords: ${keywordsMatched.slice(0, 4).join(', ')}`);
  if (skillsMatched.length > 0)   matchReasonParts.push(`Skills: ${skillsMatched.join(', ')}`);
  if (company)                     matchReasonParts.push(`Ex-${company}`);
  if (matchReasonParts.length === 0) matchReasonParts.push(`Found via ${platform} sourcing search`);

  const completeness = calcCompleteness({ full_name, title: candidateTitle, location, company, skills });
  const dedupeKey = linkedin_url || portfolio_url || url;
  if (!dedupeKey) return null;

  return {
    full_name,
    title: candidateTitle,
    location,
    company: company || undefined,
    linkedin_url,
    portfolio_url,
    source: platform,
    match_reason: matchReasonParts.join(' | '),
    match_score: score,
    skills,
    status: 'New',
    uploaded_at: new Date().toISOString(),
    keywords_matched: keywordsMatched,
    skills_matched: skillsMatched,
    completeness_score: completeness,
    company_matched: companyMatched,
  };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jd, limit = 10 } = body as { jd: string; limit?: number };

    if (!jd || jd.trim().length < 20) {
      return NextResponse.json({ error: 'Please provide a job description (at least 20 characters).' }, { status: 400 });
    }

    // ── Parse JD with new structured parser ──────────────────────────────
    const parsed = parseJD(jd);
    const kwSets = buildKeywordSets(parsed);
    const { role_title: parsedTitle, must_have_skills: topSkills, industry, location: parsedLocation } = parsed;

    const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY || '';
    const isCreative = /designer|art.?director|creative|illustrat|visual|motion|graphic/i.test(parsedTitle);

    console.log(`🦞 [Quick Source] role="${parsedTitle}" | industry=${industry} | location=${parsedLocation} | sets=${kwSets.length}`);

    // ── Clear previous sourced candidates ────────────────────────────────
    await supabase
      .from('unvetted')
      .delete()
      .in('source', ['LinkedIn', 'Wuzzuf', 'Bayt', 'Behance', 'Sourced']);

    // ── Platform config ───────────────────────────────────────────────────
    const platforms: PlatformConfig[] = [
      { name: 'LinkedIn', siteQuery: 'site:linkedin.com/in' },
      { name: 'Bayt',     siteQuery: 'site:bayt.com' },
      ...(isCreative ? [{ name: 'Behance' as Platform, siteQuery: 'site:behance.net' }] : []),
    ];

    const allCandidates: CandidateResult[] = [];
    const seen = new Set<string>();

    // ── Search every platform × every keyword set ─────────────────────────
    for (const platform of platforms) {
      for (let ki = 0; ki < kwSets.length; ki++) {
        const kws = kwSets[ki];
        const query = `${platform.siteQuery} ${kws.join(' ')}`;
        const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`;
        try {
          const resp = await fetch(url, {
            headers: { Accept: 'application/json', 'X-Subscription-Token': BRAVE_API_KEY },
          });
          if (!resp.ok) continue;
          const data = await resp.json();
          const results: RawBraveResult[] = data?.web?.results || [];
          for (const result of results) {
            const candidate = parseResult(result, kws, jd, platform.name);
            if (!candidate) continue;
            const dedupeKey = candidate.linkedin_url || candidate.portfolio_url || '';
            if (!dedupeKey || seen.has(dedupeKey)) continue;
            if (allCandidates.some(c => namesSimilar(c.full_name, candidate.full_name))) continue;
            seen.add(dedupeKey);
            allCandidates.push(candidate);
          }
        } catch (e) {
          console.warn(`Search error ${platform.name} kw[${ki}]:`, e);
        }
      }
    }

    // ── Sort by score, take top limit ─────────────────────────────────────
    allCandidates.sort((a, b) => b.match_score - a.match_score);
    const candidates = allCandidates.slice(0, limit);

    // ── Insert into unvetted (no mocks — real results only) ───────────────
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
      debug: {
        parsedTitle,
        industry,
        parsedLocation,
        keywordSets: kwSets,
        topSkills,
        titleVariants: parsed.title_variants,
        totalDiscovered: allCandidates.length,
        inserted: insertedCount,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('source-talent error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
