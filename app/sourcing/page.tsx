'use client';

import { supabase } from '@/lib/supabaseClient';
import { logActivity } from '@/lib/logActivity';
import { useState, useEffect, useRef, useCallback } from 'react';
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
type MatchDebug = {
  extractedTitle: string;
  titleKeywords: string[];
  extractedFrom: 'label' | 'fallback-line' | 'none';
  jdTermsCount: number;
} | null;
type QuickSourceDebug = {
  parsedTitle?: string;
  keywordSets?: string[][];
  topSkills?: string[];
  detectedCompanies?: string[];
  marketKw?: string[];
  totalDiscovered?: number;
  inserted?: number;
} | null;
type DeepSearchDebug = {
  mode?: string;
  parsedTitle?: string;
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
  const jdRef = useRef('');
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
  const [matchDebug, setMatchDebug] = useState<MatchDebug>(null);
  const [quickSourceDebug, setQuickSourceDebug] = useState<QuickSourceDebug>(null);
  const [deepSearchDebug, setDeepSearchDebug] = useState<DeepSearchDebug>(null);

  useEffect(() => {
    fetchSourcedQueue();
    fetchJobs();
  }, []);

  // Auto-match + reset when JD changes (debounced 600ms)
  // Store latest jd in ref to avoid stale closure in setTimeout
  useEffect(() => {
    jdRef.current = jd;
    setInternalMatches([]);
    if (!jd.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runMatching(jdRef.current);
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
    setQuickSourceDebug(null);
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
        setQuickSourceDebug(data.debug || null);
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

  async function runMatching(jdText: string) {
    if (!jdText.trim()) return;

    // ── Reset all matching state before every run ──────────────────────────
    setIsMatching(true);
    setInternalMatches([]);
    setMatchDebug(null);
    setActiveTab('internal');

    const { data } = await supabase
      .from('candidates')
      .select('*')
      .not('pipeline_stage', 'eq', 'Rejected')
      .limit(200);

    if (data) {
      // ── 1. Build stop-word set ────────────────────────────────────────────
      const STOP_WORDS = new Set([
        'the','and','for','with','from','that','this','have','will','you','are','our','your',
        'their','they','them','its','has','been','not','but','can','all','any','more','into',
        'each','such','also','about','both','through','using','strong','ability','ensure',
        'experience','build','work','team','role','join','help','make','use',
        'key','new','well','part','end','set','get','how','way','who','what','when',
        'where','which','while','across','between','within','without','including','following',
        'required','preferred','minimum','years','least','most','other','these','those',
        'relevant','related','must','need','some','than','then','time','very','just','like',
        'over','after','before','should','would','could','collaborate','communicate','deliver',
        'drive','develop','implement','support','manage','lead','provide','create','maintain',
        'improve','analyze','monitor','operate','understand','knowledge',
        'systems','solutions','platform','service','product','data','environment',
        'infrastructure','engineering','technical','opportunity','company',
        'organization','business','customer','client','hands','proven','solid','deep',
        'building','operating','scaling','high','large','modern',
        'production','real','batch','cost','debug','tune','performance','reliability',
        'summary','seeking','description','responsibilities','qualifications','about',
        'overview','duties','purpose',
      ]);

      const TITLE_STOP = new Set([
        ...STOP_WORDS,
        'job','title','position','role','remote','location','onsite','hybrid',
        'full','time','contract','freelance','permanent',
      ]);

      const jdLower = jdText.toLowerCase();

      // ── 2. Extract JD role title ──────────────────────────────────────────
      let extractedTitleLine = '';
      let extractedFrom: 'label' | 'fallback-line' | 'none' = 'none';
      const lines = jdText.split('\n').map(l => l.trim()).filter(Boolean);

      // Pass 1: explicit label — "Job Title:", "Position:", "Role:", "Title:"
      for (const line of lines) {
        const labelMatch = line.match(/^(?:job\s*title|position|role|title)\s*[:\-–|]\s*(.+)/i);
        if (labelMatch) {
          extractedTitleLine = labelMatch[1].trim();
          extractedFrom = 'label';
          break;
        }
      }

      // Pass 2: fallback — first non-header line with ≥2 meaningful words
      // FIX: raised length cap from 80 → 150 to catch "We are seeking a Senior Graphic Designer..."
      if (!extractedTitleLine) {
        for (const line of lines) {
          const isHeader = /^(role summary|about|overview|summary|responsibilities|requirements|qualifications|duties|purpose)\s*[:\-–]?$/i.test(line);
          const words = (line.match(/\b[a-z][a-z0-9+#]{2,}\b/gi) || []).filter(w => !TITLE_STOP.has(w.toLowerCase()));
          if (!isHeader && words.length >= 2 && line.length <= 150) {
            extractedTitleLine = line;
            extractedFrom = 'fallback-line';
            break;
          }
        }
      }

      const cleanedTitleLine = extractedTitleLine.toLowerCase().trim();
      const titleKeywords = (cleanedTitleLine.match(/\b[a-z][a-z0-9+#]{2,}\b/g) || [])
        .filter(w => !TITLE_STOP.has(w));

      // ── 3. Build JD keyword terms (boost signals) ─────────────────────────
      const jdTerms = [...new Set(
        (jdLower.match(/\b[a-z][a-z0-9+#._-]{2,}\b/g) || [])
          .filter(w => !STOP_WORDS.has(w) && w.length >= 3)
      )];

      // ── 4. Seniority requirement ──────────────────────────────────────────
      const seniorityMatch = jdText.match(/(\d+)\+?\s*years?/i);
      const requiredYears = seniorityMatch ? parseInt(seniorityMatch[1]) : 0;

      // ── Set debug info for UI ─────────────────────────────────────────────
      setMatchDebug({
        extractedTitle: extractedTitleLine || '(none)',
        titleKeywords,
        extractedFrom,
        jdTermsCount: jdTerms.length,
      });

      console.log('[Matching] Extracted JD title line:', extractedTitleLine, `(via ${extractedFrom})`);
      console.log('[Matching] Title keywords:', titleKeywords);
      console.log('[Matching] JD terms count:', jdTerms.length, jdTerms.slice(0, 20));

      // ── 5. Score each candidate ───────────────────────────────────────────
      const scored = data
        .map(c => {
          const candidateTitle = (c.title || '').toLowerCase().trim();

          // ── Component A: Job Title Match (PRIMARY — 65%) ──────────────────
          let titleScore = 0;
          if (titleKeywords.length > 0 && candidateTitle) {
            const hits = titleKeywords.filter(k => candidateTitle.includes(k)).length;
            const keywordRatio = hits / titleKeywords.length;
            const exactPhrase = cleanedTitleLine.replace(/\s+/g, ' ');
            const exactBonus = candidateTitle.includes(exactPhrase) ? 20 : 0;
            titleScore = Math.min(100, Math.round(keywordRatio * 100) + exactBonus);
          }

          // ── Component B: JD Keyword / Skill Match (BOOST — 35%) ──────────
          const weightedFields: { text: string; weight: number }[] = [
            { text: candidateTitle, weight: 4 },
            { text: (Array.isArray(c.skills) ? c.skills.join(' ') : ''), weight: 3 },
            { text: (Array.isArray(c.technologies) ? c.technologies.map((t: any) => t.name || t).join(' ') : ''), weight: 3 },
            { text: (Array.isArray(c.tools) ? c.tools.map((t: any) => t.name || t).join(' ') : ''), weight: 3 },
            { text: c.brief || '', weight: 2 },
            { text: c.match_reason || '', weight: 2 },
            { text: (Array.isArray(c.work_history) ? c.work_history.map((w: any) => `${w.title || ''} ${w.company || ''}`).join(' ') : ''), weight: 2 },
            { text: c.lnkd_notes || '', weight: 1 },
            { text: c.resume_text || '', weight: 1 },
          ];
          const weightedText = weightedFields
            .map(f => Array(f.weight).fill(f.text.toLowerCase()).join(' '))
            .join(' ');
          const termHits = jdTerms.filter(t => weightedText.includes(t)).length;
          const termScore = jdTerms.length > 0 ? Math.round((termHits / jdTerms.length) * 100) : 0;

          // ── Blend: 65% title + 35% keyword boost ─────────────────────────
          let blendedScore = Math.round((titleScore * 0.65) + (termScore * 0.35));

          // FIX: Strong title match (≥90) should not be dragged below 85 by missing skill data.
          // Candidates whose title exactly matches the JD role must rank near the top regardless
          // of whether their skills/tools fields are populated in the DB.
          if (titleScore >= 90) {
            blendedScore = Math.max(blendedScore, 85);
          } else if (titleScore >= 70) {
            blendedScore = Math.max(blendedScore, 60);
          }

          // ── Seniority adjustment ──────────────────────────────────────────
          let seniorityPenalty = 0;
          const candidateYears = c.years_experience_total || 0;
          const isSeniorTitle = /senior|lead|principal|staff|head|manager|architect|director/i.test(candidateTitle);
          if (requiredYears >= 5) {
            if (candidateYears > 0 && candidateYears < requiredYears) seniorityPenalty = -15;
            else if (candidateYears === 0 && !isSeniorTitle) seniorityPenalty = -8;
          }

          const finalScore = Math.max(0, Math.min(100, blendedScore + seniorityPenalty));

          console.log(`[Match] ${c.full_name} | jobTitle="${c.title}" | titleScore=${titleScore} | termScore=${termScore} | blended=${blendedScore} | final=${finalScore}`);

          return { ...c, _jdScore: finalScore, _titleScore: titleScore, _termScore: termScore };
        })
        .filter(c => c._jdScore >= 10)
        .sort((a, b) => b._jdScore - a._jdScore)
        .slice(0, 20);

      setInternalMatches(scored);
    }

    setIsMatching(false);
  }

  async function findInternalMatches() {
    runMatching(jdRef.current || jd);
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

      {matchDebug && (
        <div className="mb-6 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold">🎯 Internal Match Debug</h3>
              <p className="text-[11px] text-slate-400 mt-1">What the matching engine parsed from the JD — validate this before investigating scores.</p>
            </div>
            <button onClick={() => setMatchDebug(null)} className="text-slate-400 hover:text-white text-lg leading-none">×</button>
          </div>
          <div className="p-5 space-y-3 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2 bg-slate-950 rounded-lg p-3 border border-slate-800">
                <div className="text-slate-400 mb-1">Extracted Job Title</div>
                <div className={`font-semibold break-words text-sm ${matchDebug.extractedTitle && matchDebug.extractedTitle !== '(none)' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {matchDebug.extractedTitle || '⚠ Nothing extracted — scores will be near zero'}
                </div>
              </div>
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                <div className="text-slate-400 mb-1">Extracted Via</div>
                <div className={`font-semibold ${matchDebug.extractedFrom === 'label' ? 'text-emerald-400' : matchDebug.extractedFrom === 'fallback-line' ? 'text-amber-400' : 'text-red-400'}`}>
                  {matchDebug.extractedFrom === 'label' ? '✅ Explicit label' : matchDebug.extractedFrom === 'fallback-line' ? '⚠ Fallback line' : '❌ Not found'}
                </div>
              </div>
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                <div className="text-slate-400 mb-1">JD Keyword Terms</div>
                <div className="font-semibold text-slate-100">{matchDebug.jdTermsCount}</div>
              </div>
            </div>
            {matchDebug.titleKeywords.length > 0 && (
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                <div className="text-slate-400 mb-2">Title Keywords Used for Scoring</div>
                <div className="flex flex-wrap gap-1.5">
                  {matchDebug.titleKeywords.map((kw, i) => (
                    <span key={i} className="bg-emerald-900/50 text-emerald-200 border border-emerald-700/50 rounded px-2 py-0.5 text-[11px] font-medium">{kw}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {quickSourceDebug && (
        <div className="mb-6 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold">⚡ Quick Source Debug</h3>
              <p className="text-[11px] text-slate-400 mt-1">Parsed title + keyword sets used for this Brave search run.</p>
            </div>
            <button onClick={() => setQuickSourceDebug(null)} className="text-slate-400 hover:text-white text-lg leading-none">×</button>
          </div>
          <div className="p-5 space-y-4 text-xs">
            {/* Parsed title + stats row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                <div className="text-slate-400 mb-1">Parsed Job Title</div>
                <div className={`font-semibold break-words ${quickSourceDebug.parsedTitle ? 'text-emerald-400' : 'text-red-400'}`}>
                  {quickSourceDebug.parsedTitle || '⚠ Not detected — fallback used'}
                </div>
              </div>
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                <div className="text-slate-400 mb-1">Profiles Discovered</div>
                <div className="font-semibold text-slate-100">{quickSourceDebug.totalDiscovered ?? '—'}</div>
              </div>
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                <div className="text-slate-400 mb-1">Inserted to Queue</div>
                <div className="font-semibold text-slate-100">{quickSourceDebug.inserted ?? '—'}</div>
              </div>
            </div>
            {/* Skills + companies row */}
            {(!!quickSourceDebug.topSkills?.length || !!quickSourceDebug.detectedCompanies?.length || !!quickSourceDebug.marketKw?.length) && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                  <div className="text-slate-400 mb-2">Skills Extracted from JD</div>
                  <div className="flex flex-wrap gap-1.5">
                    {quickSourceDebug.topSkills?.length
                      ? quickSourceDebug.topSkills.map((s, i) => (
                          <span key={i} className="bg-blue-900/50 text-blue-200 border border-blue-700/50 rounded px-2 py-0.5 text-[11px] font-medium">{s}</span>
                        ))
                      : <span className="text-slate-500">None detected</span>}
                  </div>
                </div>
                <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                  <div className="text-slate-400 mb-2">Companies Detected</div>
                  <div className="flex flex-wrap gap-1.5">
                    {quickSourceDebug.detectedCompanies?.length
                      ? quickSourceDebug.detectedCompanies.map((c, i) => (
                          <span key={i} className="bg-amber-900/50 text-amber-200 border border-amber-700/50 rounded px-2 py-0.5 text-[11px] font-medium">{c}</span>
                        ))
                      : <span className="text-slate-500">None detected</span>}
                  </div>
                </div>
                <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                  <div className="text-slate-400 mb-2">Market Signals</div>
                  <div className="flex flex-wrap gap-1.5">
                    {quickSourceDebug.marketKw?.length
                      ? quickSourceDebug.marketKw.map((m, i) => (
                          <span key={i} className="bg-emerald-900/50 text-emerald-200 border border-emerald-700/50 rounded px-2 py-0.5 text-[11px] font-medium">{m}</span>
                        ))
                      : <span className="text-slate-500">Egypt (default)</span>}
                  </div>
                </div>
              </div>
            )}
            {/* Keyword sets */}
            {!!quickSourceDebug.keywordSets?.length && (
              <div>
                <div className="text-slate-300 font-semibold mb-2">Keyword Sets ({quickSourceDebug.keywordSets.length})</div>
                <div className="space-y-2">
                  {quickSourceDebug.keywordSets.map((set, i) => (
                    <div key={i} className="bg-slate-950 rounded-lg p-3 border border-slate-800 flex items-start gap-3">
                      <span className="text-slate-500 font-mono w-5 shrink-0">#{i + 1}</span>
                      <div className="flex flex-wrap gap-2">
                        {set.map((kw, j) => (
                          <span key={j} className="bg-indigo-900/50 text-indigo-200 border border-indigo-700/50 rounded px-2 py-0.5 text-[11px] font-medium">{kw}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                <div className="text-slate-400 mb-1">Parsed Job Title</div>
                <div className={`font-semibold break-words ${deepSearchDebug.parsedTitle ? 'text-emerald-400' : 'text-red-400'}`}>
                  {deepSearchDebug.parsedTitle || '⚠ Not detected'}
                </div>
              </div>
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                <div className="text-slate-400 mb-1">Title Used in Query</div>
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
                            <div className="flex gap-2 mt-1">
                              <span className="text-[10px] text-slate-400">Title <span className="font-bold text-slate-600">{c._titleScore ?? '—'}%</span></span>
                              <span className="text-[10px] text-slate-300">·</span>
                              <span className="text-[10px] text-slate-400">KW <span className="font-bold text-slate-600">{c._termScore ?? '—'}%</span></span>
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
