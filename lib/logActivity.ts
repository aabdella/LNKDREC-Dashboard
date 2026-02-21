import { createClient } from '@supabase/supabase-js';

export type LogAction =
  | 'candidate_staged'
  | 'candidate_approved'
  | 'candidate_rejected'
  | 'candidate_vetted'
  | 'candidate_assigned'
  | 'candidate_unassigned'
  | 'candidate_edited'
  | 'cv_generated'
  | 'job_created'
  | 'job_updated'
  | 'sourcing_triggered'
  | 'search_performed'
  | 'status_snapshot';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://clrzajerliyyddfyvggd.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const sb = createClient(supabaseUrl, supabaseKey);

export async function logActivity(
  action: LogAction,
  entityName: string,
  details?: Record<string, any>,
  entityType?: string,
  entityId?: string
) {
  try {
    await sb.from('activity_log').insert({
      action,
      entity_type: entityType || 'candidate',
      entity_id: entityId || null,
      entity_name: entityName,
      details: details || {},
      source: 'web',
    });
  } catch (e) {
    // Never let logging break the main flow
    console.warn('Activity log failed silently:', e);
  }
}
