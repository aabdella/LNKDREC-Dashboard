import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { email, name } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabaseUser = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    // Verify requesting user is super admin
    const { data: { session } } = await supabaseUser.auth.getSession();
    const isSuperAdmin = session?.user?.email?.endsWith('@lnkd.ai');

    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Super Admin access only' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Invite the user using Supabase Auth Admin API
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { 
        full_name: name,
        role: 'user' // Default role for new invites
      },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://lnkdrec-dshbrd.vercel.app'}/`
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
