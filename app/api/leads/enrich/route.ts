import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';

// Keyword filter for HR/Talent roles
const TALENT_KEYWORDS = [
  'talent', 'recruit', 'hr ', 'human resource', 'people', 'hiring',
  'staffing', 'workforce', 'culture', 'acquisition', 'head of people',
];

function isTalentContact(position: string): boolean {
  if (!position) return false;
  const p = position.toLowerCase();
  return TALENT_KEYWORDS.some((kw) => p.includes(kw));
}

// ── Hunter.io ─────────────────────────────────────────────────────────────────
// API: GET https://api.hunter.io/v2/domain-search
// Supports both ?domain= and ?company= params
// Response: { data: { emails: [{ value, first_name, last_name, position, linkedin, ... }] } }
async function searchHunter(domain: string, companyName?: string): Promise<any[]> {
  const hunterKey = process.env.HUNTER_API_KEY;
  if (!hunterKey) throw new Error('Hunter API key not configured');

  const HUNTER_DEPARTMENTS = ['hr', 'recruiting'];
  const contacts: any[] = [];

  // Try domain search first
  for (const dept of HUNTER_DEPARTMENTS) {
    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&department=${dept}&limit=10&api_key=${hunterKey}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      contacts.push(...(data?.data?.emails || []));
    }
  }

  // If domain returned nothing, try company name directly
  if (contacts.length === 0 && companyName) {
    for (const dept of HUNTER_DEPARTMENTS) {
      const url = `https://api.hunter.io/v2/domain-search?company=${encodeURIComponent(companyName)}&department=${dept}&limit=10&api_key=${hunterKey}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        contacts.push(...(data?.data?.emails || []));
      }
    }
  }

  // Deduplicate by email
  const seen = new Set<string>();
  return contacts.filter((c) => {
    if (seen.has(c.value)) return false;
    seen.add(c.value);
    return true;
  });
}


// -- People Data Labs ----------------------------------------------------------
// API: POST https://api.peopledatalabs.com/v5/person/search
// Auth: X-Api-Key header
// Body: { sql: "SELECT ... FROM person WHERE job_company_website='domain.com' AND job_title_role='human resources' LIMIT 10", size: 10 }
// Response: { status: 200, data: [{ first_name, last_name, full_name, job_title, work_email, linkedin_url }], total: N }
async function searchPDL(domain: string, companyName?: string): Promise<any[]> {
  const pdlKey = process.env.PDL_API_KEY;
  if (!pdlKey) throw new Error('People Data Labs API key not configured');

  const cleanDomain = domain.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '');
  const queries = [
    `SELECT first_name, last_name, full_name, job_title, work_email, linkedin_url FROM person WHERE job_company_website='${cleanDomain}' AND job_title_role='human resources' LIMIT 10`,
    ...(companyName ? [`SELECT first_name, last_name, full_name, job_title, work_email, linkedin_url FROM person WHERE job_company_name='${companyName.replace(/'/g, "\'\''")}' AND job_title_role='human resources' LIMIT 10`] : []),
  ];

  for (const sql of queries) {
    const res = await fetch('https://api.peopledatalabs.com/v5/person/search', {
      method: 'POST',
      headers: { 'X-Api-Key': pdlKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, size: 10 }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`PDL API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const results: any[] = data?.data || [];
    if (results.length > 0) return results;
  }

  return [];
}

// ── Apollo ────────────────────────────────────────────────────────────────────
// NOTE: Apollo's people search endpoints (/v1/people/search, /v1/mixed_people/search)
// require a paid plan. The free plan only allows organization/account lookup.
// We surface a clear user-facing message instead of a raw 403.
async function searchApollo(_domain: string): Promise<any[]> {
  throw new Error('Apollo people search requires a paid Apollo plan. Please upgrade at https://app.apollo.io or use Hunter.io / Prospeo instead.');
}

// ── Prospeo ───────────────────────────────────────────────────────────────────
// API: POST https://api.prospeo.io/search-person
// Headers: X-KEY, Content-Type
// Body: { "filters": { "company": { "websites": { "include": ["domain.com"] } }, "person_department": { "include": ["Human Resources"] } }, "page": 1 }
// Response: { error: false, results: [ { person: { first_name, last_name, full_name, current_job_title, linkedin_url, email: { status, revealed, email } } } ], pagination: {...} }
async function searchProspeo(domain: string, companyName?: string): Promise<any[]> {
  const prospeoKey = process.env.PROSPEO_API_KEY;
  if (!prospeoKey) throw new Error('Prospeo API key not configured');

  // Prospeo domain filter: just the bare domain (no https://, no www)
  const cleanDomain = domain.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '');

  const filters: Record<string, any> = {
    company: {
      websites: { include: [cleanDomain] },
      ...(companyName ? { names: { include: [companyName] } } : {}),
    },
    person_department: { include: ['Human Resources'] },
  };

  const res = await fetch('https://api.prospeo.io/search-person', {
    method: 'POST',
    headers: {
      'X-KEY': prospeoKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ filters, page: 1 }),
  });

  if (!res.ok) {
    const errText = await res.text();
    // NO_RESULTS is a valid empty response — not an error worth surfacing
    try {
      const parsed = JSON.parse(errText);
      if (parsed?.error_code === 'NO_RESULTS') return [];
    } catch {}
    throw new Error(`Prospeo API error ${res.status}: ${errText}`);
  }

  const data = await res.json();

  if (data.error) {
    if (data.error_code === 'NO_RESULTS') return [];
    throw new Error(`Prospeo error: ${data.error_code || 'unknown'}${data.filter_error ? ` — ${data.filter_error}` : ''}`);
  }

  return data?.results || [];
}

// ── Domain extraction ─────────────────────────────────────────────────────────
function extractDomain(companyName: string): string {
  const slug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${slug}.com`;
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const body = await request.json();
  const { lead_id, provider = 'hunter' } = body;

  if (!lead_id) return NextResponse.json({ error: 'Missing lead_id' }, { status: 400 });

  const { data: lead, error: leadError } = await supabase
    .from('qualified_leads')
    .select('*')
    .eq('id', lead_id)
    .single();

  if (leadError || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  try {
    const domain = lead.company_domain || extractDomain(lead.company_name);
    console.log(`[enrich] Provider=${provider} domain=${domain} company=${lead.company_name}`);

    let rows: any[] = [];

    if (provider === 'hunter') {
      const contacts = await searchHunter(domain, lead.company_name);
      const talent = contacts.filter((c) => isTalentContact(c.position || ''));
      const final = talent.length > 0 ? talent : contacts.slice(0, 5);
      console.log(`[enrich] Hunter: ${contacts.length} total, ${talent.length} HR/talent`);
      rows = final.map((c: any) => ({
        lead_id,
        name: [c.first_name, c.last_name].filter(Boolean).join(' ') || null,
        title: c.position || null,
        email: c.value || null,
        linkedin_url: c.linkedin || null,
        source: 'hunter',
      }));

    } else if (provider === 'apollo') {
      const contacts = await searchApollo(domain);
      console.log(`[enrich] Apollo: ${contacts.length} contacts`);
      rows = contacts.map((c: any) => ({
        lead_id,
        name: [c.first_name, c.last_name].filter(Boolean).join(' ') || null,
        title: c.title || null,
        email: c.email || null,
        linkedin_url: c.linkedin_url || null,
        source: 'apollo',
      }));

    } else if (provider === 'prospeo') {
      const results = await searchProspeo(domain, lead.company_name);
      console.log(`[enrich] Prospeo: ${results.length} results`);
      // Each result is { person: {...}, company: {...} }
      // Filter to HR/talent by job title, fall back to all if none match
      const talent = results.filter((r: any) => isTalentContact(r.person?.current_job_title || ''));
      const final = talent.length > 0 ? talent : results.slice(0, 5);
      rows = final.map((r: any) => {
        const p = r.person || {};
        return {
          lead_id,
          name: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || null,
          title: p.current_job_title || null,
          email: p.email?.status === 'VERIFIED' ? p.email?.email : null,
          linkedin_url: p.linkedin_url || null,
          source: 'prospeo',
        };
      });

    } else if (provider === 'pdl') {
      const results = await searchPDL(domain, lead.company_name);
      console.log(`[enrich] PDL: ${results.length} results`);
      const talent = results.filter((p: any) => isTalentContact(p.job_title || ''));
      const final = talent.length > 0 ? talent : results.slice(0, 5);
      rows = final.map((p: any) => ({
        lead_id,
        name: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || null,
        title: p.job_title || null,
        email: p.work_email || null,
        linkedin_url: p.linkedin_url || null,
        source: 'pdl',
      }));

    } else {
      return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
    }

    // Replace contacts for this lead
    await supabase.from('lead_contacts').delete().eq('lead_id', lead_id);
    if (rows.length > 0) {
      const { error: insertError } = await supabase.from('lead_contacts').insert(rows);
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Update lead metadata
    await supabase
      .from('qualified_leads')
      .update({ status: 'enriched', enriched_at: new Date().toISOString(), company_domain: domain })
      .eq('id', lead_id);

    return NextResponse.json({
      success: true,
      contacts_found: rows.length,
      domain_searched: domain,
      provider,
    });
  } catch (err: any) {
    console.error('[enrich] Error:', err.message);
    return NextResponse.json({ error: err.message || 'Enrichment failed' }, { status: 500 });
  }
}
