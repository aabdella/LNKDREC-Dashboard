import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';

// Hunter.io department filter covers HR/Talent/People roles
const HUNTER_DEPARTMENTS = ['hr', 'recruiting'];

// Fallback keyword filter if department search returns non-talent results
const TALENT_KEYWORDS = [
  'talent', 'recruit', 'hr ', 'human resource', 'people', 'hiring',
  'staffing', 'workforce', 'culture', 'acquisition',
];

function isTalentContact(position: string): boolean {
  if (!position) return false;
  const p = position.toLowerCase();
  return TALENT_KEYWORDS.some((kw) => p.includes(kw));
}

async function searchHunter(domain: string, companyName?: string): Promise<any[]> {
  const hunterKey = process.env.HUNTER_API_KEY;
  if (!hunterKey) throw new Error('Hunter API key not configured');

  const contacts: any[] = [];

  for (const dept of HUNTER_DEPARTMENTS) {
    // Prefer domain search; fall back to company name search if domain yields nothing
    const byDomain = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&department=${dept}&limit=10&api_key=${hunterKey}`;
    const res = await fetch(byDomain);
    if (res.ok) {
      const data = await res.json();
      const emails: any[] = data?.data?.emails || [];
      contacts.push(...emails);
    }
  }

  // If domain search returned nothing and we have a company name, try company name search
  if (contacts.length === 0 && companyName) {
    for (const dept of HUNTER_DEPARTMENTS) {
      const byCompany = `https://api.hunter.io/v2/domain-search?company=${encodeURIComponent(companyName)}&department=${dept}&limit=10&api_key=${hunterKey}`;
      const res = await fetch(byCompany);
      if (res.ok) {
        const data = await res.json();
        const emails: any[] = data?.data?.emails || [];
        contacts.push(...emails);
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

async function searchApollo(domain: string): Promise<any[]> {
  const apolloKey = process.env.APOLLO_API_KEY;
  if (!apolloKey) throw new Error('Apollo API key not configured');

  // Use people/search (accessible on free plan; mixed_people/search requires paid)
  const res = await fetch('https://api.apollo.io/v1/people/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Api-Key': apolloKey,
    },
    body: JSON.stringify({
      q_organization_domains: domain,
      person_titles: ['HR Manager', 'Talent Acquisition', 'Recruiter', 'People Operations', 'Head of Talent', 'Talent Partner'],
      per_page: 10,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Apollo API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data?.people || [];
}

async function searchProspeo(domain: string): Promise<any[]> {
  const prospeoKey = process.env.PROSPEO_API_KEY;
  if (!prospeoKey) throw new Error('Prospeo API key not configured');

  // Prospeo requires a full URL (https://domain.com) not just the domain
  const companyUrl = domain.startsWith('http') ? domain : `https://${domain}`;

  const res = await fetch('https://api.prospeo.io/search-person', {
    method: 'POST',
    headers: {
      'X-KEY': prospeoKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      company_url: companyUrl,
      limit: 10,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Prospeo API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  // data may be { response: [...] } or { data: [...] } depending on plan
  return data?.response || data?.data || [];
}

function extractDomain(companyName: string): string | null {
  // Simple heuristic: lowercase, remove spaces/special chars, append .com
  const slug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${slug}.com`;
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const body = await request.json();
  const { lead_id, provider = 'hunter' } = body;

  if (!lead_id) return NextResponse.json({ error: 'Missing lead_id' }, { status: 400 });

  // Fetch the lead
  const { data: lead, error: leadError } = await supabase
    .from('qualified_leads')
    .select('*')
    .eq('id', lead_id)
    .single();

  if (leadError || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  try {
    // Try company_domain if stored, else derive from company name
    const domain = lead.company_domain || extractDomain(lead.company_name);
    console.log(`[enrich] Searching ${provider} for domain: ${domain} (${lead.company_name})`);

    let finalContacts: any[] = [];

    if (provider === 'hunter') {
      const hunterContacts = await searchHunter(domain, lead.company_name);
      const talentContacts = hunterContacts.filter((c) => isTalentContact(c.position || ''));
      finalContacts = talentContacts.length > 0 ? talentContacts : hunterContacts.slice(0, 5);
      console.log(`[enrich] Hunter: ${hunterContacts.length} total, ${talentContacts.length} talent-specific`);

      // Delete old contacts then insert fresh
      await supabase.from('lead_contacts').delete().eq('lead_id', lead_id);

      if (finalContacts.length > 0) {
        const rows = finalContacts.map((c: any) => ({
          lead_id,
          name: [c.first_name, c.last_name].filter(Boolean).join(' ') || null,
          title: c.position || null,
          email: c.value || null,
          linkedin_url: c.linkedin || null,
          source: 'hunter',
        }));
        const { error: insertError } = await supabase.from('lead_contacts').insert(rows);
        if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

    } else if (provider === 'apollo') {
      const apolloContacts = await searchApollo(domain);
      finalContacts = apolloContacts;
      console.log(`[enrich] Apollo: ${apolloContacts.length} contacts found`);

      // Delete old contacts then insert fresh
      await supabase.from('lead_contacts').delete().eq('lead_id', lead_id);

      if (finalContacts.length > 0) {
        const rows = finalContacts.map((c: any) => ({
          lead_id,
          name: [c.first_name, c.last_name].filter(Boolean).join(' ') || null,
          title: c.title || null,
          email: c.email || null,
          linkedin_url: c.linkedin_url || null,
          source: 'apollo',
        }));
        const { error: insertError } = await supabase.from('lead_contacts').insert(rows);
        if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

    } else if (provider === 'prospeo') {
      const prospeoContacts = await searchProspeo(domain);
      const talentContacts = prospeoContacts.filter((c: any) => isTalentContact(c.job_title || ''));
      finalContacts = talentContacts.length > 0 ? talentContacts : prospeoContacts.slice(0, 5);
      console.log(`[enrich] Prospeo: ${prospeoContacts.length} total, ${talentContacts.length} talent-specific`);

      // Delete old contacts then insert fresh
      await supabase.from('lead_contacts').delete().eq('lead_id', lead_id);

      if (finalContacts.length > 0) {
        const rows = finalContacts.map((c: any) => ({
          lead_id,
          name: [c.first_name, c.last_name].filter(Boolean).join(' ') || null,
          title: c.job_title || null,
          email: c.email?.value || null,
          linkedin_url: c.linkedin_url || null,
          source: 'prospeo',
        }));
        const { error: insertError } = await supabase.from('lead_contacts').insert(rows);
        if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

    } else {
      return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
    }

    // Store the domain and update enrichment timestamp
    await supabase
      .from('qualified_leads')
      .update({
        status: 'enriched',
        enriched_at: new Date().toISOString(),
        company_domain: domain,
      })
      .eq('id', lead_id);

    return NextResponse.json({
      success: true,
      contacts_found: finalContacts.length,
      domain_searched: domain,
      provider,
    });
  } catch (err: any) {
    console.error('[enrich] Error:', err.message);
    return NextResponse.json({ error: err.message || 'Enrichment failed' }, { status: 500 });
  }
}
