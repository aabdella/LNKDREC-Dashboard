'use client';

import { BriefcaseIcon, StarIcon as StarOutline, ClockIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';

// ─── Shared Candidate Card ──────────────────────────────────────────────────────
// Mirrors the candidates page card exactly.
// Action buttons are only rendered when the page passes callbacks in
// (i.e. on the Candidates page). On the sourcing hover card they're omitted.

type SharedCandidateCardProps = {
  candidate: any;
  // Only needed on the candidates page — omit for hover cards
  onViewDetails?: () => void;
  onVetCandidate?: () => void;
  onToggleAssign?: () => void;
  onGenerateCV?: () => void;
  onToggleHighlight?: () => void;
  addingToPipelineId?: string | null;
  addToPipelineStage?: string;
  setAddingToPipelineId?: (id: string | null) => void;
  setAddToPipelineStage?: (stage: string) => void;
  onAddToPipeline?: (candidateId: string) => void;
  movingCandidate?: boolean;
};

export default function SharedCandidateCard({
  candidate,
  onViewDetails,
  onVetCandidate,
  onToggleAssign,
  onGenerateCV,
  onToggleHighlight,
}: SharedCandidateCardProps) {
  const isVetted = candidate.status === 'Vetted';
  const isAssigned = !!candidate.assigned_job_title;
  const portfolioUrl = candidate.portfolio_url;
  const isGithub = portfolioUrl?.includes('github.com');
  const isBehance = portfolioUrl && !isGithub;

  return (
    <div className={`bg-white rounded-xl shadow-sm border hover:shadow-md transition group flex flex-col h-full relative ${
      candidate.is_highlighted ? 'border-amber-400 ring-1 ring-amber-400' : 'border-slate-200 hover:border-black/10'
    }`}>

      {/* Highlight star */}
      {onToggleHighlight && (
        <button
          onClick={onToggleHighlight}
          className="absolute top-2.5 right-2.5 z-10 p-1 rounded-full bg-white/50 backdrop-blur shadow-sm hover:bg-white transition"
        >
          {candidate.is_highlighted
            ? <StarSolid className="h-4 w-4 text-amber-400" />
            : <StarOutline className="h-4 w-4 text-slate-300 hover:text-amber-400" />}
        </button>
      )}

      <div className="p-4 flex-grow flex flex-col">
        {/* Header */}
        <div className="flex gap-3 mb-3">
          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-lg shrink-0 border border-slate-200">👤</div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-base text-slate-900 line-clamp-1">{candidate.full_name}</h3>
            <p className="text-[11px] text-slate-500 truncate">{candidate.title} · {candidate.location}</p>
          </div>
        </div>

        {/* Experience + links + status */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              Experience: {candidate.years_experience_total || 0}+ yrs
            </span>
            <div className="flex items-center gap-1">
              {candidate.linkedin_url && (
                <a
                  href={candidate.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[#0077b5] hover:text-[#006097] transition"
                >
                  <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </a>
              )}
              {portfolioUrl && isGithub && (
                <a
                  href={portfolioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[#24292f] hover:text-[#4a4a4a] transition"
                >
                  <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24">
                    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                  </svg>
                </a>
              )}
              {portfolioUrl && isBehance && (
                <a
                  href={portfolioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[#1769ff] hover:text-[#0052cc] transition"
                >
                  <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24">
                    <path d="M22 7h-7V5h7v2zm1.726 10c-.442 1.297-2.029 3-5.101 3-3.074 0-5.564-1.729-5.564-5.675 0-3.91 2.325-5.92 5.466-5.92 3.082 0 4.964 1.782 5.375 4.426.078.506.109 1.188.095 2.14H15.97c.13 1.202.836 1.883 2.168 1.883.902 0 1.574-.413 1.798-1.102l2.79.273zm-5.188-4h3.954c-.07-1.03-.677-1.867-1.886-1.867-1.246 0-1.972.875-2.114 1.867zM8.207 10.5c.367-.51.602-1.154.602-1.946C8.809 6.604 7.672 5.5 5.758 5.5H0v13h6.05c2.114 0 3.561-1.222 3.561-3.233 0-1.313-.538-2.254-1.404-2.767zM2.337 7.773h2.947c.876 0 1.418.44 1.418 1.204 0 .82-.588 1.24-1.498 1.24H2.337V7.773zm3.265 8.454H2.337v-2.84h3.207c1.002 0 1.607.505 1.607 1.42 0 .944-.568 1.42-1.549 1.42z" />
                  </svg>
                </a>
              )}
            </div>
          </div>

          {/* Status badge */}
          {candidate.status === 'Hired' ? (
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-600 text-white flex items-center gap-1">
                <BriefcaseIcon className="h-2.5 w-2.5" /> Hired
              </span>
              {candidate.assigned_company_name && (
                <span className="text-[9px] font-bold text-slate-500 mt-0.5 text-right leading-tight max-w-[100px] truncate">
                  {candidate.assigned_company_name}
                </span>
              )}
            </div>
          ) : isAssigned ? (
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-green-100 text-green-700 border-green-200 flex items-center gap-1 capitalize">
                Matched
              </span>
              {candidate.assigned_company_name && (
                <span className="text-[9px] font-bold text-slate-500 mt-0.5 text-right leading-tight max-w-[100px] truncate">
                  {candidate.assigned_company_name}
                </span>
              )}
            </div>
          ) : isVetted ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-blue-100 text-blue-700 border-blue-200 flex items-center gap-1 capitalize">
              Vetted
            </span>
          ) : (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-50 text-slate-400 border-slate-200 capitalize">
              New
            </span>
          )}
        </div>

        {/* Match reason */}
        <div className="flex-grow">
          <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100 relative mb-2">
            <p className="text-[13px] text-slate-600 line-clamp-2 leading-snug">
              {candidate.match_reason}
            </p>
          </div>
          {candidate.last_interaction_at && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-purple-600 px-1">
              <ClockIcon className="h-3 w-3" />
              <span>
                Last Contact: {new Date(candidate.last_interaction_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons — only rendered on the candidates page */}
      {onViewDetails && (
        <div className="px-4 py-3 border-t border-slate-100 flex gap-2 bg-slate-50/50">
          <button
            onClick={onViewDetails}
            className="flex-1 bg-white border border-slate-200 text-slate-700 text-[11px] font-bold py-1.5 rounded hover:bg-slate-50 transition"
          >
            Details
          </button>
          <button
            onClick={onVetCandidate}
            className={`flex-1 text-[11px] font-bold py-1.5 rounded transition ${
              isVetted || isAssigned || !!candidate.assigned_job_title
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-black text-white hover:bg-zinc-800'
            }`}
          >
            {isVetted || isAssigned || !!candidate.assigned_job_title ? 'Edit' : 'Vet'}
          </button>
          {isAssigned ? (
            <button
              onClick={onToggleAssign}
              className="flex-1 bg-red-600 text-white text-[11px] font-bold py-1.5 rounded hover:bg-red-700 transition flex items-center justify-center gap-1"
            >
              <XMarkIcon className="h-3 w-3" /> Unmatch
            </button>
          ) : isVetted ? (
            <button
              onClick={onToggleAssign}
              className="flex-1 bg-blue-600 text-white text-[11px] font-bold py-1.5 rounded hover:bg-blue-700 transition flex items-center justify-center gap-1"
            >
              <BriefcaseIcon className="h-3 w-3" /> Assign
            </button>
          ) : null}
          {onGenerateCV && (
            <button
              onClick={onGenerateCV}
              className="px-2 py-1.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-100 hover:bg-indigo-100 transition"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Bottom progress bar */}
      <div className={`h-1 w-full transition-all duration-300 ${
        candidate.is_highlighted ? 'bg-amber-400 opacity-100' : 'bg-black opacity-0 group-hover:opacity-100'
      }`} />
    </div>
  );
}