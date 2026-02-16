'use client';

import { createClient } from '@supabase/supabase-js';
import { useState, useEffect } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';

// Initialize Supabase Client (Client-side safe for anon read)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Types
type Tool = { name: string; years: number };
type Technology = { name: string; years: number };
type WorkHistory = { company: string; title: string; years: number };

type Candidate = {
  id: string;
  full_name: string;
  title: string;
  location: string;
  years_experience_total: number;
  match_score: number;
  match_reason: string;
  source: string;
  lnkd_notes?: string;
  portfolio_url?: string;
  linkedin_url?: string;
  tools?: Tool[];
  technologies?: Technology[];
  work_history?: WorkHistory[];
};

export default function Dashboard() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCandidates();
  }, []);

  async function fetchCandidates() {
    setLoading(true);
    const { data, error } = await supabase
      .from('candidates')
      .select('*')
      .order('match_score', { ascending: false });

    if (error) console.error('Error fetching:', error);
    else setCandidates(data || []);
    setLoading(false);
  }

  // Enhanced Filter Logic
  const filteredCandidates = candidates.filter(c => {
    const q = search.toLowerCase();
    
    // Helper to check array of objects
    const checkArray = (arr: any[], key: string) => arr?.some(item => item[key]?.toLowerCase().includes(q));

    return (
      c.full_name.toLowerCase().includes(q) ||
      c.title?.toLowerCase().includes(q) ||
      c.location?.toLowerCase().includes(q) ||
      c.match_reason?.toLowerCase().includes(q) ||
      c.source?.toLowerCase().includes(q) ||
      c.lnkd_notes?.toLowerCase().includes(q) ||
      checkArray(c.tools || [], 'name') ||
      checkArray(c.technologies || [], 'name') ||
      checkArray(c.work_history || [], 'company') ||
      checkArray(c.work_history || [], 'title')
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header: Black + White Logo */}
      <header className="bg-black text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {/* LNKD Logo Image */}
            <div className="bg-white p-1 rounded-sm">
              <Image 
                src="/logo.jpg" 
                alt="LNKD Logo" 
                width={80} 
                height={40} 
                className="object-contain h-8 w-auto" 
              />
            </div>
            <h1 className="text-xl font-semibold tracking-wide hidden sm:block border-l border-zinc-700 pl-4 ml-1">Talent Scout</h1>
          </div>
          <div className="flex items-center gap-4">
             <span className="text-sm text-zinc-400">Logged in as Admin</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Search Bar */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-2/3">
            <MagnifyingGlassIcon className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name, skills, tools, companies..." 
              className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-md focus:ring-2 focus:ring-black outline-none transition"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="text-sm text-slate-500 font-medium whitespace-nowrap">
            Showing {filteredCandidates.length} Candidates
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="text-center py-20 text-slate-400 animate-pulse">Loading talent pool...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCandidates.map((candidate) => (
              <CandidateCard key={candidate.id} candidate={candidate} />
            ))}
            {filteredCandidates.length === 0 && (
              <div className="col-span-full text-center py-12 text-slate-400">
                No candidates found matching "{search}"
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function CandidateCard({ candidate }: { candidate: Candidate }) {
  // Score Color Logic
  const scoreColor = candidate.match_score >= 90 ? 'bg-green-100 text-green-700 border-green-200' :
                     candidate.match_score >= 80 ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                     'bg-red-100 text-red-700 border-red-200';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition group flex flex-col h-full hover:border-black/20">
      <div className="p-6 flex-grow">
        <div className="flex justify-between items-start mb-4">
          <div className="flex gap-4">
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-xl shrink-0 border border-slate-200">
              👤
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900 group-hover:text-black transition line-clamp-1">{candidate.full_name}</h3>
              <p className="text-sm text-slate-500 line-clamp-1">{candidate.title}</p>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                📍 {candidate.location}
              </p>
            </div>
          </div>
          <span className={`text-xs font-bold px-2 py-1 rounded-full border ${scoreColor} shrink-0`}>
            {candidate.match_score}%
          </span>
        </div>
        
        <div className="mb-4 space-y-3">
          {/* Tags: Tech + Tools */}
          <div className="flex flex-wrap gap-2 text-xs text-slate-700">
             <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200 font-medium">{candidate.years_experience_total}+ Years</span>
             {candidate.technologies?.slice(0, 2).map((t, i) => (
               <span key={i} className="bg-slate-50 px-2 py-1 rounded border border-slate-100 text-slate-600">{t.name}</span>
             ))}
             {candidate.tools?.slice(0, 2).map((t, i) => (
               <span key={i} className="bg-slate-50 px-2 py-1 rounded border border-slate-100 text-slate-600">{t.name}</span>
             ))}
          </div>
          
          {/* Description */}
          <div className="bg-slate-50 p-3 rounded-md border border-slate-100">
            <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">{candidate.match_reason}</p>
          </div>

          {/* Work History Snippet */}
          {candidate.work_history && candidate.work_history.length > 0 && (
             <div className="text-xs text-slate-400 mt-2">
               Previously at <span className="font-medium text-slate-600">{candidate.work_history[0].company}</span>
             </div>
          )}
        </div>
      </div>

      <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center bg-slate-50/50 mt-auto">
        <span className="text-xs text-slate-400 font-medium capitalize flex items-center gap-1">
          From {candidate.source}
        </span>
        <a 
          href={candidate.linkedin_url || candidate.portfolio_url || '#'} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-black text-sm font-semibold hover:underline transition flex items-center gap-1 group/link"
        >
          View Profile <span className="group-hover/link:translate-x-0.5 transition-transform">→</span>
        </a>
      </div>
      <div className="h-1 bg-black w-full transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
    </div>
  );
}
