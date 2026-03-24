import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
  // Use a simple Supabase client for middleware
  // We check for the session cookie directly for speed
  const supabase = createMiddlewareClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();

  const isLoginPage = req.nextUrl.pathname === '/login';
  const isPublicAsset = req.nextUrl.pathname.startsWith('/_next') || 
                       req.nextUrl.pathname.startsWith('/api') ||
                       req.nextUrl.pathname.includes('.');

  // 1. If no session and trying to access private page -> Redirect to /login
  if (!session && !isLoginPage && !isPublicAsset) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // 2. If session exists and trying to access /login -> Redirect to /
  if (session && isLoginPage) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
