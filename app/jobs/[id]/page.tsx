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
  UserIcon
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

export default function JobDetailPage() {
  const params = useParams();
  const rawId = params?.id;
  const jobId = Array.isArray(rawId) ? rawId[0] : (rawId as string | undefined);

  const [job, setJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [showDescription, setShowDescription] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<'full_name' | 'years_experience_total' | 'match_score'>('match_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (!jobId) return;
    fetchJob();
    fetchCandidates();
  }, [jobId]);

  async function fetchJob() {
    const { data, error } = await supabase
      .from('jobs')
      .select('*, clients(name, industry)')
      .eq('id', jobId)
      .single();
    console.error('[JobDetail] fetchJob error:', JSON.stringify(error));
    if (data) setJob(data as Job);
  }

  async function fetchCandidates() {
    setLoading(true);
    const { data, error } = await supabase
      .from('applications')
      .select('candidate_id, candidates(id, full_name, title, location, years_experience_total, status, pipeline_stage, match_score, match_reason, technologies, tools, email, phone)')
      .eq('job_id', jobId);
    console.error('[JobDetail] fetchCandidates error:', JSON.stringify(error));

    if (data) {
      const formatted = data
        .map((d: any) => ({
          ...d.candidates,
          _pipeline_stage: d.pipeline_stage,
        }))
        .filter((c: any) => c);
      setCandidates(formatted);
    }
    setLoading(false);
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function toggleSelectAll() {
    if (selectedIds.size === sortedCandidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedCandidates.map((c: any) => c.id)));
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function handleSort(field: 'full_name' | 'years_experience_total' | 'match_score') {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  const sortedCandidates = [...candidates].sort((a: any, b: any) => {
    let va = a[sortField];
    let vb = b[sortField];
    if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  function getTopTechTools(candidate: any): string[] {
    const tech = candidate.technologies || [];
    const tools = candidate.tools || [];
    return [...tech, ...tools]
      .map((t: any) => typeof t === 'string' ? t : t?.name)
      .filter(Boolean)
      .slice(0, 4);
  }

  function getClientName(clients?: Job['clients']) {
    if (!clients) return undefined;
    return Array.isArray(clients) ? clients[0]?.name : (clients as any).name;
  }

  function getClientIndustry(clients?: Job['clients']) {
    if (!clients) return undefined;
    return Array.isArray(clients) ? clients[0]?.industry : (clients as any).industry;
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center">
        <div className="animate-pulse text-slate-400">Loading job details...</div>
        {jobId && <div className="mt-4 text-xs text-slate-400 break-all">JobID: {jobId}</div>}
      </div>
    );
  }

  if (!job) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center">
        <p className="text-slate-500 mb-4">Job not found.</p>
        <Link href="/jobs" className="text-black font-semibold hover:underline">← Back to Jobs</Link>
      </div>
    );
  }

  const hiredCount = (job.total_openings || 1) - (job.remaining_openings || 0);
  const descLines = (job.description || '').split('\n');

  return (
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
              className="text-sm font-semibold text-slate-700 mb-2 hover:text-black transition"
            >
              {showDescription ? '▼' : '▶'} Job Description
            </button>
            <div className={`text-sm text-slate-600 leading-relaxed ${!showDescription && descLines.length > 2 ? 'line-clamp-2' : ''}`}>
              {job.description}
            </div>
            {descLines.length > 2 && !showDescription && (
              <button
                onClick={() => setShowDescription(true)}
                className="text-xs text-slate-400 hover:text-black mt-1 transition"
              >
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
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Stage</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedCandidates.map((candidate: any) => {
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
                          {topTech.length > 0 ? topTech.map((tech: string, i: number) => (
                            <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">{tech}</span>
                          )) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {candidate._pipeline_stage ? (
                          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{candidate._pipeline_stage}</span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedCandidate(candidate as Candidate)}
                          className="text-xs font-semibold text-slate-500 hover:text-black transition"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedCandidate && (
        <CandidateDetailsModal
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          onUpdate={fetchCandidates}
        />
      )}
    </div>
  );
}
