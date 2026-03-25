import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
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

    // List users using Supabase Auth Admin API
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return sanitized user list
    const sanitizedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || user.email?.split('@')[0],
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      role: user.user_metadata?.role || 'user'
    }));

    return NextResponse.json({ users: sanitizedUsers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
