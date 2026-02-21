import { NextResponse } from 'next/server';

export async function GET() {
  // SQL to create the activity_log table
  // Since Supabase REST doesn't support DDL, we use the service role key
  // and a direct fetch to the Supabase SQL endpoint via pg REST workaround
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://clrzajerliyyddfyvggd.supabase.co';

  // Try creating via a raw insert — if table exists, this just fails silently
  // The actual table creation is done via Supabase dashboard SQL editor
  // This route just confirms connectivity and returns table status
  const res = await fetch(`${supabaseUrl}/rest/v1/activity_log?limit=1`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });

  if (res.status === 404 || res.status === 400) {
    return NextResponse.json({
      status: 'table_missing',
      message: 'Run this SQL in Supabase dashboard SQL editor to create the table',
      sql: `CREATE TABLE IF NOT EXISTS activity_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  action text NOT NULL,
  entity_type text,
  entity_id text,
  entity_name text,
  details jsonb,
  source text DEFAULT 'web'
);`
    });
  }

  const data = await res.json();
  return NextResponse.json({ status: 'ok', rows: Array.isArray(data) ? data.length : 0 });
}
