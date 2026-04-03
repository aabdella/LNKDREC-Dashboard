import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from 'next/link';
import Image from 'next/image';
import { ViewColumnsIcon } from '@heroicons/react/24/outline';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import LogoutButton from './components/LogoutButton';
import AutoLogout from './components/AutoLogout';
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LNKD Platform",
  description: "Advanced candidate sourcing and matching platform.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  
  // Create a read-only supabase client for the server component
  const supabase = createServerClient(
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

  const { data: { session } } = await supabase.auth.getSession();
  // Use both domain check AND explicit role — domain is the primary gate, role is a fallback
  const userEmail = session?.user?.email ?? '';
  const userRole = session?.user?.user_metadata?.role ?? '';
  const isSuperAdmin = userEmail.endsWith('@lnkd.ai') || userRole === 'super_admin';

  return (
    <html lang="en">
      <body className={inter.className}>
        {session && <AutoLogout />}
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
          
          {session && (
            <header className="bg-black text-white shadow-lg sticky top-0 z-50 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="max-w-7xl mx-auto px-4 py-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-6">
                      <Link href="/" className="flex items-center gap-3 group">
                          <div className="bg-white p-1 rounded-sm">
                              <Image src="/logo.jpg" alt="LNKD Logo" width={80} height={40} className="object-contain h-8 w-auto" />
                          </div>
                          <div className="h-6 w-px bg-zinc-700 mx-1 hidden sm:block"></div>
                          <h1 className="text-xl font-semibold tracking-wide hidden sm:block group-hover:text-zinc-200 transition">Platform</h1>
                      </Link>

                      <nav className="hidden md:flex gap-6 ml-4 text-sm font-medium text-zinc-400">
                          <Link href="/" className="hover:text-white transition py-2 border-b-2 border-transparent hover:border-white">Candidates</Link>
                          <Link href="/sourcing" className="hover:text-white transition py-2 border-b-2 border-transparent hover:border-white">Sourcing</Link>
                          <Link href="/sales" className="hover:text-white transition py-2 border-b-2 border-transparent hover:border-white">Sales</Link>
                          <Link href="/jobs" className="hover:text-white transition py-2 border-b-2 border-transparent hover:border-white">Companies/Jobs</Link>
                          <Link href="/add-candidate" className="hover:text-white transition py-2 border-b-2 border-transparent hover:border-white">Add Candidate</Link>
                          <Link href="/pipeline" className="hover:text-white transition py-2 border-b-2 border-transparent hover:border-white flex items-center gap-1.5">
                            <ViewColumnsIcon className="h-4 w-4" />Pipeline
                          </Link>
                      </nav>
                  </div>
                  
                  <div className="flex items-center gap-3">
                      {isSuperAdmin && (
                        <Link 
                          href="/admin" 
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-bold text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 transition-all active:scale-95"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                          </svg>
                          Admin Dashboard
                        </Link>
                      )}
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-[10px] font-medium text-zinc-500 leading-none">
                          {userEmail}
                        </span>
                        <LogoutButton />
                      </div>
                  </div>
                </div>

                <nav className="md:hidden mt-3 pt-3 border-t border-zinc-800 flex gap-4 text-sm font-medium text-zinc-400 overflow-x-auto">
                  <Link href="/" className="hover:text-white transition whitespace-nowrap">Candidates</Link>
                  <Link href="/sourcing" className="hover:text-white transition whitespace-nowrap">Sourcing</Link>
                  <Link href="/sales" className="hover:text-white transition whitespace-nowrap">Sales</Link>
                  <Link href="/jobs" className="hover:text-white transition whitespace-nowrap">Companies/Jobs</Link>
                  <Link href="/add-candidate" className="hover:text-white transition whitespace-nowrap">Add Candidate</Link>
                  <Link href="/pipeline" className="hover:text-white transition whitespace-nowrap flex items-center gap-1">
                    <ViewColumnsIcon className="h-4 w-4" />Pipeline
                  </Link>
                </nav>
              </div>
            </header>
          )}

          <main>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
