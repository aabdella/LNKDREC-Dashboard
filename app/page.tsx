'use client';

import { createClient } from '@supabase/supabase-js';
import { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, XMarkIcon, CheckBadgeIcon, BriefcaseIcon, EnvelopeIcon, PhoneIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';

// Initialize Supabase Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Types
type Tool = { name: string; years: number };
type Technology = { name: string; years: number };
type WorkHistory = { company: string; title: string; years: number };
type Job = { id: string; title: string; client_id: string; clients: any };

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
  email?: string;
  phone?: string;
  status?: string;
};

// Vetting Options
const ENGLISH_LEVELS = ['Weak', 'Acceptable', 'Good', 'Very Good', 'Excellent'];
const WORK_MODES = ['Work from home', 'Hybrid', 'OnSite'];
const BENEFITS_LIST = [
  'Social Insurance & Taxation',
  'Health Insurance',
  'Life Insurance',
  'Laptop Allowance',
  'Transportation Allowance'
];

export default function Dashboard() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Modal States
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [vettingCandidate, setVettingCandidate] = useState<Candidate | null>(null);
  const [assigningCandidate, setAssigningCandidate] = useState<Candidate | null>(null);

  // Vetting Form State
  const [vettingData, setVettingData] = useState({
    id: '', // Vetting Record ID (for updates)
    english_proficiency: 'Good',
    notice_period: '',
    current_salary: '',
    expected_salary: '',
    work_presence: 'Hybrid',
    benefits: [] as string[],
    notes: ''
  });
  const [submittingVetting, setSubmittingVetting] = useState(false);
  const [loadingVetting, setLoadingVetting] = useState(false);

  // Assignment Form State
  const [selectedJobId, setSelectedJobId] = useState('');
  const [submittingAssignment, setSubmittingAssignment] = useState(false);

  useEffect(() => {
    fetchCandidates();
    fetchJobs();
  }, []);

  async function fetchCandidates() {
    setLoading(true);
    const { data, error } = await supabase
      .from('candidates')
      .select('*')
      .order('match_score', { ascending: false });

    if (error) console.error('Error fetching candidates:', error);
    else setCandidates(data || []);
    setLoading(false);
  }

  async function fetchJobs() {
    const { data } = await supabase.from('jobs').select('id, title, client_id, clients(name)').eq('status', 'Open');
    if (data) {
        const formattedJobs = data.map((j: any) => ({
            ...j,
            clients: Array.isArray(j.clients) ? j.clients[0] : j.clients
        }));
        setJobs(formattedJobs);
    }
  }

  // Open Vetting Modal & Fetch Data (Robust against duplicates)
  async function openVettingModal(candidate: Candidate) {
      setVettingCandidate(candidate);
      setLoadingVetting(true);
      
      // Default State
      const defaultState = {
        id: '',
        english_proficiency: 'Good',
        notice_period: '',
        current_salary: '',
        expected_salary: '',
        work_presence: 'Hybrid',
        benefits: [],
        notes: ''
      };
      setVettingData(defaultState);

      if (candidate.status === 'Vetted') {
          // Fetch logic: use .limit(1) to avoid .single() crash on duplicates
          const { data, error } = await supabase
            .from('vettings')
            .select('*')
            .eq('candidate_id', candidate.id)
            .order('vetted_at', { ascending: false }) // Get latest if multiple
            .limit(1);
          
          if (data && data.length > 0) {
              const record = data[0];
              setVettingData({
                  id: record.id,
                  english_proficiency: record.english_proficiency || 'Good',
                  notice_period: record.notice_period || '',
                  current_salary: record.current_salary?.toString() || '',
                  expected_salary: record.expected_salary?.toString() || '',
                  work_presence: record.work_presence || 'Hybrid',
                  benefits: record.benefits || [],
                  notes: record.notes || ''
              });
          } else if (error) {
              console.error('Error fetching vetting:', error);
          }
      }
      setLoadingVetting(false);
  }

  async function submitVetting(e: React.FormEvent) {
    e.preventDefault();
    if (!vettingCandidate) return;

    setSubmittingVetting(true);
    
    const payload = {
      candidate_id: vettingCandidate.id,
      english_proficiency: vettingData.english_proficiency,
      notice_period: vettingData.notice_period,
      current_salary: parseFloat(vettingData.current_salary) || 0,
      expected_salary: parseFloat(vettingData.expected_salary) || 0,
      work_presence: vettingData.work_presence,
      benefits: vettingData.benefits,
      notes: vettingData.notes
    };

    let error;
    
    if (vettingData.id) {
        // UPDATE existing record
        const { error: updateError } = await supabase
            .from('vettings')
            .update(payload)
            .eq('id', vettingData.id);
        error = updateError;
    } else {
        // INSERT new record
        const { error: insertError } = await supabase
            .from('vettings')
            .insert(payload);
        error = insertError;
    }

    if (error) {
      alert('Error saving vetting: ' + error.message);
      setSubmittingVetting(false);
      return;
    }

    // 2. Update Candidate Status
    if (vettingCandidate.status !== 'Vetted') {
        await supabase
        .from('candidates')
        .update({ status: 'Vetted' })
        .eq('id', vettingCandidate.id);
    }

    // Refresh & Close
    await fetchCandidates();
    setVettingCandidate(null);
    setSubmittingVetting(false);
  }

  async function submitAssignment(e: React.FormEvent) {
      e.preventDefault();
      if (!assigningCandidate || !selectedJobId) return;
      setSubmittingAssignment(true);

      const { error } = await supabase.from('applications').insert({
          candidate_id: assigningCandidate.id,
          job_id: selectedJobId,
          status: 'Assigned'
      });

      if (error) {
          if (error.code === '23505') alert('This candidate is already assigned to this job.');
          else alert('Error assigning candidate: ' + error.message);
      } else {
          alert(`Successfully assigned ${assigningCandidate.full_name} to the job!`);
          setAssigningCandidate(null);
          setSelectedJobId('');
      }
      setSubmittingAssignment(false);
  }

  const toggleBenefit = (benefit: string) => {
    setVettingData(prev => ({
      ...prev,
      benefits: prev.benefits.includes(benefit) 
        ? prev.benefits.filter(b => b !== benefit)
        : [...prev.benefits, benefit]
    }));
  };

  // Filter Logic
  const filteredCandidates = candidates.filter(c => {
    const q = search.toLowerCase();
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
    <div className="max-w-7xl mx-auto px-4 py-8">
        
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
              <CandidateCard 
                key={candidate.id} 
                candidate={candidate} 
                onViewDetails={() => setSelectedCandidate(candidate)} 
                onVetCandidate={() => openVettingModal(candidate)}
                onAssignCandidate={() => setAssigningCandidate(candidate)}
              />
            ))}
            {filteredCandidates.length === 0 && (
              <div className="col-span-full text-center py-12 text-slate-400">
                No candidates found matching "{search}"
              </div>
            )}
          </div>
        )}

      {/* Details Modal */}
      {selectedCandidate && (
        <CandidateDetailsModal 
           candidate={selectedCandidate} 
           onClose={() => setSelectedCandidate(null)} 
        />
      )}

      {/* Vetting Modal */}
      {vettingCandidate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setVettingCandidate(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-100 p-6 flex justify-between items-center z-10">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                    {vettingCandidate.status === 'Vetted' ? 'Edit Vetting' : 'Vet Candidate'}: {vettingCandidate.full_name}
                </h2>
                <p className="text-sm text-slate-500">{vettingCandidate.title}</p>
              </div>
              <button onClick={() => setVettingCandidate(null)} className="p-2 hover:bg-slate-100 rounded-full transition">
                <XMarkIcon className="h-6 w-6 text-slate-500" />
              </button>
            </div>
            
            {loadingVetting ? (
                <div className="p-12 text-center text-slate-400">Loading vetting details...</div>
            ) : (
                <form onSubmit={submitVetting} className="p-6 space-y-6">
                
                {/* Row 1: English & Work Presence */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">English Proficiency</label>
                        <select 
                            className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none"
                            value={vettingData.english_proficiency}
                            onChange={e => setVettingData({...vettingData, english_proficiency: e.target.value})}
                        >
                            {ENGLISH_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Work Presence</label>
                        <select 
                            className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none"
                            value={vettingData.work_presence}
                            onChange={e => setVettingData({...vettingData, work_presence: e.target.value})}
                        >
                            {WORK_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                </div>

                {/* Row 2: Salaries */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Current Salary (EGP)</label>
                        <input 
                            type="number" 
                            className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none"
                            value={vettingData.current_salary}
                            onChange={e => setVettingData({...vettingData, current_salary: e.target.value})}
                            placeholder="e.g. 25000"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Expected Salary (EGP)</label>
                        <input 
                            type="number" 
                            className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none"
                            value={vettingData.expected_salary}
                            onChange={e => setVettingData({...vettingData, expected_salary: e.target.value})}
                            placeholder="e.g. 35000"
                        />
                    </div>
                </div>

                {/* Row 3: Notice Period */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notice Period</label>
                    <input 
                        type="text" 
                        className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none"
                        value={vettingData.notice_period}
                        onChange={e => setVettingData({...vettingData, notice_period: e.target.value})}
                        placeholder="e.g. 1 Month, Immediate"
                    />
                </div>

                {/* Row 4: Benefits (Multi-select) */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Benefits Required</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {BENEFITS_LIST.map(benefit => (
                            <label key={benefit} className="flex items-center gap-2 cursor-pointer p-2 border border-slate-200 rounded-md hover:bg-slate-50 transition">
                                <input 
                                    type="checkbox" 
                                    checked={vettingData.benefits.includes(benefit)}
                                    onChange={() => toggleBenefit(benefit)}
                                    className="h-4 w-4 text-black focus:ring-black border-gray-300 rounded"
                                />
                                <span className="text-sm text-slate-700">{benefit}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Row 5: Notes */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Interview Notes</label>
                    <textarea 
                        className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none min-h-[100px]"
                        value={vettingData.notes}
                        onChange={e => setVettingData({...vettingData, notes: e.target.value})}
                        placeholder="Candidate demeanor, key strengths, red flags..."
                    ></textarea>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button 
                        type="button" 
                        onClick={() => setVettingCandidate(null)}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-md transition"
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit" 
                        disabled={submittingVetting}
                        className="px-6 py-2 bg-black text-white font-semibold rounded-md hover:bg-zinc-800 transition disabled:opacity-50 flex items-center gap-2"
                    >
                        {submittingVetting ? 'Saving...' : 'Complete Vetting'}
                    </button>
                </div>

                </form>
            )}
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {assigningCandidate && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setAssigningCandidate(null)}>
              <div className="bg-white p-6 rounded-xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
                  <h2 className="text-xl font-bold mb-4">Assign {assigningCandidate.full_name}</h2>
                  <p className="text-slate-500 text-sm mb-6">Select a job position to assign this candidate to.</p>
                  
                  <form onSubmit={submitAssignment}>
                      <div className="mb-6">
                          <label className="block text-sm font-medium mb-2">Select Job</label>
                          <select 
                              className="w-full border border-slate-300 rounded-md p-3 focus:ring-2 focus:ring-black outline-none bg-white"
                              value={selectedJobId}
                              onChange={e => setSelectedJobId(e.target.value)}
                              required
                          >
                              <option value="">-- Choose an Open Job --</option>
                              {jobs.map(job => (
                                  <option key={job.id} value={job.id}>
                                      {job.clients?.name} - {job.title}
                                  </option>
                              ))}
                          </select>
                      </div>
                      
                      <div className="flex justify-end gap-3">
                          <button type="button" onClick={() => setAssigningCandidate(null)} className="text-slate-600">Cancel</button>
                          <button 
                              type="submit" 
                              disabled={submittingAssignment}
                              className="bg-black text-white px-4 py-2 rounded flex items-center gap-2 disabled:opacity-50"
                          >
                              {submittingAssignment ? 'Assigning...' : 'Confirm Assignment'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
}

// Sub-Components
function CandidateCard({ 
    candidate, 
    onViewDetails, 
    onVetCandidate, 
    onAssignCandidate 
}: { 
    candidate: Candidate; 
    onViewDetails: () => void; 
    onVetCandidate: () => void; 
    onAssignCandidate: () => void;
}) {
  const scoreColor = candidate.match_score >= 90 ? 'bg-green-100 text-green-700 border-green-200' :
                     candidate.match_score >= 80 ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                     'bg-red-100 text-red-700 border-red-200';

  const isVetted = candidate.status === 'Vetted';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition group flex flex-col h-full hover:border-black/20 relative">
      {isVetted && (
          <div className="absolute top-3 right-3 bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full border border-blue-200 flex items-center gap-1 z-10">
              <CheckBadgeIcon className="h-3 w-3" /> Vetted
          </div>
      )}
      
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
          {!isVetted && (
              <span className={`text-xs font-bold px-2 py-1 rounded-full border ${scoreColor} shrink-0`}>
                {candidate.match_score}%
              </span>
          )}
        </div>
        
        <div className="mb-4 space-y-3">
          <div className="flex flex-wrap gap-2 text-xs text-slate-700">
             <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200 font-medium">{candidate.years_experience_total}+ Years</span>
             {candidate.technologies?.slice(0, 2).map((t, i) => (
               <span key={i} className="bg-slate-50 px-2 py-1 rounded border border-slate-100 text-slate-600">{t.name}</span>
             ))}
          </div>
          
          <div className="bg-slate-50 p-3 rounded-md border border-slate-100">
            <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">{candidate.match_reason}</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-slate-100 flex gap-2 bg-slate-50/50 mt-auto">
        <button 
          onClick={onViewDetails}
          className="flex-1 bg-white border border-slate-200 text-slate-700 text-xs font-semibold py-2 rounded hover:bg-slate-50 transition"
        >
          Details
        </button>
        
        <button 
          onClick={onVetCandidate}
          className={`flex-1 text-xs font-semibold py-2 rounded transition ${isVetted ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-black text-white hover:bg-zinc-800'}`}
        >
          {isVetted ? 'Edit Vetting' : 'Vet'}
        </button>

        {isVetted && (
            <button 
                onClick={onAssignCandidate}
                className="flex-1 bg-blue-600 text-white text-xs font-semibold py-2 rounded hover:bg-blue-700 transition flex items-center justify-center gap-1"
            >
                <BriefcaseIcon className="h-3 w-3" /> Assign
            </button>
        )}
      </div>
      <div className="h-1 bg-black w-full transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
    </div>
  );
}

function CandidateDetailsModal({ candidate, onClose }: { candidate: Candidate; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-100 p-6 flex justify-between items-center z-10">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{candidate.full_name}</h2>
                <p className="text-slate-500">{candidate.title}</p>
                <div className="flex flex-col gap-1 mt-2 text-sm text-slate-500">
                    {candidate.email && (
                        <a href={`mailto:${candidate.email}`} className="flex items-center gap-2 hover:text-black transition">
                            <EnvelopeIcon className="h-4 w-4" /> {candidate.email}
                        </a>
                    )}
                    {candidate.phone && (
                        <a href={`tel:${candidate.phone}`} className="flex items-center gap-2 hover:text-black transition">
                            <PhoneIcon className="h-4 w-4" /> {candidate.phone}
                        </a>
                    )}
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition">
                <XMarkIcon className="h-6 w-6 text-slate-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                 <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Score</div>
                    <div className="text-xl font-bold text-slate-900">{candidate.match_score}%</div>
                 </div>
                 <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Exp</div>
                    <div className="text-xl font-bold text-slate-900">{candidate.years_experience_total} Yrs</div>
                 </div>
                 <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Location</div>
                    <div className="text-lg font-bold text-slate-900 truncate" title={candidate.location}>{candidate.location}</div>
                 </div>
                 <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Source</div>
                    <div className="text-lg font-bold text-slate-900 capitalize">{candidate.source}</div>
                 </div>
              </div>

              <div>
                <h3 className="font-bold text-slate-900 mb-2">Why they match</h3>
                <p className="text-slate-600 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                  {candidate.match_reason}
                </p>
              </div>

              {candidate.lnkd_notes && (
                <div>
                    <h3 className="font-bold text-slate-900 mb-2">LNKD Analysis</h3>
                    <p className="text-slate-600 italic">
                    "{candidate.lnkd_notes}"
                    </p>
                </div>
              )}

              <div>
                <h3 className="font-bold text-slate-900 mb-2">Tech Stack</h3>
                <div className="flex flex-wrap gap-2">
                    {candidate.technologies?.map((t, i) => (
                        <span key={i} className="bg-slate-100 px-3 py-1 rounded-full text-sm border border-slate-200">
                            {t.name} <span className="text-slate-400 text-xs ml-1">({t.years}y)</span>
                        </span>
                    ))}
                    {candidate.tools?.map((t, i) => (
                        <span key={i} className="bg-white px-3 py-1 rounded-full text-sm border border-slate-200 shadow-sm">
                            {t.name} <span className="text-slate-400 text-xs ml-1">({t.years}y)</span>
                        </span>
                    ))}
                </div>
              </div>

              {candidate.work_history && candidate.work_history.length > 0 && (
                <div>
                    <h3 className="font-bold text-slate-900 mb-2">Work History</h3>
                    <div className="space-y-3">
                        {candidate.work_history.map((job, i) => (
                            <div key={i} className="flex justify-between items-center border-b border-slate-100 pb-2 last:border-0">
                                <div>
                                    <div className="font-semibold text-slate-800">{job.company}</div>
                                    <div className="text-sm text-slate-500">{job.title}</div>
                                </div>
                                <div className="text-sm font-medium text-slate-400">{job.years} Years</div>
                            </div>
                        ))}
                    </div>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                 {candidate.linkedin_url && (
                    <a href={candidate.linkedin_url} target="_blank" className="flex-1 bg-[#0077b5] text-white text-center py-2.5 rounded-lg font-semibold hover:bg-[#006097] transition">
                        LinkedIn Profile
                    </a>
                 )}
                 {candidate.portfolio_url && (
                    <a href={candidate.portfolio_url} target="_blank" className="flex-1 bg-black text-white text-center py-2.5 rounded-lg font-semibold hover:bg-zinc-800 transition">
                        Portfolio / Behance
                    </a>
                 )}
              </div>

            </div>
          </div>
        </div>
    );
}
