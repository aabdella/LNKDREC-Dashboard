import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from 'next/link';
import Image from 'next/image';
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LNKD Talent Scout",
  description: "Advanced candidate sourcing and matching platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
           {/* Global Header */}
          <header className="bg-black text-white shadow-lg sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
              <div className="flex items-center gap-6">
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="bg-white p-1 rounded-sm">
                        <Image src="/logo.jpg" alt="LNKD Logo" width={80} height={40} className="object-contain h-8 w-auto" />
                    </div>
                    <div className="h-6 w-px bg-zinc-700 mx-1"></div>
                    <h1 className="text-xl font-semibold tracking-wide hidden sm:block group-hover:text-zinc-200 transition">Talent Scout</h1>
                </Link>

                {/* Navigation */}
                <nav className="hidden md:flex gap-6 ml-4 text-sm font-medium text-zinc-400">
                    <Link href="/" className="hover:text-white transition py-2 border-b-2 border-transparent hover:border-white">Candidates</Link>
                    <Link href="/jobs" className="hover:text-white transition py-2 border-b-2 border-transparent hover:border-white">Jobs</Link>
                    <a href="#" className="hover:text-white transition py-2 border-b-2 border-transparent hover:border-white opacity-50 cursor-not-allowed">Pipeline</a>
                </nav>
              </div>
              
              <div className="flex items-center gap-4">
                <span className="text-sm text-zinc-400">Logged in as Admin</span>
              </div>
            </div>
          </header>

          {children}
        </div>
      </body>
    </html>
  );
}
