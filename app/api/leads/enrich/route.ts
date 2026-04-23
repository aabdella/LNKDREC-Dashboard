import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';

const APOLLO_API_URL = 'https://api.apollo.io/v1/mixed_people/search';

const TALENT_TITLES = [
  'Head of Talent',
  'Talent Acquisition',
  'Talent Partner',
  'Recruiter',
  'Senior Recruiter',
  'Technical Recruiter',
  'People & Culture',
  'HR Director',
  'HR Manager',
  'Head of People',
  'VP People',
  'Chief People Officer',
];

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const body = await request.json();
  const { lead_id } = body;

  if (!lead_id) return NextResponse.json({ error: 'Missing lead_id' }, { status: 400 });

  const apolloKey = process.env.APOLLO_API_KEY;
  if (!apolloKey) return NextResponse.json({ error: 'Apollo API key not configured' }, { status: 500 });

  // Fetch the lead
  const { data: lead, error: leadError } = await supabase
    .from('qualified_leads')
    .select('*')
    .eq('id', lead_id)
    .single();

  if (leadError || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  try {
    // Search Apollo for talent/HR contacts at this company
    const apolloRes = await fetch(APOLLO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({
        api_key: apolloKey,
        q_organization_name: lead.company_name,
        person_titles: TALENT_TITLES,
        page: 1,
        per_page: 10,
      }),
    });

    if (!apolloRes.ok) {
      const err = await apolloRes.text();
      console.error('[enrich] Apollo error:', err);
      return NextResponse.json({ error: 'Apollo API request failed' }, { status: 502 });
    }

    const apolloData = await apolloRes.json();
    const people = apolloData.people || [];

    if (people.length === 0) {
      // Mark as enriched even if no contacts found
      await supabase
        .from('qualified_leads')
        .update({ status: 'enriched', enriched_at: new Date().toISOString() })
        .eq('id', lead_id);

      return NextResponse.json({ success: true, contacts_found: 0 });
    }

    // Insert contacts (delete old ones first to avoid dupes on re-enrich)
    await supabase.from('lead_contacts').delete().eq('lead_id', lead_id);

    const contacts = people.map((person: any) => ({
      lead_id,
      name: person.name || null,
      title: person.title || null,
      email: person.email || null,
      linkedin_url: person.linkedin_url || null,
      source: 'apollo',
    }));

    const { error: insertError } = await supabase.from('lead_contacts').insert(contacts);
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    // Update lead status
    await supabase
      .from('qualified_leads')
      .update({ status: 'enriched', enriched_at: new Date().toISOString() })
      .eq('id', lead_id);

    return NextResponse.json({ success: true, contacts_found: contacts.length, contacts });
  } catch (err: any) {
    console.error('[enrich] Unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
