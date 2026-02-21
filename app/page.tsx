'use client';

import { supabase } from '@/lib/supabaseClient';
import { useState, useEffect, useCallback } from 'react';
import { MagnifyingGlassIcon, XMarkIcon, CheckBadgeIcon, BriefcaseIcon, EnvelopeIcon, PhoneIcon, PencilSquareIcon, Squares2X2Icon, ListBulletIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

// Types
type Tool = { name: string; years: number };
type Technology = { name: string; years: number };
type WorkHistory = { 
  company: string; 
  title: string; 
  start_date?: string; 
  end_date?: string; 
  years?: number 
};
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
  skills?: string[];
  work_history?: WorkHistory[];
  email?: string;
  phone?: string;
  status?: string;
  resume_url?: string;
  resume_text?: string;
  years_experience?: number;
  last_interaction_type?: string;
  last_interaction_at?: string;
  assigned_job_title?: string;
  assigned_company_name?: string;
  candidate_interactions?: any[];
  applications?: any[];
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
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Modal States
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [vettingCandidate, setVettingCandidate] = useState<Candidate | null>(null);
  const [assigningCandidate, setAssigningCandidate] = useState<Candidate | null>(null);
  const [cvCandidate, setCvCandidate] = useState<Candidate | null>(null);

  // Interaction States
  const [interactions, setInteractions] = useState<any[]>([]);
  const [loadingInteractions, setLoadingInteractions] = useState(false);
  const [newInteraction, setNewInteraction] = useState({ type: 'LinkedIn Message', content: '' });
  const [submittingInteraction, setSubmittingInteraction] = useState(false);

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
    
    // Fetch candidates along with their last interaction and job assignments
    const { data, error } = await supabase
      .from('candidates')
      .select(`
        *,
        candidate_interactions (
          type,
          created_at
        ),
        applications (
          job_id,
          jobs (
            title,
            clients (
              name
            )
          )
        )
      `)
      .order('match_score', { ascending: false });

    if (error) {
      console.error('Error fetching candidates:', error);
    } else {
      const formattedData = data.map((c: any) => {
        // Find latest interaction
        const sortedInteractions = (c.candidate_interactions || []).sort(
          (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const last = sortedInteractions[0];

        // Find assignment info
        const application = c.applications?.[0];
        const jobInfo = application?.jobs;
        const clientInfo = Array.isArray(jobInfo?.clients) ? jobInfo.clients[0] : jobInfo?.clients;
        
        return {
          ...c,
          last_interaction_type: last?.type,
          last_interaction_at: last?.created_at,
          assigned_job_title: jobInfo?.title,
          assigned_company_name: clientInfo?.name
        };
      });
      setCandidates(formattedData);
    }
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

  async function fetchInteractions(candidateId: string) {
    setLoadingInteractions(true);
    const { data, error } = await supabase
      .from('candidate_interactions')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false });

    if (error) console.error('Error fetching interactions:', error);
    else setInteractions(data || []);
    setLoadingInteractions(false);
  }

  async function submitInteraction(candidateId: string) {
    if (!newInteraction.content.trim()) return;
    setSubmittingInteraction(true);

    const { error } = await supabase
      .from('candidate_interactions')
      .insert({
        candidate_id: candidateId,
        type: newInteraction.type,
        content: newInteraction.content
      });

    if (error) {
      alert('Error saving interaction: ' + error.message);
    } else {
      setNewInteraction({ ...newInteraction, content: '' });
      fetchInteractions(candidateId);
    }
    setSubmittingInteraction(false);
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

      if (candidate.status === 'Vetted' || candidate.status === 'Assigned') {
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

  async function toggleAssignment(candidate: Candidate) {
      if (candidate.status === 'Assigned') {
          // UNASSIGN: 1. Delete from applications table
          const { error: appError } = await supabase
              .from('applications')
              .delete()
              .eq('candidate_id', candidate.id);

          if (appError) {
              alert('Error removing application: ' + appError.message);
              return;
          }

          // 2. Flip status back to Vetted in candidates table
          const { error: candError } = await supabase
              .from('candidates')
              .update({ status: 'Vetted' })
              .eq('id', candidate.id);

          if (candError) alert('Error unassigning: ' + candError.message);
          else fetchCandidates();
      } else {
          // ASSIGN: Open modal to pick a job
          setAssigningCandidate(candidate);
      }
  }

  async function submitAssignment(e: React.FormEvent) {
      e.preventDefault();
      if (!assigningCandidate || !selectedJobId) return;
      setSubmittingAssignment(true);

      // 1. Create Application Record
      const { error } = await supabase.from('applications').insert({
          candidate_id: assigningCandidate.id,
          job_id: selectedJobId,
          status: 'Assigned'
      });

      if (error) {
          if (error.code === '23505') alert('This candidate is already assigned to this job.');
          else alert('Error assigning candidate: ' + error.message);
      } else {
          // 2. Update candidate status to Assigned
          await supabase.from('candidates').update({ status: 'Assigned' }).eq('id', assigningCandidate.id);
          
          setAssigningCandidate(null);
          setSelectedJobId('');
          fetchCandidates();
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

    // 1. Status Filter
    if (filter !== 'All') {
      if (filter === 'UnVetted') {
        if (c.status === 'Vetted' || c.status === 'Assigned') return false;
      } else {
        if (c.status !== filter) return false;
      }
    }
    
    // 2. Search Logic
    // Safety check function: safely handles null/undefined arrays and items
    const checkArray = (arr: any[], key: string) => 
      Array.isArray(arr) && arr.some(item => item && item[key] && item[key].toLowerCase().includes(q));

    // Safe string check
    const checkString = (val?: string) => val && val.toLowerCase().includes(q);

    return (
      checkString(c.full_name) ||
      checkString(c.title) ||
      checkString(c.location) ||
      checkString(c.match_reason) ||
      checkString(c.source) ||
      checkString(c.lnkd_notes) ||
      checkString(c.resume_text) ||
      (c.years_experience && c.years_experience.toString().includes(q)) ||
      checkArray(c.tools || [], 'name') ||
      checkArray(c.technologies || [], 'name') ||
      (c.skills && c.skills.some(s => s && s.toLowerCase().includes(q))) ||
      checkArray(c.work_history || [], 'company') ||
      checkArray(c.work_history || [], 'title')
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Search Bar */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-1 w-full gap-3">
            <div className="relative flex-grow">
              <MagnifyingGlassIcon className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search by name, skills, tools, companies..." 
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-md focus:ring-2 focus:ring-black outline-none transition"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select 
              className="px-4 py-3 border border-slate-200 rounded-md focus:ring-2 focus:ring-black outline-none transition bg-white text-sm font-medium appearance-none cursor-pointer"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="All">All Candidates</option>
              <option value="UnVetted">UnVetted</option>
              <option value="Vetted">Vetted Only</option>
              <option value="Assigned">Assigned Only</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-500 font-medium whitespace-nowrap">
              Showing {filteredCandidates.length} Candidates
            </div>
            {/* View Mode Toggle */}
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all ${
                  viewMode === 'grid'
                    ? 'bg-black text-white'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
                title="Grid View"
              >
                <Squares2X2Icon className="h-4 w-4" />
                Cards
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all ${
                  viewMode === 'list'
                    ? 'bg-black text-white'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
                title="List View"
              >
                <ListBulletIcon className="h-4 w-4" />
                List
              </button>
            </div>
          </div>
        </div>

        {/* Grid / List */}
        {loading ? (
          <div className="text-center py-20 text-slate-400 animate-pulse">Loading talent pool...</div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCandidates.map((candidate) => (
              <CandidateCard 
                key={candidate.id} 
                candidate={candidate} 
                onViewDetails={() => setSelectedCandidate(candidate)} 
                onVetCandidate={() => openVettingModal(candidate)}
                onToggleAssign={() => toggleAssignment(candidate)}
                onGenerateCV={() => setCvCandidate(candidate)}
              />
            ))}
            {filteredCandidates.length === 0 && (
              <div className="col-span-full text-center py-12 text-slate-400">
                No candidates found matching "{search}"
              </div>
            )}
          </div>
        ) : (
          /* List View */
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            {filteredCandidates.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                No candidates found matching "{search}"
              </div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs uppercase text-slate-500 font-semibold">Name</th>
                    <th className="text-left px-4 py-3 text-xs uppercase text-slate-500 font-semibold">Title</th>
                    <th className="text-left px-4 py-3 text-xs uppercase text-slate-500 font-semibold">Yrs Exp</th>
                    <th className="text-left px-4 py-3 text-xs uppercase text-slate-500 font-semibold">Links</th>
                    <th className="text-left px-4 py-3 text-xs uppercase text-slate-500 font-semibold">Status</th>
                    <th className="text-right px-4 py-3 text-xs uppercase text-slate-500 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.map((candidate) => (
                    <CandidateRow
                      key={candidate.id}
                      candidate={candidate}
                      onViewDetails={() => setSelectedCandidate(candidate)}
                      onVetCandidate={() => openVettingModal(candidate)}
                      onToggleAssign={() => toggleAssignment(candidate)}
                      onGenerateCV={() => setCvCandidate(candidate)}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

      {/* Details Modal */}
      {selectedCandidate && (
        <CandidateDetailsModal 
           candidate={selectedCandidate} 
           interactions={interactions}
           loadingInteractions={loadingInteractions}
           onFetchInteractions={() => fetchInteractions(selectedCandidate.id)}
           newInteraction={newInteraction}
           setNewInteraction={setNewInteraction}
           submittingInteraction={submittingInteraction}
           onSubmitInteraction={() => submitInteraction(selectedCandidate.id)}
           onClose={() => {
             setSelectedCandidate(null);
             setInteractions([]);
           }} 
           onUpdate={() => {
               fetchCandidates();
               setSelectedCandidate(null);
           }}
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

      {/* CV Export Modal */}
      {cvCandidate && (
        <CVExportModal
          candidate={cvCandidate}
          onClose={() => setCvCandidate(null)}
        />
      )}
    </div>
  );
}

// Sub-Components
function CandidateRow({
  candidate,
  onViewDetails,
  onVetCandidate,
  onToggleAssign,
  onGenerateCV,
}: {
  candidate: Candidate;
  onViewDetails: () => void;
  onVetCandidate: () => void;
  onToggleAssign: () => void;
  onGenerateCV: () => void;
}) {
  const isVetted = candidate.status === 'Vetted';
  const isAssigned = candidate.status === 'Assigned';

  // Initials for avatar
  const initials = candidate.full_name
    ? candidate.full_name
        .split(' ')
        .slice(0, 2)
        .map((part: string) => part[0])
        .join('')
        .toUpperCase()
    : '?';

  // Health score (same logic as CandidateCard)
  let healthScore = 0;
  if (candidate.full_name && candidate.title) healthScore += 20;
  if (candidate.email) healthScore += 20;
  if (candidate.phone) healthScore += 20;
  if (
    (candidate.skills && candidate.skills.length > 0) ||
    (candidate.tools && candidate.tools.length > 0) ||
    (candidate.technologies && candidate.technologies.length > 0)
  )
    healthScore += 20;
  if (candidate.linkedin_url || candidate.portfolio_url) healthScore += 20;

  const healthColor =
    healthScore >= 80
      ? 'text-green-600 bg-green-50 border-green-200'
      : healthScore >= 50
      ? 'text-yellow-600 bg-yellow-50 border-yellow-200'
      : 'text-red-600 bg-red-50 border-red-200';

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
      {/* Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
            {initials}
          </div>
          <span className="font-semibold text-slate-900 whitespace-nowrap">{candidate.full_name}</span>
        </div>
      </td>

      {/* Title */}
      <td className="px-4 py-3 text-slate-500 max-w-[180px]">
        <span className="line-clamp-1">{candidate.title || '—'}</span>
      </td>

      {/* Yrs Exp */}
      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
        {candidate.years_experience_total || candidate.years_experience || 0} yrs
      </td>

      {/* Links */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          {candidate.linkedin_url && (
            <a
              href={candidate.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              title="LinkedIn"
              className="inline-flex items-center justify-center h-6 w-6 rounded bg-[#0077b5] hover:bg-[#006097] transition"
            >
              <svg className="h-3.5 w-3.5 fill-white" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
          )}
          {candidate.portfolio_url && (
            <a
              href={candidate.portfolio_url}
              target="_blank"
              rel="noopener noreferrer"
              title="Portfolio / Behance"
              className="inline-flex items-center justify-center h-6 w-6 rounded bg-[#1769ff] hover:bg-[#0057e0] transition"
            >
              <svg className="h-3.5 w-3.5 fill-white" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M6.938 4.503c.702 0 1.34.06 1.92.188.577.13 1.07.33 1.485.61.41.28.733.65.96 1.12.225.47.34 1.05.34 1.73 0 .74-.17 1.36-.507 1.86-.338.5-.837.9-1.502 1.22.906.26 1.576.72 2.022 1.37.448.66.665 1.45.665 2.36 0 .75-.13 1.39-.41 1.93-.28.55-.67 1-1.16 1.35-.48.348-1.05.6-1.69.75-.63.15-1.28.22-1.96.22H0V4.51h6.938v-.007zm-.412 5.53c.58 0 1.06-.14 1.44-.42.38-.28.57-.72.57-1.32 0-.33-.06-.61-.18-.83-.12-.23-.29-.41-.5-.55-.21-.14-.45-.24-.72-.3-.27-.06-.56-.08-.87-.08H3.9v3.5h2.626zm.15 5.77c.33 0 .64-.03.93-.1.29-.06.54-.17.75-.32.21-.15.38-.36.5-.62.12-.26.18-.59.18-.99 0-.79-.22-1.36-.67-1.71-.45-.35-1.04-.53-1.76-.53H3.9v4.27h2.776zm10.724.54l-.004.012H21.4v.003c-.19.55-.5 1.02-.93 1.42-.42.4-.95.7-1.56.92-.61.22-1.28.33-2 .33-.78 0-1.49-.13-2.12-.4-.63-.27-1.17-.64-1.61-1.12-.44-.48-.78-1.06-1.01-1.74-.23-.68-.35-1.43-.35-2.25 0-.79.12-1.53.37-2.2.25-.67.6-1.25 1.05-1.73.45-.48.99-.85 1.63-1.11.64-.26 1.35-.39 2.12-.39.82 0 1.54.16 2.16.47.62.31 1.13.73 1.54 1.26.41.53.71 1.14.9 1.83.19.69.27 1.42.24 2.19h-6.82c.02.79.26 1.4.7 1.82.44.42 1.02.63 1.74.63.5 0 .93-.12 1.28-.36.35-.24.59-.56.72-.97h2.18zM17.5 13.5c-.04-.67-.26-1.22-.66-1.63-.4-.41-.94-.62-1.62-.62-.47 0-.87.08-1.19.25-.32.17-.58.38-.79.64-.21.26-.36.54-.46.84-.1.3-.15.59-.16.88h4.88v-.36zM14.5 7.35h4.76V8.9H14.5V7.35z" />
              </svg>
            </a>
          )}
          {!candidate.linkedin_url && !candidate.portfolio_url && (
            <span className="text-slate-400">—</span>
          )}
        </div>
      </td>

      {/* Status Badge */}
      <td className="px-4 py-3 whitespace-nowrap">
        {isAssigned ? (
          <span className="text-xs font-bold px-2 py-1 rounded-full border bg-green-100 text-green-700 border-green-200 flex items-center gap-1 w-fit">
            <BriefcaseIcon className="h-3 w-3" /> Matched
          </span>
        ) : isVetted ? (
          <span className="text-xs font-bold px-2 py-1 rounded-full border bg-blue-100 text-blue-700 border-blue-200 flex items-center gap-1 w-fit">
            <CheckBadgeIcon className="h-3 w-3" /> Vetted
          </span>
        ) : (
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 w-fit ${healthColor}`}
            title="Profile Data Health"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
            {healthScore}% Data
          </span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={onViewDetails}
            className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded hover:bg-slate-50 transition"
          >
            Details
          </button>
          <button
            onClick={onVetCandidate}
            className={`px-2.5 py-1 text-xs font-semibold rounded transition ${
              isVetted ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-black text-white hover:bg-zinc-800'
            }`}
          >
            {isVetted || isAssigned ? 'Edit Vetting' : 'Vet'}
          </button>
          {(isVetted || isAssigned) && (
            <button
              onClick={onToggleAssign}
              className={`px-2.5 py-1 text-xs font-semibold text-white rounded transition flex items-center gap-1 ${
                isAssigned ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isAssigned ? (
                <>
                  <XMarkIcon className="h-3 w-3" /> Unmatch
                </>
              ) : (
                <>
                  <BriefcaseIcon className="h-3 w-3" /> Assign
                </>
              )}
            </button>
          )}
          <button
            onClick={onGenerateCV}
            title="Generate CV"
            className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700 rounded hover:bg-indigo-100 transition flex items-center gap-1"
          >
            <DocumentArrowDownIcon className="h-3 w-3" /> CV
          </button>
        </div>
      </td>
    </tr>
  );
}

function CandidateCard({ 
    candidate, 
    onViewDetails, 
    onVetCandidate, 
    onToggleAssign,
    onGenerateCV,
}: { 
    candidate: Candidate; 
    onViewDetails: () => void; 
    onVetCandidate: () => void; 
    onToggleAssign: () => void;
    onGenerateCV: () => void;
}) {
  const isVetted = candidate.status === 'Vetted';
  const isAssigned = candidate.status === 'Assigned';

  // Calculate Data Health Score
  // Max score: 100
  // Weights:
  // - Name & Title: 20 (Essential)
  // - Email: 20 (Primary Contact)
  // - Phone: 20 (Secondary Contact)
  // - Skills/Tools: 20 (Searchable)
  // - LinkedIn/Portfolio: 20 (Verifiable)
  let healthScore = 0;
  if (candidate.full_name && candidate.title) healthScore += 20;
  if (candidate.email) healthScore += 20;
  if (candidate.phone) healthScore += 20;
  if ((candidate.skills && candidate.skills.length > 0) || (candidate.tools && candidate.tools.length > 0) || (candidate.technologies && candidate.technologies.length > 0)) healthScore += 20;
  if (candidate.linkedin_url || candidate.portfolio_url) healthScore += 20;

  const healthColor = healthScore >= 80 ? 'text-green-600 bg-green-50 border-green-200' :
                      healthScore >= 50 ? 'text-yellow-600 bg-yellow-50 border-yellow-200' :
                      'text-red-600 bg-red-50 border-red-200';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition group flex flex-col h-full hover:border-black/20 relative">
      
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
          <div className="flex flex-col items-end gap-1">
            {candidate.last_interaction_at && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
                Contacted {new Date(candidate.last_interaction_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </span>
            )}
            {isAssigned ? (
              <div className="flex flex-col items-end">
                <span className="text-xs font-bold px-2 py-1 rounded-full border bg-green-100 text-green-700 border-green-200 shrink-0 flex items-center gap-1">
                    <BriefcaseIcon className="h-3 w-3" /> Matched
                </span>
                {candidate.assigned_company_name && (
                   <span className="text-[10px] font-bold text-slate-500 mt-1 text-right leading-tight">
                     {candidate.assigned_company_name}<br/>
                     <span className="text-slate-400 font-normal">{candidate.assigned_job_title}</span>
                   </span>
                )}
              </div>
            ) : isVetted ? (
                <span className="text-xs font-bold px-2 py-1 rounded-full border bg-blue-100 text-blue-700 border-blue-200 shrink-0 flex items-center gap-1">
                    <CheckBadgeIcon className="h-3 w-3" /> Vetted
                </span>
            ) : (
                <div className={`text-[10px] font-bold px-2 py-0.5 rounded border ${healthColor} flex items-center gap-1`} title="Profile Data Health">
                   <span className="w-1.5 h-1.5 rounded-full bg-current"></span> {healthScore}% Data
                </div>
            )}
          </div>
        </div>
        
        <div className="mb-4 space-y-3">
          <div className="flex flex-wrap gap-2 text-xs text-slate-700">
             <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200 font-medium">{candidate.years_experience_total || candidate.years_experience || 0}+ Years</span>
             {(candidate.technologies?.length ? candidate.technologies.slice(0, 2) : candidate.skills?.slice(0,2))?.map((t: any, i: number) => (
               <span key={i} className="bg-slate-50 px-2 py-1 rounded border border-slate-100 text-slate-600">{typeof t === 'string' ? t : t.name}</span>
             ))}
          </div>
          
          <div className="bg-slate-50 p-3 rounded-md border border-slate-100 relative">
            <div className="absolute -top-2.5 right-2 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 border border-slate-200 rounded-full shadow-sm">
                Match: {candidate.match_score}%
            </div>
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
          {isVetted || isAssigned ? 'Edit Vetting' : 'Vet'}
        </button>

        {(isVetted || isAssigned) && (
            <button 
                onClick={onToggleAssign}
                className={`flex-1 text-white text-xs font-semibold py-2 rounded transition flex items-center justify-center gap-1 ${
                    isAssigned 
                        ? 'bg-red-600 hover:bg-red-700' 
                        : 'bg-blue-600 hover:bg-blue-700'
                }`}
            >
                {isAssigned ? (
                    <>
                        <XMarkIcon className="h-3 w-3" /> Unmatch
                    </>
                ) : (
                    <>
                        <BriefcaseIcon className="h-3 w-3" /> Assign
                    </>
                )}
            </button>
        )}
        <button
          onClick={onGenerateCV}
          title="Generate CV"
          className="px-2 py-2 text-xs font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700 rounded hover:bg-indigo-100 transition flex items-center gap-1"
        >
          <DocumentArrowDownIcon className="h-3.5 w-3.5" /> CV
        </button>
      </div>
      <div className="h-1 bg-black w-full transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
    </div>
  );
}

function CandidateDetailsModal({ 
    candidate, 
    onClose, 
    onUpdate,
    interactions,
    loadingInteractions,
    onFetchInteractions,
    newInteraction,
    setNewInteraction,
    submittingInteraction,
    onSubmitInteraction
}: { 
    candidate: Candidate; 
    onClose: () => void; 
    onUpdate: () => void;
    interactions: any[];
    loadingInteractions: boolean;
    onFetchInteractions: () => void;
    newInteraction: { type: string; content: string };
    setNewInteraction: (val: any) => void;
    submittingInteraction: boolean;
    onSubmitInteraction: () => void;
}) {
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (candidate && !isEditing) {
            onFetchInteractions();
        }
    }, [candidate, isEditing]);

    const [formData, setFormData] = useState<Candidate>({
        ...candidate,
        work_history: Array.isArray(candidate.work_history) ? candidate.work_history : [],
        technologies: Array.isArray(candidate.technologies) ? candidate.technologies : [],
        tools: Array.isArray(candidate.tools) ? candidate.tools : []
    });
    const [saving, setSaving] = useState(false);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        
        // Sanitize numeric fields and OMIT calculated/relational fields from the update payload
        const { 
            id, 
            last_interaction_type, 
            last_interaction_at, 
            assigned_job_title, 
            assigned_company_name,
            candidate_interactions,
            applications,
            ...updateData 
        } = formData;

        const payload = {
            ...updateData,
            years_experience: Number(formData.years_experience_total) || 0,
            years_experience_total: Number(formData.years_experience_total) || 0,
            match_score: Number(formData.match_score) || 0,
            // Ensure arrays are sent correctly
            work_history: formData.work_history || [],
            technologies: formData.technologies || [],
            tools: formData.tools || []
        };

        const { error } = await supabase.from('candidates').update(payload).eq('id', candidate.id);
        
        if (!error) {
            setIsEditing(false);
            onUpdate(); // Refresh parent list
        } else {
            alert('Error updating candidate: ' + error.message);
        }
        setSaving(false);
    };

    const handleChange = (field: keyof Candidate, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const addWorkHistory = () => {
        const newEntry: WorkHistory = { company: '', title: '', start_date: '', end_date: '', years: 0 };
        setFormData(prev => ({
            ...prev,
            work_history: [...(prev.work_history || []), newEntry]
        }));
    };

    const updateWorkHistory = (index: number, field: keyof WorkHistory, value: any) => {
        const updatedHistory = [...(formData.work_history || [])];
        updatedHistory[index] = { ...updatedHistory[index], [field]: value };
        setFormData(prev => ({ ...prev, work_history: updatedHistory }));
    };

    const removeWorkHistory = (index: number) => {
        setFormData(prev => ({
            ...prev,
            work_history: (prev.work_history || []).filter((_, i) => i !== index)
        }));
    };

    const addTech = (type: 'technologies' | 'tools') => {
        const newEntry = { name: '', years: 0 };
        setFormData(prev => ({
            ...prev,
            [type]: [...(prev[type] || []), newEntry]
        }));
    };

    const updateTech = (type: 'technologies' | 'tools', index: number, field: string, value: any) => {
        const updated = [...(formData[type] || [])];
        updated[index] = { ...updated[index], [field]: value };
        setFormData(prev => ({ ...prev, [type]: updated }));
    };

    const removeTech = (type: 'technologies' | 'tools', index: number) => {
        setFormData(prev => ({
            ...prev,
            [type]: (prev[type] || []).filter((_, i) => i !== index)
        }));
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-100 p-6 flex justify-between items-center z-10">
              <div>
                {!isEditing ? (
                    <>
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
                    </>
                ) : (
                    <h2 className="text-xl font-bold text-slate-900">Edit Profile: {candidate.full_name}</h2>
                )}
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition">
                <XMarkIcon className="h-6 w-6 text-slate-500" />
              </button>
            </div>
            
            {isEditing ? (
                <form onSubmit={handleSave} className="p-6 space-y-8">
                    {/* Basic Info Section */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Basic Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                                <input 
                                    type="text" 
                                    required
                                    className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none"
                                    value={formData.full_name}
                                    onChange={e => handleChange('full_name', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Job Title</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none"
                                    value={formData.title}
                                    onChange={e => handleChange('title', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                <input 
                                    type="email" 
                                    className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none"
                                    value={formData.email || ''}
                                    onChange={e => handleChange('email', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none"
                                    value={formData.phone || ''}
                                    onChange={e => handleChange('phone', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none"
                                    value={formData.location}
                                    onChange={e => handleChange('location', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Years of Experience</label>
                                <input 
                                    type="number" 
                                    className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none"
                                    value={formData.years_experience_total || 0}
                                    onChange={e => handleChange('years_experience_total', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">LinkedIn URL</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none"
                                    value={formData.linkedin_url || ''}
                                    onChange={e => handleChange('linkedin_url', e.target.value)}
                                    placeholder="https://linkedin.com/in/..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Portfolio/Behance URL</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none"
                                    value={formData.portfolio_url || ''}
                                    onChange={e => handleChange('portfolio_url', e.target.value)}
                                    placeholder="https://behance.net/..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Work History Section */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b pb-2">
                            <h3 className="text-lg font-bold text-slate-800">Work History</h3>
                            <button 
                                type="button" 
                                onClick={addWorkHistory}
                                className="text-sm bg-black text-white px-3 py-1 rounded hover:bg-zinc-800 transition"
                            >
                                + Add Entry
                            </button>
                        </div>
                        <div className="space-y-4">
                            {(formData.work_history || []).map((work, idx) => (
                                <div key={idx} className="p-4 bg-slate-50 rounded-lg border border-slate-200 relative group">
                                    <button 
                                        type="button" 
                                        onClick={() => removeWorkHistory(idx)}
                                        className="absolute top-2 right-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                                    >
                                        <XMarkIcon className="h-5 w-5" />
                                    </button>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Company</label>
                                            <input 
                                                type="text" 
                                                className="w-full border border-slate-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-black outline-none"
                                                value={work.company}
                                                onChange={e => updateWorkHistory(idx, 'company', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Title</label>
                                            <input 
                                                type="text" 
                                                className="w-full border border-slate-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-black outline-none"
                                                value={work.title}
                                                onChange={e => updateWorkHistory(idx, 'title', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
                                            <input 
                                                type="text" 
                                                className="w-full border border-slate-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-black outline-none"
                                                placeholder="e.g. Jan 2020"
                                                value={work.start_date || ''}
                                                onChange={e => updateWorkHistory(idx, 'start_date', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Date</label>
                                            <input 
                                                type="text" 
                                                className="w-full border border-slate-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-black outline-none"
                                                placeholder="e.g. Present"
                                                value={work.end_date || ''}
                                                onChange={e => updateWorkHistory(idx, 'end_date', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {(!formData.work_history || formData.work_history.length === 0) && (
                                <p className="text-center py-4 text-slate-400 text-sm italic">No work history entries added.</p>
                            )}
                        </div>
                    </div>

                    {/* Tech & Tools Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Technologies */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center border-b pb-2">
                                <h3 className="text-lg font-bold text-slate-800">Technologies</h3>
                                <button 
                                    type="button" 
                                    onClick={() => addTech('technologies')}
                                    className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded hover:bg-slate-300 transition"
                                >
                                    + Add
                                </button>
                            </div>
                            <div className="space-y-2">
                                {(formData.technologies || []).map((tech, idx) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <input 
                                            type="text" 
                                            placeholder="Name"
                                            className="flex-grow border border-slate-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-black outline-none"
                                            value={tech.name}
                                            onChange={e => updateTech('technologies', idx, 'name', e.target.value)}
                                        />
                                        <input 
                                            type="number" 
                                            placeholder="Yrs"
                                            className="w-16 border border-slate-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-black outline-none"
                                            value={tech.years}
                                            onChange={e => updateTech('technologies', idx, 'years', e.target.value)}
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => removeTech('technologies', idx)}
                                            className="text-slate-400 hover:text-red-500 transition"
                                        >
                                            <XMarkIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Tools */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center border-b pb-2">
                                <h3 className="text-lg font-bold text-slate-800">Tools</h3>
                                <button 
                                    type="button" 
                                    onClick={() => addTech('tools')}
                                    className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded hover:bg-slate-300 transition"
                                >
                                    + Add
                                </button>
                            </div>
                            <div className="space-y-2">
                                {(formData.tools || []).map((tool, idx) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <input 
                                            type="text" 
                                            placeholder="Name"
                                            className="flex-grow border border-slate-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-black outline-none"
                                            value={tool.name}
                                            onChange={e => updateTech('tools', idx, 'name', e.target.value)}
                                        />
                                        <input 
                                            type="number" 
                                            placeholder="Yrs"
                                            className="w-16 border border-slate-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-black outline-none"
                                            value={tool.years}
                                            onChange={e => updateTech('tools', idx, 'years', e.target.value)}
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => removeTech('tools', idx)}
                                            className="text-slate-400 hover:text-red-500 transition"
                                        >
                                            <XMarkIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Resume Text (Read Only) */}
                    <div className="space-y-2">
                        <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Original Resume Text (Reference)</h3>
                        <textarea 
                            readOnly 
                            className="w-full bg-slate-50 border border-slate-200 rounded-md p-4 text-xs font-mono text-slate-600 min-h-[300px] outline-none"
                            value={formData.resume_text || 'No resume text available.'}
                        ></textarea>
                        <p className="text-xs text-slate-400 italic">This field is read-only. Copy information from here to the fields above.</p>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                        <button 
                            type="button"
                            onClick={() => setIsEditing(false)} 
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-md transition"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={saving}
                            className="px-6 py-2 bg-black text-white font-semibold rounded-md hover:bg-zinc-800 transition disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="p-6 space-y-8">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Score</div>
                        <div className="text-xl font-bold text-slate-900">{candidate.match_score}%</div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Exp</div>
                        <div className="text-xl font-bold text-slate-900">{candidate.years_experience_total || candidate.years_experience || 0} Yrs</div>
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
                    <h3 className="font-bold text-slate-900 mb-2">Tech Stack / Skills</h3>
                    <div className="flex flex-wrap gap-2">
                        {/* 1. Technologies (Parsed from Resume) */}
                        {candidate.technologies?.map((t, i) => (
                            <span key={i} className="bg-slate-100 px-3 py-1 rounded-full text-sm border border-slate-200">
                                {t.name} <span className="text-slate-400 text-xs ml-1">({t.years}y)</span>
                            </span>
                        ))}
                        {/* 2. Tools (Parsed from Resume) */}
                        {candidate.tools?.map((t, i) => (
                            <span key={i} className="bg-white px-3 py-1 rounded-full text-sm border border-slate-200 shadow-sm">
                                {t.name} <span className="text-slate-400 text-xs ml-1">({t.years}y)</span>
                            </span>
                        ))}
                        {/* 3. Skills (Sourced from LNKD/Manual) */}
                        {!candidate.technologies?.length && !candidate.tools?.length && candidate.skills?.map((s, i) => (
                            <span key={i} className="bg-blue-50 px-3 py-1 rounded-full text-sm border border-blue-100 text-blue-800">
                                {s}
                            </span>
                        ))}
                    </div>
                </div>

                {candidate.work_history && Array.isArray(candidate.work_history) && candidate.work_history.length > 0 && (
                    <div>
                        <h3 className="font-bold text-slate-900 mb-2">Work History</h3>
                        <div className="space-y-4">
                            {candidate.work_history.map((job, i) => (
                                <div key={i} className="flex justify-between items-start border-b border-slate-100 pb-3 last:border-0">
                                    <div>
                                        <div className="font-bold text-slate-800">{job.company}</div>
                                        <div className="text-sm text-slate-600">{job.title}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-semibold text-slate-500">{job.start_date} - {job.end_date}</div>
                                        {job.years && <div className="text-xs text-slate-400">{job.years} Years</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Interactions Section */}
                <div className="pt-6 border-t border-slate-100">
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        💬 Interaction Timeline
                    </h3>
                    
                    {/* Log New Interaction */}
                    <div className="bg-white p-2.5 rounded-lg border border-slate-100 mb-6 shadow-sm">
                        <div className="flex flex-col sm:flex-row gap-2.5 mb-2">
                            <select 
                                className="sm:w-1/3 border border-slate-200 rounded text-sm p-1.5 outline-none focus:ring-1 focus:ring-black bg-slate-50"
                                value={newInteraction.type}
                                onChange={e => setNewInteraction({...newInteraction, type: e.target.value})}
                            >
                                <option>LinkedIn</option>
                                <option>Email</option>
                                <option>Call</option>
                                <option>Interview</option>
                                <option>Offer</option>
                                <option>Feedback</option>
                            </select>
                            <textarea 
                                className="sm:w-2/3 flex-grow border border-slate-200 rounded text-sm p-1.5 outline-none focus:ring-1 focus:ring-black min-h-[36px]"
                                placeholder="Quick notes..."
                                value={newInteraction.content}
                                onChange={e => setNewInteraction({...newInteraction, content: e.target.value})}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                        onSubmitInteraction();
                                    }
                                }}
                            />
                        </div>
                        <div className="flex justify-between items-center px-1">
                            <span className="text-xs text-slate-400">⌘+Enter</span>
                            <button 
                                onClick={onSubmitInteraction}
                                disabled={submittingInteraction || !newInteraction.content.trim()}
                                className="bg-black text-white px-5 py-1 rounded text-xs font-bold hover:bg-zinc-800 transition disabled:opacity-50"
                            >
                                {submittingInteraction ? '...' : 'Log Interaction'}
                            </button>
                        </div>
                    </div>

                    {/* Interaction List */}
                    <div className="space-y-4">
                        {loadingInteractions ? (
                            <div className="text-center py-4 text-slate-400 text-sm animate-pulse">Loading history...</div>
                        ) : interactions.length > 0 ? (
                            interactions.map((it) => (
                                <div key={it.id} className="flex gap-4 relative">
                                    <div className="w-px bg-slate-200 absolute left-2.5 top-8 bottom-0"></div>
                                    <div className="h-5 w-5 rounded-full bg-slate-200 shrink-0 mt-1.5 flex items-center justify-center text-[10px] z-10">
                                        {it.type.includes('Call') ? '📞' : it.type.includes('Email') ? '📧' : '💬'}
                                    </div>
                                    <div className="pb-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                {it.type}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-medium">
                                                {new Date(it.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-600 whitespace-pre-wrap">{it.content}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-center py-8 text-slate-400 text-sm italic">No interactions logged yet. Start the journey!</p>
                        )}
                    </div>
                </div>

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
                    <button 
                        onClick={() => setIsEditing(true)}
                        className="flex-1 bg-white border border-slate-300 text-slate-700 text-center py-2.5 rounded-lg font-semibold hover:bg-slate-50 transition flex items-center justify-center gap-2"
                    >
                        <PencilSquareIcon className="h-5 w-5" /> Edit Profile
                    </button>
                </div>

                </div>
            )}
          </div>
        </div>
    );
}

// ─── CV EXPORT MODAL & PDF TEMPLATES ────────────────────────────────────────

function CVExportModal({
  candidate,
  onClose,
}: {
  candidate: Candidate;
  onClose: () => void;
}) {
  const [selectedTemplate, setSelectedTemplate] = useState<'A' | 'B'>('A');
  const [privacy, setPrivacy] = useState({
    linkedin: true,
    portfolio: true,
    email: false,
    phone: false,
  });
  const [generating, setGenerating] = useState(false);

  const initials = candidate.full_name
    ? candidate.full_name
        .split(' ')
        .slice(0, 2)
        .map((p: string) => p[0])
        .join('')
        .toUpperCase()
    : '??';

  const allSkills = [
    ...(candidate.technologies?.map((t) => t.name) || []),
    ...(candidate.tools?.map((t) => t.name) || []),
    ...(candidate.skills || []),
  ].slice(0, 12);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      // Dynamically import react-pdf to avoid SSR issues
      const { pdf } = await import('@react-pdf/renderer');
      const { CVTemplateA, CVTemplateB } = await import('./cv-templates');

      // Fetch logo as base64
      let logoBase64 = '';
      try {
        const res = await fetch('/logo.jpg');
        const blob = await res.blob();
        logoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch {
        // logo fetch failed, proceed without
      }

      const doc =
        selectedTemplate === 'A' ? (
          <CVTemplateA candidate={candidate} privacy={privacy} logoBase64={logoBase64} />
        ) : (
          <CVTemplateB candidate={candidate} privacy={privacy} logoBase64={logoBase64} />
        );

      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${candidate.full_name.replace(/[ ]+/g, '_')}_CV.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Error generating PDF. Please try again.');
    }
    setGenerating(false);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-center z-10 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Generate CV</h2>
            <p className="text-sm text-slate-500">{candidate.full_name} — {candidate.title}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition">
            <XMarkIcon className="h-6 w-6 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Privacy Options */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Privacy Options</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { key: 'linkedin', label: 'Include LinkedIn', available: !!candidate.linkedin_url },
                { key: 'portfolio', label: 'Include Portfolio', available: !!candidate.portfolio_url },
                { key: 'email', label: 'Include Email', available: !!candidate.email },
                { key: 'phone', label: 'Include Phone', available: !!candidate.phone },
              ].map(({ key, label, available }) => (
                <label
                  key={key}
                  className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition text-sm ${
                    available
                      ? 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
                      : 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={privacy[key as keyof typeof privacy] && available}
                    disabled={!available}
                    onChange={(e) => setPrivacy((prev) => ({ ...prev, [key]: e.target.checked }))}
                    className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="text-slate-700 font-medium leading-tight">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Template Selection */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Choose Template</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Template A Preview */}
              <div
                onClick={() => setSelectedTemplate('A')}
                className={`border-2 rounded-xl overflow-hidden cursor-pointer transition-all ${
                  selectedTemplate === 'A'
                    ? 'border-indigo-500 shadow-lg shadow-indigo-100'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="bg-slate-50 px-3 py-2 flex items-center justify-between border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-700">A — Clean Minimal</span>
                  {selectedTemplate === 'A' && (
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Selected</span>
                  )}
                </div>
                {/* Mini preview of Template A */}
                <div className="bg-white p-3 text-[7px] leading-tight min-h-[220px] select-none">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-black text-[11px] text-slate-900 leading-none">{candidate.full_name}</div>
                      <div className="text-slate-500 text-[8px] mt-0.5">{candidate.title}</div>
                    </div>
                    <div className="w-8 h-6 bg-slate-200 rounded flex items-center justify-center text-[6px] text-slate-400">LOGO</div>
                  </div>
                  <div className="border-t border-slate-200 my-1.5"></div>
                  <div className="flex gap-2 text-slate-500 mb-2 flex-wrap">
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded">📍 {candidate.location || '—'}</span>
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded">🗓 {candidate.years_experience_total || 0} yrs</span>
                  </div>
                  <div className="font-bold text-slate-700 mb-1">SKILLS</div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {allSkills.slice(0, 6).map((s, i) => (
                      <span key={i} className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">{s}</span>
                    ))}
                  </div>
                  {candidate.work_history && candidate.work_history.length > 0 && (
                    <>
                      <div className="font-bold text-slate-700 mb-1">EXPERIENCE</div>
                      {candidate.work_history.slice(0, 2).map((w, i) => (
                        <div key={i} className="flex justify-between mb-1">
                          <div>
                            <div className="font-semibold">{w.company}</div>
                            <div className="text-slate-400 italic">{w.title}</div>
                          </div>
                          <div className="text-slate-400 text-right">{w.start_date} – {w.end_date}</div>
                        </div>
                      ))}
                    </>
                  )}
                  <div className="border-t border-slate-100 mt-2 pt-1 text-center text-slate-300 text-[6px]">Presented by LNKDREC.ai</div>
                </div>
                <div className={`py-2 text-center text-xs font-bold transition ${
                  selectedTemplate === 'A' ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>
                  {selectedTemplate === 'A' ? '✓ Selected' : 'Select Template A'}
                </div>
              </div>

              {/* Template B Preview */}
              <div
                onClick={() => setSelectedTemplate('B')}
                className={`border-2 rounded-xl overflow-hidden cursor-pointer transition-all ${
                  selectedTemplate === 'B'
                    ? 'border-indigo-500 shadow-lg shadow-indigo-100'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="bg-slate-50 px-3 py-2 flex items-center justify-between border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-700">B — Two-Column Modern</span>
                  {selectedTemplate === 'B' && (
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Selected</span>
                  )}
                </div>
                {/* Mini preview of Template B */}
                <div className="flex min-h-[220px] select-none">
                  {/* Sidebar */}
                  <div className="w-1/3 bg-slate-900 p-2 text-white text-[7px] leading-tight">
                    <div className="w-8 h-5 bg-slate-700 rounded flex items-center justify-center text-[5px] text-slate-400 mb-1.5">LOGO</div>
                    <div className="h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center text-[8px] font-black mb-1.5 mx-auto">{initials}</div>
                    <div className="font-black text-[8px] text-center leading-none text-white mb-0.5">{candidate.full_name}</div>
                    <div className="text-slate-400 text-[6px] text-center mb-2">{candidate.title}</div>
                    <div className="text-slate-300 font-bold mb-1 text-[6px]">CONTACT</div>
                    {privacy.email && candidate.email && <div className="text-slate-400 mb-0.5 truncate">✉ {candidate.email}</div>}
                    {privacy.phone && candidate.phone && <div className="text-slate-400 mb-0.5">📞 {candidate.phone}</div>}
                    <div className="text-slate-300 font-bold mb-1 mt-1.5 text-[6px]">SKILLS</div>
                    {allSkills.slice(0, 4).map((s, i) => (
                      <div key={i} className="text-slate-300 mb-0.5">• {s}</div>
                    ))}
                  </div>
                  {/* Content */}
                  <div className="flex-1 bg-white p-2 text-[7px]">
                    <div className="text-indigo-600 font-black text-[8px] tracking-widest mb-2">CANDIDATE PROFILE</div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">{candidate.years_experience_total || 0} yrs exp</span>
                    </div>
                    {candidate.work_history && candidate.work_history.length > 0 && (
                      <>
                        <div className="font-bold text-slate-700 mb-1">EXPERIENCE</div>
                        {candidate.work_history.slice(0, 2).map((w, i) => (
                          <div key={i} className="mb-1.5">
                            <div className="font-semibold">{w.company}</div>
                            <div className="text-slate-400 italic">{w.title}</div>
                          </div>
                        ))}
                      </>
                    )}
                    <div className="border-t border-slate-100 mt-2 pt-1 text-center text-slate-300 text-[6px]">Presented by LNKDREC.ai</div>
                  </div>
                </div>
                <div className={`py-2 text-center text-xs font-bold transition ${
                  selectedTemplate === 'B' ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>
                  {selectedTemplate === 'B' ? '✓ Selected' : 'Select Template B'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex items-center justify-between rounded-b-2xl">
          <p className="text-xs text-slate-400">
            Template {selectedTemplate} · {privacy.email ? 'Email visible · ' : ''}{privacy.phone ? 'Phone visible · ' : ''}
            {privacy.linkedin ? 'LinkedIn visible · ' : ''}{privacy.portfolio ? 'Portfolio visible' : ''}
          </p>
          <button
            onClick={handleDownload}
            disabled={generating}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition disabled:opacity-60"
          >
            <DocumentArrowDownIcon className="h-5 w-5" />
            {generating ? 'Generating...' : 'Download PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
