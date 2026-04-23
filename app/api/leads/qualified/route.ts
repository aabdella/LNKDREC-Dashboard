import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';

// GET /api/leads/qualified — list all qualified leads with their contacts
export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('qualified_leads')
    .select('*, lead_contacts(*)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, leads: data || [] });
}

// POST /api/leads/qualified — add one or more results as qualified leads (deduplicated by company)
export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const body = await request.json();
  const items: { company_name: string; job_title: string; job_url?: string; board_slug?: string }[] = body.items || [];

  if (!items.length) return NextResponse.json({ error: 'No items provided' }, { status: 400 });

  // Deduplicate: upsert by company_name
  const rows = items.map((item) => ({
    company_name: item.company_name,
    job_title: item.job_title,
    job_url: item.job_url || null,
    board_slug: item.board_slug || null,
    status: 'new',
  }));

  const { data, error } = await supabase
    .from('qualified_leads')
    .upsert(rows, { onConflict: 'company_name', ignoreDuplicates: true })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, added: data?.length || 0 });
}

// PATCH /api/leads/qualified — update status of a lead
export async function PATCH(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const body = await request.json();
  const { id, status } = body;

  if (!id || !status) return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });

  const update: any = { status };
  if (status === 'emailed') update.contacted_at = new Date().toISOString();

  const { error } = await supabase.from('qualified_leads').update(update).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

// DELETE /api/leads/qualified — remove a qualified lead
export async function DELETE(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { error } = await supabase.from('qualified_leads').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
