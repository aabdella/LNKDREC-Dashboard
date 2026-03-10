'use client';

import { supabase } from '@/lib/supabaseClient';
import { useState, useEffect } from 'react';
import { BriefcaseIcon, PlusIcon, MapPinIcon, XMarkIcon, PencilIcon, UserIcon, FunnelIcon } from '@heroicons/react/24/outline';

type Client = {
    id: string;
    name: string;
    industry: string;
};

type Job = {
    id: string;
    client_id: string;
    title: string;
    location: string;
    status: string;
    description: string;
    total_openings: number;
    remaining_openings?: number;
    clients?: Client; // joined
    application_count?: number;
};

export default function JobsPage() {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterClientId, setFilterClientId] = useState<string>('all');
    
    // Modals
    const [showClientModal, setShowClientModal] = useState(false);
    const [showJobModal, setShowJobModal] = useState(false);
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [editingJob, setEditingJob] = useState<Job | null>(null);
    const [assignedCandidates, setAssignedCandidates] = useState<any[]>([]);
    const [loadingCandidates, setLoadingCandidates] = useState(false);

    // Form Data
    const [newClient, setNewClient] = useState({ name: '', industry: '' });
    const [newJob, setNewJob] = useState({ client_id: '', title: '', location: 'Remote', description: '', status: 'Open', total_openings: 1 });

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchAssignedCandidates(jobId: string) {
        setLoadingCandidates(true);
        // We only want to show candidates who are NOT rejected.
        // If they are in the 'applications' table, they were assigned.
        // We join with candidates to check their 'status' or 'pipeline_stage'.
        const { data, error } = await supabase
            .from('applications')
            .select('candidate_id, candidates(id, full_name, title, location, status, pipeline_stage)')
            .eq('job_id', jobId);

        if (data) {
            // Filter out candidates who are already rejected (unassigned should already be gone from this table)
            const formatted = data
                .map((d: any) => d.candidates)
                .filter((c: any) => c && c.pipeline_stage !== 'Rejected');
            setAssignedCandidates(formatted);
        }
        setLoadingCandidates(false);
    }

    async function fetchData() {
        setLoading(true);
        // Fetch Jobs with Client info
        const { data: jobsData } = await supabase
            .from('jobs')
            .select('*, clients(name, industry), applications(count, candidates(status))')
            .order('created_at', { ascending: false });
        
        // Fetch Clients for dropdown
        const { data: clientsData } = await supabase.from('clients').select('*').order('name');

        if (jobsData) {
            // Map count correctly
            const mappedJobs = jobsData.map((j: any) => {
                // Deduct hired candidates from total_openings for the "Needs" count
                const hiredCount = j.applications?.filter((a: any) => a.candidates?.status === 'Hired').length || 0;
                const remainingOpenings = Math.max(0, (j.total_openings || 1) - hiredCount);

                return {
                    ...j,
                    application_count: j.applications ? j.applications.length : 0,
                    remaining_openings: remainingOpenings
                };
            });
            setJobs(mappedJobs);
        }
        if (clientsData) setClients(clientsData);
        setLoading(false);
    }

    async function handleCreateClient(e: React.FormEvent) {
        e.preventDefault();
        const { error } = await supabase.from('clients').insert(newClient);
        if (!error) {
            setShowClientModal(false);
            setNewClient({ name: '', industry: '' });
            fetchData();
        } else {
            alert(error.message);
        }
    }

    async function handleCreateJob(e: React.FormEvent) {
        e.preventDefault();
        const { error } = await supabase.from('jobs').insert(newJob);
        if (!error) {
            setShowJobModal(false);
            setNewJob({ client_id: '', title: '', location: 'Remote', description: '', status: 'Open', total_openings: 1 });
            fetchData();
        } else {
            alert(error.message);
        }
    }

    async function handleUpdateJob(e: React.FormEvent) {
        e.preventDefault();
        if (!editingJob) return;

        const { error } = await supabase
            .from('jobs')
            .update({
                title: editingJob.title,
                location: editingJob.location,
                status: editingJob.status,
                description: editingJob.description,
                total_openings: editingJob.total_openings
            })
            .eq('id', editingJob.id);

        if (!error) {
            setEditingJob(null);
            fetchData();
        } else {
            alert(error.message);
        }
    }

    const filteredJobs = filterClientId === 'all' 
        ? jobs 
        : jobs.filter(j => j.client_id === filterClientId);

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Active Jobs</h1>
                    <p className="text-slate-500">Manage clients and open positions</p>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    {/* Company Filter Dropdown */}
                    <div className="relative w-full sm:w-64 group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FunnelIcon className="h-4 w-4 text-slate-400" />
                        </div>
                        <select 
                            value={filterClientId}
                            onChange={(e) => setFilterClientId(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold bg-white text-slate-700 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-black transition shadow-sm appearance-none cursor-pointer"
                        >
                            <option value="all">All Companies</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                            <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>

                    <div className="flex gap-3 w-full sm:w-auto">
                        <button 
                            onClick={() => setShowClientModal(true)}
                            className="flex-1 sm:flex-none px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 font-medium bg-white transition shadow-sm"
                        >
                            + New Client
                        </button>
                        <button 
                            onClick={() => setShowJobModal(true)}
                            className="flex-1 sm:flex-none px-4 py-2 bg-black text-white rounded-md hover:bg-zinc-800 font-medium flex items-center justify-center gap-2 transition shadow-sm"
                        >
                            <PlusIcon className="h-5 w-5" /> Post Job
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20 text-slate-400 animate-pulse">Loading jobs...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredJobs.map(job => (
                        <div key={job.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition group relative overflow-hidden animate-in fade-in duration-300">
                            {/* Openings Indicator */}
                            <div className="absolute top-0 right-0 p-2">
                                <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-full px-2 py-0.5 shadow-sm">
                                    <UserIcon className="h-3 w-3 text-slate-400" />
                                    <span className="text-[10px] font-bold text-slate-600">Needs {job.remaining_openings !== undefined ? job.remaining_openings : (job.total_openings || 1)}</span>
                                </div>
                            </div>

                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-lg text-slate-900 leading-tight pr-8">{job.title}</h3>
                                        <button 
                                            onClick={() => setEditingJob({...job})}
                                            className="opacity-0 group-hover:opacity-100 transition p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600"
                                        >
                                            <PencilIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <p className="text-slate-500 text-sm font-medium">{job.clients?.name}</p>
                                </div>
                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${job.status.toLowerCase() === 'open' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {job.status}
                                </span>
                            </div>
                            
                            <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
                                <span className="flex items-center gap-1">
                                    <MapPinIcon className="h-3 w-3" /> {job.location}
                                </span>
                                <span className="flex items-center gap-1">
                                    <BriefcaseIcon className="h-3 w-3" /> {job.clients?.industry || 'General'}
                                </span>
                            </div>

                            <div className="border-t border-slate-100 pt-4 flex justify-between items-center">
                                <span className="text-xs text-slate-400 font-medium">
                                    {job.application_count || 0} Candidates Assigned
                                </span>
                                <button 
                                    onClick={() => {
                                        setSelectedJob(job);
                                        fetchAssignedCandidates(job.id);
                                    }}
                                    className="text-black text-sm font-semibold hover:underline"
                                >
                                    View Details
                                </button>
                            </div>
                        </div>
                    ))}
                    
                    {filteredJobs.length === 0 && (
                        <div className="col-span-full text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                            <h3 className="text-slate-900 font-medium mb-1">No Jobs Found</h3>
                            <p className="text-slate-500 text-sm mb-4">Try clearing your filters or posting a new job.</p>
                            <button onClick={() => setFilterClientId('all')} className="text-blue-600 hover:underline text-sm font-semibold">Clear Filters</button>
                        </div>
                    )}
                </div>
            )}

            {/* Client Modal */}
            {showClientModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowClientModal(false)}>
                    <div className="bg-white p-6 rounded-xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">Add New Client</h2>
                            <button onClick={() => setShowClientModal(false)}><XMarkIcon className="h-6 w-6 text-slate-500" /></button>
                        </div>
                        <form onSubmit={handleCreateClient} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-700">Client Name</label>
                                <input 
                                    className="w-full border border-slate-300 p-2 rounded focus:ring-2 focus:ring-black outline-none" 
                                    value={newClient.name} 
                                    onChange={e => setNewClient({...newClient, name: e.target.value})} 
                                    placeholder="e.g. Al-Rifai" 
                                    required 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-700">Industry</label>
                                <input 
                                    className="w-full border border-slate-300 p-2 rounded focus:ring-2 focus:ring-black outline-none" 
                                    value={newClient.industry} 
                                    onChange={e => setNewClient({...newClient, industry: e.target.value})} 
                                    placeholder="e.g. FMCG" 
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setShowClientModal(false)} className="text-slate-600 hover:bg-slate-100 px-4 py-2 rounded font-medium transition">Cancel</button>
                                <button type="submit" className="bg-black text-white px-6 py-2 rounded hover:bg-zinc-800 font-bold shadow-sm transition">Create Client</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Post Job Modal */}
            {showJobModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowJobModal(false)}>
                    <div className="bg-white p-6 rounded-xl shadow-2xl max-w-lg w-full animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">Post New Job</h2>
                            <button onClick={() => setShowJobModal(false)}><XMarkIcon className="h-6 w-6 text-slate-500" /></button>
                        </div>
                        <form onSubmit={handleCreateJob} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-700">Client</label>
                                <select 
                                    className="w-full border border-slate-300 p-2 rounded focus:ring-2 focus:ring-black outline-none bg-white text-sm" 
                                    value={newJob.client_id} 
                                    onChange={e => setNewJob({...newJob, client_id: e.target.value})} 
                                    required
                                >
                                    <option value="">Select Client...</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700">Job Title</label>
                                    <input 
                                        className="w-full border border-slate-300 p-2 rounded focus:ring-2 focus:ring-black outline-none text-sm" 
                                        value={newJob.title} 
                                        onChange={e => setNewJob({...newJob, title: e.target.value})} 
                                        placeholder="e.g. Senior Graphic Designer" 
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700">Openings (Resources)</label>
                                    <input 
                                        type="number"
                                        min="1"
                                        className="w-full border border-slate-300 p-2 rounded focus:ring-2 focus:ring-black outline-none text-sm" 
                                        value={newJob.total_openings} 
                                        onChange={e => setNewJob({...newJob, total_openings: parseInt(e.target.value) || 1})} 
                                        required 
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-700">Location</label>
                                <select 
                                    className="w-full border border-slate-300 p-2 rounded focus:ring-2 focus:ring-black outline-none bg-white text-sm" 
                                    value={newJob.location} 
                                    onChange={e => setNewJob({...newJob, location: e.target.value})}
                                >
                                    <option>Remote</option>
                                    <option>Hybrid</option>
                                    <option>OnSite (UAE)</option>
                                    <option>OnSite (KSA)</option>
                                    <option>OnSite (Egypt)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-700">Description</label>
                                <textarea 
                                    className="w-full border border-slate-300 p-2 rounded h-24 focus:ring-2 focus:ring-black outline-none text-sm" 
                                    value={newJob.description} 
                                    onChange={e => setNewJob({...newJob, description: e.target.value})} 
                                    placeholder="Job requirements..." 
                                    required 
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setShowJobModal(false)} className="text-slate-600 hover:bg-slate-100 px-4 py-2 rounded font-medium transition">Cancel</button>
                                <button type="submit" className="bg-black text-white px-6 py-2 rounded hover:bg-zinc-800 font-bold shadow-sm transition">Post Job</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Job Modal */}
            {editingJob && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setEditingJob(null)}>
                    <div className="bg-white p-6 rounded-xl shadow-2xl max-w-lg w-full animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-bold">Edit Job Details</h2>
                                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{editingJob.clients?.name}</p>
                            </div>
                            <button onClick={() => setEditingJob(null)}><XMarkIcon className="h-6 w-6 text-slate-500" /></button>
                        </div>
                        <form onSubmit={handleUpdateJob} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Job Title</label>
                                    <input 
                                        className="w-full border border-slate-200 p-2 rounded bg-slate-50 focus:ring-2 focus:ring-black outline-none font-bold text-sm" 
                                        value={editingJob.title} 
                                        onChange={e => setEditingJob({...editingJob, title: e.target.value})} 
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</label>
                                    <select 
                                        className="w-full border border-slate-200 p-2 rounded bg-slate-50 focus:ring-2 focus:ring-black outline-none font-bold text-sm" 
                                        value={editingJob.status} 
                                        onChange={e => setEditingJob({...editingJob, status: e.target.value})}
                                    >
                                        <option value="Open">Open</option>
                                        <option value="Closed">Closed</option>
                                        <option value="On Hold">On Hold</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Location</label>
                                    <select 
                                        className="w-full border border-slate-200 p-2 rounded bg-slate-50 focus:ring-2 focus:ring-black outline-none font-bold text-sm" 
                                        value={editingJob.location} 
                                        onChange={e => setEditingJob({...editingJob, location: e.target.value})}
                                    >
                                        <option>Remote</option>
                                        <option>Hybrid</option>
                                        <option>OnSite (UAE)</option>
                                        <option>OnSite (KSA)</option>
                                        <option>OnSite (Egypt)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Openings</label>
                                    <input 
                                        type="number"
                                        min="1"
                                        className="w-full border border-slate-200 p-2 rounded bg-slate-50 focus:ring-2 focus:ring-black outline-none font-bold text-sm" 
                                        value={editingJob.total_openings} 
                                        onChange={e => setEditingJob({...editingJob, total_openings: parseInt(e.target.value) || 1})} 
                                        required 
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Description</label>
                                <textarea 
                                    className="w-full border border-slate-200 p-2 rounded h-32 bg-slate-50 focus:ring-2 focus:ring-black outline-none text-sm leading-relaxed" 
                                    value={editingJob.description} 
                                    onChange={e => setEditingJob({...editingJob, description: e.target.value})} 
                                    required 
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-8">
                                <button type="button" onClick={() => setEditingJob(null)} className="text-slate-600 hover:bg-slate-100 px-4 py-2 rounded font-medium transition">Cancel</button>
                                <button type="submit" className="bg-black text-white px-8 py-2 rounded hover:bg-zinc-800 font-bold shadow-md transition">Update Job</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Job Details Modal */}
            {selectedJob && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedJob(null)}>
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">{selectedJob.title}</h2>
                                <p className="text-slate-500 font-medium text-sm">{selectedJob.clients?.name} • {selectedJob.location}</p>
                            </div>
                            <button onClick={() => setSelectedJob(null)} className="p-1 hover:bg-slate-100 rounded-full transition">
                                <XMarkIcon className="h-6 w-6 text-slate-500" />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-grow space-y-8">
                            <div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Job Description</h3>
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                                    {selectedJob.description}
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Matched Candidates</h3>
                                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">Needs {selectedJob.total_openings}</span>
                                    </div>
                                    <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                                        {assignedCandidates.length} Active
                                    </span>
                                </div>

                                {loadingCandidates ? (
                                    <div className="text-center py-10 text-slate-400 text-sm animate-pulse">Fetching candidate list...</div>
                                ) : assignedCandidates.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {assignedCandidates.map(c => (
                                            <div key={c.id} className="p-4 rounded-lg border border-slate-100 bg-white shadow-sm flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200 text-lg">
                                                    👤
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-bold text-slate-900 text-sm truncate">{c.full_name}</div>
                                                    <div className="text-[10px] text-slate-500 truncate">{c.title}</div>
                                                    <div className="text-[9px] text-slate-400">{c.location}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-sm text-slate-400 italic">
                                        No candidates assigned to this role yet.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
                            <button 
                                onClick={() => setSelectedJob(null)}
                                className="px-6 py-2 bg-black text-white rounded-md font-bold text-sm hover:bg-zinc-800 transition shadow-sm"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
