import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseJD, SKILL_RARITY } from '@/lib/parseJD';

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function getSupabaseClient() {
  const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is required.');
  }
  return createClient(supabaseUrl, supabaseKey);
}

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
// 6 genuinely different query strategies — not just location permutations.
function buildKeywordSets(parsed: ReturnType<typeof parseJD>): string[][] {
  const { role_title, title_variants, must_have_skills, skill_aliases, location, seniority_prefix, search_hints } = parsed;

  const primaryTitle = (seniority_prefix && !role_title.toLowerCase().startsWith(seniority_prefix.toLowerCase()))
    ? `${seniority_prefix} ${role_title}`
    : role_title;

  const allTitles = [primaryTitle, ...title_variants].slice(0, 3);
  const loc = location || 'Egypt';

  // Ranked skill tiers from search_hints
  const nicheTerm   = search_hints.niche_terms[0] || null;
  const nicheTerm2  = search_hints.niche_terms[1] || null;
  const domainSkill = search_hints.must_include[0] || must_have_skills[0] || null;
  const domainSkill2= search_hints.must_include[1] || must_have_skills[1] || null;
  const company     = search_hints.company_targets[0] || null;
  const roleConcept = search_hints.role_concept !== primaryTitle ? search_hints.role_concept : null;

  const sets: string[][] = [];

  // Strategy 1: Broad title + location
  sets.push([allTitles[0], loc]);

  // Strategy 2: Niche tool anchor — people who list the specific platform
  // e.g. "Talkwalker Egypt" finds profiles that mention the tool directly
  if (nicheTerm) sets.push([nicheTerm, loc]);
  else if (domainSkill) sets.push([allTitles[0], domainSkill, loc]);

  // Strategy 3: Industry-aware compound concept
  // e.g. "Media Analytics Engineer Egypt" — role + industry context
  if (roleConcept) sets.push([roleConcept, loc]);
  else if (domainSkill) sets.push([allTitles[0], domainSkill, loc]);

  // Strategy 4: Title variant + niche/domain skill
  // e.g. "Analytics Engineer Talkwalker"
  if (allTitles[1] && (nicheTerm || domainSkill)) {
    sets.push([allTitles[1], nicheTerm || domainSkill!, loc]);
  } else if (allTitles[1]) {
    sets.push([allTitles[1], loc]);
  }

  // Strategy 5: Company-targeted search
  // e.g. "Data Engineer Vodafone Egypt" — targets candidates from known companies
  if (company) sets.push([allTitles[0], company, loc]);
  else if (nicheTerm2) sets.push([allTitles[0], nicheTerm2, loc]);
  else if (domainSkill2) sets.push([allTitles[0], domainSkill2, loc]);
  else if (skill_aliases[0]) sets.push([allTitles[0], skill_aliases[0], loc]);

  // Strategy 6: Second title variant or bare niche term (profile-keyword sweep)
  if (allTitles[2]) sets.push([allTitles[2], loc]);
  else if (nicheTerm) sets.push([nicheTerm, 'Cairo']);
  else sets.push([allTitles[0], 'Cairo']);

  // Dedupe
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

  // ── Normalized scoring — meaningful tiers ────────────────────────────
  // 70-99 = strong match (niche skill or company match found)
  // 50-69 = title/domain match
  // 30-49 = weak / title only
  let score = 35; // baseline — title matched via search

  // Niche/rare keyword hits (worth the most — very discriminating)
  const nicheKeywords = keywords.filter(kw => {
    const rarityScore = (SKILL_RARITY as Record<string, number>)[kw] ?? 0;
    return rarityScore >= 3;
  });
  const domainKeywords = keywords.filter(kw => {
    const rarityScore = (SKILL_RARITY as Record<string, number>)[kw] ?? 0;
    return rarityScore === 2;
  });
  const commonKeywords = keywords.filter(kw => {
    const rarityScore = (SKILL_RARITY as Record<string, number>)[kw] ?? 0;
    return rarityScore <= 1;
  });

  nicheKeywords.forEach(kw => { if (descLower.includes(kw.toLowerCase())) score += 15; });
  domainKeywords.forEach(kw => { if (descLower.includes(kw.toLowerCase())) score += 7; });
  commonKeywords.forEach(kw => { if (descLower.includes(kw.toLowerCase())) score += 2; });

  if (companyMatched) score += 10;
  // Location-relevant bonuses
  if (descLower.includes('saudi') || descLower.includes('ksa'))  score += 5;
  if (descLower.includes('gcc')   || descLower.includes('gulf')) score += 5;
  const visRegex = new RegExp('\\b(vis|vois|_vois|vodafone international)\\b', 'i');
  if (visRegex.test(descLower)) score += 8;

  // Clamp to 0-99
  if (score > 99) score = 99;
  if (score < 0)  score = 0;

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
    const supabase = getSupabaseClient();
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

    // ── Create sourcing session ─────────────────────────────────────────
    const sessionLabel = `Quick Source · ${parsedTitle}`;
    const { data: sessionRow, error: sessionErr } = await supabase
      .from('sourcing_sessions')
      .insert({
        label: sessionLabel,
        run_type: 'quick_source',
        jd_snippet: jd.substring(0, 300),
        parsed_title: parsedTitle,
        created_by: 'system',
      })
      .select('id')
      .single();
    if (sessionErr || !sessionRow) {
      console.error('Failed to create sourcing session:', sessionErr);
      return NextResponse.json({ error: 'Failed to create sourcing session.' }, { status: 500 });
    }
    const sourcingSessionId = sessionRow.id;

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
        sourcing_session_id:    sourcingSessionId,
      };
      const { error: insertErr } = await supabase.from('unvetted').insert(row);
      if (!insertErr) {
        insertedCount++;
        insertedCandidates.push(candidate);
      } else {
        console.warn('Insert error:', insertErr.message);
      }
    }

    // ── Update session candidate count ─────────────────────────────────
    await supabase
      .from('sourcing_sessions')
      .update({ candidate_count: insertedCount })
      .eq('id', sourcingSessionId);

    return NextResponse.json({
      success: true,
      sourced: insertedCount,
      candidates: insertedCandidates,
      session: { id: sourcingSessionId, label: sessionLabel },
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
