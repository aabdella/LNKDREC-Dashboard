'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useParams } from 'next/navigation';
import CandidateDetailsModal from '@/components/CandidateDetailsModal';
import { 
  ArrowLeftIcon,
  MapPinIcon,
  BriefcaseIcon,
  UserIcon,
  DocumentArrowDownIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { Candidate } from '@/components/CandidateDetailsModal';

type Job = {
  id: string;
  client_id: string;
  title: string;
  location: string;
  status: string;
  description: string;
  total_openings: number;
  remaining_openings: number;
  clients?: { name: string; industry: string } | { name: string; industry: string }[];
};

// ─── CV EXPORT MODAL ──────────────────────────────────────────────────────────

function CVExportModal({
  candidate,
  onClose,
}: {
  candidate: Candidate;
  onClose: () => void;
}) {
  const [selectedTemplate, setSelectedTemplate] = useState<'A' | 'B'>('A');
  const [privacy, setPrivacy] = useState({
    linkedin: true,
    portfolio: true,
    email: false,
    phone: false,
  });
  const [generating, setGenerating] = useState(false);
  const [vetting, setVetting] = useState<Record<string, any> | null>(null);
  const [egpRate, setEgpRate] = useState<number>(47);
  const [editableMatchReason, setEditableMatchReason] = useState<string>(candidate.match_reason || '');

  useEffect(() => {
    async function fetchRate() {
      try {
        const cached = localStorage.getItem('lnkd_egp_rate');
        const now = Date.now();
        if (cached) {
          const { rate, ts } = JSON.parse(cached);
          if (now - ts < 24 * 60 * 60 * 1000) {
            setEgpRate(rate);
            return;
          }
        }
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await res.json();
        const rate = data.rates?.EGP;
        if (rate && typeof rate === 'number') {
          setEgpRate(rate);
          localStorage.setItem('lnkd_egp_rate', JSON.stringify({ rate, ts: now }));
        }
      } catch { }
    }
    fetchRate();
  }, []);

  useEffect(() => {
    async function fetchVetting() {
      if (!candidate.id) return;
      const { data } = await supabase
        .from('vettings')
        .select('*')
        .eq('candidate_id', candidate.id)
        .order('vetted_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) setVetting(data[0]);
    }
    fetchVetting();
  }, [candidate.id]);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const { CVTemplateA, CVTemplateB } = await import('@/app/cv-templates');
      let logoBase64 = '';
      try {
        const res = await fetch('/logo.jpg');
        const blob = await res.blob();
        logoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch { }
      const doc = selectedTemplate === 'A' ? (
          <CVTemplateA candidate={{ ...candidate, match_reason: editableMatchReason }} privacy={privacy} logoBase64={logoBase64} vetting={vetting} egpRate={egpRate} />
        ) : (
          <CVTemplateB candidate={{ ...candidate, match_reason: editableMatchReason }} privacy={privacy} logoBase64={logoBase64} vetting={vetting} egpRate={egpRate} />
        );
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${candidate.full_name.replace(/[ ]+/g, '_')}_CV.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Error generating PDF.');
    }
    setGenerating(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10 rounded-t-2xl">
          <div><h2 className="text-xl font-bold text-slate-900">Generate CV</h2><p className="text-sm text-slate-500">{candidate.full_name} — {candidate.title}</p></div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition"><XMarkIcon className="h-6 w-6 text-slate-500" /></button>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Template</label>
            <div className="flex gap-3">
              {(['A', 'B'] as const).map(t => (
                <button key={t} onClick={() => setSelectedTemplate(t)}
                  className={"flex-1 py-3 rounded-xl border-2 font-semibold text-sm transition " + (selectedTemplate === t ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500 hover:border-slate-300")}>
                  Template {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Match Reason</label>
            <textarea value={editableMatchReason} onChange={e => setEditableMatchReason(e.target.value)} rows={3}
              className="w-full text-sm border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Privacy</label>
            <div className="grid grid-cols-2 gap-2">
              {([['linkedin','Show LinkedIn'],['portfolio','Show Portfolio'],['email','Show Email'],['phone','Show Phone']] as [keyof typeof privacy, string][]).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={privacy[key]} onChange={e => setPrivacy(p => ({ ...p, [key]: e.target.checked }))} className="rounded border-slate-300" />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">USD to EGP Rate</label>
            <input type="number" value={egpRate} onChange={e => setEgpRate(Number(e.target.value))}
              className="w-32 text-sm border border-slate-200 rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition" />
          </div>
          <button onClick={handleDownload} disabled={generating}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold rounded-xl transition flex items-center justify-center gap-2">
            {generating ? <span className="animate-pulse">Generating PDF...</span> : <><DocumentArrowDownIcon className="h-5 w-5" /> Download CV PDF</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function JobDetailPage() {
  const params = useParams();
  const rawId = params?.id;
  const jobId = Array.isArray(rawId) ? rawId[0] : (rawId as string | undefined);

  const [job, setJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [cvCandidate, setCvCandidate] = useState<Candidate | null>(null);
  const [showDescription, setShowDescription] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<'full_name' | 'years_experience_total'>('full_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [loadingCandidateId, setLoadingCandidateId] = useState<string | null>(null);

  useEffect(() => { if (jobId) { fetchJob(); fetchCandidates(); } }, [jobId]);

  async function fetchJob() {
    const { data, error } = await supabase.from('jobs').select('*, clients(name, industry)').eq('id', jobId).single();
    console.error('[JobDetail] fetchJob error:', JSON.stringify(error));
    if (data) setJob(data as Job);
  }

  async function fetchCandidates() {
    setLoading(true);
    const { data, error } = await supabase
      .from('applications')
      .select('candidate_id, candidates(id, full_name, title, location, years_experience_total, status, pipeline_stage, match_score, match_reason, technologies, tools, email, phone, resume_url, resume_text)')
      .eq('job_id', jobId);
    console.error('[JobDetail] fetchCandidates error:', JSON.stringify(error));
    if (data) setCandidates(data.map((d: any) => ({ ...d.candidates, _pipeline_stage: d.pipeline_stage })).filter((c: any) => c));
    setLoading(false);
  }

  function toggleSelect(id: string) { const next = new Set(selectedIds); next.has(id) ? next.delete(id) : next.add(id); setSelectedIds(next); }
  function toggleSelectAll() { selectedIds.size === sortedCandidates.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(sortedCandidates.map((c: any) => c.id))); }
  function clearSelection() { setSelectedIds(new Set()); }
  function handleSort(field: 'full_name' | 'years_experience_total') { if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField(field); setSortDir('asc'); } }

  const sortedCandidates = [...candidates].sort((a: any, b: any) => {
    let va = a[sortField], vb = b[sortField];
    if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
    return (va < vb ? -1 : va > vb ? 1 : 0) * (sortDir === 'asc' ? 1 : -1);
  });

  function getTopTechTools(c: any): string[] { return [...(c.technologies || []), ...(c.tools || [])].map((t: any) => typeof t === 'string' ? t : t?.name).filter(Boolean).slice(0, 4); }
  function getClientName(clients?: Job['clients']) { return Array.isArray(clients) ? clients[0]?.name : (clients as any)?.name; }
  function getClientIndustry(clients?: Job['clients']) { return Array.isArray(clients) ? clients[0]?.industry : (clients as any)?.industry; }

  async function openCandidateDetails(candidate: any) {
    setLoadingCandidateId(candidate.id);
    const { data } = await supabase.from('candidates').select('*').eq('id', candidate.id).single();
    if (data) setSelectedCandidate(data as Candidate);
    setLoadingCandidateId(null);
  }

  async function openCvModal(candidate: any) {
    const { data } = await supabase.from('candidates').select('*').eq('id', candidate.id).single();
    if (data) setCvCandidate(data as Candidate);
  }

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-12 text-center"><div className="animate-pulse text-slate-400">Loading...</div></div>;
  if (!job) return <div className="max-w-6xl mx-auto px-4 py-12 text-center"><p className="text-slate-500 mb-4">Job not found.</p><Link href="/jobs" className="text-black font-semibold hover:underline">← Back to Jobs</Link></div>;

  const hiredCount = (job.total_openings || 1) - (job.remaining_openings || 0);
  const descLines = (job.description || '').split('\n');

  return (
    <>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Link href="/jobs" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-black mb-6 transition">
          <ArrowLeftIcon className="h-4 w-4" /> Back to Jobs
        </Link>

        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-slate-900">{job.title}</h1>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  job.status?.toLowerCase() === 'open' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {job.status}
                </span>
              </div>
              <p className="text-slate-500 font-medium">{getClientName(job.clients)}</p>
              <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                <span className="flex items-center gap-1"><MapPinIcon className="h-4 w-4" />{job.location}</span>
                <span className="flex items-center gap-1"><BriefcaseIcon className="h-4 w-4" />{getClientIndustry(job.clients)}</span>
                <span className="flex items-center gap-1">
                  <UserIcon className="h-4 w-4" />
                  {hiredCount} of {job.total_openings || 1} filled
                </span>
              </div>
            </div>
          </div>

          {job.description && (
            <div className="border-t border-slate-100 pt-4">
              <button
                onClick={() => setShowDescription(d => !d)}
                className="text-sm font-semibold text-slate-700 mb-2 hover:text-black transition">
                {showDescription ? '▼' : '▶'} Job Description
              </button>
              <div className={`text-sm text-slate-600 leading-relaxed ${!showDescription && descLines.length > 2 ? 'line-clamp-2' : ''}`}>
                {job.description}
              </div>
              {descLines.length > 2 && !showDescription && (
                <button onClick={() => setShowDescription(true)} className="text-xs text-slate-400 hover:text-black mt-1 transition">
                  Show more
                </button>
              )}
            </div>
          )}
        </div>

        {/* Candidate Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">
              Candidates <span className="text-slate-400 font-normal">({candidates.length})</span>
            </h2>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">{selectedIds.size} selected</span>
                <button onClick={() => { const sel = candidates.filter((c) => selectedIds.has(c.id)); if (sel[0]) openCvModal(sel[0]); }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5">
                  <DocumentArrowDownIcon className="h-3.5 w-3.5" /> Generate CV
                </button>
                <button onClick={clearSelection} className="text-xs text-slate-400 hover:text-slate-600 transition">Clear</button>
              </div>
            )}
          </div>

          {candidates.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-400">
              No candidates assigned to this job yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-4 py-3">
                      <input type="checkbox" checked={selectedIds.size === sortedCandidates.length} onChange={toggleSelectAll} className="rounded border-slate-300" />
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-black select-none" onClick={() => handleSort('full_name')}>
                      Name {sortField === 'full_name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Job Title</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-black select-none" onClick={() => handleSort('years_experience_total')}>
                      Yrs Exp {sortField === 'years_experience_total' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Tech / Tools</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCandidates.map((candidate) => {
                    const topTech = getTopTechTools(candidate);
                    const isSelected = selectedIds.has(candidate.id);
                    return (
                      <tr key={candidate.id} className={`border-b border-slate-50 hover:bg-slate-50/50 transition ${isSelected ? 'bg-indigo-50/40' : ''}`}>
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(candidate.id)} className="rounded border-slate-300" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-sm text-slate-900">{candidate.full_name}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-slate-600">{candidate.title || '—'}</div>
                          <div className="text-xs text-slate-400">{candidate.location || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {candidate.years_experience_total || 0}+ yrs
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {topTech.length > 0 ? topTech.map((tech, i) => (
                              <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">{tech}</span>
                            )) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openCvModal(candidate)}
                              className="text-xs font-semibold text-slate-400 hover:text-indigo-600 transition"
                              title="Generate CV">
                              <DocumentArrowDownIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openCandidateDetails(candidate)}
                              className="text-xs font-semibold text-slate-500 hover:text-black transition disabled:opacity-50"
                              disabled={loadingCandidateId === candidate.id}>
                              {loadingCandidateId === candidate.id ? '...' : 'Details'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedCandidate && (
        <CandidateDetailsModal
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          onUpdate={fetchCandidates}
        />
      )}

      {cvCandidate && (
        <CVExportModal
          candidate={cvCandidate}
          onClose={() => setCvCandidate(null)}
        />
      )}
    </>
  );
}
