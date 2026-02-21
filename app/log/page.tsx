'use client';

import { supabase } from '@/lib/supabaseClient';
import { useState, useEffect, useCallback } from 'react';

type LogEntry = {
  id: string;
  created_at: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_name: string | null;
  details: Record<string, any> | null;
  source: string | null;
};

const ACTION_COLORS: Record<string, string> = {
  candidate_approved:   'bg-green-100 text-green-700 border-green-200',
  candidate_vetted:     'bg-green-100 text-green-700 border-green-200',
  candidate_assigned:   'bg-green-100 text-green-700 border-green-200',
  candidate_rejected:   'bg-red-100 text-red-700 border-red-200',
  candidate_unassigned: 'bg-red-100 text-red-700 border-red-200',
  cv_generated:         'bg-blue-100 text-blue-700 border-blue-200',
  sourcing_triggered:   'bg-blue-100 text-blue-700 border-blue-200',
  search_performed:     'bg-blue-100 text-blue-700 border-blue-200',
  candidate_staged:     'bg-orange-100 text-orange-700 border-orange-200',
  candidate_edited:     'bg-orange-100 text-orange-700 border-orange-200',
  job_created:          'bg-purple-100 text-purple-700 border-purple-200',
  job_updated:          'bg-purple-100 text-purple-700 border-purple-200',
  status_snapshot:      'bg-slate-100 text-slate-600 border-slate-200',
};

const ACTION_ICONS: Record<string, string> = {
  candidate_approved:   '✅',
  candidate_vetted:     '🔍',
  candidate_assigned:   '💼',
  candidate_rejected:   '❌',
  candidate_unassigned: '↩️',
  cv_generated:         '📄',
  sourcing_triggered:   '🔎',
  search_performed:     '🔍',
  candidate_staged:     '📥',
  candidate_edited:     '✏️',
  job_created:          '🆕',
  job_updated:          '📝',
  status_snapshot:      '📊',
};

const ALL_ACTIONS = [
  'candidate_approved', 'candidate_vetted', 'candidate_assigned',
  'candidate_rejected', 'candidate_unassigned', 'cv_generated',
  'sourcing_triggered', 'search_performed', 'candidate_staged',
  'candidate_edited', 'job_created', 'job_updated', 'status_snapshot',
];

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return 'Yesterday';
  return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatDetails(details: Record<string, any> | null): string {
  if (!details || Object.keys(details).length === 0) return '';
  return Object.entries(details)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => {
      const label = k.replace(/_/g, ' ');
      const val = typeof v === 'object' ? JSON.stringify(v).slice(0, 60) : String(v).slice(0, 80);
      return `${label}: ${val}`;
    })
    .join(' · ');
}

export default function LogPage() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('all');
  const [tableError, setTableError] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchLog = useCallback(async () => {
    let query = supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (filterAction !== 'all') {
      query = query.eq('action', filterAction);
    }

    const { data, error } = await query;

    if (error) {
      if (error.message.includes('relation') || error.message.includes('schema cache')) {
        setTableError(true);
      }
      console.error('Log fetch error:', error);
    } else {
      setEntries(data || []);
      setTableError(false);
    }
    setLoading(false);
    setLastRefresh(new Date());
  }, [filterAction]);

  useEffect(() => {
    fetchLog();
    const interval = setInterval(fetchLog, 30000);
    return () => clearInterval(interval);
  }, [fetchLog]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              🗂 Activity Log
            </h1>
            <p className="text-sm text-slate-400 mt-1">Read-only system event log · Auto-refreshes every 30s</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              Last updated: {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <button
              onClick={fetchLog}
              className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition text-slate-600 font-medium"
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Table missing error */}
      {tableError && (
        <div className="mb-6 p-5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <p className="font-bold mb-2">⚠️ activity_log table not found in Supabase</p>
          <p className="mb-3">Run this SQL in your <a href="https://supabase.com/dashboard/project/clrzajerliyyddfyvggd/sql" target="_blank" className="underline font-semibold">Supabase SQL Editor</a>:</p>
          <pre className="bg-white border border-amber-200 rounded p-3 text-xs overflow-x-auto">{`CREATE TABLE IF NOT EXISTS activity_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  action text NOT NULL,
  entity_type text,
  entity_id text,
  entity_name text,
  details jsonb,
  source text DEFAULT 'web'
);`}</pre>
        </div>
      )}

      {/* Filter + stats bar */}
      {!tableError && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-600">Filter:</label>
            <select
              className="text-sm border border-slate-200 rounded-md px-3 py-1.5 bg-white focus:ring-2 focus:ring-black outline-none appearance-none cursor-pointer"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
            >
              <option value="all">All Actions</option>
              {ALL_ACTIONS.map(a => (
                <option key={a} value={a}>{ACTION_ICONS[a]} {a.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <span className="text-sm text-slate-500 font-medium">
            {loading ? 'Loading...' : `${entries.length} event${entries.length !== 1 ? 's' : ''}`}
          </span>
        </div>
      )}

      {/* Log table */}
      {!tableError && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase w-28">Time</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase w-48">Action</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Entity</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Details</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase w-20">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-400 animate-pulse">
                    Loading activity log...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-400 italic">
                    No events logged yet. Actions on the dashboard will appear here.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const colorClass = ACTION_COLORS[entry.action] || 'bg-slate-100 text-slate-600 border-slate-200';
                  const icon = ACTION_ICONS[entry.action] || '•';
                  const detailsText = formatDetails(entry.details);

                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-5 py-3">
                        <span className="text-xs text-slate-400 whitespace-nowrap" title={new Date(entry.created_at).toLocaleString()}>
                          {timeAgo(entry.created_at)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${colorClass}`}>
                          {icon} {entry.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-sm font-medium text-slate-800">{entry.entity_name || '—'}</div>
                        {entry.entity_type && (
                          <div className="text-[10px] text-slate-400">{entry.entity_type}</div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs text-slate-500 line-clamp-2" title={detailsText}>
                          {detailsText || <span className="italic text-slate-300">—</span>}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-[10px] font-medium text-slate-400 uppercase">{entry.source || 'web'}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
