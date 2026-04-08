'use client';

import { useEffect, useState, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '@/lib/supabaseClient';
import CandidateDetailsModal, { Candidate } from '@/components/CandidateDetailsModal';
import {
  ClockIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  BuildingOfficeIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

// ─── Stage Config

const STAGES: any[] = [
  { id: 'Sourced', label: 'Sourced', color: 'bg-slate-100', textColor: 'text-slate-700', badgeColor: 'bg-slate-200 text-slate-700', borderColor: 'border-l-slate-400' },
  { id: 'Contacted/No Reply', label: 'Contacted/No Reply', color: 'bg-indigo-50', textColor: 'text-indigo-800', badgeColor: 'bg-indigo-200 text-indigo-800', borderColor: 'border-l-indigo-400' },
  { id: 'Lnkd Interview', label: 'Lnkd Interview', color: 'bg-amber-50', textColor: 'text-amber-800', badgeColor: 'bg-amber-200 text-amber-800', borderColor: 'border-l-amber-400' },
  { id: 'Shortlisted by Lnkd', label: 'Shortlisted by Lnkd', color: 'bg-blue-50', textColor: 'text-blue-800', badgeColor: 'bg-blue-200 text-blue-800', borderColor: 'border-l-blue-400' },
  { id: 'Client Interview', label: 'Client Interview', color: 'bg-purple-50', textColor: 'text-purple-800', badgeColor: 'bg-purple-200 text-purple-800', borderColor: 'border-l-purple-400' },
  { id: 'Offer', label: 'Pending client feedback/offer', color: 'bg-green-50', textColor: 'text-green-800', badgeColor: 'bg-green-200 text-green-800', borderColor: 'border-l-green-400' },
  { id: 'Hired', label: 'Hired', color: 'bg-emerald-100', textColor: 'text-emerald-900', badgeColor: 'bg-emerald-600 text-white', borderColor: 'border-l-emerald-600' },
  { id: 'Rejected', label: 'Rejected', color: 'bg-red-50', textColor: 'text-red-700', badgeColor: 'bg-red-200 text-red-700', borderColor: 'border-l-red-400' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveStage(c: Candidate): string {
  if (c.pipeline_stage) return c.pipeline_stage;
  if (!c.status || c.status === 'Unvetted') return 'Sourced';
  if (c.status === 'Vetted') return 'Lnkd Interview';
  if (c.status === 'Assigned') return 'Shortlisted by Lnkd';
  return 'Sourced';
}

function statusForStage(stage: string): string | null {
  if (stage === 'Sourced') return 'Unvetted';
  if (['Lnkd Interview', 'Shortlisted by Lnkd', 'Client Interview', 'Offer'].includes(stage)) return 'Vetted';
  if (stage === 'Hired') return 'Assigned';
  return null;
}

function daysInStage(c: Candidate): number {
  const ref = c.stage_changed_at || c.created_at;
  if (!ref) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(ref).getTime()) / 86400000));
}

function scoreChipClass(score?: number): string {
  if (!score && score !== 0) return 'bg-slate-100 text-slate-500';
  if (score >= 70) return 'bg-green-100 text-green-700';
  if (score >= 40) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-600';
}

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map((p) => (p[0] || '').toUpperCase()).join('');
}

// ─── Candidate Card ───────────────────────────────────────────────────────────

