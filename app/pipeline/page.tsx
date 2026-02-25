'use client';

import { useEffect, useState, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '@/lib/supabaseClient';
import {
  UserCircleIcon,
  LinkIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';

// ─── Types ────────────────────────────────────────────────────────────────────

type Candidate = {
  id: string;
  full_name: string;
  title?: string;
  match_score?: number;
  status?: string;
  pipeline_stage?: string;
  stage_changed_at?: string;
  created_at?: string;
  linkedin_url?: string;
  portfolio_url?: string;
  assigned_company_name?: string;
  assigned_job_title?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applications?: any[];
};

type Stage = {
  id: string;
  label: string;
  color: string;           // header bg
  textColor: string;       // header text
  badgeColor: string;      // count badge
  borderColor: string;     // column left-border accent
};

// ─── Stage Config ─────────────────────────────────────────────────────────────
// Stage order & names sourced from lib/constants.ts (single source of truth).

const STAGES: Stage[] = [
  {
    id: 'Sourced',
    label: 'Sourced',
    color: 'bg-slate-100',
    textColor: 'text-slate-700',
    badgeColor: 'bg-slate-200 text-slate-700',
    borderColor: 'border-l-slate-400',
  },
  {
    id: 'Lnkd Interview',
    label: 'Lnkd Interview',
    color: 'bg-amber-50',
    textColor: 'text-amber-800',
    badgeColor: 'bg-amber-200 text-amber-800',
    borderColor: 'border-l-amber-400',
  },
  {
    id: 'Shortlisted by Lnkd',
    label: 'Shortlisted by Lnkd',
    color: 'bg-blue-50',
    textColor: 'text-blue-800',
    badgeColor: 'bg-blue-200 text-blue-800',
    borderColor: 'border-l-blue-400',
  },
  {
    id: 'Client Interview',
    label: 'Client Interview',
    color: 'bg-purple-50',
    textColor: 'text-purple-800',
    badgeColor: 'bg-purple-200 text-purple-800',
    borderColor: 'border-l-purple-400',
  },
  {
    id: 'Offer',
    label: 'Offer',
    color: 'bg-green-50',
    textColor: 'text-green-800',
    badgeColor: 'bg-green-200 text-green-800',
    borderColor: 'border-l-green-400',
  },
  {
    id: 'Hired',
    label: 'Hired',
    color: 'bg-emerald-100',
    textColor: 'text-emerald-900',
    badgeColor: 'bg-emerald-600 text-white',
    borderColor: 'border-l-emerald-600',
  },
  {
    id: 'Rejected',
    label: 'Rejected',
    color: 'bg-red-50',
    textColor: 'text-red-700',
    badgeColor: 'bg-red-200 text-red-700',
    borderColor: 'border-l-red-400',
  },
];

// ─── Stage derivation from legacy status ──────────────────────────────────────

function deriveStage(c: Candidate): string {
  if (c.pipeline_stage) return c.pipeline_stage;
  if (!c.status || c.status === 'Unvetted') return 'Sourced';
  if (c.status === 'Vetted') return 'Lnkd Interview';
  if (c.status === 'Assigned') return 'Shortlisted by Lnkd';
  return 'Sourced';
}

// ─── Status sync when moving ──────────────────────────────────────────────────

function statusForStage(stage: string): string | null {
  if (stage === 'Sourced') return 'Unvetted';
  if (stage === 'Lnkd Interview' || stage === 'Shortlisted by Lnkd' || stage === 'Client Interview' || stage === 'Offer') return 'Vetted';
  if (stage === 'Hired') return 'Assigned';
  if (stage === 'Rejected') return null; // keep existing
  return null;
}

// ─── Days in stage ────────────────────────────────────────────────────────────

function daysInStage(c: Candidate): number {
  const ref = c.stage_changed_at || c.created_at;
  if (!ref) return 0;
  const ms = Date.now() - new Date(ref).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

// ─── Score chip color ─────────────────────────────────────────────────────────

function scoreChipClass(score?: number): string {
  if (!score && score !== 0) return 'bg-slate-100 text-slate-500';
  if (score >= 70) return 'bg-green-100 text-green-700';
  if (score >= 40) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-600';
}

// ─── Initials ─────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => (p[0] || '').toUpperCase())
    .join('');
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
  const companyName = candidate.assigned_company_name;
  const hasLinkedIn = !!candidate.linkedin_url;
  const hasBehance = !!candidate.portfolio_url;

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
                <p className="text-[11px] text-slate-400 leading-tight truncate mt-0.5">
                  {candidate.title}
                </p>
              )}
              {companyName && (
                <p className="flex items-center gap-0.5 text-[11px] text-slate-400 leading-tight truncate mt-0.5">
                  <BuildingOfficeIcon className="h-3 w-3 shrink-0" />
                  {companyName}
                </p>
              )}
            </div>
            {/* Score chip */}
            {score !== undefined && score !== null && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${scoreChipClass(score)}`}>
                {score}%
              </span>
            )}
          </div>

          {/* Bottom row: days + linkedin/behance | cv + details */}
          <div className="flex items-center justify-between gap-1 mt-1">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                <ClockIcon className="h-3 w-3" />
                {days}d
              </span>
              {/* LinkedIn icon — show if linkedin_url exists */}
              {hasLinkedIn && (
                <a
                  href={candidate.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center justify-center h-5 w-5 rounded bg-[#0077b5] hover:bg-[#006097] transition shrink-0"
                  title="LinkedIn"
                >
                  <svg className="h-3 w-3 fill-white" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </a>
              )}
              {/* Behance icon — show only if portfolio_url exists and no linkedin */}
              {!hasLinkedIn && hasBehance && (
                <a
                  href={candidate.portfolio_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center justify-center h-5 w-5 rounded bg-[#1769ff] hover:bg-[#0052cc] transition shrink-0"
                  title="Behance Portfolio"
                >
                  <svg className="h-3 w-3 fill-white" viewBox="0 0 24 24">
                    <path d="M22 7h-7V5h7v2zm1.726 10c-.442 1.297-2.029 3-5.101 3-3.074 0-5.564-1.729-5.564-5.675 0-3.91 2.325-5.92 5.466-5.92 3.082 0 4.964 1.782 5.375 4.426.078.506.109 1.188.095 2.14H15.97c.13 1.202.836 1.883 2.168 1.883.902 0 1.574-.413 1.798-1.102l2.79.273zm-5.188-4h3.954c-.07-1.03-.677-1.867-1.886-1.867-1.246 0-1.972.875-2.114 1.867zM8.207 10.5c.367-.51.602-1.154.602-1.946C8.809 6.604 7.672 5.5 5.758 5.5H0v13h6.05c2.114 0 3.561-1.222 3.561-3.233 0-1.313-.538-2.254-1.404-2.767zM2.337 7.773h2.947c.876 0 1.418.44 1.418 1.204 0 .82-.588 1.24-1.498 1.24H2.337V7.773zm3.265 8.454H2.337v-2.84h3.207c1.002 0 1.607.505 1.607 1.42 0 .944-.568 1.42-1.549 1.42z" />
                  </svg>
                </a>
              )}
            </div>
            <div className="flex items-center gap-1">
              <a
                href={`/?cv=${candidate.id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] font-semibold px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-600 rounded hover:bg-slate-100 transition"
                title="Generate CV"
              >
                CV
              </a>
              <button
                onClick={() => onDetails(candidate)}
                className="text-[10px] font-semibold px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-600 rounded hover:bg-slate-100 transition"
              >
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
  stage,
  candidates,
  collapsed,
  onToggleCollapse,
  onDetails,
  onRemoveFromPipeline,
}: {
  stage: Stage;
  candidates: Candidate[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  onDetails: (c: Candidate) => void;
  onRemoveFromPipeline: (id: string) => void;
}) {
  return (
    <div
      className={`
        flex flex-col rounded-xl border border-slate-200 shadow-sm bg-white shrink-0
        border-l-4 ${stage.borderColor}
        ${collapsed ? 'w-14' : 'w-64'}
        transition-all duration-200
      `}
      style={{ minHeight: '200px' }}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl ${stage.color} cursor-pointer`}
        onClick={onToggleCollapse}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-1 w-full">
            <ChevronRightIcon className={`h-4 w-4 ${stage.textColor}`} />
            <span
              className={`text-[10px] font-bold writing-vertical ${stage.textColor} select-none`}
              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}
            >
              {stage.label}
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${stage.badgeColor}`}>
              {candidates.length}
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${stage.textColor}`}>{stage.label}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${stage.badgeColor}`}>
                {candidates.length}
              </span>
            </div>
            <ChevronDownIcon className={`h-4 w-4 ${stage.textColor} shrink-0`} />
          </>
        )}
      </div>

      {/* Droppable area */}
      {!collapsed && (
        <Droppable droppableId={stage.id}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`
                flex-1 p-2 overflow-y-auto transition-colors
                ${snapshot.isDraggingOver ? 'bg-slate-50' : 'bg-white'}
                rounded-b-xl
              `}
              style={{ minHeight: '80px', maxHeight: 'calc(100vh - 200px)' }}
            >
              {candidates.length === 0 && !snapshot.isDraggingOver && (
                <div className="text-center py-8 text-[11px] text-slate-300 select-none">
                  Drop here
                </div>
              )}
              {candidates.map((c, i) => (
                <CandidateCard key={c.id} candidate={c} index={i} onDetails={onDetails} onRemoveFromPipeline={onRemoveFromPipeline} />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      )}
      {collapsed && (
        <Droppable droppableId={stage.id}>
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="flex-1">
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      )}
    </div>
  );
}

