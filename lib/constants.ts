// ─── Pipeline Stages ─────────────────────────────────────────────────────────
// Single source of truth for pipeline stage names and order.

export const PIPELINE_STAGES = [
  'Sourced',
  'Lnkd Interview',
  'Shortlisted by Lnkd',
  'Client Interview',
  'Offer',
  'Hired',
  'Rejected',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const STAGE_COLORS: Record<string, string> = {
  'Sourced':            'bg-slate-700 text-slate-100',
  'Lnkd Interview':     'bg-amber-600 text-white',
  'Shortlisted by Lnkd':'bg-blue-600 text-white',
  'Client Interview':   'bg-purple-600 text-white',
  'Offer':              'bg-green-600 text-white',
  'Hired':              'bg-emerald-700 text-white',
  'Rejected':           'bg-red-700 text-white',
};
