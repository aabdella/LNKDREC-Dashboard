import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  const isLoginPage = request.nextUrl.pathname === '/login';
  const isAdminPage = request.nextUrl.pathname.startsWith('/admin');
  const isApiRoute = request.nextUrl.pathname.startsWith('/api');
  const isPublicAsset = request.nextUrl.pathname.startsWith('/_next') || 
                       request.nextUrl.pathname.includes('.');

  // 1. If no session and trying to access private page -> Redirect to /login
  if (!session && !isLoginPage && !isPublicAsset && !isApiRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 2. Block unauthenticated access to API routes (except /api/auth/* and /api/me)
  if (isApiRoute && !request.nextUrl.pathname.startsWith('/api/auth') && request.nextUrl.pathname !== '/api/me') {
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // 2. If session exists and trying to access /login -> Redirect to /
  if (session && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 3. Admin Route Protection
  if (isAdminPage) {
    const isSuperAdmin = session?.user?.email?.endsWith('@lnkd.ai');
    if (!isSuperAdmin) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
