'use client';

import { supabase } from '@/lib/supabaseClient';
import { logActivity } from '@/lib/logActivity';
import { useState, useEffect } from 'react';
import { BriefcaseIcon, CloudArrowUpIcon, TrashIcon, CheckCircleIcon, SparklesIcon } from '@heroicons/react/24/outline';

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
  const [isDeepCrawling, setIsDeepCrawling] = useState(false);
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
    setSelectedIds([]);
    try {
      const res = await fetch('/api/source-talent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd, limit: 10 }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSourcingAlert({ type: 'error', message: data.error || 'Sourcing failed.' });
      } else {
        setSourcingAlert({
          type: 'success',
          message: `Quick Sourcing complete! Found ${data.sourced} candidates.`,
        });
        await logActivity('sourcing_triggered', 'Sourcing Run', { candidates_found: data.sourced }, 'sourcing');
        setActiveTab('sourced');
        await fetchSourcedQueue();
      }
    } catch {
      setSourcingAlert({ type: 'error', message: 'Network error.' });
    } finally {
      setIsSourcing(false);
    }
  }

  async function deepCrawlTalent() {
    if (!jd.trim()) {
      setSourcingAlert({ type: 'error', message: 'Please paste a Job Description first.' });
      return;
    }
    setIsDeepCrawling(true);
    setSourcingAlert(null);
    setSelectedIds([]);
    try {
      const res = await fetch('/api/deep-crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSourcingAlert({ type: 'error', message: data.error || 'Deep search failed.' });
      } else {
        setSourcingAlert({
          type: 'success',
          message: `Deep Search complete! Sourced ${data.sourced} candidates.${data.debug?.discovered ? ` Discovery found ${data.debug.discovered.length} profile URLs.` : ''}`,
        });
        await logActivity('sourcing_triggered', 'Deep Search Run', { candidates_found: data.sourced }, 'sourcing');
        setActiveTab('sourced');
        await fetchSourcedQueue();
      }
    } catch {
      setSourcingAlert({ type: 'error', message: 'Network error during deep search.' });
    } finally {
      setIsDeepCrawling(false);
    }
  }

  async function findInternalMatches() {
    if (!jd.trim()) return;
    setIsMatching(true);
    const { data } = await supabase.from('candidates').select('*').limit(10);
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
        await logActivity('candidate_approved', c.full_name, { source: c.source }, 'candidate', c.id);
      }
    }
    setSelectedIds([]);
    fetchSourcedQueue();
  }

  async function rejectCandidates() {
    if (selectedIds.length === 0) return;
    if (!confirm(`Reject ${selectedIds.length} candidates?`)) return;
    const { error } = await supabase.from('unvetted').delete().in('id', selectedIds);
    if (!error) {
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
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Talent Sourcing Platform</h1>

      {sourcingAlert && (
        <div className={`mb-6 px-5 py-4 rounded-lg border text-sm font-medium flex items-center justify-between ${
          sourcingAlert.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <span>{sourcingAlert.message}</span>
          <button onClick={() => setSourcingAlert(null)}>×</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm sticky top-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <BriefcaseIcon className="h-5 w-5 text-indigo-600" /> Job Description
            </h2>
            <textarea
              className="w-full h-64 p-4 border border-slate-200 rounded-lg mb-4 text-sm resize-none focus:ring-2 focus:ring-black outline-none"
              placeholder="Paste JD here..."
              value={jd}
              onChange={(e) => setJd(e.target.value)}
            />
            <div className="space-y-3">
              <button
                onClick={findInternalMatches}
                disabled={isMatching || !jd.trim()}
                className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-black transition disabled:opacity-50"
              >
                {isMatching ? 'Matching...' : 'Match Internal Talent'}
              </button>
              
              <button
                onClick={sourceNewTalent}
                disabled={isSourcing || isDeepCrawling || !jd.trim()}
                className="w-full bg-white border border-slate-300 text-slate-700 py-3 rounded-lg font-bold hover:bg-slate-50 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSourcing ? 'Sourcing...' : <><CloudArrowUpIcon className="h-5 w-5" /> Quick Source (Brave)</>}
              </button>

              <button
                onClick={deepCrawlTalent}
                disabled={isDeepCrawling || isSourcing || !jd.trim()}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeepCrawling ? 'Deep Searching...' : <><SparklesIcon className="h-5 w-5" /> Deep Search</>}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <div className="flex border-b border-slate-200">
            <button onClick={() => setActiveTab('internal')} className={`px-6 py-3 font-bold text-sm relative ${activeTab === 'internal' ? 'text-black' : 'text-slate-400'}`}>
              Internal Matches ({internalMatches.length})
              {activeTab === 'internal' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />}
            </button>
            <button onClick={() => setActiveTab('sourced')} className={`px-6 py-3 font-bold text-sm relative ${activeTab === 'sourced' ? 'text-black' : 'text-slate-400'}`}>
              Sourced Queue ({sourcedQueue.length})
              {activeTab === 'sourced' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />}
            </button>
          </div>

          {activeTab === 'sourced' && (
            <div className="space-y-4">
              {selectedIds.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg flex items-center justify-between">
                  <span className="text-sm font-bold text-indigo-900">{selectedIds.length} Selected</span>
                  <div className="flex gap-2">
                    <button onClick={rejectCandidates} className="px-4 py-2 bg-white border text-red-600 text-xs font-bold rounded-md">Reject</button>
                    <button onClick={approveCandidates} className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-md">Approve to Pipeline</button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b">
                    <tr className="text-xs font-bold text-slate-500 uppercase">
                      <th className="px-4 py-4 w-10"></th>
                      <th className="px-4 py-4">Candidate</th>
                      <th className="px-4 py-4">Match Analysis</th>
                      <th className="px-4 py-4">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sourcedQueue.map(c => (
                      <tr key={c.id} className={`hover:bg-slate-50 transition cursor-pointer ${selectedIds.includes(c.id) ? 'bg-indigo-50/30' : ''}`} onClick={() => toggleSelect(c.id)}>
                        <td className="px-4 py-4"><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleSelect(c.id)} /></td>
                        <td className="px-4 py-4">
                          <div className="font-bold text-slate-900">{c.full_name}</div>
                          <div className="text-[11px] text-slate-500">{c.title}</div>
                          <div className="flex gap-2 mt-1">
                            {c.linkedin_url && <a href={c.linkedin_url} target="_blank" className="text-[10px] text-indigo-600 font-bold">LinkedIn</a>}
                            {c.portfolio_url && <a href={c.portfolio_url} target="_blank" className="text-[10px] text-pink-600 font-bold">Portfolio</a>}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                           <div className="text-xs font-bold text-slate-700">{c.match_score}% Match</div>
                           <div className="text-[11px] text-slate-400 mt-1 max-w-xs line-clamp-2">{c.match_reason}</div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${c.source === 'Cloudflare' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-500'}`}>{c.source}</span>
                        </td>
                      </tr>
                    ))}
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
