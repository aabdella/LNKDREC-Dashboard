'use client';

import { supabase } from '@/lib/supabaseClient';
import { logActivity } from '@/lib/logActivity';
import { useState, useEffect } from 'react';
import { BriefcaseIcon, CloudArrowUpIcon, TrashIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

// Types
type Candidate = {
  id: string;
  full_name: string;
  title: string;
  location: string;
  years_experience_total?: number;
  match_score?: number;
  match_reason?: string;
  source: string;
  skills?: string[];
  linkedin_url?: string;
  portfolio_url?: string;
};

type SourcingAlert = { type: 'success' | 'error'; message: string } | null;

export default function SourcingPage() {
  const [jd, setJd] = useState('');
  const [internalMatches, setInternalMatches] = useState<Candidate[]>([]);
  const [sourcedQueue, setSourcedQueue] = useState<Candidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSourcing, setIsSourcing] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [activeTab, setActiveTab] = useState<'internal' | 'sourced'>('internal');
  const [sourcingAlert, setSourcingAlert] = useState<SourcingAlert>(null);

  useEffect(() => {
    fetchSourcedQueue();
  }, []);

  async function fetchSourcedQueue() {
    const { data, error } = await supabase
      .from('unvetted')
      .select('*')
      .in('source', ['Sourced', 'LinkedIn', 'Wuzzuf', 'Bayt', 'Behance'])
      .order('created_at', { ascending: false });

    if (data) setSourcedQueue(data);
    if (error) console.error('Error fetching queue:', error);
  }

  async function sourceNewTalent() {
    if (!jd.trim()) {
      setSourcingAlert({ type: 'error', message: 'Please paste a Job Description first.' });
      return;
    }
    setIsSourcing(true);
    setSourcingAlert(null);
    setSourcedQueue([]); // Clear queue immediately so user sees it's refreshing
    setSelectedIds([]);
    try {
      const res = await fetch('/api/source-talent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd, limit: 10 }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSourcingAlert({ type: 'error', message: data.error || 'Sourcing failed. Please try again.' });
      } else {
        setSourcingAlert({
          type: 'success',
          message: `Sourced ${data.sourced} new candidate${data.sourced !== 1 ? 's' : ''} — check the queue!`,
        });
        await logActivity('sourcing_triggered', 'Sourcing Run', { candidates_found: data.sourced, jd_snippet: jd.slice(0, 200) }, 'sourcing');
        setActiveTab('sourced');
        await fetchSourcedQueue();
      }
    } catch {
      setSourcingAlert({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setIsSourcing(false);
    }
  }

  async function findInternalMatches() {
    if (!jd.trim()) return;
    setIsMatching(true);

    const { data } = await supabase
      .from('candidates')
      .select('*')
      .limit(10);

    if (data) setInternalMatches(data);
    setIsMatching(false);
  }

  async function approveCandidates() {
    if (selectedIds.length === 0) return;

    const candidatesToApprove = sourcedQueue.filter(c => selectedIds.includes(c.id));

    for (const c of candidatesToApprove) {
      const { id, ...candidateData } = c;
      const { error: insertError } = await supabase.from('candidates').insert({
        ...candidateData,
        status: 'Lead',
      });

      if (!insertError) {
        await supabase.from('unvetted').delete().eq('id', c.id);
        await logActivity('candidate_approved', c.full_name, { source: c.source, match_score: c.match_score }, 'candidate', c.id);
      }
    }

    setSelectedIds([]);
    fetchSourcedQueue();
    alert(`Successfully approved ${candidatesToApprove.length} candidates.`);
  }

  async function rejectCandidates() {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to reject ${selectedIds.length} candidates?`)) return;

    const { error } = await supabase.from('unvetted').delete().in('id', selectedIds);
    if (!error) {
      await logActivity('candidate_rejected', `${selectedIds.length} candidate(s)`, { ids: selectedIds }, 'candidate');
      setSelectedIds([]);
      fetchSourcedQueue();
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === sourcedQueue.length) setSelectedIds([]);
    else setSelectedIds(sourcedQueue.map(c => c.id));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Talent Scout Sourcing</h1>

      {/* Alert Banner */}
      {sourcingAlert && (
        <div className={`mb-6 px-5 py-4 rounded-lg border text-sm font-medium flex items-start justify-between gap-4 ${
          sourcingAlert.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <span>{sourcingAlert.message}</span>
          <button
            onClick={() => setSourcingAlert(null)}
            className="text-current opacity-60 hover:opacity-100 shrink-0 font-bold text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left: Job Description Input */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm sticky top-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <BriefcaseIcon className="h-5 w-5 text-indigo-600" /> Job Description
            </h2>
            <textarea
              className="w-full h-64 p-4 border border-slate-200 rounded-lg focus:ring-2 focus:ring-black outline-none text-sm leading-relaxed mb-4 resize-none"
              placeholder="Paste the Job Description here to find matching talent..."
              value={jd}
              onChange={(e) => setJd(e.target.value)}
            />
            <div className="flex flex-col gap-3">
              <button
                onClick={findInternalMatches}
                disabled={isMatching || !jd.trim()}
                className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-black transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isMatching ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Matching...
                  </>
                ) : 'Match Internal Talent'}
              </button>
              <button
                onClick={sourceNewTalent}
                disabled={isSourcing || !jd.trim()}
                className="w-full bg-white border border-slate-300 text-slate-700 py-3 rounded-lg font-bold hover:bg-slate-50 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSourcing ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Sourcing...
                  </>
                ) : (
                  <>
                    <CloudArrowUpIcon className="h-5 w-5" /> Source New Talent
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Results & Queue */}
        <div className="lg:col-span-2 space-y-8">

          {/* Tabs */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab('internal')}
              className={`px-6 py-3 font-bold text-sm transition-colors relative ${activeTab === 'internal' ? 'text-black' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Internal Matches ({internalMatches.length})
              {activeTab === 'internal' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />}
            </button>
            <button
              onClick={() => setActiveTab('sourced')}
              className={`px-6 py-3 font-bold text-sm transition-colors relative ${activeTab === 'sourced' ? 'text-black' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Sourced Queue ({sourcedQueue.length})
              {activeTab === 'sourced' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />}
            </button>
          </div>

          {activeTab === 'internal' ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Name & Title</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Exp</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Score</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {internalMatches.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{c.full_name}</div>
                        <div className="text-xs text-slate-500">{c.title}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{c.years_experience_total || 0}y</td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold px-2 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {c.match_score || 0}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition">View Details</button>
                      </td>
                    </tr>
                  ))}
                  {internalMatches.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                        Enter a JD and click "Match Internal Talent" to see results.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Bulk Actions Bar */}
              {sourcedQueue.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                      checked={selectedIds.length === sourcedQueue.length && sourcedQueue.length > 0}
                      onChange={toggleSelectAll}
                    />
                    <span className="text-sm font-bold text-indigo-900">
                      {selectedIds.length} Selected
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={rejectCandidates}
                      disabled={selectedIds.length === 0}
                      className="px-4 py-2 bg-white border border-red-200 text-red-600 text-xs font-bold rounded-md hover:bg-red-50 transition flex items-center gap-1 disabled:opacity-50"
                    >
                      <TrashIcon className="h-4 w-4" /> Reject
                    </button>
                    <button
                      onClick={approveCandidates}
                      disabled={selectedIds.length === 0}
                      className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-md hover:bg-indigo-700 transition flex items-center gap-1 disabled:opacity-50"
                    >
                      <CheckCircleIcon className="h-4 w-4" /> Approve to Pipeline
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-4 w-10"></th>
                      <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase">Name</th>
                      <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase">Role</th>
                      <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase">Company</th>
                      <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase">Yrs Exp</th>
                      <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sourcedQueue.map(c => {
                      // Extract company from match_reason (e.g. "Majorel Egypt — 5 yrs..." or "at Concentrix")
                      const companyMatch = c.match_reason
                        ? (c.match_reason.match(/^([^—]+?)\s*—/) || c.match_reason.match(/\bat\s+([A-Z][^.,]+)/i))
                        : null;
                      const company = companyMatch ? companyMatch[1].trim() : '—';

                      return (
                      <tr
                        key={c.id}
                        className={`hover:bg-slate-50/50 transition cursor-pointer ${selectedIds.includes(c.id) ? 'bg-indigo-50/30' : ''}`}
                        onClick={() => toggleSelect(c.id)}
                      >
                        <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300"
                            checked={selectedIds.includes(c.id)}
                            onChange={() => toggleSelect(c.id)}
                          />
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-bold text-slate-900 text-sm">{c.full_name}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{c.location}</div>
                          <div className="flex gap-2 mt-1">
                            {c.linkedin_url && (
                              <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="text-[10px] text-indigo-500 hover:text-indigo-700">
                                LinkedIn ↗
                              </a>
                            )}
                            {c.portfolio_url && (
                              <a href={c.portfolio_url} target="_blank" rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="text-[10px] text-pink-500 hover:text-pink-700">
                                Portfolio ↗
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm text-slate-700 font-medium">{c.title || '—'}</div>
                          {c.match_reason && (
                            <div className="text-[10px] text-slate-400 mt-1 max-w-[160px] truncate" title={c.match_reason}>
                              {c.match_reason}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm text-slate-600">{company}</div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm font-semibold text-slate-700">
                            {c.years_experience_total ? `${c.years_experience_total} yrs` : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            c.source === 'LinkedIn'  ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                            c.source === 'Wuzzuf'    ? 'bg-orange-50 text-orange-700 border-orange-200' :
                            c.source === 'Bayt'      ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            c.source === 'Behance'   ? 'bg-pink-50 text-pink-700 border-pink-200' :
                            'bg-slate-100 text-slate-500 border-slate-200'
                          }`}>
                            {c.source}
                          </span>
                          {c.match_score != null && (
                            <div className="mt-1">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                                {c.match_score}%
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                    {sourcedQueue.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                          The sourced queue is empty. Paste a JD and click "Source New Talent" to get started.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
