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

async function searchHunter(domain: string): Promise<any[]> {
  const hunterKey = process.env.HUNTER_API_KEY;
  if (!hunterKey) throw new Error('Hunter API key not configured');

  const contacts: any[] = [];

  for (const dept of HUNTER_DEPARTMENTS) {
    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&department=${dept}&limit=10&api_key=${hunterKey}`;
    const res = await fetch(url);
    if (!res.ok) continue;
    const data = await res.json();
    const emails: any[] = data?.data?.emails || [];
    contacts.push(...emails);
  }

  // Deduplicate by email
  const seen = new Set<string>();
  return contacts.filter((c) => {
    if (seen.has(c.value)) return false;
    seen.add(c.value);
    return true;
  });
}

function extractDomain(companyName: string): string | null {
  // Simple heuristic: lowercase, remove spaces/special chars, append .com
  // In practice Hunter also accepts company names directly
  const slug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${slug}.com`;
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const body = await request.json();
  const { lead_id } = body;

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
    console.log(`[enrich] Searching Hunter for domain: ${domain} (${lead.company_name})`);

    const hunterContacts = await searchHunter(domain);

    // Filter to talent/HR roles only
    const talentContacts = hunterContacts.filter((c) => isTalentContact(c.position || ''));
    const finalContacts = talentContacts.length > 0 ? talentContacts : hunterContacts.slice(0, 5);

    console.log(`[enrich] Found ${hunterContacts.length} contacts, ${talentContacts.length} talent-specific`);

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

    // Store the domain we used for future re-enrichment
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
    });
  } catch (err: any) {
    console.error('[enrich] Error:', err.message);
    return NextResponse.json({ error: err.message || 'Enrichment failed' }, { status: 500 });
  }
}