function CandidateCard({
  candidate,
  index,
  onDetails,
  onRemoveFromPipeline,
}: {
  candidate: Candidate;
  index: number;
  onDetails: (c: Candidate) => void;
  onRemoveFromPipeline: (id: string) => void;
}) {
  const days = daysInStage(candidate);
  const score = candidate.match_score;
  const hasLinkedIn = !!candidate.linkedin_url;
  const portfolioUrl = candidate.portfolio_url;
  const isGithub = portfolioUrl?.includes('github.com');
  const isBehance = portfolioUrl && !isGithub;

  return (
    <Draggable draggableId={candidate.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`
            relative bg-white rounded-lg border border-slate-200 p-3 mb-2 shadow-sm
            hover:shadow-md hover:border-slate-300 transition-all cursor-grab active:cursor-grabbing select-none group
            ${snapshot.isDragging ? 'shadow-xl ring-2 ring-black/10 rotate-1 scale-105' : ''}
          `}
        >
          {/* Subtle X — remove from pipeline */}
          <button
            onClick={(e) => { e.stopPropagation(); onRemoveFromPipeline(candidate.id); }}
            className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full flex items-center justify-center text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition opacity-0 group-hover:opacity-100"
            title="Remove from pipeline"
          >
            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Top row: avatar + name */}
          <div className="flex items-start gap-2.5 mb-2">
            <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
              {initials(candidate.full_name || '?')}
            </div>
            <div className="flex-1 min-w-0 pr-4">
              <p className="font-semibold text-sm text-slate-900 leading-tight truncate">
                {candidate.full_name}
              </p>
              {candidate.title && (
                <p className="text-[11px] text-slate-400 leading-tight truncate mt-0.5">{candidate.title}</p>
              )}
              {candidate.assigned_company_name && (
                <p className="flex items-center gap-0.5 text-[11px] text-slate-400 leading-tight truncate mt-0.5">
                  <BuildingOfficeIcon className="h-3 w-3 shrink-0" />
                  {candidate.assigned_company_name}
                </p>
              )}
            </div>
          </div>

          {/* Bottom row */}
          <div className="flex items-center justify-between gap-1 mt-1">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                <ClockIcon className="h-3 w-3" />{days}d
              </span>
              {hasLinkedIn && (
                <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center justify-center h-5 w-5 rounded bg-[#0077b5] hover:bg-[#006097] transition shrink-0"
                  title="LinkedIn">
                  <svg className="h-3 w-3 fill-white" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </a>
              )}
              {isGithub && (
                <a href={portfolioUrl} target="_blank" rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center justify-center h-5 w-5 rounded bg-[#24292f] hover:bg-[#4a4a4a] transition shrink-0"
                  title="GitHub">
                  <svg className="h-3 w-3 fill-white" viewBox="0 0 24 24">
                    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                  </svg>
                </a>
              )}
              {isBehance && (
                <a href={portfolioUrl} target="_blank" rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center justify-center h-5 w-5 rounded bg-[#1769ff] hover:bg-[#0052cc] transition shrink-0"
                  title="Portfolio">
                  <svg className="h-3 w-3 fill-white" viewBox="0 0 24 24">
                    <path d="M22 7h-7V5h7v2zm1.726 10c-.442 1.297-2.029 3-5.101 3-3.074 0-5.564-1.729-5.564-5.675 0-3.91 2.325-5.92 5.466-5.92 3.082 0 4.964 1.782 5.375 4.426.078.506.109 1.188.095 2.14H15.97c.13 1.202.836 1.883 2.168 1.883.902 0 1.574-.413 1.798-1.102l2.79.273zm-5.188-4h3.954c-.07-1.03-.677-1.867-1.886-1.867-1.246 0-1.972.875-2.114 1.867zM8.207 10.5c.367-.51.602-1.154.602-1.946C8.809 6.604 7.672 5.5 5.758 5.5H0v13h6.05c2.114 0 3.561-1.222 3.561-3.233 0-1.313-.538-2.254-1.404-2.767zM2.337 7.773h2.947c.876 0 1.418.44 1.418 1.204 0 .82-.588 1.24-1.498 1.24H2.337V7.773zm3.265 8.454H2.337v-2.84h3.207c1.002 0 1.607.505 1.607 1.42 0 .944-.568 1.42-1.549 1.42z" />
                  </svg>
                </a>
              )}
            </div>
            <div className="flex items-center gap-1">
              <a href={`/?cv=${candidate.id}`} onClick={(e) => e.stopPropagation()}
                className="text-[10px] font-semibold px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-600 rounded hover:bg-slate-100 transition"
                title="Generate CV">CV</a>
              <button onClick={() => onDetails(candidate)}
                className="text-[10px] font-semibold px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-600 rounded hover:bg-slate-100 transition">
                Details
              </button>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}

// ─── Stage Column ─────────────────────────────────────────────────────────────

function StageColumn({
  stage, candidates, collapsed, onToggleCollapse, onDetails, onRemoveFromPipeline,
}: {
  stage: any;
  candidates: Candidate[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  onDetails: (c: Candidate) => void;
  onRemoveFromPipeline: (id: string) => void;
}) {
  return (
    <div
      className={`flex flex-col rounded-xl border border-slate-200 shadow-sm bg-white shrink-0 border-l-4 ${stage.borderColor} ${collapsed ? 'w-14' : 'w-64'} transition-all duration-200`}
      style={{ minHeight: '200px' }}
    >
      <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl ${stage.color} cursor-pointer`} onClick={onToggleCollapse}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-1 w-full">
            <ChevronRightIcon className={`h-4 w-4 ${stage.textColor}`} />
            <span className={`text-[10px] font-bold ${stage.textColor} select-none`}
              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}>
              {stage.label}
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${stage.badgeColor}`}>{candidates.length}</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${stage.textColor}`}>{stage.label}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${stage.badgeColor}`}>{candidates.length}</span>
            </div>
            <ChevronDownIcon className={`h-4 w-4 ${stage.textColor} shrink-0`} />
          </>
        )}
      </div>

      {!collapsed && (
        <Droppable droppableId={stage.id}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`flex-1 p-2 overflow-y-auto transition-colors ${snapshot.isDraggingOver ? 'bg-slate-50' : 'bg-white'} rounded-b-xl`}
              style={{ minHeight: '80px', maxHeight: 'calc(100vh - 200px)' }}
            >
              {candidates.length === 0 && !snapshot.isDraggingOver && (
                <div className="text-center py-8 text-[11px] text-slate-300 select-none">Drop here</div>
              )}
              {candidates.map((c, i) => (
                <CandidateCard key={c.id} candidate={c} index={i} onDetails={onDetails} onRemoveFromPipeline={onRemoveFromPipeline} />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationNotice, setMigrationNotice] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [rejectionContext, setRejectionContext] = useState<{ candidate: Candidate; stage: string } | null>(null);
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({ Rejected: true });

  // ─── Fetch ───────────────────────────────────────────────────────────────────

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('candidates')
      .select('*, applications(job_id, jobs(title, clients(name)))')
      .order('pipeline_order', { ascending: true, nullsFirst: false });

    if (error) {
      console.error('Error fetching candidates:', error);
    } else {
      const enriched = (data || [])
        .filter((c: Candidate) => c.pipeline_stage !== null && c.pipeline_stage !== undefined)
        .map((c: Candidate) => {
          const apps = c.applications;
          const firstApp = Array.isArray(apps) ? apps[0] : undefined;
          const jobClients = firstApp?.jobs?.clients;
          const companyName = Array.isArray(jobClients) ? jobClients[0]?.name : jobClients?.name;
          return { ...c, assigned_company_name: companyName ?? undefined, assigned_job_title: firstApp?.jobs?.title ?? undefined };
        });
      setCandidates(enriched);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCandidates(); }, [fetchCandidates]);

  // ─── Group by stage (sorted by pipeline_order) ────────────────────────────────

  const stageMap = useCallback(() => {
    const map: Record<string, Candidate[]> = {};
    STAGES.forEach((s) => (map[s.id] = []));
    candidates.forEach((c) => {
      const stage = c.pipeline_stage || 'Sourced';
      if (map[stage]) map[stage].push(c);
      else map['Sourced'].push(c);
    });
    // Sort each column by pipeline_order (nulls last, fallback to created_at)
    Object.keys(map).forEach((stageId) => {
      map[stageId].sort((a, b) => {
        const ao = a.pipeline_order ?? 999999;
        const bo = b.pipeline_order ?? 999999;
        return ao - bo;
      });
    });
    return map;
  }, [candidates]);

  // ─── Remove from pipeline ─────────────────────────────────────────────────────

  const removeFromPipeline = useCallback(async (id: string) => {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
    const { error } = await supabase
      .from('candidates')
      .update({ pipeline_stage: null, stage_changed_at: null, pipeline_order: null })
      .eq('id', id);
    if (error) { console.error('Error removing from pipeline:', error); fetchCandidates(); }
  }, [fetchCandidates]);

  // ─── Drag End ─────────────────────────────────────────────────────────────────

  const onDragEnd = useCallback(
    async (result: DropResult) => {
      const { destination, source, draggableId } = result;
      if (!destination) return;
      if (destination.droppableId === source.droppableId && destination.index === source.index) return;

      const newStage = destination.droppableId;
      const oldStage = source.droppableId;
      const isSameStage = newStage === oldStage;

      // Build current grouped state to calculate new orders
      const grouped = stageMap();

      // Move candidate in the target column
      const targetList = [...(grouped[newStage] || [])];
      if (isSameStage) {
        // Reorder within same column
        const [moved] = targetList.splice(source.index, 1);
        targetList.splice(destination.index, 0, moved);
      } else {
        // Move from source to destination column
        const sourceList = [...(grouped[oldStage] || [])];
        const [moved] = sourceList.splice(source.index, 1);
        targetList.splice(destination.index, 0, moved);
      }

      // Assign new pipeline_order values (0-based integers) to the affected column
      const orderUpdates = targetList.map((c, i) => ({ id: c.id, pipeline_order: i }));

      // Optimistic update in local state
      setCandidates((prev) => {
        const orderMap: Record<string, number> = {};
        orderUpdates.forEach(({ id, pipeline_order }) => { orderMap[id] = pipeline_order; });
        return prev.map((c) => {
          if (c.id === draggableId && !isSameStage) {
            return { ...c, pipeline_stage: newStage, stage_changed_at: new Date().toISOString(), pipeline_order: orderMap[c.id] ?? c.pipeline_order };
          }
          if (orderMap[c.id] !== undefined) {
            return { ...c, pipeline_order: orderMap[c.id] };
          }
          return c;
        });
      });

      // Persist: update the moved candidate's stage (if changed) + all order updates in the target column
      const updates: Promise<unknown>[] = [];

      if (!isSameStage) {
        if (newStage === 'Rejected') {
          const cand = candidates.find(c => c.id === draggableId);
          if (cand) {
            setRejectionContext({ candidate: cand, stage: newStage });
            return; // Modal will handle the update
          }
        }

        let newStatus = statusForStage(newStage);
        if (newStage === 'Offer') newStatus = 'Offer';
        if (newStage === 'Hired') newStatus = 'Hired';
        if (newStage === 'Rejected') newStatus = 'Vetted'; // Ensure they stay Vetted when Rejected

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload: Record<string, any> = { pipeline_stage: newStage, stage_changed_at: new Date().toISOString() };
        if (newStatus !== null) payload.status = newStatus;
        updates.push(
          Promise.resolve(
            supabase.from('candidates').update(payload).eq('id', draggableId).then(async ({ error }) => {
              if (error) {
                const msg = error.message || '';
                if (msg.includes('pipeline_stage') || msg.includes('column') || error.code === '42703') {
                  setMigrationNotice(true);
                } else {
                  console.error('Stage update error:', error);
                }
              } else {
                // Side effects for special stages
                const cand = candidates.find(c => c.id === draggableId);
                if (!cand) return;

                if (newStage === 'Rejected') {
                  const firstApp = Array.isArray(cand.applications) ? cand.applications[0] : cand.applications;
                  const jobId = firstApp?.job_id;
                  const jobTitle = firstApp?.jobs?.title || 'assigned job';
                  const clientName = firstApp?.jobs?.clients?.name || 'client';

                  if (jobId) {
                    // 1. Unassign from vacancy
                    await supabase.from('applications').delete().eq('candidate_id', cand.id).eq('job_id', jobId);
                    // 2. Log feedback interaction
                    await supabase.from('candidate_interactions').insert({
                      candidate_id: cand.id,
                      type: 'Feedback',
                      content: `Rejected from ${jobTitle} vacancy at ${clientName}`
                    });
                  }
                }
              }
            })
          )
        );
      }

      // Bulk-update pipeline_order for the reordered column
      orderUpdates.forEach(({ id, pipeline_order }) => {
        updates.push(
          Promise.resolve(
            supabase.from('candidates').update({ pipeline_order }).eq('id', id).then(({ error }) => {
              if (error) console.error('Order update error:', error);
            })
          )
        );
      });

      await Promise.all(updates);
    },
    [stageMap]
  );

  // ─── Stage toggle ─────────────────────────────────────────────────────────────

  const toggleCollapse = (stageId: string) => {
    setCollapsedStages((prev) => ({ ...prev, [stageId]: !prev[stageId] }));
  };

  const handleRejectionFeedback = async (reason: string, customNote: string) => {
    if (!rejectionContext) return;
    const { candidate, stage } = rejectionContext;
    const finalNote = reason === 'Other' ? customNote : `${reason}${customNote ? `: ${customNote}` : ''}`;

    // Optimistic Update
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === candidate.id
          ? { ...c, pipeline_stage: stage, stage_changed_at: new Date().toISOString(), status: 'Vetted' }
          : c
      )
    );

    const firstApp = Array.isArray(candidate.applications) ? candidate.applications[0] : candidate.applications;
    const jobId = firstApp?.job_id;
    const jobTitle = firstApp?.jobs?.title || 'assigned job';
    const clientName = firstApp?.jobs?.clients?.name || 'client';

    // 1. Update Candidate Stage
    await supabase.from('candidates').update({
      pipeline_stage: stage,
      stage_changed_at: new Date().toISOString(),
      status: 'Vetted'
    }).eq('id', candidate.id);

    if (jobId) {
      // 2. Unassign from vacancy
      await supabase.from('applications').delete().eq('candidate_id', candidate.id).eq('job_id', jobId);
      // 3. Log feedback interaction
      await supabase.from('candidate_interactions').insert({
        candidate_id: candidate.id,
        type: 'Feedback',
        content: `Rejected from ${jobTitle} at ${clientName}. Reason: ${finalNote}`
      });
    }

    setRejectionContext(null);
    fetchCandidates();
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  const grouped = stageMap();
  const total = candidates.length;

  return (
    <div className="flex flex-col h-[calc(100vh-68px)] bg-white">
      {selectedCandidate && (
        <CandidateDetailsModal 
          candidate={selectedCandidate} 
          onClose={() => setSelectedCandidate(null)} 
          onUpdate={fetchCandidates}
        />
      )}
      {rejectionContext && (
        <RejectionFeedbackModal 
          candidate={rejectionContext.candidate}
          onClose={() => {
            setRejectionContext(null);
            fetchCandidates(); // Reset to original position
          }}
          onSave={handleRejectionFeedback}
        />
      )}
      {migrationNotice && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-start gap-2">
          <ExclamationTriangleIcon className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800">
            <strong>Stage changes saved locally only.</strong> Run in Supabase SQL editor:{' '}
            <code className="bg-amber-100 px-1 rounded font-mono">
              ALTER TABLE candidates ADD COLUMN IF NOT EXISTS pipeline_stage TEXT; ALTER TABLE candidates ADD COLUMN IF NOT EXISTS stage_changed_at TIMESTAMPTZ; ALTER TABLE candidates ADD COLUMN IF NOT EXISTS pipeline_order INTEGER;
            </code>
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="border-b border-slate-200 px-6 py-3 flex items-center gap-3 flex-wrap bg-white">
        <span className="text-sm font-semibold text-slate-700">Pipeline</span>
        <div className="h-4 w-px bg-slate-200" />
        <StatPill label="Total" count={total} color="bg-slate-100 text-slate-700" />
        <StatPill label="Sourced" count={grouped['Sourced']?.length || 0} color="bg-slate-200 text-slate-700" />
        <StatPill label="Contacted" count={grouped['Contacted/No Reply']?.length || 0} color="bg-indigo-100 text-indigo-800" />
        <StatPill label="Lnkd Interview" count={grouped['Lnkd Interview']?.length || 0} color="bg-amber-100 text-amber-800" />
        <StatPill label="Shortlisted by Lnkd" count={grouped['Shortlisted by Lnkd']?.length || 0} color="bg-blue-100 text-blue-800" />
        <StatPill label="Client Interview" count={grouped['Client Interview']?.length || 0} color="bg-purple-100 text-purple-800" />
        <StatPill label="Hired" count={grouped['Hired']?.length || 0} color="bg-emerald-100 text-emerald-800" />
        <StatPill label="Rejected" count={grouped['Rejected']?.length || 0} color="bg-red-100 text-red-700" />
      </div>

      {/* Board */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 animate-pulse text-sm">Loading pipeline...</div>
      ) : total === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-4">
          <div className="text-5xl">📋</div>
          <p className="text-slate-700 font-semibold text-base">No candidates in the pipeline yet.</p>
          <p className="text-slate-400 text-sm max-w-sm">Assign a stage from the Candidates list to get started.</p>
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex gap-3 px-4 py-4 h-full" style={{ minWidth: 'max-content' }}>
              {STAGES.map((stage) => (
                <StageColumn
                  key={stage.id}
                  stage={stage}
                  candidates={grouped[stage.id] || []}
                  collapsed={!!collapsedStages[stage.id]}
                  onToggleCollapse={() => toggleCollapse(stage.id)}
                  onDetails={setSelectedCandidate}
                  onRemoveFromPipeline={removeFromPipeline}
                />
              ))}
            </div>
          </div>
        </DragDropContext>
      )}

    </div>
  );
}

// ─── Rejection Feedback Modal ──────────────────────────────────────────────────

function RejectionFeedbackModal({ 
  candidate, onClose, onSave 
}: { 
  candidate: Candidate; 
  onClose: () => void; 
  onSave: (reason: string, note: string) => void 
}) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');

  const REASONS = ['Salary Expectation', 'Technical Skills', 'Cultural Fit', 'Seniority', 'Ghosted/No Reply', 'Other'];

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Rejection Feedback</h3>
            <p className="text-xs text-slate-500 mt-0.5">Why was {candidate.full_name} rejected?</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {REASONS.map(r => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`
                px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all
                ${reason === r 
                  ? 'bg-slate-900 border-slate-900 text-white shadow-sm' 
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}
              `}
            >
              {r}
            </button>
          ))}
        </div>

        <textarea
          rows={3}
          placeholder="Additional notes (optional)..."
          className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-slate-900 outline-none transition appearance-none"
          value={note}
          onChange={e => setNote(e.target.value)}
        />

        <div className="flex gap-3 mt-6">
          <button 
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-lg transition"
          >
            Cancel
          </button>
          <button 
            disabled={!reason}
            onClick={() => onSave(reason, note)}
            className="flex-1 px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:bg-slate-300"
          >
            Confirm Rejection
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stat Pill ────────────────────────────────────────────────────────────────

function StatPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${color}`}>
      {label}
      <span className="font-bold">{count}</span>
    </span>
  );
}
