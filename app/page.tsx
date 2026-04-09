'use client';

import { supabase } from '@/lib/supabaseClient';
import { logActivity } from '@/lib/logActivity';
import CandidateDetailsModal, { Candidate } from '@/components/CandidateDetailsModal';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { 
  MagnifyingGlassIcon, 
  XMarkIcon, 
  CheckBadgeIcon, 
  BriefcaseIcon, 
  EnvelopeIcon, 
  PhoneIcon, 
  PencilSquareIcon, 
  Squares2X2Icon, 
  ListBulletIcon, 
  DocumentArrowDownIcon,
  PlusIcon, 
  TrashIcon,
  StarIcon as StarOutline,
  ClockIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
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

// Pipeline stages — imported from shared constants
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
  const INITIAL_LOAD = 10;
  const searchParams = useSearchParams();
  const userEmailRef = useRef<string>('System');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [displayedCount, setDisplayedCount] = useState(INITIAL_LOAD);
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
  const [addingToPipelineId, setAddingToPipelineId] = useState<string | null>(null);
  const [addToPipelineStage, setAddToPipelineStage] = useState<PipelineStage>('Sourced');
  const [movingCandidate, setMovingCandidate] = useState(false);

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

  async function addCandidateToPipeline(candidateId: string) {
    if (!addToPipelineStage) return;
    setMovingCandidate(true);
    const { error } = await supabase
      .from('candidates')
      .update({ pipeline_stage: addToPipelineStage, stage_changed_at: new Date().toISOString() })
      .eq('id', candidateId);
    setMovingCandidate(false);
    setAddingToPipelineId(null);
    if (!error) {
      fetchCandidates();
    }
  }

  // Vetting Form State
  const [vettingData, setVettingData] = useState({
    id: '', 
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
    // Read session from server-side cookies (reliable after server-action login)
    fetch('/api/me').then(r => r.json()).then(({ email }) => {
      if (email) userEmailRef.current = email;
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      userEmailRef.current = session?.user?.email || userEmailRef.current;
    });
    fetchCandidates();
    fetchJobs();
    return () => subscription.unsubscribe();
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
      .order('created_at', { ascending: false });

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

      if (candidate.status === 'Vetted' || candidate.status === 'Assigned' || !!candidate.assigned_job_title) {
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
    if (vettingCandidate.status !== 'Vetted' && !vettingCandidate.assigned_job_title) {
        await supabase.from('candidates').update({ status: 'Vetted' }).eq('id', vettingCandidate.id);
    }
    await logActivity('candidate_vetted', vettingCandidate.full_name, {
      english: vettingData.english_proficiency,
      work_presence: vettingData.work_presence,
      expected_salary: vettingData.expected_salary,
      notice_period: vettingData.notice_period,
    }, 'candidate', vettingCandidate.id, userEmailRef.current);
    await fetchCandidates();
    setVettingCandidate(null);
    setSubmittingVetting(false);
  }

  async function toggleAssignment(candidate: Candidate) {
      if (candidate.status === 'Assigned' || !!candidate.assigned_job_title) {
          const { error: appError } = await supabase.from('applications').delete().eq('candidate_id', candidate.id);
          if (appError) {
              alert('Error removing application: ' + appError.message);
              return;
          }
          const { error: candError } = await supabase.from('candidates').update({ status: 'Vetted' }).eq('id', candidate.id);
          if (candError) alert('Error unassigning: ' + candError.message);
          else {
            await logActivity('candidate_unassigned', candidate.full_name, {}, 'candidate', candidate.id, userEmailRef.current);
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
          await logActivity('candidate_assigned', assigningCandidate.full_name, { job_id: selectedJobId }, 'candidate', assigningCandidate.id, userEmailRef.current);
          setAssigningCandidate(null);
          setSelectedJobId('');
          fetchCandidates();
      }
      setSubmittingAssignment(false);
  }

  async function toggleHighlight(candidate: Candidate) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentStatus = (candidate as any).is_highlighted;
    const { error } = await supabase.from('candidates').update({ is_highlighted: !currentStatus }).eq('id', candidate.id);
    if (!error) {
        setCandidates(prev => prev.map(c => c.id === candidate.id ? { ...c, is_highlighted: !currentStatus } : c));
    }
  }

  const toggleBenefit = (benefit: string) => {
    setVettingData(prev => ({
      ...prev,
      benefits: prev.benefits.includes(benefit) ? prev.benefits.filter(b => b !== benefit) : [...prev.benefits, benefit]
    }));
  };

  // Filter Logic
  const filteredCandidates = candidates.filter(c => {
    const q = search.toLowerCase();

    // 1. Status Filter
    if (filter !== 'All') {
      if (filter === 'UnVetted') {
        if (c.status === 'Vetted' || c.status === 'Assigned' || !!c.assigned_job_title) return false;
      } else if (filter === 'Assigned') {
        // "Assigned Only" should show anyone with an active job assignment
        if (!c.assigned_job_title) return false;
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

  const visibleGridCandidates = filteredCandidates.slice(0, displayedCount);

  useEffect(() => {
    setDisplayedCount(INITIAL_LOAD);
  }, [search, filter, viewMode]);

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
              ><Squares2X2Icon className="h-4 w-4" />Cards</button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all ${viewMode === 'list' ? 'bg-black text-white' : 'text-slate-500 hover:bg-slate-50'}`}
              ><ListBulletIcon className="h-4 w-4" />List</button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-400 animate-pulse">Loading talent pool...</div>
        ) : viewMode === 'grid' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleGridCandidates.map((candidate) => (
                <CandidateCard 
                  key={candidate.id} 
                  candidate={candidate} 
                  onViewDetails={() => setSelectedCandidate(candidate)} 
                  onVetCandidate={() => openVettingModal(candidate)}
                  onToggleAssign={() => toggleAssignment(candidate)}
                  onGenerateCV={() => setCvCandidate(candidate)}
                  onToggleHighlight={() => toggleHighlight(candidate)}
                  addingToPipelineId={addingToPipelineId}
                  addToPipelineStage={addToPipelineStage}
                  setAddingToPipelineId={setAddingToPipelineId}
                  setAddToPipelineStage={setAddToPipelineStage}
                  onAddToPipeline={addCandidateToPipeline}
                  movingCandidate={movingCandidate}
                  onOpenPipelinePopup={(id: string, stage: PipelineStage) => { setAddingToPipelineId(id); setAddToPipelineStage(stage); }}
                  onClosePipelinePopup={() => { setAddingToPipelineId(null); }}
                />
              ))}
            </div>
            {displayedCount < filteredCandidates.length && (
              <div className="flex justify-center">
                <button
                  onClick={() => setDisplayedCount(prev => prev + INITIAL_LOAD)}
                  className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Load more ({filteredCandidates.length - displayedCount} remaining)
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {selectedListIds.length > 0 && (
              <div className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xl">
                <span className="text-sm font-semibold text-white">{selectedListIds.length} selected</span>
                <div className="flex flex-wrap gap-2 items-center">
                  <button onClick={() => setSelectedListIds([])} className="text-xs px-3 py-1.5 bg-slate-700 text-slate-200 rounded-md hover:bg-slate-600">Clear</button>
                  {showBulkPipelinePicker ? (
                    <div className="flex items-center gap-2">
                      {PIPELINE_STAGES.map(stage => (
                        <button key={stage} onClick={() => setBulkPipelineStage(stage)} className={`text-xs px-2.5 py-1 rounded-full font-bold transition ${bulkPipelineStage === stage ? STAGE_COLORS[stage] : 'bg-slate-700 text-slate-300'}`}>{stage}</button>
                      ))}
                      <button onClick={moveBulkToPipeline} disabled={movingToPipeline} className="text-xs px-3 py-1.5 bg-indigo-600 text-white font-bold rounded-md hover:bg-indigo-700 transition">Confirm</button>
                    </div>
                  ) : (
                    <button onClick={() => setShowBulkPipelinePicker(true)} className="text-xs px-3 py-1.5 bg-indigo-600 text-white font-bold rounded-md hover:bg-indigo-700 transition flex items-center gap-1">🏷 Move to Pipeline</button>
                  )}
                  <button onClick={deleteSelectedCandidates} className="text-xs px-3 py-1.5 bg-red-600 text-white font-bold rounded-md hover:bg-red-700 transition">Delete Selected</button>
                </div>
              </div>
            )}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 w-10"><input type="checkbox" checked={selectedListIds.length === filteredCandidates.length && filteredCandidates.length > 0} onChange={toggleSelectAllList} className="rounded border-slate-300" /></th>
                            <th className="text-left px-4 py-3 text-xs uppercase text-slate-500 font-bold">Name</th>
                            <th className="text-left px-4 py-3 text-xs uppercase text-slate-500 font-bold">Title</th>
                            <th className="text-left px-4 py-3 text-xs uppercase text-slate-500 font-bold">Yrs Exp</th>
                            <th className="text-left px-4 py-3 text-xs uppercase text-slate-500 font-bold">Status</th>
                            <th className="text-right px-4 py-3 text-xs uppercase text-slate-500 font-bold">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredCandidates.map(c => (
                            <CandidateRow 
                              key={c.id} 
                              candidate={c} 
                              isSelected={selectedListIds.includes(c.id)} 
                              onToggleSelect={() => toggleListSelect(c.id)} 
                              onViewDetails={() => setSelectedCandidate(c)} 
                              onVetCandidate={() => openVettingModal(c)} 
                              onToggleAssign={() => toggleAssignment(c)} 
                              onGenerateCV={() => setCvCandidate(c)} 
                              onToggleHighlight={() => toggleHighlight(c)}
                              addingToPipelineId={addingToPipelineId}
                              addToPipelineStage={addToPipelineStage}
                              setAddingToPipelineId={setAddingToPipelineId}
                              setAddToPipelineStage={setAddToPipelineStage}
                              onAddToPipeline={addCandidateToPipeline}
                              movingCandidate={movingCandidate}
                              onOpenPipelinePopup={(id: string, stage: PipelineStage) => { setAddingToPipelineId(id); setAddToPipelineStage(stage); }}
                              onClosePipelinePopup={() => { setAddingToPipelineId(null); }}
                            />
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
                <h2 className="text-xl font-bold text-slate-900">{vettingCandidate.status === 'Vetted' || vettingCandidate.status === 'Assigned' || !!vettingCandidate.assigned_job_title ? 'Edit Vetting' : 'Vet Candidate'}: {vettingCandidate.full_name}</h2>
                <p className="text-sm text-slate-500">{vettingCandidate.title}</p>
              </div>
              <button onClick={() => setVettingCandidate(null)} className="p-2 hover:bg-slate-100 rounded-full transition"><XMarkIcon className="h-6 w-6 text-slate-500" /></button>
            </div>
            {loadingVetting ? (
                <div className="p-12 text-center text-slate-400">Loading vetting details...</div>
            ) : (
                <form onSubmit={submitVetting} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">English Proficiency</label>
                        <select className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none" value={vettingData.english_proficiency} onChange={e => setVettingData({...vettingData, english_proficiency: e.target.value})}>
                            {ENGLISH_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Work Presence</label>
                        <select className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none" value={vettingData.work_presence} onChange={e => setVettingData({...vettingData, work_presence: e.target.value})}>
                            {WORK_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Current Salary (EGP)</label>
                        <input type="number" className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none" value={vettingData.current_salary} onChange={e => setVettingData({...vettingData, current_salary: e.target.value})} placeholder="e.g. 25000" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Expected Salary (EGP)</label>
                        <input type="number" className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none" value={vettingData.expected_salary} onChange={e => setVettingData({...vettingData, expected_salary: e.target.value})} placeholder="e.g. 35000" />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notice Period</label>
                    <input type="text" className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none" value={vettingData.notice_period} onChange={e => setVettingData({...vettingData, notice_period: e.target.value})} placeholder="e.g. 1 Month" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Current Benefits</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {BENEFITS_LIST.map(benefit => (
                            <label key={benefit} className="flex items-center gap-2 p-2 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer transition">
                                <input type="checkbox" checked={vettingData.benefits.includes(benefit)} onChange={() => toggleBenefit(benefit)} className="h-4 w-4 text-black focus:ring-black rounded" />
                                <span className="text-sm text-slate-700">{benefit}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Interview Notes</label>
                    <textarea className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none min-h-[100px]" value={vettingData.notes} onChange={e => setVettingData({...vettingData, notes: e.target.value})} placeholder="Candidate notes..."></textarea>
                </div>
                <div className="bg-slate-900 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">Move to Pipeline</h4>
                      {vettingCandidate?.pipeline_stage && (
                        <p className="text-xs text-slate-400 mt-0.5">Currently: <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${STAGE_COLORS[vettingCandidate.pipeline_stage] || 'bg-slate-600'}`}>{vettingCandidate.pipeline_stage}</span></p>
                      )}
                    </div>
                    {!showVettingPipelinePicker && <button type="button" onClick={() => setShowVettingPipelinePicker(true)} className="text-xs px-3 py-1.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition">🏷 Set Stage</button>}
                  </div>
                  {showVettingPipelinePicker && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-1.5">
                        {PIPELINE_STAGES.map(stage => (
                          <button key={stage} type="button" onClick={() => setVettingPipelineStage(stage)} className={`text-xs px-3 py-1.5 rounded-full font-bold border transition ${vettingPipelineStage === stage ? STAGE_COLORS[stage] : 'bg-slate-700 text-slate-300 border-slate-600'}`}>{stage}</button>
                        ))}
                      </div>
                      <button type="button" onClick={moveVettingCandidateToPipeline} disabled={movingVettingToPipeline} className="text-xs px-4 py-1.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50">Confirm → {vettingPipelineStage}</button>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button type="button" onClick={() => setVettingCandidate(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-md transition">Cancel</button>
                    <button type="submit" disabled={submittingVetting} className="px-6 py-2 bg-black text-white font-semibold rounded-md hover:bg-zinc-800 transition disabled:opacity-50">Save Vetting</button>
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
                  <p className="text-slate-500 text-sm mb-6">Select a job position to assign this candidate to.</p>
                  <form onSubmit={submitAssignment}>
                      <div className="mb-6">
                          <label className="block text-sm font-medium mb-2">Select Job</label>
                          <select className="w-full border border-slate-300 rounded-md p-3 focus:ring-2 focus:ring-black outline-none bg-white" value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)} required>
                              <option value="">-- Choose an Open Job --</option>
                              {jobs.map(job => (<option key={job.id} value={job.id}>{job.clients?.name} - {job.title}</option>))}
                          </select>
                      </div>
                      <div className="flex justify-end gap-3 pt-4 border-t border-slate-50">
                          <button type="button" onClick={() => setAssigningCandidate(null)} className="text-slate-600 px-4 py-2 hover:bg-slate-50 rounded">Cancel</button>
                          <button type="submit" disabled={submittingAssignment} className="bg-black text-white px-6 py-2 rounded font-bold hover:bg-zinc-800 transition disabled:opacity-50">{submittingAssignment ? 'Assigning...' : 'Confirm Assignment'}</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {cvCandidate && <CVExportModal candidate={cvCandidate} onClose={() => setCvCandidate(null)} />}
    </div>
  );
}

function CandidateRow({ candidate, isSelected, onToggleSelect, onViewDetails, onVetCandidate, onToggleAssign, onGenerateCV, onToggleHighlight }: any) {
  const isVetted = candidate.status === 'Vetted';
  const isAssigned = !!candidate.assigned_job_title;
  const initials = candidate.full_name?.split(' ').slice(0, 2).map((p: any) => p[0]).join('').toUpperCase() || '?';

  let healthScore = 0;
  if (candidate.full_name && candidate.title) healthScore += 20;
  if (candidate.email) healthScore += 20;
  if (candidate.phone) healthScore += 20;
  if (candidate.skills?.length || candidate.tools?.length || candidate.technologies?.length) healthScore += 20;
  if (candidate.linkedin_url || candidate.portfolio_url) healthScore += 20;
  const healthColor = healthScore >= 80 ? 'text-green-600 bg-green-50 border-green-200' : healthScore >= 50 ? 'text-yellow-600 bg-yellow-50 border-yellow-200' : 'text-red-600 bg-red-50 border-red-200';

  return (
    <tr className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${isSelected ? 'bg-red-50/40' : ''}`}>
      <td className="px-4 py-3 w-10"><input type="checkbox" checked={isSelected} onChange={onToggleSelect} className="rounded border-slate-300" /></td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button onClick={onToggleHighlight} className="transition transform active:scale-125">
             {candidate.is_highlighted ? <StarSolid className="h-4 w-4 text-amber-400" /> : <StarOutline className="h-4 w-4 text-slate-300 hover:text-slate-400" />}
          </button>
          <span className="font-semibold text-slate-900">{candidate.full_name}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-slate-500 max-w-[180px] truncate">{candidate.title || '—'}</td>
      <td className="px-4 py-3 text-slate-700">{candidate.years_experience_total || 0} yrs</td>
      <td className="px-4 py-3">
          {isAssigned ? (
            <span className="text-xs font-bold px-2 py-1 rounded-full border bg-green-100 text-green-700 border-green-200 flex items-center gap-1 w-fit"><BriefcaseIcon className="h-3 w-3" /> Matched</span>
          ) : isVetted ? (
            <span className="text-xs font-bold px-2 py-1 rounded-full border bg-blue-100 text-blue-700 border-blue-200 flex items-center gap-1 w-fit"><CheckBadgeIcon className="h-3 w-3" /> Vetted</span>
          ) : (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 w-fit ${healthColor}`}><span className="w-1.5 h-1.5 rounded-full bg-current"></span>{healthScore}% Data</span>
          )}
      </td>
      <td className="px-4 py-3 flex justify-end gap-1.5">
          <button onClick={onViewDetails} className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded hover:bg-slate-50 transition">Details</button>
          <button onClick={onVetCandidate} className={`px-2.5 py-1 text-xs font-semibold rounded transition ${isVetted || isAssigned || !!candidate.assigned_job_title ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-black text-white hover:bg-zinc-800'}`}>{isVetted || isAssigned || !!candidate.assigned_job_title ? 'Edit Vetting' : 'Vet'}</button>
          {isAssigned ? (
            <button onClick={onToggleAssign} className="px-2.5 py-1 text-xs font-semibold text-white bg-red-600 rounded transition flex items-center gap-1 hover:bg-red-700"><XMarkIcon className="h-3 w-3" /> Unmatch</button>
          ) : isVetted ? (
            <button onClick={onToggleAssign} className="px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 rounded transition flex items-center gap-1 hover:bg-blue-700"><BriefcaseIcon className="h-3 w-3" /> Assign</button>
          ) : null}
          <button onClick={onGenerateCV} className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700 rounded hover:bg-indigo-100 transition flex items-center gap-1"><DocumentArrowDownIcon className="h-3 w-3" /> CV</button>
      </td>
    </tr>
  );
}

