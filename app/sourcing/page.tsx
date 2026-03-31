'use client';

import { supabase } from '@/lib/supabaseClient';
import { logActivity } from '@/lib/logActivity';
import { useState, useEffect, useRef } from 'react';
import { BriefcaseIcon, CloudArrowUpIcon, TrashIcon, CheckCircleIcon, SparklesIcon } from '@heroicons/react/24/outline';

// Types
type Job = {
  id: string;
  title: string;
  description: string;
  location?: string;
  status?: string;
};

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
type DeepSearchDebug = {
  mode?: string;
  titleLine?: string;
  targetMarket?: string;
  queries?: string[];
  discoveryRuns?: any[];
  discovered?: string[];
  targets?: string[];
  extractedCount?: number;
  extracted?: any[];
  failedCount?: number;
  failed?: any[];
} | null;

export default function SourcingPage() {
  const [jd, setJd] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [internalMatches, setInternalMatches] = useState<Candidate[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sourcedQueue, setSourcedQueue] = useState<Candidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSourcing, setIsSourcing] = useState(false);
  const [isDeepCrawling, setIsDeepCrawling] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [activeTab, setActiveTab] = useState<'internal' | 'sourced'>('internal');
  const [sourcingAlert, setSourcingAlert] = useState<SourcingAlert>(null);
  const [deepSearchDebug, setDeepSearchDebug] = useState<DeepSearchDebug>(null);

  useEffect(() => {
    fetchSourcedQueue();
    fetchJobs();
  }, []);

  // Auto-match + reset when JD changes (debounced 600ms)
  useEffect(() => {
    setInternalMatches([]);
    if (!jd.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      findInternalMatches();
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [jd]);

  async function fetchJobs() {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, title, description, location, status')
      .eq('status', 'Open')
      .order('created_at', { ascending: false });
    if (data) setJobs(data);
    if (error) console.error('Error fetching jobs:', error);
  }

  function handleJobSelect(jobId: string) {
    setSelectedJobId(jobId);
    if (!jobId) return;
    const job = jobs.find(j => j.id === jobId);
    if (job?.description) setJd(job.description);
  }

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
    setDeepSearchDebug(null);
    setSelectedIds([]);
    try {
      const res = await fetch('/api/deep-crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setDeepSearchDebug(data.debug || null);
        setSourcingAlert({ type: 'error', message: data.error || 'Deep search failed.' });
      } else {
        setDeepSearchDebug(data.debug || null);
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
    setActiveTab('internal');

    const { data } = await supabase
      .from('candidates')
      .select('*')
      .not('pipeline_stage', 'eq', 'Rejected')
      .order('match_score', { ascending: false })
      .limit(100);

    if (data) {
      const jdLower = jd.toLowerCase();

      // --- Point 1: Extract meaningful technical terms only (strip filler words) ---
      const STOP_WORDS = new Set([
        'the','and','for','with','from','that','this','have','will','you','are','our','your',
        'their','they','them','its','has','been','not','but','can','all','any','more','into',
        'each','such','also','about','both','through','using','strong','ability','ensure',
        'experience','design','build','work','team','role','join','help','make','use',
        'key','new','well','part','end','set','get','how','way','who','what','when',
        'where','which','while','across','between','within','without','including','following',
        'required','preferred','minimum','years','least','most','other','these','those',
        'relevant','related','must','need','some','than','then','time','very','just','like',
        'over','after','before','should','would','could','collaborate','communicate','deliver',
        'drive','develop','implement','support','manage','lead','provide','create','maintain',
        'improve','analyze','monitor','operate','understand','knowledge','skills','tools',
        'systems','solutions','platform','service','product','data','environment',
        'infrastructure','engineering','software','technical','opportunity','company',
        'organization','business','customer','client','hands','proven','solid','deep',
        'working','building','operating','designing','scaling','high','large','modern',
        'production','real','batch','cost','debug','tune','performance','reliability',
      ]);

      const jdTerms = [...new Set(
        (jdLower.match(/\b[a-z][a-z0-9+#._-]{2,}\b/g) || [])
          .filter(w => !STOP_WORDS.has(w) && w.length >= 3)
      )];

      // --- Point 4: Extract seniority requirement from JD ---
      const seniorityMatch = jd.match(/(\d+)\+?\s*years?/i);
      const requiredYears = seniorityMatch ? parseInt(seniorityMatch[1]) : 0;

      // --- Point 2: Extract title keywords from first meaningful JD line ---
      const jdTitleLine = jd.split('\n').find(l => l.trim().length > 5)?.toLowerCase() || '';
      const titleKeywords = (jdTitleLine.match(/\b[a-z][a-z0-9+#]{2,}\b/g) || [])
        .filter(w => !STOP_WORDS.has(w));

      const scored = data
        .map(c => {
          // Build full candidate text from all relevant fields
          const candidateText = [
            c.title || '',
            c.brief || '',
            c.match_reason || '',
            c.lnkd_notes || '',
            c.resume_text || '',
            ...(Array.isArray(c.skills) ? c.skills : []),
            ...(Array.isArray(c.technologies) ? c.technologies.map((t: any) => t.name || t) : []),
            ...(Array.isArray(c.tools) ? c.tools.map((t: any) => t.name || t) : []),
            ...(Array.isArray(c.work_history)
              ? c.work_history.map((w: any) => `${w.title || ''} ${w.company || ''}`)
              : []),
          ].join(' ').toLowerCase();

          // Point 1: Technical term match score
          const termHits = jdTerms.filter(t => candidateText.includes(t)).length;
          const termScore = jdTerms.length > 0 ? (termHits / jdTerms.length) * 100 : 0;

          // Point 2: Title similarity bonus/penalty
          const candidateTitle = (c.title || '').toLowerCase();
          const titleHits = titleKeywords.filter(k => candidateTitle.includes(k)).length;
          let titleBonus = 0;
          if (titleKeywords.length > 0) {
            const ratio = titleHits / titleKeywords.length;
            if (ratio >= 0.4) titleBonus = 20;
            else if (ratio >= 0.2) titleBonus = 8;
            else titleBonus = -15; // completely unrelated title
          }

          // Point 4: Seniority penalty
          let seniorityPenalty = 0;
          const candidateYears = c.years_experience_total || 0;
          const isSeniorTitle = /senior|lead|principal|staff|head|manager|architect|director/i.test(c.title || '');
          if (requiredYears >= 5) {
            if (candidateYears > 0 && candidateYears < requiredYears) {
              seniorityPenalty = -25; // confirmed under-experienced
            } else if (candidateYears === 0 && !isSeniorTitle) {
              seniorityPenalty = -10; // no seniority signals
            }
          }

          const finalScore = Math.max(0, Math.min(100, Math.round(termScore + titleBonus + seniorityPenalty)));
          return { ...c, _jdScore: finalScore };
        })
        // Point 3: Hide anything below 10% — irrelevant results
        .filter(c => c._jdScore >= 10)
        .sort((a, b) => b._jdScore - a._jdScore)
        .slice(0, 20);

      setInternalMatches(scored);
    }
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

      {deepSearchDebug && (
        <div className="mb-6 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold">Deep Search Debug</h3>
              <p className="text-[11px] text-slate-400 mt-1">Use this to inspect discovery before changing backend logic again.</p>
            </div>
            <button onClick={() => setDeepSearchDebug(null)} className="text-slate-400 hover:text-white">×</button>
          </div>

          <div className="p-5 space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                <div className="text-slate-400 mb-1">Parsed Title</div>
                <div className="font-semibold text-slate-100 break-words">{deepSearchDebug.titleLine || '—'}</div>
              </div>
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                <div className="text-slate-400 mb-1">Target Market</div>
                <div className="font-semibold text-slate-100">{deepSearchDebug.targetMarket || '—'}</div>
              </div>
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                <div className="text-slate-400 mb-1">Discovery Count</div>
                <div className="font-semibold text-slate-100">{deepSearchDebug.discovered?.length || 0}</div>
              </div>
            </div>

            <div>
              <div className="text-slate-300 font-semibold mb-2">Queries</div>
              <div className="space-y-2">
                {(deepSearchDebug.queries || []).map((query, index) => (
                  <div key={index} className="bg-slate-950 rounded-lg p-3 border border-slate-800 break-words text-slate-200">
                    {query}
                  </div>
                ))}
              </div>
            </div>

            {!!deepSearchDebug.discoveryRuns?.length && (
              <div>
                <div className="text-slate-300 font-semibold mb-2">Discovery Runs</div>
                <div className="max-h-[32rem] overflow-auto space-y-3 pr-1">
                  {deepSearchDebug.discoveryRuns.map((run, index) => (
                    <div key={index} className="bg-slate-950 rounded-lg p-3 border border-slate-800 text-slate-300">
                      <div className="mb-2 break-words"><span className="text-slate-500">Query:</span> {run.query}</div>
                      <div className="mb-2"><span className="text-slate-500">HTTP:</span> {run.status} · <span className="text-slate-500">Raw:</span> {run.rawCount} · <span className="text-slate-500">Filtered:</span> {run.filteredUrls?.length || 0}</div>
                      {!!run.rawUrls?.length && (
                        <div className="space-y-2 mt-3">
                          <div className="text-slate-400">Raw Brave Results</div>
                          {run.rawUrls.slice(0, 10).map((item: any, i: number) => (
                            <div key={i} className="border border-slate-800 rounded p-2">
                              <div className="text-slate-200">{item.title || 'Untitled'}</div>
                              <div className="text-indigo-300 break-all">{item.url}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="text-slate-300 font-semibold mb-2">Discovered URLs</div>
              <div className="max-h-72 overflow-auto space-y-2 pr-1">
                {(deepSearchDebug.discovered || []).length > 0 ? (
                  (deepSearchDebug.discovered || []).map((url, index) => (
                    <a
                      key={index}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-slate-950 rounded-lg p-3 border border-slate-800 break-all text-indigo-300 hover:text-indigo-200 hover:border-slate-700 transition"
                    >
                      {url}
                    </a>
                  ))
                ) : (
                  <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 text-slate-500">No URLs discovered.</div>
                )}
              </div>
            </div>

            {!!deepSearchDebug.extracted?.length && (
              <div>
                <div className="text-slate-300 font-semibold mb-2">Raw Extraction Results</div>
                <div className="max-h-[32rem] overflow-auto space-y-3 pr-1">
                  {deepSearchDebug.extracted.map((item, index) => (
                    <div key={index} className="bg-slate-950 rounded-lg p-3 border border-slate-800 text-slate-300">
                      <div className="mb-2 break-all">
                        <span className="text-slate-500">URL:</span> {item.url}
                      </div>
                      <pre className="text-[11px] leading-5 whitespace-pre-wrap break-words text-slate-200">{JSON.stringify(item.candidate, null, 2)}</pre>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!!deepSearchDebug.failed?.length && (
              <div>
                <div className="text-slate-300 font-semibold mb-2">Failures</div>
                <div className="max-h-56 overflow-auto space-y-2 pr-1">
                  {deepSearchDebug.failed.map((item, index) => (
                    <div key={index} className="bg-slate-950 rounded-lg p-3 border border-slate-800 text-slate-300">
                      <div><span className="text-slate-500">Phase:</span> {item.phase || 'unknown'}</div>
                      <div className="break-all"><span className="text-slate-500">URL:</span> {item.url || '—'}</div>
                      <div className="break-all"><span className="text-slate-500">Error:</span> {typeof item.error === 'string' ? item.error : JSON.stringify(item.error)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
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
              placeholder="Paste JD here or select a job below..."
              value={jd}
              onChange={(e) => setJd(e.target.value)}
            />

            {/* Job selector */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                Load from Saved Jobs
              </label>
              <div className="relative">
                <select
                  value={selectedJobId}
                  onChange={(e) => handleJobSelect(e.target.value)}
                  className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-700 font-medium focus:ring-2 focus:ring-black outline-none cursor-pointer pr-8 shadow-sm"
                >
                  <option value="">— Select a job —</option>
                  {jobs.map(job => (
                    <option key={job.id} value={job.id}>
                      {job.title}{job.location ? ` · ${job.location}` : ''}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
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

          {activeTab === 'internal' && (
            <div className="space-y-4">
              {internalMatches.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
                  <p className="text-slate-400 text-sm">
                    {isMatching ? 'Matching against internal candidates...' : 'Paste a JD and click "Match Internal Talent" to find matches.'}
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b">
                      <tr className="text-xs font-bold text-slate-500 uppercase">
                        <th className="px-4 py-4">Candidate</th>
                        <th className="px-4 py-4">JD Fit</th>
                        <th className="px-4 py-4">Stage</th>
                        <th className="px-4 py-4">Links</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {internalMatches.map((c: any) => (
                        <tr key={c.id} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-4">
                            <div className="font-bold text-slate-900">{c.full_name}</div>
                            <div className="text-[11px] text-slate-500">{c.title}</div>
                            <div className="text-[11px] text-slate-400">{c.location}</div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${c._jdScore}%`,
                                    backgroundColor: c._jdScore >= 60 ? '#22c55e' : c._jdScore >= 30 ? '#f59e0b' : '#e2e8f0'
                                  }}
                                />
                              </div>
                              <span className="text-xs font-bold text-slate-700">{c._jdScore}%</span>
                            </div>
                            {c.match_reason && (
                              <div className="text-[10px] text-slate-400 mt-1 max-w-xs line-clamp-2">{c.match_reason}</div>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-100 text-slate-600 border-slate-200">
                              {c.pipeline_stage || c.status || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex gap-2">
                              {c.linkedin_url && (
                                <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-600 font-bold hover:underline">LinkedIn</a>
                              )}
                              {c.portfolio_url && (
                                <a href={c.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-pink-600 font-bold hover:underline">Portfolio</a>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

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
