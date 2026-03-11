'use client';

import { supabase } from '@/lib/supabaseClient';
import { logActivity } from '@/lib/logActivity';
import CandidateDetailsModal, { Candidate } from '@/components/CandidateDetailsModal';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { MagnifyingGlassIcon, XMarkIcon, CheckBadgeIcon, BriefcaseIcon, EnvelopeIcon, PhoneIcon, PencilSquareIcon, Squares2X2Icon, ListBulletIcon, DocumentArrowDownIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';

// Types
type Tool = { name: string; years: number };
type Technology = { name: string; years: number };
type WorkHistory = { 
  company: string; 
  title: string; 
  start_date?: string; 
  end_date?: string; 
  years?: number;
  brief?: string;
};
type Job = { id: string; title: string; client_id: string; clients: any };

// Pipeline stages — imported from shared constants (single source of truth)
import { PIPELINE_STAGES, STAGE_COLORS } from '@/lib/constants';
type PipelineStage = (typeof PIPELINE_STAGES)[number];

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
  return (
    <Suspense fallback={null}>
      <DashboardInner />
    </Suspense>
  );
}

function DashboardInner() {
  const searchParams = useSearchParams();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  
  // Pipeline bulk action
  const [showBulkPipelinePicker, setShowBulkPipelinePicker] = useState(false);
  const [bulkPipelineStage, setBulkPipelineStage] = useState<PipelineStage>('Sourced');
  const [movingToPipeline, setMovingToPipeline] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const toggleListSelect = (id: string) => {
    setSelectedListIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAllList = () => {
    if (selectedListIds.length === filteredCandidates.length) {
      setSelectedListIds([]);
    } else {
      setSelectedListIds(filteredCandidates.map(c => c.id));
    }
  };

  async function deleteSelectedCandidates() {
    if (selectedListIds.length === 0) return;
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete ${selectedListIds.length} candidate${selectedListIds.length > 1 ? 's' : ''}? This cannot be undone.`
    );
    if (!confirmed) return;

    const { error } = await supabase.from('candidates').delete().in('id', selectedListIds);
    if (error) {
      showToast('Error deleting candidates: ' + error.message, 'error');
    } else {
      setSelectedListIds([]);
      fetchCandidates();
      showToast(`Deleted ${selectedListIds.length} candidate(s).`);
    }
  }

  async function moveBulkToPipeline() {
    if (selectedListIds.length === 0 || !bulkPipelineStage) return;
    setMovingToPipeline(true);
    const { error } = await supabase
      .from('candidates')
      .update({ pipeline_stage: bulkPipelineStage, stage_changed_at: new Date().toISOString() })
      .in('id', selectedListIds);
    setMovingToPipeline(false);
    setShowBulkPipelinePicker(false);
    if (error) {
      showToast('Error updating pipeline: ' + error.message, 'error');
    } else {
      showToast(`Moved ${selectedListIds.length} candidate(s) to ${bulkPipelineStage} ✓`);
      setSelectedListIds([]);
      fetchCandidates();
    }
  }
  
  // Modal States
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [vettingCandidate, setVettingCandidate] = useState<Candidate | null>(null);
  const [assigningCandidate, setAssigningCandidate] = useState<Candidate | null>(null);
  const [cvCandidate, setCvCandidate] = useState<Candidate | null>(null);

  // Pipeline stage picker for vetting modal
  const [showVettingPipelinePicker, setShowVettingPipelinePicker] = useState(false);
  const [vettingPipelineStage, setVettingPipelineStage] = useState<PipelineStage>('Sourced');
  const [movingVettingToPipeline, setMovingVettingToPipeline] = useState(false);

  async function moveVettingCandidateToPipeline() {
    if (!vettingCandidate || !vettingPipelineStage) return;
    setMovingVettingToPipeline(true);
    const { error } = await supabase
      .from('candidates')
      .update({ pipeline_stage: vettingPipelineStage, stage_changed_at: new Date().toISOString() })
      .eq('id', vettingCandidate.id);
    setMovingVettingToPipeline(false);
    setShowVettingPipelinePicker(false);
    if (error) {
      showToast('Error updating pipeline: ' + error.message, 'error');
    } else {
      showToast(`${vettingCandidate.full_name} moved to ${vettingPipelineStage} ✓`);
      setVettingCandidate(prev => prev ? { ...prev, pipeline_stage: vettingPipelineStage } : prev);
      fetchCandidates();
    }
  }

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

  // Auto-trigger CV generation when ?cv=<id> param is present
  useEffect(() => {
    const cvId = searchParams?.get('cv');
    if (!cvId || candidates.length === 0) return;
    const match = candidates.find((c) => c.id === cvId);
    if (match) {
      setCvCandidate(match);
    }
  }, [searchParams, candidates]);

  async function fetchCandidates() {
    setLoading(true);
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
        const sortedInteractions = (c.candidate_interactions || []).sort(
          (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const last = sortedInteractions[0];
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

  // Open Vetting Modal & Fetch Data
  async function openVettingModal(candidate: Candidate) {
      setVettingCandidate(candidate);
      setLoadingVetting(true);
      setShowVettingPipelinePicker(false);
      if (candidate.pipeline_stage) {
        setVettingPipelineStage(candidate.pipeline_stage as PipelineStage);
      } else {
        setVettingPipelineStage('Sourced');
      }
      
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
          const { data, error } = await supabase
            .from('vettings')
            .select('*')
            .eq('candidate_id', candidate.id)
            .order('vetted_at', { ascending: false })
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
        const { error: updateError } = await supabase.from('vettings').update(payload).eq('id', vettingData.id);
        error = updateError;
    } else {
        const { error: insertError } = await supabase.from('vettings').insert(payload);
        error = insertError;
    }
    if (error) {
      alert('Error saving vetting: ' + error.message);
      setSubmittingVetting(false);
      return;
    }
    if (vettingCandidate.status !== 'Vetted') {
        await supabase.from('candidates').update({ status: 'Vetted' }).eq('id', vettingCandidate.id);
    }
    await logActivity('candidate_vetted', vettingCandidate.full_name, {
      english: vettingData.english_proficiency,
      work_presence: vettingData.work_presence,
      expected_salary: vettingData.expected_salary,
      notice_period: vettingData.notice_period,
    }, 'candidate', vettingCandidate.id);
    await fetchCandidates();
    setVettingCandidate(null);
    setSubmittingVetting(false);
  }

  async function toggleAssignment(candidate: Candidate) {
      if (candidate.status === 'Assigned') {
          const { error: appError } = await supabase.from('applications').delete().eq('candidate_id', candidate.id);
          if (appError) {
              alert('Error removing application: ' + appError.message);
              return;
          }
          const { error: candError } = await supabase.from('candidates').update({ status: 'Vetted' }).eq('id', candidate.id);
          if (candError) alert('Error unassigning: ' + candError.message);
          else {
            await logActivity('candidate_unassigned', candidate.full_name, {}, 'candidate', candidate.id);
            fetchCandidates();
          }
      } else {
          setAssigningCandidate(candidate);
      }
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
          await supabase.from('candidates').update({ status: 'Assigned' }).eq('id', assigningCandidate.id);
          await logActivity('candidate_assigned', assigningCandidate.full_name, { job_id: selectedJobId }, 'candidate', assigningCandidate.id);
          setAssigningCandidate(null);
          setSelectedJobId('');
          fetchCandidates();
      }
      setSubmittingAssignment(false);
  }

  const toggleBenefit = (benefit: string) => {
    setVettingData(prev => ({
      ...prev,
      benefits: prev.benefits.includes(benefit) ? prev.benefits.filter(b => b !== benefit) : [...prev.benefits, benefit]
    }));
  };

  const filteredCandidates = candidates.filter(c => {
    const q = search.toLowerCase();
    if (filter !== 'All') {
      if (filter === 'UnVetted') {
        if (c.status === 'Vetted' || c.status === 'Assigned') return false;
      } else {
        if (c.status !== filter) return false;
      }
    }
    const checkArray = (arr: any[], key: string) => Array.isArray(arr) && arr.some(item => item && item[key] && item[key].toLowerCase().includes(q));
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
        {toast && (
          <div className={`fixed top-6 right-6 z-[500] px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
            toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}>
            {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
          </div>
        )}
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
            <div className="text-sm text-slate-500 font-medium whitespace-nowrap">Showing {filteredCandidates.length} Candidates</div>
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all ${viewMode === 'grid' ? 'bg-black text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                title="Grid View"
              ><Squares2X2Icon className="h-4 w-4" />Cards</button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all ${viewMode === 'list' ? 'bg-black text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                title="List View"
              ><ListBulletIcon className="h-4 w-4" />List</button>
            </div>
          </div>
        </div>

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
          </div>
        ) : (
          <div className="space-y-3">
            {selectedListIds.length > 0 && (
              <div className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-semibold text-white">{selectedListIds.length} selected</span>
                <div className="flex flex-wrap gap-2 items-center">
                  <button onClick={() => setSelectedListIds([])} className="text-xs px-3 py-1.5 bg-slate-700 text-slate-200 rounded-md">Clear</button>
                  {showBulkPipelinePicker ? (
                    <div className="flex items-center gap-2">
                      {PIPELINE_STAGES.map(stage => (
                        <button key={stage} onClick={() => setBulkPipelineStage(stage)} className={`text-xs px-2.5 py-1 rounded-full ${bulkPipelineStage === stage ? STAGE_COLORS[stage] : 'bg-slate-700 text-slate-300'}`}>{stage}</button>
                      ))}
                      <button onClick={moveBulkToPipeline} disabled={movingToPipeline} className="text-xs px-3 py-1.5 bg-indigo-600 text-white font-bold rounded-md">Confirm</button>
                    </div>
                  ) : (
                    <button onClick={() => setShowBulkPipelinePicker(true)} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-md">🏷 Move to Pipeline</button>
                  )}
                  <button onClick={deleteSelectedCandidates} className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-md">Delete Selected</button>
                </div>
              </div>
            )}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 w-10"><input type="checkbox" checked={selectedListIds.length === filteredCandidates.length} onChange={toggleSelectAllList} /></th>
                            <th className="text-left px-4 py-3 text-xs uppercase text-slate-500">Name</th>
                            <th className="text-left px-4 py-3 text-xs uppercase text-slate-500">Title</th>
                            <th className="text-left px-4 py-3 text-xs uppercase text-slate-500">Yrs Exp</th>
                            <th className="text-left px-4 py-3 text-xs uppercase text-slate-500">Status</th>
                            <th className="text-right px-4 py-3 text-xs uppercase text-slate-500">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredCandidates.map(c => (
                            <CandidateRow key={c.id} candidate={c} isSelected={selectedListIds.includes(c.id)} onToggleSelect={() => toggleListSelect(c.id)} onViewDetails={() => setSelectedCandidate(c)} onVetCandidate={() => openVettingModal(c)} onToggleAssign={() => toggleAssignment(c)} onGenerateCV={() => setCvCandidate(c)} />
                        ))}
                    </tbody>
                </table>
            </div>
          </div>
        )}

      {selectedCandidate && <CandidateDetailsModal candidate={selectedCandidate} onClose={() => setSelectedCandidate(null)} onUpdate={fetchCandidates} />}

      {vettingCandidate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setVettingCandidate(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-100 p-6 flex justify-between items-center z-10">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{vettingCandidate.status === 'Vetted' ? 'Edit Vetting' : 'Vet Candidate'}: {vettingCandidate.full_name}</h2>
                <p className="text-sm text-slate-500">{vettingCandidate.title}</p>
              </div>
              <button onClick={() => setVettingCandidate(null)} className="p-2 hover:bg-slate-100 rounded-full transition"><XMarkIcon className="h-6 w-6 text-slate-500" /></button>
            </div>
            {loadingVetting ? (
                <div className="p-12 text-center text-slate-400">Loading...</div>
            ) : (
                <form onSubmit={submitVetting} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">English Proficiency</label>
                        <select className="w-full border rounded-md p-2" value={vettingData.english_proficiency} onChange={e => setVettingData({...vettingData, english_proficiency: e.target.value})}>
                            {ENGLISH_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Work Presence</label>
                        <select className="w-full border rounded-md p-2" value={vettingData.work_presence} onChange={e => setVettingData({...vettingData, work_presence: e.target.value})}>
                            {WORK_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Current Salary</label>
                        <input type="number" className="w-full border rounded-md p-2" value={vettingData.current_salary} onChange={e => setVettingData({...vettingData, current_salary: e.target.value})} placeholder="25000" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Expected Salary</label>
                        <input type="number" className="w-full border rounded-md p-2" value={vettingData.expected_salary} onChange={e => setVettingData({...vettingData, expected_salary: e.target.value})} placeholder="35000" />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notice Period</label>
                    <input type="text" className="w-full border rounded-md p-2" value={vettingData.notice_period} onChange={e => setVettingData({...vettingData, notice_period: e.target.value})} placeholder="1 Month" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Current Benefits</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {BENEFITS_LIST.map(benefit => (
                            <label key={benefit} className="flex items-center gap-2 p-2 border rounded-md hover:bg-slate-50 cursor-pointer">
                                <input type="checkbox" checked={vettingData.benefits.includes(benefit)} onChange={() => toggleBenefit(benefit)} />
                                <span className="text-sm text-slate-700">{benefit}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                    <textarea className="w-full border rounded-md p-2 min-h-[100px]" value={vettingData.notes} onChange={e => setVettingData({...vettingData, notes: e.target.value})} placeholder="Interview notes..."></textarea>
                </div>
                <div className="bg-slate-900 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">Move to Pipeline</h4>
                      {vettingCandidate?.pipeline_stage && (
                        <p className="text-xs text-slate-400 mt-0.5">Currently: <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${STAGE_COLORS[vettingCandidate.pipeline_stage]}`}>{vettingCandidate.pipeline_stage}</span></p>
                      )}
                    </div>
                    {!showVettingPipelinePicker && <button type="button" onClick={() => setShowVettingPipelinePicker(true)} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg">🏷 Set Stage</button>}
                  </div>
                  {showVettingPipelinePicker && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-1.5">
                        {PIPELINE_STAGES.map(stage => (
                          <button key={stage} type="button" onClick={() => setVettingPipelineStage(stage)} className={`text-xs px-3 py-1.5 rounded-full ${vettingPipelineStage === stage ? STAGE_COLORS[stage] : 'bg-slate-700 text-slate-300'}`}>{stage}</button>
                        ))}
                      </div>
                      <button type="button" onClick={moveVettingCandidateToPipeline} disabled={movingVettingToPipeline} className="text-xs px-4 py-1.5 bg-indigo-600 text-white rounded-lg">Confirm</button>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onClick={() => setVettingCandidate(null)} className="px-4 py-2 text-slate-600">Cancel</button>
                    <button type="submit" disabled={submittingVetting} className="px-6 py-2 bg-black text-white font-semibold rounded-md disabled:opacity-50">Save Vetting</button>
                </div>
                </form>
            )}
          </div>
        </div>
      )}

      {assigningCandidate && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setAssigningCandidate(null)}>
              <div className="bg-white p-6 rounded-xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
                  <h2 className="text-xl font-bold mb-4">Assign {assigningCandidate.full_name}</h2>
                  <form onSubmit={submitAssignment}>
                      <div className="mb-6">
                          <label className="block text-sm font-medium mb-2">Select Job</label>
                          <select className="w-full border rounded-md p-3" value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)} required>
                              <option value="">-- Choose Job --</option>
                              {jobs.map(job => (<option key={job.id} value={job.id}>{job.clients?.name} - {job.title}</option>))}
                          </select>
                      </div>
                      <div className="flex justify-end gap-3">
                          <button type="button" onClick={() => setAssigningCandidate(null)} className="text-slate-600">Cancel</button>
                          <button type="submit" disabled={submittingAssignment} className="bg-black text-white px-4 py-2 rounded">Assign</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {cvCandidate && <CVExportModal candidate={cvCandidate} onClose={() => setCvCandidate(null)} />}
    </div>
  );
}

function CandidateRow({ candidate, isSelected, onToggleSelect, onViewDetails, onVetCandidate, onToggleAssign, onGenerateCV }: any) {
  const initials = candidate.full_name?.split(' ').slice(0, 2).map((p: any) => p[0]).join('').toUpperCase() || '?';
  return (
    <tr className={`border-b hover:bg-slate-50 transition-colors ${isSelected ? 'bg-red-50' : ''}`}>
      <td className="px-4 py-3"><input type="checkbox" checked={isSelected} onChange={onToggleSelect} /></td>
      <td className="px-4 py-3 font-semibold">{candidate.full_name}</td>
      <td className="px-4 py-3 text-slate-500">{candidate.title}</td>
      <td className="px-4 py-3">{candidate.years_experience_total || 0} yrs</td>
      <td className="px-4 py-3"><span className="text-xs font-bold px-2 py-1 rounded-full border bg-blue-100 text-blue-700">{candidate.status}</span></td>
      <td className="px-4 py-3 flex justify-end gap-1.5">
          <button onClick={onViewDetails} className="px-2.5 py-1 text-xs font-semibold bg-white border rounded">Details</button>
          <button onClick={onVetCandidate} className="px-2.5 py-1 text-xs font-semibold bg-black text-white rounded">Vet</button>
          <button onClick={onGenerateCV} className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 text-indigo-700 rounded border border-indigo-200">CV</button>
      </td>
    </tr>
  );
}

function CandidateCard({ candidate, onViewDetails, onVetCandidate, onToggleAssign, onGenerateCV }: any) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-6 flex flex-col h-full hover:shadow-md transition group relative">
        <div className="flex justify-between items-start mb-4">
          <div className="flex gap-4">
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-xl border">👤</div>
            <div>
              <h3 className="font-bold text-lg text-slate-900 line-clamp-1">{candidate.full_name}</h3>
              <p className="text-sm text-slate-500 line-clamp-1">{candidate.title}</p>
              <p className="text-xs text-slate-400">📍 {candidate.location}</p>
            </div>
          </div>
          <span className="text-xs font-bold px-2 py-1 rounded-full border bg-blue-100 text-blue-700">{candidate.status}</span>
        </div>
        <div className="bg-slate-50 p-3 rounded-md border text-sm text-slate-600 line-clamp-3 mb-4">{candidate.match_reason}</div>
        <div className="flex gap-2 mt-auto">
            <button onClick={onViewDetails} className="flex-1 bg-white border text-slate-700 text-xs font-semibold py-2 rounded">Details</button>
            <button onClick={onVetCandidate} className="flex-1 bg-black text-white text-xs font-semibold py-2 rounded">Vet</button>
            <button onClick={onGenerateCV} className="px-2 py-2 bg-indigo-50 text-indigo-700 rounded border border-indigo-200"><DocumentArrowDownIcon className="h-4 w-4" /></button>
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
  const [vetting, setVetting] = useState<Record<string, any> | null>(null);
  const [egpRate, setEgpRate] = useState<number>(47);
  const [editableMatchReason, setEditableMatchReason] = useState<string>(candidate.match_reason || '');

  useEffect(() => {
    async function fetchRate() {
      try {
        const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=EGP');
        const data = await res.json();
        if (data?.rates?.EGP) setEgpRate(data.rates.EGP);
      } catch { }
    }
    fetchRate();
  }, []);

  useEffect(() => {
    async function fetchVetting() {
      if (!candidate.id) return;
      const { data } = await supabase
        .from('vettings')
        .select('*')
        .eq('candidate_id', candidate.id)
        .order('vetted_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) setVetting(data[0]);
    }
    fetchVetting();
  }, [candidate.id]);

  const initials = candidate.full_name ? candidate.full_name.split(' ').slice(0, 2).map((p: string) => p[0]).join('').toUpperCase() : '??';

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const { CVTemplateA, CVTemplateB } = await import('./cv-templates');
      let logoBase64 = '';
      try {
        const res = await fetch('/logo.jpg');
        const blob = await res.blob();
        logoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch { }
      const doc = selectedTemplate === 'A' ? (
          <CVTemplateA candidate={{ ...candidate, match_reason: editableMatchReason }} privacy={privacy} logoBase64={logoBase64} vetting={vetting} egpRate={egpRate} />
        ) : (
          <CVTemplateB candidate={{ ...candidate, match_reason: editableMatchReason }} privacy={privacy} logoBase64={logoBase64} vetting={vetting} egpRate={egpRate} />
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
      alert('Error generating PDF.');
    }
    setGenerating(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10 rounded-t-2xl">
          <div><h2 className="text-xl font-bold">Generate CV</h2><p className="text-sm text-slate-500">{candidate.full_name}</p></div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition"><XMarkIcon className="h-6 w-6" /></button>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-700 uppercase mb-3">Privacy</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label className="flex items-center gap-2 p-3 border rounded-lg"><input type="checkbox" checked={privacy.linkedin} onChange={e => setPrivacy({...privacy, linkedin: e.target.checked})} /> LinkedIn</label>
              <label className="flex items-center gap-2 p-3 border rounded-lg"><input type="checkbox" checked={privacy.portfolio} onChange={e => setPrivacy({...privacy, portfolio: e.target.checked})} /> Portfolio</label>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-700 uppercase mb-3">Templates</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div onClick={() => setSelectedTemplate('A')} className={`border-2 rounded-xl p-4 cursor-pointer ${selectedTemplate === 'A' ? 'border-indigo-500 bg-indigo-50' : ''}`}>Template A</div>
              <div onClick={() => setSelectedTemplate('B')} className={`border-2 rounded-xl p-4 cursor-pointer ${selectedTemplate === 'B' ? 'border-indigo-500 bg-indigo-50' : ''}`}>Template B</div>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-700 uppercase mb-3">Editable Match Reason</h3>
            <textarea value={editableMatchReason} onChange={e => setEditableMatchReason(e.target.value)} rows={4} className="w-full p-4 border rounded-xl" />
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex items-center justify-end">
          <button onClick={handleDownload} disabled={generating} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold disabled:opacity-60">{generating ? 'Generating...' : 'Download PDF'}</button>
        </div>
      </div>
    </div>
  );
}