function CandidateCard({ candidate, onViewDetails, onVetCandidate, onToggleAssign, onGenerateCV, onToggleHighlight, addingToPipelineId, addToPipelineStage, setAddingToPipelineId, setAddToPipelineStage, onAddToPipeline, movingCandidate, onOpenPipelinePopup, onClosePipelinePopup }: any) {
  const isVetted = candidate.status === 'Vetted';
  const isAssigned = !!candidate.assigned_job_title;
  const healthScore = 0; // (Simplified for layout)
  const portfolioUrl = candidate.portfolio_url;
  const isGithub = portfolioUrl?.includes('github.com');
  const isBehance = portfolioUrl && !isGithub;
  
  return (
    <div className={`bg-white rounded-xl shadow-sm border hover:shadow-md transition group flex flex-col h-full relative ${candidate.is_highlighted ? 'border-amber-400 ring-1 ring-amber-400' : 'border-slate-200 hover:border-black/10'}`}>
        <button onClick={onToggleHighlight} className="absolute top-2.5 right-2.5 z-10 p-1 rounded-full bg-white/50 backdrop-blur shadow-sm hover:bg-white transition">
             {candidate.is_highlighted ? <StarSolid className="h-4 w-4 text-amber-400" /> : <StarOutline className="h-4 w-4 text-slate-300 hover:text-amber-400" />}
        </button>

        <div className="p-4 flex-grow flex flex-col">
          <div className="flex gap-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-lg shrink-0 border border-slate-200">👤</div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-base text-slate-900 line-clamp-1">{candidate.full_name}</h3>
                <p className="text-[11px] text-slate-500 truncate">{candidate.title} · {candidate.location}</p>
              </div>
          </div>

          <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Experience: {candidate.years_experience_total || 0}+ yrs</span>
                <div className="flex items-center gap-1">
                  {candidate.linkedin_url && (
                    <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[#0077b5] hover:text-[#006097] transition">
                      <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                    </a>
                  )}
                  {portfolioUrl && isGithub && (
                    <a href={portfolioUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[#24292f] hover:text-[#4a4a4a] transition">
                      <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24">
                        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                      </svg>
                    </a>
                  )}
                  {portfolioUrl && isBehance && (
                    <a href={portfolioUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[#1769ff] hover:text-[#0052cc] transition">
                      <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24">
                        <path d="M22 7h-7V5h7v2zm1.726 10c-.442 1.297-2.029 3-5.101 3-3.074 0-5.564-1.729-5.564-5.675 0-3.91 2.325-5.92 5.466-5.92 3.082 0 4.964 1.782 5.375 4.426.078.506.109 1.188.095 2.14H15.97c.13 1.202.836 1.883 2.168 1.883.902 0 1.574-.413 1.798-1.102l2.79.273zm-5.188-4h3.954c-.07-1.03-.677-1.867-1.886-1.867-1.246 0-1.972.875-2.114 1.867zM8.207 10.5c.367-.51.602-1.154.602-1.946C8.809 6.604 7.672 5.5 5.758 5.5H0v13h6.05c2.114 0 3.561-1.222 3.561-3.233 0-1.313-.538-2.254-1.404-2.767zM2.337 7.773h2.947c.876 0 1.418.44 1.418 1.204 0 .82-.588 1.24-1.498 1.24H2.337V7.773zm3.265 8.454H2.337v-2.84h3.207c1.002 0 1.607.505 1.607 1.42 0 .944-.568 1.42-1.549 1.42z"/>
                      </svg>
                    </a>
                  )}
                </div>
              </div>
              {candidate.status === 'Hired' ? (
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-600 text-white flex items-center gap-1"><BriefcaseIcon className="h-2.5 w-2.5" /> Hired</span>
                  {candidate.assigned_company_name && (
                    <span className="text-[9px] font-bold text-slate-500 mt-0.5 text-right leading-tight max-w-[100px] truncate">
                      {candidate.assigned_company_name}
                    </span>
                  )}
                </div>
              ) : isAssigned ? (
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-green-100 text-green-700 border-green-200 flex items-center gap-1 capitalize">Matched</span>
                  {candidate.assigned_company_name && (
                    <span className="text-[9px] font-bold text-slate-500 mt-0.5 text-right leading-tight max-w-[100px] truncate">
                      {candidate.assigned_company_name}
                    </span>
                  )}
                </div>
              ) : isVetted ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-blue-100 text-blue-700 border-blue-200 flex items-center gap-1 capitalize">Vetted</span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-50 text-slate-400 border-slate-200 capitalize">New</span>
              )}
          </div>

          <div className="flex-grow">
            <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100 relative mb-2">
              <p className="text-[13px] text-slate-600 line-clamp-2 leading-snug">{candidate.match_reason}</p>
            </div>
            {candidate.last_interaction_at && (
              <div className="flex items-center gap-1 text-[10px] font-bold text-purple-600 px-1">
                <ClockIcon className="h-3 w-3" />
                <span>Last Contact: {new Date(candidate.last_interaction_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-slate-100 flex gap-2 bg-slate-50/50">
            <button onClick={onViewDetails} className="flex-1 bg-white border border-slate-200 text-slate-700 text-[11px] font-bold py-1.5 rounded hover:bg-slate-50 transition">Details</button>
            <button onClick={onVetCandidate} className={`flex-1 text-[11px] font-bold py-1.5 rounded transition ${isVetted || isAssigned || !!candidate.assigned_job_title ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-black text-white hover:bg-zinc-800'}`}>{isVetted || isAssigned || !!candidate.assigned_job_title ? 'Edit' : 'Vet'}</button>
            {isAssigned ? (
              <button onClick={onToggleAssign} className="flex-1 bg-red-600 text-white text-[11px] font-bold py-1.5 rounded hover:bg-red-700 transition flex items-center justify-center gap-1">
                <XMarkIcon className="h-3 w-3" /> Unmatch
              </button>
            ) : isVetted ? (
              <button onClick={onToggleAssign} className="flex-1 bg-blue-600 text-white text-[11px] font-bold py-1.5 rounded hover:bg-blue-700 transition flex items-center justify-center gap-1">
                <BriefcaseIcon className="h-3 w-3" /> Assign
              </button>
            ) : null}
            <button onClick={onGenerateCV} className="px-2 py-1.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-100 hover:bg-indigo-100 transition"><DocumentArrowDownIcon className="h-3.5 w-3.5" /></button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenPipelinePopup(candidate.id, candidate.pipeline_stage || 'Sourced');
              }}
              className="px-2 py-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded border border-transparent hover:border-indigo-100 transition"
              title="Set pipeline stage">
              <PlusIcon className="h-3.5 w-3.5" />
            </button>
            {addingToPipelineId === candidate.id && (
              <div className="absolute left-1/2 -translate-x-1/2 top-[56px] z-20 bg-white border border-indigo-200 rounded-xl shadow-xl px-3 py-2.5 flex flex-col gap-2 min-w-[260px]"
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-700">Set Pipeline Stage</span>
                  <button onClick={onClosePipelinePopup} className="text-slate-400 hover:text-slate-600"><XMarkIcon className="h-3.5 w-3.5" /></button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {PIPELINE_STAGES.map(stage => (
                    <button
                      key={stage}
                      onClick={() => { setAddToPipelineStage(stage); }}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold border transition ${
                        addToPipelineStage === stage
                          ? STAGE_COLORS[stage]
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:border-indigo-400'
                      }`}>
                      {stage}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => { onAddToPipeline(candidate.id); onClosePipelinePopup(); }}
                  disabled={movingCandidate}
                  className="w-full px-2 py-1.5 text-[11px] font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50">
                  {movingCandidate ? 'Moving...' : `Move to ${addToPipelineStage}`}
                </button>
              </div>
            )}
        </div>
        <div className={`h-1 w-full transition-all duration-300 ${candidate.is_highlighted ? 'bg-amber-400 opacity-100' : 'bg-black opacity-0 group-hover:opacity-100'}`}></div>
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
        const cached = localStorage.getItem('lnkd_egp_rate');
        const now = Date.now();
        if (cached) {
          const { rate, ts } = JSON.parse(cached);
          if (now - ts < 24 * 60 * 60 * 1000) {
            setEgpRate(rate);
            return;
          }
        }
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await res.json();
        const rate = data.rates?.EGP;
        if (rate && typeof rate === 'number') {
          setEgpRate(rate);
          localStorage.setItem('lnkd_egp_rate', JSON.stringify({ rate, ts: now }));
        }
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

  const allSkills = [
    ...(candidate.technologies?.map((t: any) => t.name) || []),
    ...(candidate.tools?.map((t: any) => t.name) || []),
    ...(candidate.skills || []),
  ].slice(0, 12);

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
          <div><h2 className="text-xl font-bold text-slate-900">Generate CV</h2><p className="text-sm text-slate-500">{candidate.full_name} — {candidate.title}</p></div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition"><XMarkIcon className="h-6 w-6 text-slate-500" /></button>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Privacy Options</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {['linkedin', 'portfolio', 'email', 'phone'].map(key => (
                <label key={key} className="flex items-center gap-2 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-indigo-50 transition">
                  <input type="checkbox" checked={privacy[key as keyof typeof privacy]} onChange={e => setPrivacy({...privacy, [key]: e.target.checked})} className="h-4 w-4 text-indigo-600 rounded" />
                  <span className="text-sm font-medium capitalize">{key}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Templates</h3>
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
                <div className="bg-white p-3 text-[7px] leading-tight min-h-[160px] select-none">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-black text-[11px] text-slate-900 leading-none">{candidate.full_name}</div>
                      <div className="text-slate-500 text-[8px] mt-0.5">{candidate.title}</div>
                    </div>
                    <div className="w-8 h-6 bg-slate-200 rounded flex items-center justify-center text-[6px] text-slate-400 font-bold">LOGO</div>
                  </div>
                  <div className="border-t border-slate-200 my-1.5"></div>
                  <div className="flex gap-2 text-slate-500 mb-2 flex-wrap">
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded">📍 {candidate.location || '—'}</span>
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded">🗓 {candidate.years_experience_total || 0} yrs</span>
                  </div>
                  <div className="font-bold text-slate-700 mb-1">SKILLS</div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {allSkills.slice(0, 6).map((s, i) => (
                      <span key={i} className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold">{s}</span>
                    ))}
                  </div>
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
                  <span className="text-xs font-bold text-slate-700">B — Modern Two-Column</span>
                  {selectedTemplate === 'B' && (
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Selected</span>
                  )}
                </div>
                {/* Mini preview of Template B */}
                <div className="flex min-h-[160px] select-none">
                  {/* Sidebar */}
                  <div className="w-1/3 bg-slate-900 p-2 text-white text-[7px] leading-tight">

                    <div className="w-8 h-5 bg-slate-700 rounded flex items-center justify-center text-[5px] text-slate-400 mb-1.5 font-bold">LOGO</div>
                    <div className="h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center text-[8px] font-black mb-1.5 mx-auto">{initials}</div>
                    <div className="font-black text-[8px] text-center leading-none text-white mb-0.5">{candidate.full_name}</div>
                    <div className="text-slate-400 text-[6px] text-center mb-2">{candidate.title}</div>
                    <div className="text-slate-300 font-bold mb-1 mt-1.5 text-[6px]">SKILLS</div>
                    {allSkills.slice(0, 4).map((s, i) => (
                      <div key={i} className="text-slate-300 mb-0.5 font-bold">• {s}</div>
                    ))}
                  </div>
                  {/* Content */}
                  <div className="flex-1 bg-white p-2 text-[7px]">
                    <div className="text-indigo-600 font-black text-[8px] tracking-widest mb-2 uppercase">Candidate Profile</div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold">{candidate.years_experience_total || 0} yrs exp</span>
                    </div>
                    <div className="font-bold text-slate-700 mb-1">MATCH REASON</div>
                    <div className="bg-slate-50 p-1.5 rounded border border-slate-100 text-slate-500 leading-tight">High relevance to role requirements...</div>
                    <div className="border-t border-slate-100 mt-auto pt-1 text-center text-slate-300 text-[6px]">Presented by LNKDREC.ai</div>
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
          <div>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Editable Match Reason</h3>
            <textarea value={editableMatchReason} onChange={e => setEditableMatchReason(e.target.value)} rows={4} className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex items-center justify-between rounded-b-2xl">
          <p className="text-xs text-slate-400">Privacy settings saved per session.</p>
          <button onClick={handleDownload} disabled={generating} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition disabled:opacity-60 flex items-center gap-2">
            <DocumentArrowDownIcon className="h-5 w-5" /> {generating ? 'Generating...' : 'Download PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
