import { createClient } from '@supabase/supabase-js';
import { useState, useEffect } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

// Initialize Supabase Client (Client-side safe for anon read)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Types
type Candidate = {
  id: string;
  full_name: string;
  title: string;
  location: string;
  years_experience_total: number;
  match_score: number;
  match_reason: string;
  source: string;
  portfolio_url?: string;
  linkedin_url?: string;
  tools?: { name: string; years: number }[];
  technologies?: { name: string; years: number }[];
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

  // Filter Logic
  const filteredCandidates = candidates.filter(c =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.title?.toLowerCase().includes(search.toLowerCase()) ||
    c.match_reason?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="bg-[#003366] text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-[#F4B41A] text-[#003366] font-bold text-2xl px-3 py-1 rounded-sm tracking-tighter">LNKD</div>
            <h1 className="text-xl font-semibold tracking-wide hidden sm:block">Talent Scout</h1>
          </div>
          <div className="flex items-center gap-4">
             <span className="text-sm text-slate-300">Logged in as Admin</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Search Bar */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-1/2">
            <MagnifyingGlassIcon className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search candidates..." 
              className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-md focus:ring-2 focus:ring-[#003366] outline-none transition"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="text-sm text-slate-500 font-medium">
            Showing {filteredCandidates.length} Candidates
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="text-center py-20 text-slate-400">Loading talent pool...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCandidates.map((candidate) => (
              <CandidateCard key={candidate.id} candidate={candidate} />
            ))}
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
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition group flex flex-col h-full">
      <div className="p-6 flex-grow">
        <div className="flex justify-between items-start mb-4">
          <div className="flex gap-4">
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-xl shrink-0">
              👤
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900 group-hover:text-[#003366] transition line-clamp-1">{candidate.full_name}</h3>
              <p className="text-sm text-slate-500 line-clamp-1">{candidate.title}</p>
              <p className="text-xs text-slate-400">{candidate.location}</p>
            </div>
          </div>
          <span className={`text-xs font-bold px-2 py-1 rounded-full border ${scoreColor} shrink-0`}>
            {candidate.match_score}%
          </span>
        </div>
        
        <div className="mb-4">
          <div className="flex flex-wrap gap-2 text-xs text-slate-600 mb-3">
             {/* Show up to 3 badges: Tools or Technologies */}
             {candidate.technologies?.slice(0, 2).map((t, i) => (
               <span key={i} className="bg-slate-100 px-2 py-1 rounded">{t.name}</span>
             ))}
             <span className="bg-slate-100 px-2 py-1 rounded">{candidate.years_experience_total}+ Years</span>
          </div>
          <p className="text-sm text-slate-600 line-clamp-3">{candidate.match_reason}</p>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center bg-slate-50/50 mt-auto">
        <span className="text-xs text-slate-400 font-medium capitalize">{candidate.source}</span>
        <a 
          href={candidate.linkedin_url || candidate.portfolio_url || '#'} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-[#003366] text-sm font-semibold hover:text-[#F4B41A] transition flex items-center gap-1"
        >
          View Profile <span>→</span>
        </a>
      </div>
      <div className="h-1 bg-[#003366] w-full"></div>
    </div>
  );
}
