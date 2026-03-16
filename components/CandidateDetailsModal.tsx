'use client';

import { supabase } from '@/lib/supabaseClient';
import { useState, useEffect } from 'react';
import { 
    XMarkIcon, 
    EnvelopeIcon, 
    PhoneIcon, 
    PencilSquareIcon,
    CheckIcon
} from '@heroicons/react/24/outline';

// Types (Mirrored from main dashboard for consistency)
type Tool = { name: string; years: number };
type Technology = { name: string; years: number };
type WorkHistory = { 
  company: string; 
  title: string; 
  start_date?: string; 
  end_date?: string; 
  years?: number;
  brief?: string;
};

export type Candidate = {
  id: string;
  full_name: string;
  title: string;
  location: string;
  years_experience_total: number;
  match_score: number;
  match_reason: string;
  source: string;
  lnkd_notes?: string;
  portfolio_url?: string;
  linkedin_url?: string;
  tools?: Tool[];
  technologies?: Technology[];
  skills?: string[];
  work_history?: WorkHistory[];
  email?: string;
  phone?: string;
  status?: string;
  resume_url?: string;
  resume_text?: string;
  years_experience?: number;
  last_interaction_type?: string;
  last_interaction_at?: string;
  assigned_job_title?: string;
  assigned_company_name?: string;
  candidate_interactions?: any[];
  applications?: any[];
  pipeline_stage?: string;
  pipeline_order?: number | null;
  stage_changed_at?: string;
  created_at?: string;
  brief?: string;
  education?: string;
  courses_certificates?: string;
};