// ─── Details Mini-Modal ───────────────────────────────────────────────────────

function DetailsModal({ candidate, onClose }: { candidate: Candidate; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 mb-4">
          <div className="h-14 w-14 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xl font-bold text-slate-600 shrink-0">
            {initials(candidate.full_name || '?')}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{candidate.full_name}</h2>
            <p className="text-slate-500 text-sm">{candidate.title || 'No title'}</p>
          </div>
        </div>

        <div className="space-y-2 text-sm text-slate-700">
          <div className="flex items-center gap-2">
            <span className="font-medium w-28 text-slate-500">Pipeline Stage:</span>
            <span className="font-semibold">{candidate.pipeline_stage || deriveStage(candidate)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium w-28 text-slate-500">Status:</span>
            <span>{candidate.status || '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium w-28 text-slate-500">Match Score:</span>
            <span className={`font-bold px-2 py-0.5 rounded-full text-xs ${scoreChipClass(candidate.match_score)}`}>
              {candidate.match_score !== undefined ? `${candidate.match_score}%` : '—'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium w-28 text-slate-500">Days in Stage:</span>
            <span>{daysInStage(candidate)}d</span>
          </div>
          {candidate.linkedin_url && (
            <div className="flex items-center gap-2">
              <span className="font-medium w-28 text-slate-500">LinkedIn:</span>
              <a
                href={candidate.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline truncate"
              >
                View Profile
              </a>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-between items-center">
          <a
            href={`/?candidate=${candidate.id}`}
            className="text-xs text-slate-500 hover:text-slate-800 underline"
          >
            Open full profile →
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-black text-white text-sm font-semibold rounded-lg hover:bg-zinc-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationNotice, setMigrationNotice] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({ Rejected: true });

  // ─── Fetch ───────────────────────────────────────────────────────────────────

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('candidates')
      .select('id, full_name, title, match_score, status, pipeline_stage, stage_changed_at, created_at, linkedin_url, portfolio_url, applications(job_id, jobs(title, clients(name)))')
      .order('stage_changed_at', { ascending: false, nullsFirst: false });

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
          const jobTitle = firstApp?.jobs?.title;
          return {
            ...c,
            pipeline_stage: c.pipeline_stage,
            assigned_company_name: companyName ?? undefined,
            assigned_job_title: jobTitle ?? undefined,
          };
        });
      setCandidates(enriched);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  // ─── Group by stage ───────────────────────────────────────────────────────────

  const stageMap = useCallback(() => {
    const map: Record<string, Candidate[]> = {};
    STAGES.forEach((s) => (map[s.id] = []));
    candidates.forEach((c) => {
      const stage = c.pipeline_stage || 'Sourced';
      if (map[stage]) {
        map[stage].push(c);
      } else {
        map['Sourced'].push(c);
      }
    });
    return map;
  }, [candidates]);

  // ─── Drag End ─────────────────────────────────────────────────────────────────

  // ─── Remove from pipeline ─────────────────────────────────────────────────────

  const removeFromPipeline = useCallback(async (id: string) => {
    // Optimistic: remove from local state immediately
    setCandidates((prev) => prev.filter((c) => c.id !== id));

    const { error } = await supabase
      .from('candidates')
      .update({ pipeline_stage: null, stage_changed_at: null })
      .eq('id', id);

    if (error) {
      console.error('Error removing from pipeline:', error);
      // Re-fetch to restore correct state
      fetchCandidates();
    }
  }, [fetchCandidates]);

  // ─── Drag End ─────────────────────────────────────────────────────────────────

  const onDragEnd = useCallback(
    async (result: DropResult) => {
      const { destination, source, draggableId } = result;
      if (!destination) return;
      if (destination.droppableId === source.droppableId && destination.index === source.index) return;

      const newStage = destination.droppableId;
      const oldStage = source.droppableId;

      // Optimistic update
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === draggableId
            ? { ...c, pipeline_stage: newStage, stage_changed_at: new Date().toISOString() }
            : c
        )
      );

      // Determine status sync
      const newStatus = statusForStage(newStage);

      // Persist to Supabase
      const updatePayload: Record<string, string> = {
        pipeline_stage: newStage,
        stage_changed_at: new Date().toISOString(),
      };
      if (newStatus !== null) {
        updatePayload.status = newStatus;
      }

      const { error } = await supabase.from('candidates').update(updatePayload).eq('id', draggableId);

      if (error) {
        // Check if it's a column-not-found error
        const msg = error.message || '';
        if (
          msg.includes('pipeline_stage') ||
          msg.includes('column') ||
          msg.includes('stage_changed_at') ||
          error.code === '42703'
        ) {
          setMigrationNotice(true);
          // Revert status update in Supabase isn't possible if col doesn't exist, but keep local state
        } else {
          console.error('Error updating pipeline stage:', error);
          // Revert optimistic update on other errors
          setCandidates((prev) =>
            prev.map((c) =>
              c.id === draggableId ? { ...c, pipeline_stage: oldStage } : c
            )
          );
        }
      } else {
        // Also sync candidates local state with new status if applicable
        if (newStatus !== null) {
          setCandidates((prev) =>
            prev.map((c) =>
              c.id === draggableId ? { ...c, status: newStatus } : c
            )
          );
        }
      }
    },
    []
  );

  // ─── Stage toggle ─────────────────────────────────────────────────────────────

  const toggleCollapse = (stageId: string) => {
    setCollapsedStages((prev) => ({ ...prev, [stageId]: !prev[stageId] }));
  };

  // ─── Stats ────────────────────────────────────────────────────────────────────

  const grouped = stageMap();
  const total = candidates.length;

  return (
    <div className="flex flex-col h-[calc(100vh-68px)] bg-white">
      {/* Migration notice */}
      {migrationNotice && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-start gap-2">
          <ExclamationTriangleIcon className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800">
            <strong>Stage changes saved locally only.</strong> To persist pipeline stages, run this migration in Supabase SQL editor:{' '}
            <code className="bg-amber-100 px-1 rounded font-mono">
              ALTER TABLE candidates ADD COLUMN IF NOT EXISTS pipeline_stage TEXT; ALTER TABLE candidates ADD COLUMN IF NOT EXISTS stage_changed_at TIMESTAMPTZ;
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
        <StatPill label="Lnkd Interview" count={grouped['Lnkd Interview']?.length || 0} color="bg-amber-100 text-amber-800" />
        <StatPill label="Shortlisted by Lnkd" count={grouped['Shortlisted by Lnkd']?.length || 0} color="bg-blue-100 text-blue-800" />
        <StatPill label="Client Interview" count={grouped['Client Interview']?.length || 0} color="bg-purple-100 text-purple-800" />
        <StatPill label="Offer" count={grouped['Offer']?.length || 0} color="bg-green-100 text-green-800" />
        <StatPill label="Hired" count={grouped['Hired']?.length || 0} color="bg-emerald-100 text-emerald-800" />
        <StatPill label="Rejected" count={grouped['Rejected']?.length || 0} color="bg-red-100 text-red-700" />
      </div>

      {/* Board */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 animate-pulse text-sm">
          Loading pipeline...
        </div>
      ) : total === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-4">
          <div className="text-5xl">📋</div>
          <p className="text-slate-700 font-semibold text-base">No candidates in the pipeline yet.</p>
          <p className="text-slate-400 text-sm max-w-sm">
            Assign a stage from the Candidates list to get started.
          </p>
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

      {/* Details modal */}
      {selectedCandidate && (
        <DetailsModal candidate={selectedCandidate} onClose={() => setSelectedCandidate(null)} />
      )}
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
