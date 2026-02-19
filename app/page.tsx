'use client';

import { supabase } from '@/lib/supabaseClient';
import { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, XMarkIcon, CheckBadgeIcon, BriefcaseIcon, EnvelopeIcon, PhoneIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
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
                onToggleAssign={() => toggleAssignment(candidate)}
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
    </div>
  );
}

// Sub-Components
function CandidateCard({ 
    candidate, 
    onViewDetails, 
    onVetCandidate, 
    onToggleAssign
}: { 
    candidate: Candidate; 
    onViewDetails: () => void; 
    onVetCandidate: () => void; 
    onToggleAssign: () => void;
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
        
        // Sanitize numeric fields
        const payload = {
            ...formData,
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
                    <div className="bg-white p-2 rounded-lg border border-slate-100 mb-6 shadow-sm">
                        <div className="flex flex-col sm:flex-row gap-2 mb-1.5">
                            <select 
                                className="sm:w-1/3 border border-slate-200 rounded text-xs p-1 outline-none focus:ring-1 focus:ring-black bg-slate-50"
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
                                className="sm:w-2/3 flex-grow border border-slate-200 rounded text-[11px] p-1.5 outline-none focus:ring-1 focus:ring-black min-h-[30px]"
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
                            <span className="text-[9px] text-slate-400">⌘+Enter</span>
                            <button 
                                onClick={onSubmitInteraction}
                                disabled={submittingInteraction || !newInteraction.content.trim()}
                                className="bg-black text-white px-3 py-0.5 rounded text-[10px] font-bold hover:bg-zinc-800 transition disabled:opacity-50"
                            >
                                {submittingInteraction ? '...' : 'Log'}
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