export default function CandidateDetailsModal({ 
    candidate, 
    onClose, 
    onUpdate
}: { 
    candidate: Candidate; 
    onClose: () => void; 
    onUpdate: () => void;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [isEditingMatch, setIsEditingMatch] = useState(false);
    const [interactions, setInteractions] = useState<any[]>([]);
    const [loadingInteractions, setLoadingInteractions] = useState(false);
    const [newInteraction, setNewInteraction] = useState({ type: 'LinkedIn Message', content: '' });
    const [submittingInteraction, setSubmittingInteraction] = useState(false);

    const [formData, setFormData] = useState<Candidate>({
        ...candidate,
        work_history: Array.isArray(candidate.work_history) ? candidate.work_history : [],
        technologies: Array.isArray(candidate.technologies) ? candidate.technologies : [],
        tools: Array.isArray(candidate.tools) ? candidate.tools : []
    });
    const [saving, setSaving] = useState(false);
    const [savingMatch, setSavingMatch] = useState(false);

    useEffect(() => {
        if (candidate) {
            setFormData({
                ...candidate,
                work_history: Array.isArray(candidate.work_history) ? candidate.work_history : [],
                technologies: Array.isArray(candidate.technologies) ? candidate.technologies : [],
                tools: Array.isArray(candidate.tools) ? candidate.tools : []
            });
            fetchInteractions();
        }
    }, [candidate]);

    async function fetchInteractions() {
        setLoadingInteractions(true);
        const { data, error } = await supabase
          .from('candidate_interactions')
          .select('*')
          .eq('candidate_id', candidate.id)
          .order('created_at', { ascending: false });
    
        if (error) console.error('Error fetching interactions:', error);
        else setInteractions(data || []);
        setLoadingInteractions(false);
    }

    async function submitInteraction() {
        if (!newInteraction.content.trim()) return;
        setSubmittingInteraction(true);
    
        const { error } = await supabase
          .from('candidate_interactions')
          .insert({
            candidate_id: candidate.id,
            type: newInteraction.type,
            content: newInteraction.content
          });
    
        if (error) {
          alert('Error saving interaction: ' + error.message);
        } else {
          setNewInteraction({ ...newInteraction, content: '' });
          fetchInteractions();
        }
        setSubmittingInteraction(false);
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        
        const { 
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            id, 
            last_interaction_type, 
            last_interaction_at, 
            assigned_job_title, 
            assigned_company_name,
            candidate_interactions,
            applications,
            ...updateData 
        } = formData;

        const payload = {
            ...updateData,
            years_experience: Number(formData.years_experience_total) || 0,
            years_experience_total: Number(formData.years_experience_total) || 0,
            match_score: Number(formData.match_score) || 0,
            work_history: formData.work_history || [],
            technologies: formData.technologies || [],
            tools: formData.tools || []
        };

        const { error } = await supabase.from('candidates').update(payload).eq('id', candidate.id);
        
        if (!error) {
            setIsEditing(false);
            onUpdate();
        } else {
            alert('Error updating candidate: ' + error.message);
        }
        setSaving(false);
    };

    const handleSaveMatch = async () => {
        setSavingMatch(true);
        const { error } = await supabase
            .from('candidates')
            .update({ match_reason: formData.match_reason })
            .eq('id', candidate.id);
        
        if (!error) {
            setIsEditingMatch(false);
            onUpdate();
        } else {
            alert('Error updating match reason: ' + error.message);
        }
        setSavingMatch(false);
    };

    const handleChange = (field: keyof Candidate, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const addWorkHistory = () => {
        const newEntry: WorkHistory = { company: '', title: '', start_date: '', end_date: '', years: 0, brief: '' };
        setFormData(prev => ({
            ...prev,
            work_history: [...(prev.work_history || []), newEntry]
        }));
    };

    const updateWorkHistory = (index: number, field: keyof WorkHistory, value: any) => {
        const updatedHistory = [...(formData.work_history || [])];
        updatedHistory[index] = { ...updatedHistory[index], [field]: value };
        setFormData(prev => ({ ...prev, work_history: updatedHistory }));
    };

    const removeWorkHistory = (index: number) => {
        setFormData(prev => ({
            ...prev,
            work_history: (prev.work_history || []).filter((_, i) => i !== index)
        }));
    };

    const addTech = (type: 'technologies' | 'tools') => {
        const newEntry = { name: '', years: 0 };
        setFormData(prev => ({
            ...prev,
            [type]: [...(prev[type] || []), newEntry]
        }));
    };

    const updateTech = (type: 'technologies' | 'tools', index: number, field: string, value: any) => {
        const updated = [...(formData[type] || [])];
        updated[index] = { ...updated[index], [field]: value };
        setFormData(prev => ({ ...prev, [type]: updated }));
    };

    const removeTech = (type: 'technologies' | 'tools', index: number) => {
        setFormData(prev => ({
            ...prev,
            [type]: (prev[type] || []).filter((_, i) => i !== index)
        }));
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-100 p-6 flex justify-between items-center z-10">
              <div>
                {!isEditing ? (
                    <>
                        <h2 className="text-2xl font-bold text-slate-900">{formData.full_name}</h2>
                        <p className="text-slate-500">{formData.title}</p>
                        <div className="flex flex-col gap-1 mt-2 text-sm text-slate-500">
                            {formData.email && (
                                <a href={`mailto:${formData.email}`} className="flex items-center gap-2 hover:text-black transition">
                                    <EnvelopeIcon className="h-4 w-4" /> {formData.email}
                                </a>
                            )}
                            {formData.phone && (
                                <a href={`tel:${formData.phone}`} className="flex items-center gap-2 hover:text-black transition">
                                    <PhoneIcon className="h-4 w-4" /> {formData.phone}
                                </a>
                            )}
                        </div>
                    </>
                ) : (
                    <h2 className="text-xl font-bold text-slate-900">Edit Profile: {formData.full_name}</h2>
                )}
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition">
                <XMarkIcon className="h-6 w-6 text-slate-500" />
              </button>
            </div>
            
            {isEditing ? (
                <form onSubmit={handleSave} className="p-6 space-y-8">
                    {/* Basic Info Section */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Basic Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                                <input 
                                    type="text" 
                                    required
                                    className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none"
                                    value={formData.full_name}
                                    onChange={e => handleChange('full_name', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Job Title</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none"
                                    value={formData.title || ''}
                                    onChange={e => handleChange('title', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                <input 
                                    type="email" 
                                    className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none"
                                    value={formData.email || ''}
                                    onChange={e => handleChange('email', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none"
                                    value={formData.phone || ''}
                                    onChange={e => handleChange('phone', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none"
                                    value={formData.location || ''}
                                    onChange={e => handleChange('location', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Years of Experience</label>
                                <input 
                                    type="number" 
                                    className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none"
                                    value={formData.years_experience_total || 0}
                                    onChange={e => handleChange('years_experience_total', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">LinkedIn URL</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none"
                                    value={formData.linkedin_url || ''}
                                    onChange={e => handleChange('linkedin_url', e.target.value)}
                                    placeholder="https://linkedin.com/in/..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Portfolio/Behance URL</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none"
                                    value={formData.portfolio_url || ''}
                                    onChange={e => handleChange('portfolio_url', e.target.value)}
                                    placeholder="https://behance.net/..."
                                />
                            </div>
                        </div>

                        <div className="space-y-4 pt-2">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Brief about candidate</label>
                                <textarea
                                    rows={3}
                                    className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none appearance-none bg-white text-slate-800 transition duration-200 resize-y"
                                    value={formData.brief || ''}
                                    onChange={e => handleChange('brief', e.target.value)}
                                    placeholder="Short bio or summary about the candidate..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Education</label>
                                <textarea
                                    rows={2}
                                    className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none appearance-none bg-white text-slate-800 transition duration-200 resize-y"
                                    value={formData.education || ''}
                                    onChange={e => handleChange('education', e.target.value)}
                                    placeholder="e.g. BSc Computer Science, Cairo University, 2019"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Courses &amp; Certificates</h3>
                        <textarea
                            rows={3}
                            className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none appearance-none bg-white text-slate-800 transition duration-200 resize-y"
                            value={formData.courses_certificates || ''}
                            onChange={e => handleChange('courses_certificates', e.target.value)}
                            placeholder="e.g. AWS Certified Solutions Architect, 2022&#10;Google UX Design Certificate, 2021"
                        />
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b pb-2">
                            <h3 className="text-lg font-bold text-slate-800">Work History</h3>
                            <button 
                                type="button" 
                                onClick={addWorkHistory}
                                className="text-sm bg-black text-white px-3 py-1 rounded hover:bg-zinc-800 transition"
                            >
                                + Add Entry
                            </button>
                        </div>
                        <div className="space-y-4">
                            {(formData.work_history || []).map((work, idx) => (
                                <div key={idx} className="p-4 bg-slate-50 rounded-lg border border-slate-200 relative group">
                                    <button 
                                        type="button" 
                                        onClick={() => removeWorkHistory(idx)}
                                        className="absolute top-2 right-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                                    >
                                        <XMarkIcon className="h-5 w-5" />
                                    </button>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Company</label>
                                            <input 
                                                type="text" 
                                                className="w-full border border-slate-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-black outline-none"
                                                value={work.company}
                                                onChange={e => updateWorkHistory(idx, 'company', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Title</label>
                                            <input 
                                                type="text" 
                                                className="w-full border border-slate-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-black outline-none"
                                                value={work.title}
                                                onChange={e => updateWorkHistory(idx, 'title', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
                                            <input 
                                                type="text" 
                                                className="w-full border border-slate-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-black outline-none"
                                                placeholder="e.g. Jan 2020"
                                                value={work.start_date || ''}
                                                onChange={e => updateWorkHistory(idx, 'start_date', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Date</label>
                                            <input 
                                                type="text" 
                                                className="w-full border border-slate-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-black outline-none"
                                                placeholder="e.g. Present"
                                                value={work.end_date || ''}
                                                onChange={e => updateWorkHistory(idx, 'end_date', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-3">
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Brief about this role</label>
                                        <textarea
                                            rows={2}
                                            className="w-full border border-slate-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-black outline-none appearance-none bg-white transition duration-200 resize-y"
                                            placeholder="Key responsibilities or achievements in this role..."
                                            value={work.brief || ''}
                                            onChange={e => updateWorkHistory(idx, 'brief', e.target.value)}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center border-b pb-2">
                                <h3 className="text-lg font-bold text-slate-800">Technologies</h3>
                                <button 
                                    type="button" 
                                    onClick={() => addTech('technologies')}
                                    className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded hover:bg-slate-300 transition"
                                >
                                    + Add
                                </button>
                            </div>
                            <div className="space-y-2">
                                {(formData.technologies || []).map((tech, idx) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <input 
                                            type="text" 
                                            placeholder="Name"
                                            className="flex-grow border border-slate-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-black outline-none"
                                            value={tech.name}
                                            onChange={e => updateTech('technologies', idx, 'name', e.target.value)}
                                        />
                                        <input 
                                            type="number" 
                                            placeholder="Yrs"
                                            className="w-16 border border-slate-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-black outline-none"
                                            value={tech.years}
                                            onChange={e => updateTech('technologies', idx, 'years', e.target.value)}
                                        />
                                        <button type="button" onClick={() => removeTech('technologies', idx)} className="text-slate-400 hover:text-red-500 transition">
                                            <XMarkIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center border-b pb-2">
                                <h3 className="text-lg font-bold text-slate-800">Tools</h3>
                                <button 
                                    type="button" 
                                    onClick={() => addTech('tools')}
                                    className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded hover:bg-slate-300 transition"
                                >
                                    + Add
                                </button>
                            </div>
                            <div className="space-y-2">
                                {(formData.tools || []).map((tool, idx) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <input 
                                            type="text" 
                                            placeholder="Name"
                                            className="flex-grow border border-slate-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-black outline-none"
                                            value={tool.name}
                                            onChange={e => updateTech('tools', idx, 'name', e.target.value)}
                                        />
                                        <input 
                                            type="number" 
                                            placeholder="Yrs"
                                            className="w-16 border border-slate-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-black outline-none"
                                            value={tool.years}
                                            onChange={e => updateTech('tools', idx, 'years', e.target.value)}
                                        />
                                        <button type="button" onClick={() => removeTech('tools', idx)} className="text-slate-400 hover:text-red-500 transition">
                                            <XMarkIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Original Resume Text (Reference)</h3>
                        <textarea 
                            readOnly 
                            className="w-full bg-slate-50 border border-slate-200 rounded-md p-4 text-xs font-mono text-slate-600 min-h-[300px] outline-none"
                            value={formData.resume_text || 'No resume text available.'}
                        ></textarea>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                        <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-md transition">Cancel</button>
                        <button type="submit" disabled={saving} className="px-6 py-2 bg-black text-white font-semibold rounded-md hover:bg-zinc-800 transition disabled:opacity-50">
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="p-6 space-y-8">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Score</div>
                            <div className="text-xl font-bold text-slate-900">{formData.match_score}%</div>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Exp</div>
                            <div className="text-xl font-bold text-slate-900">{formData.years_experience_total || 0} Yrs</div>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Location</div>
                            <div className="text-lg font-bold text-slate-900 truncate" title={formData.location}>{formData.location}</div>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Source</div>
                            <div className="text-lg font-bold text-slate-900 capitalize">{formData.source}</div>
                        </div>
                    </div>

                    <div className="group relative">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold text-slate-900">Why they match</h3>
                            {!isEditingMatch && (
                                <button 
                                    onClick={() => setIsEditingMatch(true)}
                                    className="text-[10px] font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition uppercase tracking-widest"
                                >
                                    Edit Reason
                                </button>
                            )}
                        </div>
                        {isEditingMatch ? (
                            <div className="space-y-3 animate-in fade-in duration-200">
                                <textarea 
                                    value={formData.match_reason}
                                    onChange={e => handleChange('match_reason', e.target.value)}
                                    className="w-full border border-slate-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-black outline-none min-h-[100px] shadow-inner bg-white"
                                    placeholder="Explain why this candidate matches the role..."
                                />
                                <div className="flex justify-end gap-2">
                                    <button 
                                        onClick={() => {
                                            setIsEditingMatch(false);
                                            setFormData(prev => ({ ...prev, match_reason: candidate.match_reason }));
                                        }}
                                        className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded transition"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={handleSaveMatch}
                                        disabled={savingMatch}
                                        className="bg-black text-white px-4 py-1.5 rounded text-xs font-bold hover:bg-zinc-800 transition flex items-center gap-1.5 disabled:opacity-50"
                                    >
                                        {savingMatch ? '...' : <><CheckIcon className="h-3.5 w-3.5" /> Save Reason</>}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-slate-600 bg-blue-50/50 p-4 rounded-lg border border-blue-100 leading-relaxed">
                                {formData.match_reason || 'No match justification provided.'}
                            </p>
                        )}
                    </div>

                    {formData.brief && (
                        <div>
                            <h3 className="font-bold text-slate-900 mb-2">About</h3>
                            <p className="text-slate-600 bg-slate-50 p-4 rounded-lg border border-slate-100 whitespace-pre-wrap">{formData.brief}</p>
                        </div>
                    )}

                    <div>
                        <h3 className="font-bold text-slate-900 mb-2">Tech Stack / Skills</h3>
                        <div className="flex flex-wrap gap-2">
                            {formData.technologies?.map((t, i) => (
                                <span key={i} className="bg-slate-100 px-3 py-1 rounded-full text-sm border border-slate-200">
                                    {t.name} <span className="text-slate-400 text-xs ml-1">({t.years}y)</span>
                                </span>
                            ))}
                            {formData.tools?.map((t, i) => (
                                <span key={i} className="bg-white px-3 py-1 rounded-full text-sm border border-slate-200 shadow-sm">
                                    {t.name} <span className="text-slate-400 text-xs ml-1">({t.years}y)</span>
                                </span>
                            ))}
                        </div>
                    </div>

                    {formData.work_history && formData.work_history.length > 0 && (
                        <div>
                            <h3 className="font-bold text-slate-900 mb-2">Work History</h3>
                            <div className="space-y-4">
                                {formData.work_history.map((job, i) => (
                                    <div key={i} className="border-b border-slate-100 pb-3 last:border-0">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="font-bold text-slate-800">{job.company}</div>
                                                <div className="text-sm text-slate-600">{job.title}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-semibold text-slate-500">{job.start_date} - {job.end_date}</div>
                                            </div>
                                        </div>
                                        {job.brief && <p className="mt-2 text-sm text-slate-500 italic bg-slate-50 px-3 py-2 rounded-md border border-slate-100 whitespace-pre-wrap">{job.brief}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="pt-6 border-t border-slate-100">
                        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">💬 Interaction Timeline</h3>
                        <div className="bg-white p-2.5 rounded-lg border border-slate-100 mb-6 shadow-sm">
                            <div className="flex flex-col sm:flex-row gap-2.5 mb-2">
                                <select 
                                    className="sm:w-1/3 border border-slate-200 rounded text-sm p-1.5 outline-none focus:ring-1 focus:ring-black bg-slate-50"
                                    value={newInteraction.type}
                                    onChange={e => setNewInteraction({...newInteraction, type: e.target.value})}
                                >
                                    <option>LinkedIn</option>
                                    <option>Email</option>
                                    <option>Call</option>
                                    <option>Interview</option>
                                    <option>Offer</option>
                                    <option>Feedback</option>
                                </select>
                                <textarea 
                                    className="sm:w-2/3 flex-grow border border-slate-200 rounded text-sm p-1.5 outline-none focus:ring-1 focus:ring-black min-h-[36px]"
                                    placeholder="Quick notes..."
                                    value={newInteraction.content}
                                    onChange={e => setNewInteraction({...newInteraction, content: e.target.value})}
                                />
                            </div>
                            <div className="flex justify-end">
                                <button 
                                    onClick={submitInteraction}
                                    disabled={submittingInteraction || !newInteraction.content.trim()}
                                    className="bg-black text-white px-5 py-1 rounded text-xs font-bold hover:bg-zinc-800 transition disabled:opacity-50"
                                >
                                    {submittingInteraction ? '...' : 'Log Interaction'}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {loadingInteractions ? (
                                <div className="text-center py-4 text-slate-400 text-sm animate-pulse">Loading history...</div>
                            ) : interactions.length > 0 ? (
                                interactions.map((it) => (
                                    <div key={it.id} className="flex gap-4 relative">
                                        <div className="w-px bg-slate-200 absolute left-2.5 top-8 bottom-0"></div>
                                        <div className="h-5 w-5 rounded-full bg-slate-200 shrink-0 mt-1.5 flex items-center justify-center text-[10px] z-10">💬</div>
                                        <div className="pb-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{it.type}</span>
                                                <span className="text-[10px] text-slate-400 font-medium">{new Date(it.created_at).toLocaleString()}</span>
                                            </div>
                                            <p className="text-sm text-slate-600 whitespace-pre-wrap">{it.content}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center py-8 text-slate-400 text-sm italic">No interactions logged yet.</p>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button onClick={() => setIsEditing(true)} className="flex-1 bg-white border border-slate-300 text-slate-700 text-center py-2.5 rounded-lg font-semibold hover:bg-slate-50 transition flex items-center justify-center gap-2">
                            <PencilSquareIcon className="h-5 w-5" /> Edit Profile
                        </button>
                    </div>
                </div>
            )}
          </div>
        </div>
    );
}
