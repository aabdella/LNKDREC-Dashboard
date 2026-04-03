import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { userId, newPassword } = await request.json();

    if (!userId || !newPassword) {
      return NextResponse.json({ error: 'User ID and new password are required' }, { status: 400 });
    }

    // Verify requesting user is super admin
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

    const { data: { session } } = await supabaseUser.auth.getSession();
    const isSuperAdmin = session?.user?.email?.endsWith('@lnkd.ai');

    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Super Admin access only' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Update user password
    const { data, error } = await supabaseAdmin.auth.admin.updateUser(userId, {
      password: newPassword
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Password updated successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}