'use client';

import { supabase } from '@/lib/supabaseClient';
import { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, XMarkIcon, CheckBadgeIcon, BriefcaseIcon, CloudArrowUpIcon, TrashIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';

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

export default function SourcingPage() {
  const [jd, setJd] = useState('');
  const [internalMatches, setInternalMatches] = useState<Candidate[]>([]);
  const [sourcedQueue, setSourcedQueue] = useState<Candidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSourcing, setIsSourcing] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [activeTab, setActiveTab] = useState<'internal' | 'sourced'>('internal');

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

  async function findInternalMatches() {
    if (!jd.trim()) return;
    setIsMatching(true);
    
    // Simple mock matching logic for now - later we can use pgvector or OpenAI embeddings
    const { data, error } = await supabase
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
      // 1. Move to candidates table
      const { id, ...candidateData } = c;
      const { error: insertError } = await supabase.from('candidates').insert({
          ...candidateData,
          status: 'Lead' // Initial status after approval
      });
      
      if (!insertError) {
        // 2. Delete from unvetted table
        await supabase.from('unvetted').delete().eq('id', c.id);
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left: Job Description Input */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm sticky top-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <BriefcaseIcon className="h-5 w-5 text-indigo-600" /> Job Description
            </h2>
            <textarea 
              className="w-full h-64 p-4 border border-slate-200 rounded-lg focus:ring-2 focus:ring-black outline-none text-sm leading-relaxed mb-4"
              placeholder="Paste the Job Description here to find matching talent..."
              value={jd}
              onChange={(e) => setJd(e.target.value)}
            ></textarea>
            <div className="flex flex-col gap-3">
              <button 
                onClick={findInternalMatches}
                disabled={isMatching || !jd.trim()}
                className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-black transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isMatching ? 'Matching...' : 'Match Internal Talent'}
              </button>
              <button 
                disabled={true} // Logic to be implemented (OpenClaw search)
                className="w-full bg-white border border-slate-300 text-slate-700 py-3 rounded-lg font-bold hover:bg-slate-50 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CloudArrowUpIcon className="h-5 w-5" /> Source New Talent
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
              {activeTab === 'internal' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black"></div>}
            </button>
            <button 
              onClick={() => setActiveTab('sourced')}
              className={`px-6 py-3 font-bold text-sm transition-colors relative ${activeTab === 'sourced' ? 'text-black' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Sourced Queue ({sourcedQueue.length})
              {activeTab === 'sourced' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black"></div>}
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
                      <th className="px-6 py-4 w-10"></th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Candidate Info</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Skills Found</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sourcedQueue.map(c => (
                      <tr key={c.id} className={`hover:bg-slate-50/50 transition cursor-pointer ${selectedIds.includes(c.id) ? 'bg-indigo-50/30' : ''}`} onClick={() => toggleSelect(c.id)}>
                        <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            className="h-4 w-4 rounded border-slate-300"
                            checked={selectedIds.includes(c.id)}
                            onChange={() => toggleSelect(c.id)}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900">{c.full_name}</div>
                          <div className="text-xs text-slate-500">{c.title}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{c.location}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {c.skills?.slice(0, 3).map((s, i) => (
                              <span key={i} className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 border border-slate-200">{s}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                            {c.source}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {sourcedQueue.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                          The sourced queue is empty.
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
